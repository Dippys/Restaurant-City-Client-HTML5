/**
 * Browser RPC client for the PlayFish binary protocol (docs/05).
 *
 * Auth: the backend authenticates via the session cookie and rejects
 * unauthenticated RPC with HTTP 401 — callers surface that as RpcError
 * with status 401 and the UI redirects to /login.
 */
import { callName } from './calls';
import { RpcError, RpcReader, RpcWriter } from './codec';

export interface RpcSubRequest {
  readonly type: number;
  readonly body: Uint8Array;
}

export interface RpcSubResponse {
  readonly type: number;
  readonly name: string;
  readonly body: Uint8Array;
}

const BATCH_CONDITIONAL = 3;

export class RpcClient {
  private sessionId = '';

  constructor(private readonly endpoint: string = '/g/rpc/cooking') {}

  getSessionId(): string {
    return this.sessionId;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  private async post(bytes: Uint8Array): Promise<Uint8Array> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes,
      credentials: 'same-origin',
    });
    if (response.status === 401) {
      throw new RpcError('Authentication required — log in first', 401);
    }
    if (!response.ok) {
      throw new RpcError(`HTTP ${response.status}`, response.status);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  /** Single call: returns the response body bytes (encapsulation stripped). */
  async sendSingle(type: number, body: Uint8Array = new Uint8Array(0)): Promise<Uint8Array> {
    const w = new RpcWriter();
    w.writeU8(0);
    w.writeU8(type);
    w.writeString(this.sessionId);
    // Single-call args are RAW after the session string (server
    // parseRequest keeps the remainder as `args`) — no length prefix.
    w.writeRaw(body);
    const response = await this.post(w.bytes());
    const r = new RpcReader(response);
    r.readU8(); // encapsulation
    const respType = r.readU8();
    const rest = r.rest();
    if (respType === 0) {
      const reason = rest.length > 0 ? (rest[0] ?? 0) : 0;
      throw new RpcError(`RPC error (${callName(type)}), reason ${reason}`, undefined, reason);
    }
    if (respType !== type) {
      throw new RpcError(`unexpected response type ${respType} for ${callName(type)}`);
    }
    return rest;
  }

  /** Batch call: sub-responses come back in request order. */
  async sendBatch(subs: readonly RpcSubRequest[], mode = BATCH_CONDITIONAL): Promise<RpcSubResponse[]> {
    const w = new RpcWriter();
    w.writeU8(0);
    w.writeU8(255);
    w.writeString(this.sessionId);
    w.writeU8(mode);
    w.writeVarint(subs.length);
    for (const sub of subs) {
      w.writeU8(sub.type);
      w.writeVarint(sub.body.length);
      // Body bytes follow the length raw — writeBytes would prefix AGAIN.
      w.writeRaw(sub.body);
    }
    const response = await this.post(w.bytes());
    const r = new RpcReader(response);
    r.readU8(); // encapsulation
    const respType = r.readU8();
    if (respType !== 255) {
      if (respType === 0) {
        const rest = r.rest();
        const reason = rest.length > 0 ? (rest[0] ?? 0) : 0;
        throw new RpcError(`batch rejected, reason ${reason}`, undefined, reason);
      }
      throw new RpcError(`unexpected batch response type ${respType}`);
    }
    const count = r.readVarint();
    const out: RpcSubResponse[] = [];
    for (let i = 0; i < count; i += 1) {
      const subType = r.readU8();
      const body = r.readBytes();
      if (subType === 0 && body.length === 0) {
        const req = subs[i];
        const name = req !== undefined ? callName(req.type) : `sub#${i}`;
        throw new RpcError(`sub-call failed: ${name}`);
      }
      out.push({ type: subType, name: callName(subType), body });
    }
    if (!r.isDone()) {
      throw new RpcError('trailing bytes after batch response');
    }
    return out;
  }

  /** Handshake: getServerTime + init; adopts a non-empty init session id. */
  async handshake(): Promise<number> {
    // The original client retries init up to 2 more times on failure
    // (GameInitLoader.as L163-182) — first-init server work can race.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const responses = await this.sendBatch([
          { type: 249, body: new Uint8Array(0) },
          { type: 1, body: new Uint8Array(0) },
        ]);
        const timeResp = responses[0];
        const initResp = responses[1];
        if (timeResp === undefined || initResp === undefined) {
          throw new RpcError('handshake batch returned too few responses');
        }
        const time = new RpcReader(timeResp.body).readDate();
        const session = new RpcReader(initResp.body).readString();
        if (session.length > 0) {
          this.sessionId = session;
        }
        return time;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new RpcError(`handshake failed: ${String(lastError)}`);
  }
}
