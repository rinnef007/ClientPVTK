import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module without types
import { handle } from '../server/mock-server.mjs';
import { FrameDecoder } from '../src/net/FrameDecoder';
import { Message } from '../src/net/Message';

function roundTrip(m: Message): Message[] {
  const f = m.toFrame()!;
  const req = { type: m.type, payload: Buffer.from(f.subarray(4)) };
  const d = new FrameDecoder();
  return (handle(req) as Buffer[]).flatMap((b) => d.push(new Uint8Array(b)));
}

describe('mock server', () => {
  it('accepts a well-formed PLAYERCHECK', () => {
    const m = new Message(1, 0);
    m.putLong(1n);
    m.putInt(1);
    m.putByte(5);
    m.putInt(1);
    m.putByte(2);
    const [r] = roundTrip(m);
    expect(r.type).toBe(1);
    expect(r.getByte()).toBe(0);
  });

  it('returns a Java-encoded error for unknown types', () => {
    const [r] = roundTrip(new Message(12345, 0));
    expect(r.type).toBe(12345);
    expect(r.getByte()).toBe(-1);
    expect(r.getString()).toContain('12345');
  });

  it('returns an empty actor list', () => {
    const [r] = roundTrip(new Message(10001, 0));
    expect(r.getByte()).toBe(0);
  });
});
