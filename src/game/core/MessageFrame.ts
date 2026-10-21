// Port of com.hz.core.MessageFrame (Vineflower decompile): a text bubble with a pointer
// triangle, drawn over a screen (IGTopDraw) next to a widget — e.g. the selected mission's goal
// in the mission list. Not ported: the guide arrow styles (3 / 4, /common/guide.png), the image
// / sprite content and the key-shop preview.
import type { Graphics } from '../../midp/Graphics';
import { type GWidget, type IGTopDraw, uiClock, uiFont, uiScreen } from '../gui/GWidget';
import { fillAlphaRect, fillArcRect, fillTriangle } from '../main/GameView';
import { PowerString } from '../string/PowerString';

const MF_X = 0;
const MF_Y = 1;
const MF_W = 2;
const MF_H = 3;
const MF_TOP = 4;
const MF_BOTTOM = 5;
const MF_LEFT = 6;
const MF_RIGHT = 7;
const MF_MAX_W = 8;
const MF_ALIGH = 9;
const MF_CSS = 10;
const MF_FRC_TOP_X = 11;
const MF_FRC_BOTTOM_X = 12;

export const CSS_ARC_RECT = 1;
export const CSS_HALF_APHA = 2;
/** MessageFrame.WIDTH_MAX: two thirds of the screen. */
export const WIDTH_MAX = ((uiScreen.width / 3) | 0) * 2;

export class MessageFrame implements IGTopDraw {
  private readonly vmData = new Int32Array(14);
  private message: PowerString[] | null = null;
  private drawCount = 0;
  private lastTick = -1;
  private isShowTime = false;
  isShowFrc = true;
  isShowMsg = true;

  /** MessageFrame(maxW, css, isShowTime). */
  constructor(maxW: number, css: number, showTime: boolean) {
    this.setAttribute(null, maxW, -1, css, showTime, 0, uiScreen.height, 0, uiScreen.width);
  }

  setAttribute(msg: string | null, maxW: number, align: number, css: number, showTime: boolean, top: number, bottom: number, left: number, right: number): void {
    this.isShowTime = showTime;
    const v = this.vmData;
    v[MF_MAX_W] = maxW;
    v[MF_ALIGH] = align;
    v[MF_CSS] = css;
    v[MF_TOP] = top;
    v[MF_BOTTOM] = bottom;
    v[MF_LEFT] = left;
    v[MF_RIGHT] = right;
    this.setMessage(msg);
  }

  setDrawCount(n: number): void {
    this.drawCount = n;
  }

  /** Wraps to the maximum width; a single line shrinks the bubble to the text. */
  setMessage(msg: string | null): void {
    if (msg == null || msg.trim().length === 0) {
      this.message = null;
      return;
    }
    const v = this.vmData;
    v[MF_W] = v[MF_MAX_W];
    const lines = PowerString.splitPowerString(msg, uiFont, v[MF_W]) ?? [];
    if (lines.length === 1) v[MF_W] = Math.min(v[MF_MAX_W], lines[0].width);
    v[MF_H] = uiFont.height * lines.length;
    this.message = lines;
  }

  doClear(): void {
    this.setDrawCount(0);
    this.setMessage(null);
  }

  /** Points at (x, y); `below` puts the bubble under the point (align 2) instead of above (1). */
  doUpdatePoint(msg: string | null, x: number, y: number, below: boolean, frc: number): void {
    let top = x;
    let bottom = x;
    if (frc === 1) {
      top = x - 2;
      bottom = x - 7;
    } else if (frc === 3) {
      top = x + 2;
      bottom = x + 7;
    }
    const v = this.vmData;
    v[MF_X] = x;
    v[MF_Y] = y;
    v[MF_FRC_TOP_X] = top;
    v[MF_FRC_BOTTOM_X] = bottom;
    v[MF_ALIGH] = below ? 2 : 1;
    this.setMessage(msg);
  }

  /** doUpdate(String, GWidget, below, frc): points at the widget's middle, top or bottom edge. */
  doUpdate(msg: string | null, w: GWidget, below: boolean, frc: number): void {
    this.doUpdatePoint(msg, w.getAbsX() + ((w.getW() / 2) | 0), w.getAbsY() + (below ? w.getH() : 0), below, frc);
  }

  draw(g: Graphics): void {
    const v = this.vmData;
    this.doDraw(g, v[MF_X], v[MF_Y], v[MF_FRC_TOP_X], v[MF_FRC_BOTTOM_X]);
  }

  private doDraw(g: Graphics, x: number, y: number, frcTop: number, frcBottom: number): void {
    if (this.isShowMsg && this.message == null) return;
    // Java counts paints (one per 50 ms tick); the browser paints per frame, so count ticks.
    if (this.isShowTime) {
      if (uiClock.tick !== this.lastTick) {
        this.lastTick = uiClock.tick;
        this.drawCount--;
      }
      if (this.drawCount < 0) return;
    }
    const v = this.vmData;
    const w = v[MF_W];
    const h = v[MF_H];
    const bw = w + 8;
    const bh = h + 8;
    let left = x - ((bw / 2) | 0);
    let top = y - (v[MF_ALIGH] === 1 ? bh : 0);
    if (left < v[MF_LEFT]) left = v[MF_LEFT] + 5;
    if (left + bw > v[MF_RIGHT]) left = v[MF_RIGHT] - bw - 5;
    if (top < v[MF_TOP]) top = v[MF_TOP] + 5;
    if (top + bh > v[MF_BOTTOM]) top = v[MF_BOTTOM] - bh - 5;
    let fb = frcBottom < left ? left + 1 : frcBottom;
    if (fb > left + bw) fb = left + bw - 1;
    let textColor = 0;
    let frcColor = 0;
    if (v[MF_CSS] === CSS_ARC_RECT) {
      g.setColor(4352372);
      fillArcRect(g, left, top, bw, bh);
      g.setColor(14414311);
      fillArcRect(g, left + 1, top + 1, w + 6, h + 6);
      frcColor = 14414311;
    } else if (v[MF_CSS] === CSS_HALF_APHA) {
      fillAlphaRect(g, -1409286144, left, top, bw, bh);
      textColor = 16765054;
    }
    if (this.isShowFrc) {
      if (v[MF_ALIGH] === 1) fillTriangle(g, frcColor, frcTop, top + bh + 7, 8, 8, fb, 2);
      else if (v[MF_ALIGH] === 2) fillTriangle(g, frcColor, frcTop, top - 7, 8, 8, fb, 3);
    }
    if (this.isShowMsg && this.message != null) {
      g.setColor(textColor);
      let yy = top + 4;
      for (const l of this.message) {
        l.draw(g, left + 4, yy, 0);
        yy += l.height;
      }
    }
  }
}
