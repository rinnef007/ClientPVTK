import type { Graphics } from '../midp/Graphics';
import { KEY_FIRE, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, type InputState } from '../midp/Input';
import { runLogin } from '../net/online/LoginFlow';
import type { NewPlayer } from '../net/online/LoginMessages';
import { OnlineSession } from '../net/online/OnlineSession';
import { encodeIcons } from '../game/sprite/SpriteIcon';
import { currentAppearance } from './DressingRoomScene';
import { MapScene } from './MapScene';
import { MenuScene } from './MenuScene';
import { COLOR_TEXT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { TITLE_H, drawFrame, drawParagraph, softKeyAt } from './ui';

/** WebSocket address of the bridge to the user's backend (server/ws-tcp-bridge.mjs); `?be=` overrides it. */
export const DEFAULT_BE_URL = 'ws://localhost:8081';
const DEVICE_KEY = 'pvtk.deviceId';

/** Tool.getgetDeviceId: a random id kept in this browser (the backend ties the account to it). */
function deviceId(): string {
  try {
    const old = localStorage.getItem(DEVICE_KEY);
    if (old) return old;
    const id = `web-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'web-guest';
  }
}

/** The character created when the account has none: the dressing room's outfit, a random name. */
function newPlayer(): NewPlayer {
  return {
    sex: currentAppearance.sex,
    race: 0,
    job: 1,
    icons: encodeIcons(currentAppearance),
    name: `Web${Math.floor(1000 + Math.random() * 9000)}`,
  };
}

/**
 * Logs in to the user's own backend through the bridge (GameCanvas login stages), then enters the
 * map it sends. The character list and creation screens are not ported: the first character is
 * used, or one is created.
 */
export class OnlineLoginScene implements Scene {
  private steps: string[] = [];
  private error: string | null = null;
  private readonly session: OnlineSession;
  private readonly url: string;

  constructor(private readonly ctx: Context) {
    this.session = new OnlineSession(ctx.net);
    this.url = new URLSearchParams(location.search).get('be') ?? DEFAULT_BE_URL;
    void this.start();
  }

  private async start(): Promise<void> {
    this.steps = [];
    this.error = null;
    try {
      const world = await runLogin(this.session, {
        url: this.url,
        deviceId: deviceId(),
        newPlayer,
        onStep: (t) => this.steps.push(t),
      });
      this.ctx.go(new MapScene(this.ctx, world));
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.ctx.net.close();
    }
  }

  update(input: InputState): void {
    this.session.pump();
    let key = input.key;
    for (const p of input.pointers) if (p.type === 'down') key = softKeyAt(p.x, p.y) || key;
    if (key === KEY_SOFT_RIGHT) {
      this.ctx.net.close();
      this.ctx.go(new MenuScene(this.ctx));
    } else if (this.error && (key === KEY_FIRE || key === KEY_SOFT_LEFT)) void this.start();
  }

  paint(g: Graphics): void {
    drawFrame(g, 'Server riêng (BE)', this.error ? 'Thử lại' : '', 'Về');
    let y = TITLE_H + 12;
    y = drawParagraph(g, `Cầu nối: ${this.url}`, 16, y, SCREEN_WIDTH - 32) + 8;
    for (const s of this.steps) y = drawParagraph(g, s, 16, y, SCREEN_WIDTH - 32, COLOR_TEXT) + 2;
    if (this.error) {
      y = drawParagraph(g, `Lỗi: ${this.error}`, 16, y + 8, SCREEN_WIDTH - 32, 0xff6060) + 8;
      drawParagraph(g, 'Kiểm tra: server Python đang chạy (cổng 30100) và cầu nối "npm run bridge" (cổng 8081).', 16, y, SCREEN_WIDTH - 32);
    }
  }
}
