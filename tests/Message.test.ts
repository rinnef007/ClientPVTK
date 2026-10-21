import { describe, expect, it } from 'vitest';
import { Message } from '../src/net/Message';
import { FrameDecoder } from '../src/net/FrameDecoder';

describe('Message', () => {
  it('round-trips every field type', () => {
    const m = new Message(10001, 4); // small capacity forces growth
    m.putByte(-5);
    m.putBoolean(true);
    m.putShort(-1234);
    m.putChar(0xfeff);
    m.putInt(-123456789);
    m.putLong(-9007199254740993n);
    m.putString('Phong Vân Truyền Kỳ');
    m.putBytes(new Uint8Array([1, 2, 255]));
    m.putBytes(null);

    const r = new Message(10001, m.payload());
    expect(r.getByte()).toBe(-5);
    expect(r.getBoolean()).toBe(true);
    expect(r.getShort()).toBe(-1234);
    expect(r.getChar()).toBe(0xfeff);
    expect(r.getInt()).toBe(-123456789);
    expect(r.getLong()).toBe(-9007199254740993n);
    expect(r.getString()).toBe('Phong Vân Truyền Kỳ');
    expect([...r.getBytes()]).toEqual([1, 2, 255]);
    expect(r.getBytes().length).toBe(0);
    expect(r.remaining).toBe(0);
  });

  it('encodes strings like Java: u24 length + UTF-16BE', () => {
    const m = new Message(1, 0);
    m.putString('Kỳ');
    // 'K' = 0x004B, 'ỳ' = U+1EF3
    expect([...m.payload()]).toEqual([0, 0, 2, 0x00, 0x4b, 0x1e, 0xf3]);
  });

  it('builds frames with total length and signed type header', () => {
    const m = new Message(16001, 2);
    m.putShort(7);
    expect([...m.toFrame()!]).toEqual([0, 6, 0x3e, 0x81, 0, 7]);
    expect([...new Message(-2, 0).toFrame()!]).toEqual([0, 4, 0xff, 0xfe]);
  });

  it('rejects frames over 32767 bytes', () => {
    const m = new Message(1, 0);
    m.putBytes(new Uint8Array(32767));
    expect(m.toFrame()).toBeNull();
  });

  it('throws on read past end', () => {
    expect(() => new Message(1, new Uint8Array(1)).getShort()).toThrow(RangeError);
  });
});

describe('FrameDecoder', () => {
  const f1 = (() => {
    const m = new Message(1, 0);
    m.putByte(0);
    return m.toFrame()!;
  })();
  const f2 = (() => {
    const m = new Message(10001, 0);
    m.putString('abc');
    return m.toFrame()!;
  })();

  it('splits concatenated frames', () => {
    const d = new FrameDecoder();
    const all = new Uint8Array([...f1, ...f2]);
    const msgs = d.push(all);
    expect(msgs.map((m) => m.type)).toEqual([1, 10001]);
    expect(msgs[1].getString()).toBe('abc');
    expect(d.pending).toBe(0);
  });

  it('reassembles frames delivered one byte at a time', () => {
    const d = new FrameDecoder();
    const all = [...f1, ...f2];
    const msgs = all.flatMap((b) => d.push(new Uint8Array([b])));
    expect(msgs.map((m) => m.type)).toEqual([1, 10001]);
  });

  it('skips 0xFFFF keep-alive markers', () => {
    const d = new FrameDecoder();
    const msgs = d.push(new Uint8Array([0xff, 0xff, ...f1]));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].getByte()).toBe(0);
  });

  it('rejects impossible sizes', () => {
    expect(() => new FrameDecoder().push(new Uint8Array([0, 2, 0, 0]))).toThrow();
  });
});
