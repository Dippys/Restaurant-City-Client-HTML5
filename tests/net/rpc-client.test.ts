import { afterEach, describe, expect, it, vi } from 'vitest';
import { RpcClient } from '../../src/net/rpc-client';
import { RpcReader, RpcWriter } from '../../src/net/codec';

/**
 * Envelope-building regression tests with a mocked fetch — pins the exact
 * request bytes (a double length-prefix bug slipped through here because
 * the e2e tests hand-built envelopes instead of using RpcClient).
 */

const requests: { url: string; body: Uint8Array }[] = [];
let respond: (body: Uint8Array) => Uint8Array = () => new Uint8Array(0);

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

afterEach(() => {
  requests.length = 0;
  vi.unstubAllGlobals();
});

describe('RpcClient envelope building', () => {
  it('handshake request bytes match the wire exactly', async () => {
    // Response: 00 ff 02 | f9 05 <date> | 01 01 00
    respond = () => {
      const w = new RpcWriter();
      w.writeU8(0);
      w.writeU8(255);
      w.writeVarint(2);
      w.writeU8(249);
      w.writeVarint(5);
      w.writeRaw(new Uint8Array([0x86, 0xd4, 0x91, 0xf5, 0x1e]));
      w.writeU8(1);
      w.writeVarint(1);
      w.writeRaw(new Uint8Array([0x00]));
      return w.bytes();
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests.push({ url: String(_url), body: new Uint8Array((init?.body as Uint8Array) ?? []) });
        return new Response(respond(new Uint8Array(0)), { status: 200 });
      }),
    );

    const client = new RpcClient('/g/rpc/cooking');
    const time = await client.handshake();
    expect(time).toBeGreaterThan(1000000000);
    expect(requests).toHaveLength(1);
    // 00 ff 00(session '') 03(mode) 02(count) f9 00 | 01 00 — no extra len bytes.
    expect(hex(requests[0]?.body ?? new Uint8Array(0))).toBe('00 ff 00 03 02 f9 00 01 00');
  });

  it('sendBatch writes one length per sub and parses ordered responses', async () => {
    respond = () => {
      const w = new RpcWriter();
      w.writeU8(0);
      w.writeU8(255);
      w.writeVarint(2);
      w.writeU8(249);
      w.writeVarint(1);
      w.writeRaw(new Uint8Array([0x01]));
      w.writeU8(3);
      w.writeVarint(2);
      w.writeRaw(new Uint8Array([0xaa, 0xbb]));
      return w.bytes();
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests.push({ url: String(_url), body: new Uint8Array((init?.body as Uint8Array) ?? []) });
        return new Response(respond(new Uint8Array(0)), { status: 200 });
      }),
    );
    const client = new RpcClient();
    const responses = await client.sendBatch([
      { type: 249, body: new Uint8Array(0) },
      { type: 3, body: new Uint8Array([0xcc]) },
    ]);
    expect(hex(requests[0]?.body ?? new Uint8Array(0))).toBe('00 ff 00 03 02 f9 00 03 01 cc');
    expect(responses.map((r) => r.type)).toEqual([249, 3]);
    expect([...responses[1]?.body ?? []]).toEqual([0xaa, 0xbb]);
  });

  it('sendSingle writes args raw and reads the body', async () => {
    respond = () => {
      const w = new RpcWriter();
      w.writeU8(0);
      w.writeU8(3);
      w.writeRaw(new Uint8Array([0x07, 0x08]));
      return w.bytes();
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests.push({ url: String(_url), body: new Uint8Array((init?.body as Uint8Array) ?? []) });
        return new Response(respond(new Uint8Array(0)), { status: 200 });
      }),
    );
    const client = new RpcClient();
    const body = await client.sendSingle(3, new Uint8Array([0x01, 0x02]));
    expect(hex(requests[0]?.body ?? new Uint8Array(0))).toBe('00 03 00 01 02');
    expect([...body]).toEqual([0x07, 0x08]);
  });

  it('surfaces HTTP 401 as an auth error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([0, 0, 0]), { status: 401 })),
    );
    const client = new RpcClient();
    await expect(client.sendSingle(249)).rejects.toThrow(/Authentication required/);
  });

  it('parses sub-errors as failures', async () => {
    respond = () => {
      const w = new RpcWriter();
      w.writeU8(0);
      w.writeU8(255);
      w.writeVarint(2);
      w.writeU8(249);
      w.writeVarint(0);
      w.writeU8(0);
      w.writeVarint(0);
      return w.bytes();
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(respond(new Uint8Array(0)), { status: 200 })),
    );
    const client = new RpcClient();
    await expect(
      client.sendBatch([
        { type: 249, body: new Uint8Array(0) },
        { type: 1, body: new Uint8Array(0) },
      ]),
    ).rejects.toThrow(/init/);
  });

  it('validates reader consumption (isDone) after a batch', async () => {
    respond = () => {
      const w = new RpcWriter();
      w.writeU8(0);
      w.writeU8(255);
      w.writeVarint(1);
      w.writeU8(249);
      w.writeVarint(1);
      w.writeRaw(new Uint8Array([0x01, 0x02])); // extra trailing byte
      return w.bytes();
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(respond(new Uint8Array(0)), { status: 200 })),
    );
    const client = new RpcClient();
    await expect(client.sendBatch([{ type: 249, body: new Uint8Array(0) }])).rejects.toThrow(
      /trailing bytes/,
    );
  });
});

describe('RpcReader on live-captured traffic (regression)', () => {
  it('parses the captured handshake response shape', () => {
    const r = new RpcReader(
      new Uint8Array([0x00, 0xff, 0x02, 0xf9, 0x05, 0x86, 0xd4, 0x91, 0xf5, 0x1e, 0x01, 0x01, 0x00]),
    );
    r.readU8();
    expect(r.readU8()).toBe(255);
    expect(r.readVarint()).toBe(2);
    expect(r.readU8()).toBe(249);
    expect(new RpcReader(r.readBytes()).readDate()).toBeGreaterThan(0);
    expect(r.readU8()).toBe(1);
    expect(new RpcReader(r.readBytes()).readString()).toBe('');
    expect(r.isDone()).toBe(true);
  });
});
