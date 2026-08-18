import { describe, expect, it } from 'vitest';
import { RpcReader, RpcWriter } from '../../src/net/codec';

function roundTrip(build: (w: RpcWriter) => void, read: (r: RpcReader) => unknown): unknown {
  const w = new RpcWriter();
  build(w);
  const r = new RpcReader(w.bytes());
  const value = read(r);
  expect(r.isDone(), 'reader must consume the whole payload').toBe(true);
  return value;
}

describe('codec primitives', () => {
  it('round-trips varints at 7-bit boundaries', () => {
    for (const n of [0, 1, 127, 128, 255, 16383, 16384, 1 << 21, 0x7fffffff]) {
      expect(roundTrip((w) => w.writeVarint(n), (r) => r.readVarint())).toBe(n >>> 0);
    }
  });

  it('round-trips strings including multibyte and empty', () => {
    for (const s of ['', 'a', 'hello', 'héllo wörld', 'a'.repeat(300), '日本語']) {
      expect(roundTrip((w) => w.writeString(s), (r) => r.readString())).toBe(s);
    }
  });

  it('rejects 4-byte UTF-8 (wire limit shared with the server codec)', () => {
    // The server reader also throws on 4-byte sequences — the wire simply
    // does not carry code points above U+FFFF. Keep both sides in lockstep.
    const w = new RpcWriter();
    w.writeString('🍎');
    expect(() => new RpcReader(w.bytes()).readString()).toThrow(/malformed/);
  });

  it('string length counts characters, not bytes (wire compat)', () => {
    const w = new RpcWriter();
    w.writeString('é'); // 1 char, 2 utf8 bytes
    const bytes = w.bytes();
    expect(bytes[0]).toBe(1); // varint char count
    expect(bytes.length).toBe(3); // count byte + 2 payload bytes
  });

  it('round-trips intvar32 negatives and positives', () => {
    for (const n of [0, 1, -1, 5, -5, 12345, -12345, 0x3fffffff, -0x3fffffff]) {
      expect(roundTrip((w) => w.writeIntvar32(n), (r) => r.readIntvar32())).toBe(n);
    }
  });

  it('round-trips bool, bytes, date, and arrays', () => {
    expect(roundTrip((w) => w.writeBool(true), (r) => r.readBool())).toBe(true);
    expect(roundTrip((w) => w.writeBool(false), (r) => r.readBool())).toBe(false);

    const data = new Uint8Array([1, 2, 3, 250]);
    const bytes = roundTrip((w) => w.writeBytes(data), (r) => r.readBytes()) as Uint8Array;
    expect([...bytes]).toEqual([1, 2, 3, 250]);

    expect(roundTrip((w) => w.writeDate(1265828400), (r) => r.readDate())).toBe(1265828400);

    const arr = roundTrip(
      (w) => {
        w.writeVarint(3);
        w.writeString('a');
        w.writeString('b');
        w.writeString('c');
      },
      (r) => r.readArray((rr) => rr.readString()),
    );
    expect(arr).toEqual(['a', 'b', 'c']);
  });

  it('readNetworkUid handles empty (network 0) and full entries', () => {
    const w = new RpcWriter();
    w.writeVarint(0);
    const r0 = new RpcReader(w.bytes());
    expect(r0.readNetworkUid()).toEqual({ network: 0, networkUid: '', playfishUid: 0 });

    const w2 = new RpcWriter();
    w2.writeVarint(1);
    w2.writeString('uid-1');
    w2.writeVarint(42);
    const r2 = new RpcReader(w2.bytes());
    expect(r2.readNetworkUid()).toEqual({ network: 1, networkUid: 'uid-1', playfishUid: 42 });
  });

  it('throws on truncated payloads instead of reading garbage', () => {
    const w = new RpcWriter();
    w.writeString('hello');
    const truncated = w.bytes().subarray(0, 3);
    expect(() => new RpcReader(truncated).readString()).toThrow(/EOF|malformed/);
  });
});
