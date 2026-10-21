import { FrameDecoder } from './FrameDecoder';
import { Message } from './Message';
import { MSG_HEARTBEAT } from './ProtocolDefine';

export type NetState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** Same interval as MsgHandler.HEART_BEAT_TIME. */
export const HEART_BEAT_TIME = 15000;

/**
 * WebSocket replacement for com.hz.net.SocketServer + Input + OutPut.
 * Incoming messages are queued and drained by the game loop (like MsgHandler.handleMessages()),
 * so game logic stays single-threaded.
 */
export class SocketClient {
  state: NetState = 'idle';
  sentBytes = 0;
  receivedBytes = 0;
  onState?: (s: NetState) => void;
  /** Supplies the map id carried by the heartbeat. */
  getMapId: () => number = () => 0;

  private ws: WebSocket | null = null;
  private decoder = new FrameDecoder();
  private inbox: Message[] = [];
  private heartTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly wsFactory: (url: string) => WebSocket = (u) => new WebSocket(u)) {}

  connect(url: string): void {
    this.close();
    this.setState('connecting');
    const ws = this.wsFactory(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      this.setState('open');
      this.heartTimer = setInterval(() => this.sendHeartbeat(), HEART_BEAT_TIME);
    };
    ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(ev.data);
      this.receivedBytes += bytes.length;
      try {
        this.inbox.push(...this.decoder.push(bytes));
      } catch (e) {
        console.error(e);
        this.close();
        this.setState('error');
      }
    };
    ws.onerror = () => this.setState('error');
    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.state !== 'error') this.setState('closed');
    };
    this.ws = ws;
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  send(msg: Message): boolean {
    if (!this.ws || this.state !== 'open') return false;
    const frame = msg.toFrame();
    if (!frame) return false;
    this.ws.send(frame);
    this.sentBytes += frame.length;
    return true;
  }

  sendHeartbeat(): boolean {
    const m = new Message(MSG_HEARTBEAT, 2);
    m.putShort(this.getMapId());
    return this.send(m);
  }

  /** Drain received messages; call once per game tick. */
  poll(): Message[] {
    if (this.inbox.length === 0) return [];
    const out = this.inbox;
    this.inbox = [];
    return out;
  }

  close(): void {
    this.stopHeartbeat();
    this.decoder.clear();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
      this.setState('closed');
    }
  }

  private stopHeartbeat(): void {
    if (this.heartTimer) clearInterval(this.heartTimer);
    this.heartTimer = null;
  }

  private setState(s: NetState): void {
    this.state = s;
    this.onState?.(s);
  }
}
