import { LEFT, TOP } from '../midp/anchor';
import { FONT_SMALL, type Graphics } from '../midp/Graphics';
import { KEY_DOWN, KEY_FIRE, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_UP, type InputState } from '../midp/Input';
import { Message } from '../net/Message';
import { ProtocolDefine } from '../net/ProtocolDefine';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_TEXT, COLOR_TITLE, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { TITLE_H, drawFrame, drawList, listIndexAt, softKeyAt } from './ui';

const MAX_LOG = 12;
const LIST_TOP = 108;
/** Value MsgHandler sends as GameWorld.VERSION is build-specific; any int works against the mock. */
const CLIENT_VERSION = 1;

/** Reverse lookup for log readability. Only message ids: BAG_*, TEAM_* etc. are sub-codes that reuse small numbers. */
const NAMES = new Map<number, string>();
for (const [k, v] of Object.entries(ProtocolDefine)) {
  if (/^(CG|GC|LC)_/.test(k) && !NAMES.has(v)) NAMES.set(v, k);
}

function typeName(t: number): string {
  return NAMES.get(t) ?? String(t);
}

/** Port of MsgHandler.createFirstGameServerMsg(). */
function createFirstGameServerMsg(ukey: bigint, sessionId: number): Message {
  const m = new Message(ProtocolDefine.CG_LOGIN_PLAYERCHECK);
  m.putLong(ukey);
  m.putInt(sessionId);
  m.putByte(5);
  m.putInt(CLIENT_VERSION);
  m.putByte(2);
  return m;
}

export class NetTestScene implements Scene {
  private log: string[] = [];
  private selected = 0;
  private readonly actions: { label: string; run: () => void }[];

  constructor(private readonly ctx: Context) {
    const net = ctx.net;
    net.onState = (s) => this.push(`[state] ${s}`);
    this.actions = [
      { label: 'Kết nối / Ngắt', run: () => (net.isOpen ? net.close() : net.connect(ctx.wsUrl)) },
      { label: 'Gửi heartbeat', run: () => this.send(() => (net.sendHeartbeat(), 'CG_SYSTEM_HEART')) },
      {
        label: 'Gửi PLAYERCHECK',
        run: () => this.send(() => (net.send(createFirstGameServerMsg(12345n, 1)), 'CG_LOGIN_PLAYERCHECK')),
      },
      {
        label: 'Lấy DS nhân vật',
        run: () => this.send(() => (net.send(new Message(ProtocolDefine.CG_LOGIN_ACTORLIST, 0)), 'CG_LOGIN_ACTORLIST')),
      },
    ];
  }

  private send(fn: () => string): void {
    if (!this.ctx.net.isOpen) {
      this.push('! chưa kết nối');
      return;
    }
    this.push(`→ ${fn()}`);
  }

  private push(line: string): void {
    this.log.push(line);
    if (this.log.length > MAX_LOG) this.log.shift();
  }

  update(input: InputState): void {
    for (const m of this.ctx.net.poll()) this.push(`← ${typeName(m.type)} ${describe(m)}`);

    const n = this.actions.length;
    if (input.key === KEY_UP) this.selected = (this.selected + n - 1) % n;
    if (input.key === KEY_DOWN) this.selected = (this.selected + 1) % n;
    if (input.key === KEY_FIRE || input.key === KEY_SOFT_LEFT) this.actions[this.selected].run();
    if (input.key === KEY_SOFT_RIGHT) return this.back();
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      const soft = softKeyAt(p.x, p.y);
      if (soft === KEY_SOFT_RIGHT) return this.back();
      if (soft === KEY_SOFT_LEFT) {
        this.actions[this.selected].run();
        continue;
      }
      const i = listIndexAt(p.y, LIST_TOP, n);
      if (i >= 0) {
        this.selected = i;
        this.actions[i].run();
      }
    }
  }

  private back(): void {
    this.ctx.net.onState = undefined;
    this.ctx.go(new MenuScene(this.ctx));
  }

  paint(g: Graphics): void {
    const net = this.ctx.net;
    drawFrame(g, 'Kiểm tra mạng', 'Chạy', 'Quay lại');
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_TITLE);
    g.drawString(this.ctx.wsUrl, 8, TITLE_H + 8, LEFT | TOP);
    g.setColor(COLOR_TEXT);
    g.drawString(`Trạng thái: ${net.state}`, 8, TITLE_H + 26, LEFT | TOP);
    g.drawString(`Gửi ${net.sentBytes} B · Nhận ${net.receivedBytes} B`, 8, TITLE_H + 44, LEFT | TOP);

    drawList(g, this.actions.map((a) => a.label), this.selected, LIST_TOP);

    const logTop = LIST_TOP + this.actions.length * 40 + 8;
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_DIM);
    this.log.forEach((l, i) => g.drawString(fit(g, l, SCREEN_WIDTH - 16), 8, logTop + i * 16, LEFT | TOP));
  }
}

/** Best-effort preview of the common "status byte (+ error string)" reply shape. */
function describe(m: Message): string {
  if (m.remaining === 0) return '(rỗng)';
  try {
    const status = m.getByte();
    if (status < 0 && m.remaining >= 3) return `status=${status} "${m.getString()}"`;
    return `status=${status} +${m.remaining}B`;
  } catch {
    return `${m.remaining}B`;
  } finally {
    m.reset();
  }
}

function fit(g: Graphics, s: string, w: number): string {
  if (g.stringWidth(s) <= w) return s;
  let t = s;
  while (t.length > 1 && g.stringWidth(t + '…') > w) t = t.slice(0, -1);
  return t + '…';
}
