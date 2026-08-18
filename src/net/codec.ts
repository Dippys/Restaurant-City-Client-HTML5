/**
 * PlayFish binary RPC primitives, client side.
 *
 * Spec / ground truth: ../server/src/rpc/codec.ts (proven server writers)
 * and decompiled/game/scripts/com/playfish/rpc/share/RpcResponseBase.as.
 * Big-endian varint, string = varint CHARACTER count + UTF-8, date =
 * varint epoch seconds (0 = null), bool = 1 byte, arrays = varint count.
 *
 * This module is Phaser/DOM-free and Buffer-free (Uint8Array only) so it
 * runs identically in the browser and under Vitest in Node.
 */

export class RpcError extends Error {
  readonly status: number | undefined;
  readonly reason: number | undefined;

  constructor(message: string, status?: number, reason?: number) {
    super(message);
    this.name = 'RpcError';
    this.status = status;
    this.reason = reason;
  }
}

export class RpcReader {
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {}

  /** True when every byte has been consumed (the original client's isDone). */
  isDone(): boolean {
    return this.pos === this.buf.length;
  }

  rest(): Uint8Array {
    return this.buf.subarray(this.pos);
  }

  readU8(): number {
    if (this.pos >= this.buf.length) {
      throw new RpcError('unexpected EOF while reading uint8');
    }
    const value = this.buf[this.pos] ?? 0;
    this.pos += 1;
    return value;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readVarint(): number {
    let value = 0;
    let b = 0;
    do {
      if (this.pos >= this.buf.length) {
        throw new RpcError('unexpected EOF while reading varint');
      }
      b = this.buf[this.pos] ?? 0;
      this.pos += 1;
      value = (value << 7) | (b & 0x7f);
    } while ((b & 0x80) !== 0);
    return value >>> 0;
  }

  /** PlayFish signed int: LSB = sign bit, remaining bits = magnitude. */
  readIntvar32(): number {
    const encoded = this.readVarint();
    return (encoded & 1) !== 0 ? ~(encoded >>> 1) : encoded >>> 1;
  }

  /** Reads a string: varint CHARACTER count followed by UTF-8 bytes. */
  readString(): string {
    const count = this.readVarint();
    let value = '';
    for (let i = 0; i < count; i += 1) {
      if (this.pos >= this.buf.length) {
        throw new RpcError('unexpected EOF while reading string');
      }
      let b = this.buf[this.pos] ?? 0;
      this.pos += 1;
      if (b >> 4 <= 7) {
        value += String.fromCharCode(b);
      } else if (b >> 4 === 12 || b >> 4 === 13) {
        if (this.pos >= this.buf.length) {
          throw new RpcError('unexpected EOF inside UTF-8 sequence');
        }
        b = ((b & 0x1f) << 6) | ((this.buf[this.pos] ?? 0) & 0x3f);
        this.pos += 1;
        value += String.fromCharCode(b);
      } else if (b >> 4 === 14) {
        if (this.pos + 1 >= this.buf.length) {
          throw new RpcError('unexpected EOF inside UTF-8 sequence');
        }
        b =
          ((b & 0x0f) << 12) |
          (((this.buf[this.pos] ?? 0) & 0x3f) << 6) |
          ((this.buf[this.pos + 1] ?? 0) & 0x3f);
        this.pos += 2;
        value += String.fromCharCode(b);
      } else {
        throw new RpcError(`malformed UTF-8 byte ${b}`);
      }
    }
    return value;
  }

  readBytes(): Uint8Array {
    const length = this.readVarint();
    if (this.pos + length > this.buf.length) {
      throw new RpcError('unexpected EOF while reading byte array');
    }
    const value = this.buf.subarray(this.pos, this.pos + length);
    this.pos += length;
    return value;
  }

  /** Date: varint epoch seconds; 0 = null. */
  readDate(): number {
    return this.readVarint();
  }

  readArray<T>(readItem: (r: RpcReader) => T): T[] {
    const count = this.readVarint();
    const items: T[] = [];
    for (let i = 0; i < count; i += 1) {
      items.push(readItem(this));
    }
    return items;
  }

  /** Network-uid triple; network 0 = empty entry. */
  readNetworkUid(): { network: number; networkUid: string; playfishUid: number } {
    const network = this.readVarint();
    if (network === 0) {
      return { network, networkUid: '', playfishUid: 0 };
    }
    const networkUid = this.readString();
    const playfishUid = this.readVarint();
    return { network, networkUid, playfishUid };
  }
}

export class RpcWriter {
  private chunks: Uint8Array[] = [];

  writeU8(value: number): void {
    this.chunks.push(new Uint8Array([value & 0xff]));
  }

  writeBool(value: boolean): void {
    this.writeU8(value ? 1 : 0);
  }

  writeVarint(value: number): void {
    let n = value >>> 0;
    const groups: number[] = [];
    do {
      groups.unshift(n & 0x7f);
      n = Math.floor(n / 128);
    } while (n > 0);
    for (let i = 0; i < groups.length - 1; i += 1) {
      groups[i] = (groups[i] ?? 0) | 0x80;
    }
    this.chunks.push(new Uint8Array(groups));
  }

  writeIntvar32(value: number): void {
    const encoded = value < 0 ? (((~value) << 1) | 1) >>> 0 : (value << 1) >>> 0;
    this.writeVarint(encoded);
  }

  writeString(value: string): void {
    this.writeVarint([...value].length);
    this.chunks.push(new TextEncoder().encode(value));
  }

  writeBytes(value: Uint8Array): void {
    this.writeVarint(value.length);
    this.chunks.push(value);
  }

  /** Raw bytes with NO length prefix (used by audit payloads). */
  writeRaw(value: Uint8Array): void {
    this.chunks.push(value);
  }

  writeDate(epochSeconds: number): void {
    this.writeVarint(epochSeconds);
  }

  bytes(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}
