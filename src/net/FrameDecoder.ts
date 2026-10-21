import { HEADER_SIZE, Message } from './Message';

/**
 * Reassembles frames from an arbitrary byte stream, mirroring com.hz.net.Input.run().
 * A single WebSocket message may carry part of a frame or several frames (e.g. via websockify).
 */
export class FrameDecoder {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): Message[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);

    const out: Message[] = [];
    let off = 0;
    while (merged.length - off >= 2) {
      const size = (merged[off] << 8) | merged[off + 1];
      if (size === 0xffff) {
        // Input.run() reads a -1 size as a keep-alive marker and skips just those 2 bytes.
        off += 2;
        continue;
      }
      if (size < HEADER_SIZE) throw new Error(`FrameDecoder: invalid frame size ${size}`);
      if (merged.length - off < size) break;
      const type = (((merged[off + 2] << 8) | merged[off + 3]) << 16) >> 16;
      out.push(new Message(type, merged.slice(off + HEADER_SIZE, off + size)));
      off += size;
    }
    this.buf = merged.slice(off);
    return out;
  }

  get pending(): number {
    return this.buf.length;
  }

  clear(): void {
    this.buf = new Uint8Array(0);
  }
}
