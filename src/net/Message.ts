// Port of com.hz.net.Message: a typed, big-endian read/write cursor over one frame payload.
// Wire frame: [u16 totalLen][i16 type][payload], totalLen includes the 4 header bytes.

export const HEADER_SIZE = 4;
export const MAX_FRAME_SIZE = 32767;
const DEFAULT_CAPACITY = 1024;

export class Message {
  type: number;
  private data: Uint8Array;
  private view: DataView;
  private inc = 0;

  constructor(type: number, payloadOrCapacity: Uint8Array | number = DEFAULT_CAPACITY) {
    this.type = (type << 16) >> 16; // keep as signed short, like Java
    this.data =
      typeof payloadOrCapacity === 'number' ? new Uint8Array(payloadOrCapacity) : payloadOrCapacity;
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }

  get position(): number {
    return this.inc;
  }

  get remaining(): number {
    return this.data.length - this.inc;
  }

  reset(): void {
    this.inc = 0;
  }

  // Grows the buffer on write; the Java version throws instead, but a fixed 1024B cap is pointless here.
  private ensure(n: number): void {
    if (this.inc + n <= this.data.length) return;
    let cap = Math.max(this.data.length * 2, DEFAULT_CAPACITY);
    while (cap < this.inc + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.data);
    this.data = next;
    this.view = new DataView(next.buffer);
  }

  private need(n: number): void {
    if (this.inc + n > this.data.length) {
      throw new RangeError(`Message ${this.type}: read past end (${this.inc}+${n} > ${this.data.length})`);
    }
  }

  putByte(v: number): void {
    this.ensure(1);
    this.view.setInt8(this.inc, (v << 24) >> 24);
    this.inc += 1;
  }

  getByte(): number {
    this.need(1);
    const v = this.view.getInt8(this.inc);
    this.inc += 1;
    return v;
  }

  putBoolean(v: boolean): void {
    this.putByte(v ? 1 : 0);
  }

  getBoolean(): boolean {
    return this.getByte() === 1;
  }

  putShort(v: number): void {
    this.ensure(2);
    this.view.setInt16(this.inc, (v << 16) >> 16);
    this.inc += 2;
  }

  getShort(): number {
    this.need(2);
    const v = this.view.getInt16(this.inc);
    this.inc += 2;
    return v;
  }

  putChar(code: number): void {
    this.ensure(2);
    this.view.setUint16(this.inc, code & 0xffff);
    this.inc += 2;
  }

  getChar(): number {
    this.need(2);
    const v = this.view.getUint16(this.inc);
    this.inc += 2;
    return v;
  }

  putInt(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.inc, v | 0);
    this.inc += 4;
  }

  getInt(): number {
    this.need(4);
    const v = this.view.getInt32(this.inc);
    this.inc += 4;
    return v;
  }

  putLong(v: bigint): void {
    this.ensure(8);
    this.view.setBigInt64(this.inc, BigInt.asIntN(64, v));
    this.inc += 8;
  }

  getLong(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.inc);
    this.inc += 8;
    return v;
  }

  /** 3-byte unsigned length prefix used by strings and byte arrays. */
  putLength(n: number): void {
    this.ensure(3);
    this.data[this.inc] = (n >>> 16) & 0xff;
    this.data[this.inc + 1] = (n >>> 8) & 0xff;
    this.data[this.inc + 2] = n & 0xff;
    this.inc += 3;
  }

  getLength(): number {
    this.need(3);
    const d = this.data;
    const n = (d[this.inc] << 16) | (d[this.inc + 1] << 8) | d[this.inc + 2];
    this.inc += 3;
    return n;
  }

  /** Java String: u24 length in UTF-16 code units, then each unit as big-endian char. */
  putString(s: string | null | undefined): void {
    const str = s ?? '';
    this.putLength(str.length);
    for (let i = 0; i < str.length; i++) this.putChar(str.charCodeAt(i));
  }

  getString(): string {
    const len = this.getLength();
    this.need(len * 2);
    const units = new Array<number>(len);
    for (let i = 0; i < len; i++) units[i] = this.getChar();
    // Chunk to avoid call-stack limits on very long strings.
    let out = '';
    for (let i = 0; i < len; i += 4096) out += String.fromCharCode(...units.slice(i, i + 4096));
    return out;
  }

  putBytes(bytes: Uint8Array | null | undefined): void {
    if (!bytes) {
      this.putLength(0);
      return;
    }
    this.putLength(bytes.length);
    this.ensure(bytes.length);
    this.data.set(bytes, this.inc);
    this.inc += bytes.length;
  }

  getBytes(): Uint8Array {
    const len = this.getLength();
    this.need(len);
    const out = this.data.slice(this.inc, this.inc + len);
    this.inc += len;
    return out;
  }

  /** Bytes written so far (Java getConData). */
  payload(): Uint8Array {
    return this.data.slice(0, this.inc);
  }

  /** Full wire frame (Java getDataBytes). Returns null when too large, as the original does. */
  toFrame(): Uint8Array | null {
    const total = this.inc + HEADER_SIZE;
    if (total > MAX_FRAME_SIZE) return null;
    const out = new Uint8Array(total);
    const v = new DataView(out.buffer);
    v.setUint16(0, total);
    v.setInt16(2, this.type);
    out.set(this.data.subarray(0, this.inc), HEADER_SIZE);
    return out;
  }
}
