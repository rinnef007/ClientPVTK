// java.io.DataInputStream / DataOutputStream over byte arrays (big-endian), as used by the
// resource loaders. Reads past the end throw like Java's EOFException.

export class EOFException extends Error {}

export class DataInputStream {
  private readonly view: DataView;
  private pos = 0;

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.buf.length) throw new EOFException(`EOF at ${this.pos}+${n}/${this.buf.length}`);
  }

  readByte(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }

  readUnsignedByte(): number {
    this.need(1);
    return this.buf[this.pos++];
  }

  readShort(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  readInt(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  readFully(out: Uint8Array): void {
    this.need(out.length);
    out.set(this.buf.subarray(this.pos, this.pos + out.length));
    this.pos += out.length;
  }

  skip(n: number): number {
    const k = Math.max(0, Math.min(n, this.buf.length - this.pos));
    this.pos += k;
    return k;
  }

  /** Java modified UTF-8: u16 byte length, then 1–3 byte sequences per UTF-16 unit. */
  readUTF(): string {
    const len = this.readShort() & 0xffff;
    this.need(len);
    const end = this.pos + len;
    const b = this.buf;
    let out = '';
    while (this.pos < end) {
      const c = b[this.pos++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if ((c & 0xe0) === 0xc0) out += String.fromCharCode(((c & 0x1f) << 6) | (b[this.pos++] & 0x3f));
      else {
        const c2 = b[this.pos++];
        const c3 = b[this.pos++];
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      }
    }
    return out;
  }

  get position(): number {
    return this.pos;
  }

  available(): number {
    return this.buf.length - this.pos;
  }
}

export class DataOutputStream {
  private bytes: number[] = [];

  writeByte(v: number): void {
    this.bytes.push(v & 0xff);
  }

  writeShort(v: number): void {
    this.bytes.push((v >>> 8) & 0xff, v & 0xff);
  }

  writeInt(v: number): void {
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }

  writeUTF(s: string): void {
    const enc: number[] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 1 && c < 0x80) enc.push(c);
      else if (c < 0x800) enc.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else enc.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    this.writeShort(enc.length);
    this.bytes.push(...enc);
  }

  toByteArray(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}
