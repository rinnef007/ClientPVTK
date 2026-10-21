// Port of com.hz.core.PowerMsg (Vineflower decompile): timed on-screen messages — the scrolling
// notice banner, centred prompts, the bordered prompt box and the "point" lines under the player
// panel. Each starts its clock on first paint and reports `destroy()` once its time is up.
import type { Graphics } from '../../midp/Graphics';
import { fillAlphaRect, fillArcRect } from '../main/GameView';
import { PowerString, type TextFont } from '../string/PowerString';

export const TYPE_POWERMSG_CHAT = 0;
export const TYPE_POWERMSG_PROMPT = 1;
export const TYPE_POWERMSG_NOTICE = 2;
export const TYPE_POWERMSG_POINT = 3;
export const TYPE_POWERMSG_PROMPT2 = 4;

const BACKGROUND = -1610612736; // 0xA0000000
const NOTICE_FRAME_MS = 65;
const NOTICE_Y = 10;

/** Screen and font the messages lay out against (GameCanvas.SCREEN_*, Utilities.FONT). */
export const msgEnv: { width: number; height: number; font: TextFont; now: () => number } = {
  width: 320,
  height: 480,
  font: { height: 18, stringWidth: (s) => s.length * 8 },
  now: () => Date.now(),
};

export class PowerMsg {
  private startTime = 0;
  private endTime = 0;
  private started = false;
  private destroyed = false;
  private powerString: PowerString | null = null;
  private powerArray: PowerString[] | null = null;

  private constructor(
    readonly msg: string,
    readonly type: number,
    private drawX = 0,
    private drawY = 0,
  ) {}

  static createPowerMsgNotice(s: string): PowerMsg {
    return new PowerMsg(s, TYPE_POWERMSG_NOTICE);
  }

  static createPowerMsgPrompt(s: string): PowerMsg {
    return new PowerMsg(s, TYPE_POWERMSG_PROMPT);
  }

  /** At (x, y), or along the bottom when the position is off screen. */
  static createPowerMsgPrompt2(s: string, x: number, y: number): PowerMsg {
    if (x >= 0 && x <= msgEnv.width && y >= 0 && y <= msgEnv.height) return new PowerMsg(s, TYPE_POWERMSG_PROMPT2, x, y);
    return new PowerMsg(s, TYPE_POWERMSG_PROMPT2, 0, msgEnv.height - msgEnv.font.height * 4);
  }

  static createPowerMsgPoint(s: string, x: number, y: number): PowerMsg {
    return new PowerMsg(s, TYPE_POWERMSG_POINT, x, y);
  }

  private pointWidth(): number {
    return ((msgEnv.width * 3) / 4) | 0;
  }

  private init(): void {
    const { width, font } = msgEnv;
    this.startTime = msgEnv.now();
    switch (this.type) {
      case TYPE_POWERMSG_PROMPT:
        this.powerArray = PowerString.splitPowerString(this.msg, font, width - 10) ?? [];
        this.endTime = this.startTime + this.powerArray.length * 3000;
        break;
      case TYPE_POWERMSG_NOTICE:
        this.powerString = PowerString.createPowerString(this.msg, font);
        this.endTime = this.startTime + ((((this.powerString.width + (width >> 1)) / 2) | 0) + 1) * NOTICE_FRAME_MS;
        break;
      case TYPE_POWERMSG_POINT: {
        this.powerArray = PowerString.splitPowerString(this.msg, font, this.pointWidth()) ?? [];
        const pages = ((this.powerArray.length / 3) | 0) + (this.powerArray.length % 3 > 0 ? 1 : 0);
        this.endTime = this.startTime + pages * 3000;
        break;
      }
      case TYPE_POWERMSG_PROMPT2:
        this.powerArray = PowerString.splitPowerString(this.msg, font, width - 16) ?? [];
        this.endTime = this.startTime + this.powerArray.length * 2000;
        break;
    }
  }

  /** True (and from then on dead) once the display time has passed. */
  destroy(): boolean {
    const done = this.endTime > 0 && this.endTime <= msgEnv.now();
    if (done) this.destroyed = true;
    return done;
  }

  paint(g: Graphics): void {
    if (this.destroyed) return;
    if (!this.started) {
      this.started = true;
      this.init();
    }
    if (this.type === TYPE_POWERMSG_PROMPT) this.paintPrompt(g);
    else if (this.type === TYPE_POWERMSG_NOTICE) this.paintNotice(g);
    else if (this.type === TYPE_POWERMSG_POINT) this.paintPoint(g);
    else if (this.type === TYPE_POWERMSG_PROMPT2) this.paintPrompt2(g);
  }

  /** Green text scrolling right to left, 2 px every 65 ms, on a dark strip near the top. */
  private paintNotice(g: Graphics): void {
    if (this.powerString == null) return;
    const { width } = msgEnv;
    const fh = msgEnv.font.height;
    fillAlphaRect(g, BACKGROUND, 0, NOTICE_Y, width, fh);
    g.setClip(0, NOTICE_Y, width, fh);
    g.setColor(65280);
    const steps = ((msgEnv.now() - this.startTime) / NOTICE_FRAME_MS) | 0;
    this.powerString.draw(g, (width >> 1) - steps * 2, NOTICE_Y, 20);
    g.setClip(0, 0, msgEnv.width, msgEnv.height);
  }

  /** Up to 3 lines at a time, a new page every 3 s. */
  private paintPoint(g: Graphics): void {
    if (this.powerArray == null) return;
    const page = ((msgEnv.now() - this.startTime) / 3000) | 0;
    let y = this.drawY;
    for (let i = 0; i < 3; i++) {
      const line = this.powerArray[page * 3 + i];
      if (line == null) continue;
      fillAlphaRect(g, BACKGROUND, this.drawX, y, line.width + 2, line.height);
      g.setColor(16439945);
      line.draw(g, this.drawX, y + 3, 20);
      y += line.height + 1;
    }
  }

  /** Centred yellow lines in a two-line strip, scrolling up one line every 3 s. */
  private paintPrompt(g: Graphics): void {
    if (this.powerArray == null) return;
    const { width } = msgEnv;
    const fh = msgEnv.font.height;
    let y = ((msgEnv.height / 6) | 0) + (fh >> 1);
    const h = fh * Math.min(2, this.powerArray.length);
    fillAlphaRect(g, BACKGROUND, 0, y, width, h);
    g.setClip(0, y, width, h);
    g.setColor(16776960);
    const t = msgEnv.now() - this.startTime;
    let scroll = ((t / 3000) | 0) * fh;
    const left = ((3000 - (t % 3000)) / 100) | 0;
    if (left < 6) scroll += ((fh / 6) | 0) * (6 - left);
    for (const line of this.powerArray) {
      line.draw(g, width >> 1, y - scroll, 17);
      y += fh;
    }
    g.setClip(0, 0, msgEnv.width, msgEnv.height);
  }

  /** One line at a time in a white-bordered rounded box, 2 s per line. */
  private paintPrompt2(g: Graphics): void {
    if (this.powerArray == null) return;
    const { width } = msgEnv;
    const fh = msgEnv.font.height;
    const w = width - 6;
    const h = fh + 2;
    this.drawX = 3;
    g.setColor(16777215);
    fillArcRect(g, this.drawX, this.drawY, w, h);
    g.setColor(1776408);
    fillArcRect(g, this.drawX + 1, this.drawY + 1, width - 8, fh);
    g.setColor(16439945);
    const i = ((msgEnv.now() - this.startTime) / 2000) | 0;
    const line = this.powerArray[i];
    if (i >= 0 && line != null) line.draw(g, w >> 1, this.drawY + (h >> 1) - (fh >> 1) + 3, 17);
  }
}
