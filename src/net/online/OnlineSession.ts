// A connection to the user's backend with request/reply waiting on top of SocketClient. Java blocks
// in MsgHandler.waitForRequest until the reply of the same type arrives; here the request returns a
// promise that the scene resolves while draining the socket each tick (pump). Messages nobody waits
// for are kept until the scene takes them (takeUnhandled).
import type { Message } from '../Message';
import type { SocketClient } from '../SocketClient';

const REPLY_TIMEOUT_MS = 10000;

interface Waiter {
  type: number;
  resolve: (m: Message) => void;
  reject: (e: Error) => void;
  until: number;
}

export class OnlineSession {
  private waiters: Waiter[] = [];
  private unhandled: Message[] = [];

  constructor(readonly net: SocketClient) {}

  /** Opens the socket and resolves once it is open (or rejects on error / timeout). */
  open(url: string): Promise<void> {
    this.net.connect(url);
    const until = Date.now() + REPLY_TIMEOUT_MS;
    return new Promise((ok, fail) => {
      const check = () => {
        if (this.net.state === 'open') return ok();
        if (this.net.state === 'error' || this.net.state === 'closed') return fail(new Error(`Không kết nối được ${url}`));
        if (Date.now() > until) return fail(new Error(`Hết thời gian kết nối ${url}`));
        setTimeout(check, 50);
      };
      check();
    });
  }

  /** Sends `m` and waits for the next message of `replyType`. */
  request(m: Message, replyType = m.type): Promise<Message> {
    return new Promise((resolve, reject) => {
      if (!this.net.send(m)) {
        reject(new Error('Chưa kết nối server'));
        return;
      }
      this.waiters.push({ type: replyType, resolve, reject, until: Date.now() + REPLY_TIMEOUT_MS });
    });
  }

  /** Call every tick: hands replies to their waiters and times out stale requests. */
  pump(): void {
    for (const m of this.net.poll()) {
      const i = this.waiters.findIndex((w) => w.type === m.type);
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(m);
      else this.unhandled.push(m);
    }
    const now = Date.now();
    for (const w of this.waiters.filter((x) => now > x.until)) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.reject(new Error(`Server không trả lời gói ${w.type}`));
    }
  }

  /** Server pushes and replies nobody waited for. */
  takeUnhandled(): Message[] {
    const out = this.unhandled;
    this.unhandled = [];
    return out;
  }
}
