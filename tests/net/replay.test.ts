import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { callName } from '../../src/net/calls';
import { RpcReader } from '../../src/net/codec';

/**
 * Replay tests against REAL captured traffic from the original Flash
 * client (`../server/logs.txt`, written by the local backend's request
 * log). Machine-local: skipped when the log file is absent.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGS = path.resolve(HERE, '..', '..', '..', 'server', 'logs.txt');
const present = fs.existsSync(LOGS);

interface CapturedRpc {
  body: Uint8Array;
}

function captureRpcBodies(): CapturedRpc[] {
  const text = fs.readFileSync(LOGS, 'utf8');
  const blocks = text.split(/=+\r?\n/);
  const out: CapturedRpc[] = [];
  for (const block of blocks) {
    if (!block.includes('POST /g/rpc/cooking')) continue;
    const hexMatch = block.match(/body\.hex:\r?\n([0-9a-f]+)/);
    if (!hexMatch || hexMatch[1] === undefined) continue;
    const hex = hexMatch[1].trim();
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    out.push({ body: bytes });
  }
  return out;
}

/** Parses a captured request envelope: encap, type, session, then batch info. */
function parseCapturedRequest(body: Uint8Array) {
  const r = new RpcReader(body);
  const encap = r.readU8();
  const type = r.readU8();
  const session = r.readString();
  if (type !== 255) {
    return { encap, type, name: callName(type), session, args: r.rest() };
  }
  const mode = r.readU8();
  const count = r.readVarint();
  const subs: { type: number; name: string; len: number; body: Uint8Array }[] = [];
  for (let i = 0; i < count; i += 1) {
    const subType = r.readU8();
    const subBody = r.readBytes();
    subs.push({ type: subType, name: callName(subType), len: subBody.length, body: subBody });
  }
  return { encap, type, name: callName(type), session, mode, subs, done: r.isDone() };
}

describe.skipIf(!present)('replay: real client traffic (server/logs.txt)', () => {
  it('parses every captured RPC request without errors', () => {
    const bodies = captureRpcBodies();
    expect(bodies.length).toBeGreaterThan(3);
    for (const { body } of bodies) {
      const req = parseCapturedRequest(body);
      expect(req.encap).toBe(0);
      expect(req.name).not.toBe('type_0');
    }
  });

  it('contains the boot handshake batch [getServerTime, init]', () => {
    const batches = captureRpcBodies()
      .map(({ body }) => parseCapturedRequest(body))
      .filter((r) => r.type === 255 && 'subs' in r);
    const handshake = batches.find(
      (b) => b.subs.length === 2 && b.subs[0]?.type === 249 && b.subs[1]?.type === 1,
    );
    expect(handshake, 'expected a 249+1 handshake batch').toBeTruthy();
  });

  it('contains the main data batch [249,3,2,248,20,246,44]', () => {
    const batches = captureRpcBodies()
      .map(({ body }) => parseCapturedRequest(body))
      .filter((r) => r.type === 255 && 'subs' in r);
    const main = batches.find((b) => {
      const types = b.subs.map((s) => s.type);
      return JSON.stringify(types) === JSON.stringify([249, 3, 2, 248, 20, 246, 44]);
    });
    expect(main, 'expected the 7-call main data batch').toBeTruthy();
    if (main) {
      // getPricepoints (246) carries a 1-byte body in the real capture.
      const pricepoints = main.subs.find((s) => s.type === 246);
      expect(pricepoints?.len).toBe(1);
    }
  });

  it('all captured batches parse to their exact declared length', () => {
    for (const { body } of captureRpcBodies()) {
      const req = parseCapturedRequest(body);
      if (req.type === 255 && 'done' in req) {
        expect(req.done, 'batch must consume its declared bytes').toBe(true);
      }
    }
  });
});

if (!present) {
  console.warn('[replay] server/logs.txt not found — real-traffic replay tests skipped');
}
