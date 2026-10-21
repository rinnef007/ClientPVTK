// Port of the com.hz.gui widget model (Vineflower decompile of classes2.dex; GContainer.layoutV
// from CFR, which Vineflower could not decompile): vmData slots, size/position setters and the
// container layouts actually used by the shipped .ui files (V 113×, G2 18×, G 11×, H 6×; no
// border layout). Painting follows GLabel.paint / GLinePanel.paint; text uses the system font
// until the .t pixel fonts are ported, and focus/scrolling/input are not ported yet.
import type { Graphics } from '../../midp/Graphics';
import { BOTTOM, HCENTER, RIGHT, TOP, VCENTER } from '../../midp/anchor';
import { drawBorderString, drawBoxLines, drawFrameBox, drawScrollBar, drawScrollBar2, getBackIcon, drawImageNumber, fillArcRect, fillArcRect2, getImageSet } from '../main/GameView';
import type { ImageSet } from '../image/ImageSet';
import type { Image } from '../image/Image';
import { drawGameImage } from '../common/Utilities';
import type { GameSprite } from '../sprite/GameSprite';
import { PixelFont, PixelString } from '../string/PixelFont';
import { PowerString } from '../string/PowerString';
import { isColliding, isNullText, rectGetIntersection, rectIn } from '../common/Tool';

const MAX = 2147483647;

export const VM = {
  SYS_TYPE: 0, TYPE: 1, X: 2, Y: 3, W: 4, H: 5, XX: 6, YY: 7,
  BORDER_LEFT: 8, BORDER_TOP: 9, BORDER_RIGHT: 10, BORDER_BOTTOM: 11,
  MAX_WIDTH: 12, MIN_WIDTH: 13, MAX_HEIGHT: 14, MIN_HEIGHT: 15,
  JAVA_GWIDGET: 16, OFFSET_X: 17, OFFSET_Y: 18, EVENT_TYPE: 19, EVENT_SETTING: 20,
} as const;

export const SETTING_IS_FOCUS = 1;
export const SETTING_IS_OUTVIEW = 2;
export const SETTING_IS_SCALE = 4;
export const SETTING_IS_SHOW = 8;
export const SETTING_NO_NEED_LAYOUT = 16;
export const SETTING_PRESS = 32;
export const SETTING_DRAG = 64;
export const SETTING_ENABLE_FOCUS = 128;
export const SETTING_KEY_UP = 256;
export const SETTING_KEY_DOWN = 512;
export const SETTING_KEY_LEFT = 1024;
export const SETTING_KEY_RIGHT = 2048;
export const SETTING_REPEAT = 4096;

/** Text metrics provider (GLabel uses Font.getHeight/stringWidth). */
export const uiFont = {
  height: 18,
  stringWidth: (s: string): number => s.length * 8,
};

/** GameCanvas.SCREEN_WIDTH / GameView.uiMaxWidth. */
export const uiScreen = { width: 320, height: 480 };

/**
 * Logic tick counter. Java paints once per 50ms tick, and some widgets advance animations in
 * paint(); the browser paints per display frame, so those widgets advance once per tick instead.
 */
export const uiClock = { tick: 0 };

/** GameCanvas.isMotion: flips every 8 logic ticks; blinking widgets hide while it is 1. */
export function isMotion(): number {
  return (uiClock.tick >> 3) & 1;
}

let keySeq = 0;

/** GWidget.DEFAULT_INT_ARRAY: the shared "no colour table" marker ({-1}). */
export const DEFAULT_INT_ARRAY: readonly number[] = [-1];

export class GWidget {
  vm: Int32Array;
  parent: GContainer | null = null;
  colorTable: number[] | null = DEFAULT_INT_ARRAY as number[];
  focusColorTable: number[] | null = DEFAULT_INT_ARRAY as number[];
  fragmentTable: number[] | null = null;
  focusFragmentTable: number[] | null = null;
  shadeColorTable: number[] | null = null;
  focusShadeColorTable: number[] | null = null;
  /** setObj/getObj: the game object a widget shows (an item, a player…). */
  private obj: unknown = null;
  /** Rebuilds this widget from its .ui data (set by UIBuilder); see getClone. */
  cloneSource: (() => GWidget) | null = null;

  constructor(vm: Int32Array) {
    this.vm = vm;
    this.setShow(true);
    this.setScale(true);
    if (this.getMaxW() === 0) this.vm[VM.MAX_WIDTH] = MAX;
    if (this.getMaxH() === 0) this.vm[VM.MAX_HEIGHT] = MAX;
    vm[VM.JAVA_GWIDGET] = ++keySeq;
    this.setType(0);
  }

  // --- settings bits (vm[EVENT_SETTING]) ---
  setGWidgetSetting(bit: number, on: boolean): void {
    const v = this.vm[VM.EVENT_SETTING];
    this.vm[VM.EVENT_SETTING] = on ? v | bit : v & ~bit;
  }
  isGWidgetSetting(bit: number): boolean {
    return (this.vm[VM.EVENT_SETTING] & bit) !== 0;
  }
  setShow(v: boolean): void {
    this.setGWidgetSetting(SETTING_IS_SHOW, v);
  }
  isShow(): boolean {
    return this.isGWidgetSetting(SETTING_IS_SHOW);
  }
  setScale(v: boolean): void {
    this.setGWidgetSetting(SETTING_IS_SCALE, v);
  }
  isScale(): boolean {
    return this.isGWidgetSetting(SETTING_IS_SCALE);
  }
  setOutView(v: boolean): void {
    this.setGWidgetSetting(SETTING_IS_OUTVIEW, v);
  }
  isOutView(): boolean {
    return this.isGWidgetSetting(SETTING_IS_OUTVIEW);
  }
  isFocus(): boolean {
    return this.isGWidgetSetting(SETTING_IS_FOCUS);
  }
  setObj(o: unknown): void {
    this.obj = o;
  }
  /**
   * getClone: a fresh copy built from the same .ui data. Java copies the live state instead; the
   * screens only clone library templates that are not changed before cloning, so this matches.
   */
  getClone(): GWidget {
    if (this.cloneSource == null) throw new Error('widget has no .ui source to clone');
    return this.cloneSource();
  }
  getObj(): unknown {
    return this.obj;
  }
  setFocus(v: boolean): void {
    this.setGWidgetSetting(SETTING_IS_FOCUS, v);
  }
  /** Bit 128: can take the focus (keys move it, taps select it). */
  isEnableFocus(): boolean {
    return this.isGWidgetSetting(SETTING_ENABLE_FOCUS);
  }

  /** True when some ancestor is scrolled, so the widget may stick out of its viewport. */
  parentNeedScroll(): boolean {
    for (let p = this.parent; p != null; p = p.parent) if (p.needScrollBar) return true;
    return false;
  }

  /** Visible part of the widget: its box cut by every ancestor's inner box (text areas excepted). */
  getIntersect(): [number, number, number, number] {
    const vm = this.vm;
    const p = this.parent;
    if (p == null || p.getType() === 52) return [vm[VM.XX] + vm[VM.OFFSET_X], vm[VM.YY] + vm[VM.OFFSET_Y], vm[VM.W], vm[VM.H]];
    const r = p.getIntersect();
    const pv = p.vm;
    return rectGetIntersection(vm[VM.XX] + vm[VM.OFFSET_X], vm[VM.YY] + vm[VM.OFFSET_Y], vm[VM.W], vm[VM.H],
      r[0] + pv[VM.BORDER_LEFT], r[1] + pv[VM.BORDER_TOP], r[2] - pv[VM.BORDER_LEFT] - pv[VM.BORDER_RIGHT], r[3] - pv[VM.BORDER_TOP] - pv[VM.BORDER_BOTTOM]);
  }

  /** The clip every widget paint starts with. */
  protected setPaintClip(g: Graphics): void {
    if (this.parentNeedScroll()) g.setClip(...this.getIntersect());
    else g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
  }
  SetNeedLayout(need: boolean): void {
    this.setGWidgetSetting(SETTING_NO_NEED_LAYOUT, !need);
  }
  getNoNeedLayout(): boolean {
    return this.isGWidgetSetting(SETTING_NO_NEED_LAYOUT);
  }

  setType(t: number): void {
    this.vm[VM.TYPE] = t;
  }
  getType(): number {
    return this.vm[VM.TYPE];
  }
  getEventType(): number {
    return this.vm[VM.EVENT_TYPE];
  }
  setEventType(t: number): void {
    this.vm[VM.EVENT_TYPE] = t;
  }

  getX(): number {
    return this.vm[VM.X];
  }
  getY(): number {
    return this.vm[VM.Y];
  }
  getW(): number {
    return this.vm[VM.W];
  }
  getH(): number {
    return this.vm[VM.H];
  }
  getXX(): number {
    return this.vm[VM.XX];
  }
  getYY(): number {
    return this.vm[VM.YY];
  }
  getMinW(): number {
    return this.vm[VM.MIN_WIDTH];
  }
  getMinH(): number {
    return this.vm[VM.MIN_HEIGHT];
  }
  getMaxW(): number {
    return this.vm[VM.MAX_WIDTH];
  }
  getMaxH(): number {
    return this.vm[VM.MAX_HEIGHT];
  }

  getAbsX(): number {
    let x = this.vm[VM.X];
    for (let p = this.parent; p != null; p = p.parent) x += p.vm[VM.X];
    return x;
  }
  getAbsY(): number {
    let y = this.vm[VM.Y];
    for (let p = this.parent; p != null; p = p.parent) y += p.vm[VM.Y];
    return y;
  }

  setPos(x: number, y: number): void {
    this.vm[VM.X] = x;
    this.vm[VM.Y] = y;
    this.vm[VM.XX] = this.getAbsX();
    this.vm[VM.YY] = this.getAbsY();
  }

  getParentWindow(): GWindow | null {
    for (let p = this.parent; p != null; p = p.parent) if (p instanceof GWindow) return p;
    return null;
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    this.setPos(x, y);
    const win = this instanceof GWindow ? this : this.getParentWindow();
    let ww = w;
    if (win != null && win.fullScreen) {
      if (x + w > uiScreen.width) ww = uiScreen.width - x;
    } else if (w > uiScreen.width) {
      ww = uiScreen.width;
    }
    this.vm[VM.W] = ww;
    this.vm[VM.H] = h;
  }

  setW(w: number): void {
    if (w >= 0) this.vm[VM.W] = w;
  }
  setH(h: number): void {
    if (h >= 0) this.vm[VM.H] = h;
  }
  setSize(w: number, h: number): void {
    this.setW(w);
    this.setH(h);
  }
  setMinSize(w: number, h: number): void {
    if (w >= 0) this.vm[VM.MIN_WIDTH] = w;
    if (h >= 0) this.vm[VM.MIN_HEIGHT] = h;
  }
  setMinHeight(h: number): void {
    if (h >= 0) this.vm[VM.MIN_HEIGHT] = h;
  }
  setMinWidth(w: number): void {
    if (w >= 0) this.vm[VM.MIN_WIDTH] = w;
  }
  setMaxSize(w: number, h: number): void {
    if (w >= 0) this.vm[VM.MAX_WIDTH] = w;
    if (h >= 0) this.vm[VM.MAX_HEIGHT] = h;
  }
  setOffsetXY(x: number, y: number): void {
    this.vm[VM.OFFSET_X] = x;
    this.vm[VM.OFFSET_Y] = y;
  }
  /** (top, bottom, left, right) insets. */
  setBorder(top: number, bottom: number, left: number, right: number): void {
    if (top >= 0) this.vm[VM.BORDER_TOP] = top;
    if (left >= 0) this.vm[VM.BORDER_LEFT] = left;
    if (right >= 0) this.vm[VM.BORDER_RIGHT] = right;
    if (bottom >= 0) this.vm[VM.BORDER_BOTTOM] = bottom;
  }

  setColorTable(t: number[]): void {
    this.colorTable = t;
  }
  setFocusColorTable(t: number[]): void {
    this.focusColorTable = t;
  }
  setFragmentTable(t: number[]): void {
    this.fragmentTable = t;
  }
  setFocusFragmentTable(t: number[]): void {
    this.focusFragmentTable = t;
  }
  setShadeColorTable(t: number[]): void {
    this.shadeColorTable = t;
  }
  setFocusShadeColorTable(t: number[]): void {
    this.focusShadeColorTable = t;
  }

  paint(_g: Graphics): void {}
}

const LAYOUT_NONE = 0;
const LAYOUT_H = 1;
const LAYOUT_V = 2;
const LAYOUT_GRID = 4;
const LAYOUT_GRID2 = 8;
const ALIGN_FILL = 256;
const ALIGN_HCENTER = 512;
const ALIGN_VCENTER = 1024;

/** com.hz.gui.IGTopDraw. */
export interface IGTopDraw {
  draw(g: Graphics): void;
}

export class GContainer extends GWidget {
  children: GWidget[] = [];
  /** [mode, hgap, vgap, align, rows|gridW, cols|gridH] */
  layoutData = [0, 0, 0, 0, 0, 0];
  isIntersectView = false;
  needScrollBar = false;
  outHeight = 0;
  realHeight = 0;
  firstInViewIndex = -1;
  lastInViewIndex = -1;
  gsb: GScrollBar | null = null;

  constructor(vm: Int32Array) {
    super(vm);
    this.setScale(true);
    this.setType(50);
  }

  add(w: GWidget): void {
    w.parent = this;
    this.children.push(w);
  }

  insert(w: GWidget, index: number): void {
    w.parent = this;
    this.children.splice(index, 0, w);
  }

  remove(w: GWidget): void {
    const i = this.children.indexOf(w);
    if (i >= 0) this.children.splice(i, 1);
    const win = w.getParentWindow();
    if (win != null && win.focusWidget === w) win.focusWidget = null;
  }

  getChildNum(): number {
    return this.children.length;
  }

  /** GContainer.clear: drop the children and reset the scroll bar. */
  clear(): void {
    this.children.length = 0;
    this.gsb?.reset();
  }

  getScrollBar(): GScrollBar | null {
    return this.gsb;
  }

  /** GContainer.show: re-place children and lay out again. */
  show(): void {
    this.setAbs();
    this.layout();
  }

  setLayoutMode(mode: number, hgap: number, vgap: number, align: number, a: number, b: number): void {
    this.layoutData = [mode, hgap, vgap, align, a, b];
  }

  setPos(x: number, y: number): void {
    super.setPos(x, y);
    this.setAbs();
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    super.setBounds(x, y, w, h);
    this.setAbs();
    this.refreshScrollBar();
  }

  setAbs(): void {
    for (const c of this.children) {
      c.vm[VM.XX] = c.getAbsX();
      c.vm[VM.YY] = c.getAbsY();
      if (c instanceof GContainer) {
        c.setAbs();
        if (c.gsb != null) {
          c.gsb.vm[VM.XX] = c.gsb.getAbsX();
          c.gsb.vm[VM.YY] = c.gsb.getAbsY();
        }
      }
    }
  }

  addScrollBar(sb: GScrollBar | null): void {
    this.gsb = sb;
    if (sb != null) sb.parent = this;
  }

  /** Docks the scroll bar at the left, centre or right edge, full height. */
  refreshScrollBar(): void {
    const sb = this.gsb;
    if (sb == null) return;
    const x = sb.align === 1 ? ((this.vm[VM.W] - sb.getMinW()) / 2) | 0 : sb.align === 2 ? this.vm[VM.W] - sb.getMinW() : 0;
    sb.setBounds(x, 0, sb.getMinW(), this.vm[VM.H]);
  }

  // --- input (GContainer key / pointer handling) ---
  /** Receives arrow keys when the matching SETTING_KEY_* bit is also set. */
  canCatchKey = false;
  isCatchHotKey = false;

  setCatchKey(v: boolean): void {
    this.canCatchKey = v;
  }

  getIndex(w: GWidget | null): number {
    return w == null ? -1 : this.children.indexOf(w);
  }

  getJavaChild(i: number): GWidget | null {
    return i >= 0 && i < this.children.length ? this.children[i] : null;
  }

  /** Depth-first: the first shown container that takes this key direction (or hot keys). */
  getCatchKeyContainer(hotKey: boolean, bit: number): GContainer | null {
    const takes = (c: GContainer) => (hotKey ? c.isCatchHotKey : c.canCatchKey && c.isGWidgetSetting(bit));
    if (takes(this)) return this;
    for (const c of this.children) {
      if (!(c instanceof GContainer) || !c.isShow()) continue;
      if (takes(c)) return c;
      const r = c.getCatchKeyContainer(hotKey, bit);
      if (r != null) return r;
    }
    return null;
  }

  getLayoutGColumn(): number {
    const d = this.layoutData;
    if (d[0] === LAYOUT_GRID2) return ((this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT] + d[1]) / (d[4] + d[1])) | 0;
    return d[5];
  }

  keyPressUp(): void {}
  keyPressDown(): void {}
  keyPressLeft(): void {}
  keyPressRight(): void {}
  hotKeyPress(_key: number): void {}
  moveUpPage(): void {}
  moveDownPage(): void {}

  /** Scrolls the content up by one child (shows the next one below). */
  moveUp(): void {
    const last = this.lastInViewIndex;
    if (last <= -1 || last + 1 >= this.children.length) return;
    const a = this.children[last];
    const b = this.children[last + 1];
    let d = a.vm[VM.Y] - b.vm[VM.Y];
    if (last + 1 === this.children.length - 1) d -= b.getH();
    this.setChildrenOffset(0, d);
  }

  /** Scrolls the content down by one child (shows the previous one above). */
  moveDown(): void {
    const first = this.firstInViewIndex;
    if (first <= 0) return;
    const a = this.children[first - 1];
    const b = this.children[first];
    let d = b.vm[VM.Y] - a.vm[VM.Y];
    if (first - 1 === 0) d += b.getH();
    this.setChildrenOffset(0, d);
  }

  /** Moves every child by (dx, dy) (dy clamped by the scroll bar range) and recomputes the in-view range. */
  setChildrenOffset(dx: number, dy: number): void {
    this.firstInViewIndex = -1;
    this.lastInViewIndex = -1;
    let d = dy;
    const sb = this.gsb;
    if (sb != null) {
      if (sb.scrollPos - dy > sb.maxScrollDis) {
        d = sb.scrollPos - sb.maxScrollDis;
        sb.scrollPos = sb.maxScrollDis;
      } else {
        const old = sb.scrollPos;
        sb.scrollPos -= dy;
        if (sb.scrollPos < 0) {
          sb.scrollPos = 0;
          d = old;
        }
      }
    }
    const vm = this.vm;
    const n = this.children.length;
    this.children.forEach((c, i) => {
      c.setPos(c.vm[VM.X] + dx, c.vm[VM.Y] + d);
      const inView = isColliding(vm[VM.BORDER_LEFT], vm[VM.BORDER_TOP], vm[VM.W] - vm[VM.BORDER_LEFT] - vm[VM.BORDER_RIGHT],
        vm[VM.H] - vm[VM.BORDER_TOP] - vm[VM.BORDER_BOTTOM], c.vm[VM.X], c.vm[VM.Y], c.vm[VM.W], c.vm[VM.H]);
      c.setOutView(!inView);
      if (inView) {
        if (this.firstInViewIndex === -1) this.firstInViewIndex = i;
        if (i === n - 1 && this.lastInViewIndex === -1) this.lastInViewIndex = i;
      } else if (this.lastInViewIndex === -1 && this.firstInViewIndex !== -1) {
        this.lastInViewIndex = i - 1;
      }
    });
    this.setAbs();
  }

  /** Scrolls so that `to` (newly focused, previously `from`) is fully visible. */
  setSrollBar(from: GWidget | null, to: GWidget | null): void {
    if (from === to || to == null) return;
    const top = this.vm[VM.BORDER_TOP];
    let bot = this.vm[VM.H] - this.vm[VM.BORDER_BOTTOM];
    const ty = to.vm[VM.Y];
    const th = to.vm[VM.H];
    const partial = (ty < top && ty + th > top) || (ty < bot && ty + th > bot);
    if (!to.isOutView() && !partial) return;
    const first = this.children[this.firstInViewIndex];
    const last = this.children[this.lastInViewIndex];
    if (first == null || last == null) return; // Java throws here (elementAt(-1))
    let d: number;
    if (this.children[0] === to) {
      d = this.gsb != null ? this.gsb.scrollPos : 0;
    } else if (to === this.children[this.children.length - 1]) {
      bot = Math.min(last.vm[VM.Y] + last.vm[VM.H], bot);
      d = bot - (ty + th);
    } else if (from != null && ty < from.vm[VM.Y]) {
      if (from.isOutView()) d = first.vm[VM.Y] + first.vm[VM.H] - ty;
      else if (partial) d = top - ty;
      else d = Math.max(first.vm[VM.Y], top) - ty;
    } else if (from != null && from.isOutView()) {
      d = ty <= from.vm[VM.Y] ? 0 : first.vm[VM.Y] - from.vm[VM.Y];
    } else if (partial) {
      d = bot - (ty + th);
    } else {
      bot = Math.min(last.vm[VM.Y] + last.vm[VM.H], bot);
      d = bot - (ty + th);
    }
    this.setChildrenOffset(0, d);
  }

  /** Drag scrolling (only when there is a scroll bar to track it). */
  pointerDrag(dx: number, dy: number): void {
    if (this.needScrollBar && this.gsb != null) this.setChildrenOffset(dx, dy);
  }

  isPointAtScrollBar(bit: number, x: number, y: number): boolean {
    const sb = this.gsb;
    if (!this.needScrollBar || sb == null || !sb.isGWidgetSetting(bit)) return false;
    return rectIn(sb.vm[VM.XX] + sb.vm[VM.OFFSET_X], sb.vm[VM.YY], sb.vm[VM.W], sb.vm[VM.H], x, y);
  }

  private inRect(x: number, y: number): boolean {
    return rectIn(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H], x, y);
  }

  /** The focusable widget under a tap (bit 32) or a held press (bit 4096); children before the container. */
  searchPressGWidget(x: number, y: number, bit = SETTING_PRESS): GWidget | null {
    if (!this.isShow() || this.isOutView()) return null;
    if (this.isPointAtScrollBar(bit, x, y)) return this.gsb;
    for (const c of this.children) {
      if (c instanceof GContainer) {
        const r = c.searchPressGWidget(x, y, bit);
        if (r != null) return r;
      } else if (c.isEnableFocus() && c.isGWidgetSetting(bit) && c.isShow() && !c.isOutView()
        && rectIn(c.vm[VM.XX], c.vm[VM.YY], c.vm[VM.W], c.vm[VM.H], x, y)) {
        return c;
      }
    }
    return this.isEnableFocus() && this.isGWidgetSetting(bit) && this.inRect(x, y) ? this : null;
  }

  searchRepeatedGWidget(x: number, y: number): GWidget | null {
    return this.searchPressGWidget(x, y, SETTING_REPEAT);
  }

  /** What a press-and-drag at (x, y) grabs: a scroll bar, or the outermost draggable container. */
  searchDragGWidget(x: number, y: number): GWidget | null {
    if (!this.isShow() || this.isOutView()) return null;
    if (this.isPointAtScrollBar(SETTING_DRAG, x, y)) return this.gsb;
    if (this.isGWidgetSetting(SETTING_DRAG) && this.inRect(x, y)) return this;
    for (const c of this.children) {
      if (c instanceof GContainer) {
        const r = c.searchDragGWidget(x, y);
        if (r != null) return r;
      } else if (c.isGWidgetSetting(SETTING_DRAG) && c.isShow() && !c.isOutView()
        && rectIn(c.vm[VM.XX], c.vm[VM.YY], c.vm[VM.W], c.vm[VM.H], x, y)) {
        return c;
      }
    }
    return null;
  }

  /** First child with the given event type (UIHandler uses 997 for a text area's page label). */
  getJavaChildByEvent(e: number): GWidget | null {
    return this.children.find((c) => c.getEventType() === e) ?? null;
  }

  layout(): void {
    this.layout2();
    this.align();
  }

  private getPerfectHeight(w: GWidget, max: number): number {
    let h = w.getMinH();
    if (w.getType() === 52 && w.getH() > h) h = w.getH();
    if (h > max && max > 0) h = max;
    return h;
  }

  private getPerfectWidth(w: GWidget, max: number): number {
    let v = w.getMinW();
    if (w.getType() === 52 && w.getW() > v) v = w.getW();
    return v <= max || max <= 0 ? v : max;
  }

  layout2(): void {
    switch (this.layoutData[0]) {
      case LAYOUT_NONE:
        for (const c of this.children) if (!c.getNoNeedLayout() && c instanceof GContainer) c.layout2();
        break;
      case LAYOUT_H:
        this.layoutH();
        break;
      case LAYOUT_V:
        this.layoutV();
        break;
      case LAYOUT_GRID:
        this.layoutG();
        break;
      case LAYOUT_GRID2:
        this.layoutG2();
        break;
      // 17 (border) is unused by the shipped .ui files and not ported.
    }
  }

  private clampW(w: number): number {
    return w < this.getMinW() ? this.getMinW() : w > this.getMaxW() ? this.getMaxW() : w;
  }

  private layoutH(): void {
    let x = this.vm[VM.BORDER_LEFT];
    let maxH = 0;
    for (const c of this.children) {
      if (c.getNoNeedLayout()) continue;
      if (c instanceof GContainer) c.layout2();
      const w = this.getPerfectWidth(c, 0);
      const h = this.getPerfectHeight(c, 0);
      c.setBounds(x, this.vm[VM.BORDER_TOP], w, h);
      x += this.layoutData[1] + w;
      if (h > maxH) maxH = h;
    }
    if (!this.isScale()) return;
    const w = this.clampW(this.vm[VM.BORDER_RIGHT] + x - this.layoutData[1]);
    let h = this.vm[VM.BORDER_TOP] + maxH + this.vm[VM.BORDER_BOTTOM];
    h = h < this.getMinH() ? this.getMinH() : h > this.getMaxH() ? this.getMaxH() : h;
    this.setSize(w, h);
    this.setMinSize(w, h);
  }

  /** Stacks children, marks the ones past maxHeight as out of view (scrolling), then fits. */
  private layoutV(): void {
    const n = this.children.length;
    const vgap = this.layoutData[2];
    const bottom = this.vm[VM.BORDER_BOTTOM];
    this.firstInViewIndex = 65535;
    this.lastInViewIndex = 65535;
    let y = this.vm[VM.BORDER_TOP];
    let cut = 0;
    let maxW = 0;
    let prevOut: boolean = false;
    for (let i = 0; i < n; i++) {
      const c = this.children[i];
      c.setOutView(false);
      if (c.getNoNeedLayout()) continue;
      if (c instanceof GContainer) c.layout2();
      const w = this.getPerfectWidth(c, 0);
      const h = this.getPerfectHeight(c, 0);
      c.setBounds(this.vm[VM.BORDER_LEFT], y, w, h);
      let out: boolean = prevOut;
      if (cut === 0) {
        const limit = this.getMaxH() - bottom;
        if (this.isIntersectView ? y > limit : y + h > limit) out = true;
      }
      if (out) c.setOutView(true);
      let newCut = cut;
      if (out && cut === 0) {
        if (this.firstInViewIndex === 65535) this.firstInViewIndex = 0;
        if (this.lastInViewIndex === 65535) this.lastInViewIndex = i - 1;
        if (this.getMinH() === this.getMaxH() && y < this.getMinH() - bottom) {
          c.setOutView(false);
          newCut = this.getMinH() - bottom;
        } else {
          newCut = y;
        }
      }
      y += h + vgap;
      if (w > maxW) maxW = w;
      cut = newCut;
      prevOut = out;
    }
    if (this.firstInViewIndex === 65535) this.firstInViewIndex = 0;
    if (this.lastInViewIndex === 65535) this.lastInViewIndex = n - 1;
    this.realHeight = y - vgap + bottom;
    if (cut > 0) {
      this.needScrollBar = true;
      this.outHeight = y - cut;
      if (this.gsb != null) {
        this.gsb.maxScrollDis = this.outHeight;
        this.gsb.showDis = cut;
      }
      y = cut;
    } else {
      this.needScrollBar = false;
    }
    if (!this.isScale()) return;
    const content = y - vgap;
    const w = this.clampW(this.vm[VM.BORDER_LEFT] + maxW + this.vm[VM.BORDER_RIGHT]);
    let inner: number;
    if (bottom + content > this.getMaxH()) inner = this.getMaxH() - bottom;
    else if (bottom + content >= this.getMinH()) inner = content;
    else inner = this.getMinH() - bottom;
    this.setSize(w, bottom + inner);
    this.setMinSize(w, bottom + inner);
  }

  private layoutG(): void {
    const [, hgap, vgap, , rows, cols] = this.layoutData;
    if (rows <= 0 || cols <= 0) return;
    const iw = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
    const ih = this.vm[VM.H] - this.vm[VM.BORDER_TOP] - this.vm[VM.BORDER_BOTTOM];
    const cellW = (((hgap + iw) / cols) | 0) - hgap;
    const cellH = (((vgap + ih) / rows) | 0) - vgap;
    this.layoutGrid(this.vm[VM.BORDER_LEFT], this.vm[VM.BORDER_TOP], iw, ih, cellW, cellH, rows, cols);
  }

  private layoutG2(): void {
    const [, hgap, vgap, , gw, gh] = this.layoutData;
    const iw = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
    const cols = ((hgap + iw) / (hgap + gw)) | 0;
    const ih = this.vm[VM.H] - this.vm[VM.BORDER_TOP] - this.vm[VM.BORDER_BOTTOM];
    const rows = ((vgap + ih) / (vgap + gh)) | 0;
    this.layoutGrid(this.vm[VM.BORDER_LEFT], this.vm[VM.BORDER_TOP], iw, ih, gw, gh, rows, cols);
  }

  private layoutGrid(x0: number, y0: number, iw: number, ih: number, cw: number, ch: number, rows: number, cols: number): void {
    if (cols <= 0) return;
    const hgap = this.layoutData[1];
    const vgap = this.layoutData[2];
    const padX = ((iw - (hgap + cw) * cols) / 2) | 0;
    const padY = ((ih - (vgap + ch) * rows) / 2) | 0;
    const n = this.children.length;
    const usedRows = ((n / cols) | 0) + (n % cols > 0 ? 1 : 0);
    for (let r = 0; r < usedRows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (k > n - 1) continue;
        const x = (hgap + cw) * c + x0 + padX + ((hgap / 2) | 0);
        const y = (vgap + ch) * r + y0 + padY + ((vgap / 2) | 0);
        const w = this.children[k];
        if (w.isScale()) w.setBounds(x, y, cw, ch);
        else w.setBounds((((cw - w.vm[VM.W]) / 2) | 0) + x, (((ch - w.vm[VM.H]) / 2) | 0) + y, w.vm[VM.W], w.vm[VM.H]);
      }
    }
    const visible = cols * rows;
    this.needScrollBar = visible < n;
    if (this.needScrollBar) {
      this.outHeight = (usedRows - rows) * (vgap + ch);
      if (this.gsb != null) {
        this.gsb.maxScrollDis = this.outHeight;
        this.gsb.showDis = rows * (vgap + ch);
      }
    } else if (this.gsb != null) {
      this.gsb.maxScrollDis = 0;
    }
    this.firstInViewIndex = 0;
    this.lastInViewIndex = this.needScrollBar ? visible - 1 : n - 1;
    this.children.forEach((w, i) => w.setOutView(i >= visible));
  }

  align(): void {
    this.alignChildren();
    this.refreshScrollBar();
  }

  private alignChildren(): void {
    const n = this.children.length;
    const mode = this.layoutData[3];
    if (mode === 0) {
      for (const c of this.children) if (!c.getNoNeedLayout() && c instanceof GContainer) c.align();
      return;
    }
    if (mode === ALIGN_FILL) {
      const cellW = this.layoutData[0] === LAYOUT_H
        ? ((this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT] - (n - 1) * this.layoutData[1]) / n) | 0
        : 0;
      this.children.forEach((c, i) => {
        if (c.getNoNeedLayout()) return;
        if (this.layoutData[0] === LAYOUT_V) {
          c.setBounds(c.vm[VM.X], c.vm[VM.Y], this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT], c.vm[VM.H]);
        } else if (this.layoutData[0] === LAYOUT_H) {
          let x = this.vm[VM.BORDER_LEFT] + (this.layoutData[1] + cellW) * i;
          let w = cellW;
          if (!this.isScale()) {
            w = c.vm[VM.W];
            x += ((cellW - w) / 2) | 0;
          }
          c.setBounds(x, c.vm[VM.Y], w, c.vm[VM.H]);
        }
        if (c instanceof GContainer) c.align();
      });
      return;
    }
    for (const c of this.children) {
      if (c.getNoNeedLayout()) continue;
      if (mode === ALIGN_HCENTER) {
        const inner = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
        c.setPos(c.vm[VM.X] + (((inner - c.vm[VM.W]) / 2) | 0), c.vm[VM.Y]);
      } else if (mode === ALIGN_VCENTER) {
        const inner = this.vm[VM.H] - this.vm[VM.BORDER_TOP] - this.vm[VM.BORDER_BOTTOM];
        c.setPos(c.vm[VM.X], c.vm[VM.Y] + (((inner - c.vm[VM.H]) / 2) | 0));
      } else {
        continue;
      }
      if (c instanceof GContainer) c.align();
    }
  }

  /** GContainer.paintChildren: visible, in-view children only, then the top draws. */
  paintChildren(g: Graphics): void {
    for (const c of this.children) if (c.isShow() && !c.isOutView()) c.paint(g);
    if (this.gsb != null && this.needScrollBar) this.gsb.paint(g);
    if (this.topDrawVector != null) for (const d of this.topDrawVector) d.draw(g);
  }

  /** IGTopDraw objects painted over the children (e.g. MessageFrame). */
  topDrawVector: IGTopDraw[] | null = null;

  addTopDraw(d: IGTopDraw): void {
    (this.topDrawVector ??= []).push(d);
  }

  getJavaTopDraw(i: number): IGTopDraw | null {
    return this.topDrawVector?.[i] ?? null;
  }

  paint(g: Graphics): void {
    this.paintChildren(g);
  }
}

export class GLinePanel extends GContainer {
  isLeftRightBgColorDisable = false;
  underLineColor = -1;
  cornerRes: ImageSet | null = null;
  frameIndex = 0;
  bottomFrameIndex = 0;

  /** DATA_LINEPANEL: colour table plus corner frames from an image set. */
  setData(colors: number[], setId: number, top: number, bottom: number): void {
    this.colorTable = colors;
    const set = getImageSet(setId);
    if (set != null) {
      this.cornerRes = set;
      this.frameIndex = top;
      this.bottomFrameIndex = bottom;
    }
  }

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(51);
  }

  /** GLinePanel.paint: frame box at the offset-adjusted absolute position, then children. */
  paint(g: Graphics): void {
    this.setPaintClip(g);
    const focus = this.isFocus();
    const table = focus ? this.focusColorTable : this.colorTable;
    if (table != null) {
      let x = this.vm[VM.OFFSET_X] + this.vm[VM.XX];
      let w = this.vm[VM.W];
      if (this.isLeftRightBgColorDisable) {
        x -= table.length;
        w += table.length * 2;
      }
      drawFrameBox(g, x, this.vm[VM.OFFSET_Y] + this.vm[VM.YY], w, this.vm[VM.H], table,
        focus ? this.focusShadeColorTable : this.shadeColorTable,
        focus ? this.focusFragmentTable : this.fragmentTable, this.cornerRes, this.frameIndex, this.bottomFrameIndex);
    }
    if (this.underLineColor !== -1) {
      g.setColor(this.underLineColor);
      const x = this.vm[VM.OFFSET_X] + this.vm[VM.XX];
      const y = this.vm[VM.OFFSET_Y] + this.vm[VM.YY] + this.getH() - 1;
      g.drawLine(x, y, this.getW() + x - 2, y);
    }
    this.paintData(g);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
    this.paintChildren(g);
  }

  /** Content drawn over the panel and under the children (GTextArea's text). */
  paintData(_g: Graphics): void {}
}

export class GTextArea extends GLinePanel {
  text: string | null = null;
  textColor = 0;
  lineColor = -1;
  lineHeight: number;
  lineSpace = 0;
  anchor = 0;
  isAutoScroll = false;
  alertMsg: string | null = null;
  alertCount = 0;
  curPage = 0;
  totalPage = 0;
  counter = 0;
  pageGWidgetHeight = 0;
  messages: PowerString[] | null = null;
  private displayHeight = 0;
  private numChoicesHeight = 0;
  private numTotalOffsetHeight = 0;
  private offsetY = 0;
  private isPartRowShow = false;
  private piePageHeight: number[] = [];
  private lastTick = uiClock.tick;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(52);
    this.lineHeight = uiFont.height;
    if (this.lineHeight > this.getMinH()) this.setMinHeight(this.lineHeight);
    this.setCatchKey(true);
  }

  // Keys: up/down scroll by a line, left/right turn pages (wrapping).
  keyPressUp(): void {
    this.moveDown();
  }
  keyPressDown(): void {
    this.moveUp();
  }
  keyPressLeft(): void {
    this.moveUpPage();
  }
  keyPressRight(): void {
    this.moveDownPage();
  }

  getOffsetY(): number {
    return this.offsetY;
  }

  private syncScrollBar(): void {
    if (this.gsb != null) this.gsb.scrollPos = -this.offsetY | 0;
  }

  /** Shows the previous line. */
  moveDown(): void {
    this.updateOffsetY(this.realLineHeight(), true);
    this.syncScrollBar();
  }

  /** Shows the next line. */
  moveUp(): void {
    this.updateOffsetY(this.realLineHeight(), false);
    this.syncScrollBar();
  }

  moveDownPage(): void {
    if (++this.curPage >= this.totalPage) this.curPage = 0;
    this.offsetY = -this.getPageOffsetHeight() | 0;
    this.syncScrollBar();
    this.updatePageText();
  }

  moveUpPage(): void {
    if (--this.curPage < 0) this.curPage = this.totalPage - 1;
    this.offsetY = -this.getPageOffsetHeight() | 0;
    this.syncScrollBar();
    this.updatePageText();
  }

  private getPageOffsetHeight(): number {
    let h = 0;
    for (let i = 0; i < this.curPage && i < this.piePageHeight.length; i++) h += this.piePageHeight[i];
    return h;
  }

  /** Snaps the scroll position to the previous (`up`) or next line boundary. */
  private updateOffsetY(min: number, up: boolean): void {
    if (this.messages == null) return;
    const pos = -this.offsetY;
    let next = pos;
    let acc = 0;
    for (let i = 0; i < this.messages.length; i++) {
      const h = this.textHeight(i, min);
      acc += h;
      const diff = acc - pos;
      if (diff > 0) {
        if (up) next = Math.max(diff === h ? pos - this.textHeight(i - 1, min) : pos - (h - diff), 0);
        else next = Math.min(pos + diff, this.numTotalOffsetHeight);
        break;
      }
    }
    this.offsetY = -next | 0;
  }

  /** Drag scrolling, clamped by the scroll bar; partial rows are shown while dragging. */
  pointerDrag(_dx: number, dy: number): void {
    const sb = this.gsb;
    if (!this.needScrollBar || sb == null) return;
    this.isPartRowShow = true;
    let d = dy;
    if (sb.scrollPos - dy <= sb.maxScrollDis) {
      const old = sb.scrollPos;
      sb.scrollPos -= dy;
      if (sb.scrollPos < 0) {
        sb.scrollPos = 0;
        d = old;
      }
    } else {
      d = sb.scrollPos - sb.maxScrollDis;
      sb.scrollPos = sb.maxScrollDis;
    }
    this.offsetY += d;
  }

  /** DATA_TEXTAREA. */
  setTextData(text: string, color: number, anchor: number, autoScroll: boolean): void {
    this.isAutoScroll = autoScroll;
    this.textColor = color;
    this.anchor = anchor;
    this.setText(text);
  }

  setText(s: string | null): void {
    this.text = s;
    this.alertMsg = null;
    this.alertCount = 0;
    this.setLines();
  }

  setAlertText(s: string): void {
    this.alertMsg = s;
    this.alertCount = 20;
    this.setLines();
  }

  getText(): string | null {
    return isNullText(this.alertMsg) ? this.text : this.alertMsg;
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    const old = this.getH();
    super.setBounds(x, y, w, h);
    if (old !== this.getH()) this.setLines();
  }

  private realLineHeight(): number {
    return this.lineHeight + this.lineSpace;
  }

  private textHeight(i: number, min: number): number {
    const m = this.messages;
    if (m == null || i < 0 || i >= m.length || m[i] == null) return 0;
    return Math.max(m[i].height, min);
  }

  private totalLineHeight(min: number): number {
    let h = 0;
    for (let i = 0; this.messages != null && i < this.messages.length; i++) h += this.textHeight(i, min);
    return h;
  }

  private firstPageFullHeight(min: number, max: number): number {
    if (this.messages == null) return max;
    let h = 0;
    for (let i = 0; i < this.messages.length; i++) {
      const next = this.textHeight(i, min) + h;
      if (next > max) return h;
      h = next;
    }
    return max;
  }

  private adjustWidthHeight(): void {
    if (this.getW() < this.getMinW()) this.setW(this.getMinW());
    else if (this.getW() > this.getMaxW()) this.setW(this.getMaxW());
    if (this.getH() < this.getMinH()) this.setH(this.getMinH());
    else if (this.getH() > this.getMaxH()) this.setH(this.getMaxH());
  }

  /** Wraps the text to the inner width minus `reserve` and shrinks/grows the box to fit. */
  private initArea(reserve: number): void {
    this.curPage = 0;
    this.totalPage = 1;
    this.needScrollBar = false;
    this.offsetY = 0;
    this.numChoicesHeight = 0;
    this.numTotalOffsetHeight = 0;
    this.isPartRowShow = false;
    this.adjustWidthHeight();
    const right = Math.max(this.vm[VM.BORDER_RIGHT], reserve);
    const text = this.getText();
    this.messages = PowerString.splitPowerString(text, uiFont, this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - right);
    const tb = this.vm[VM.BORDER_TOP] + this.vm[VM.BORDER_BOTTOM];
    if (!isNullText(text)) {
      this.numChoicesHeight = this.totalLineHeight(this.realLineHeight());
      const h = this.numChoicesHeight + tb;
      if (h < this.getH()) this.setH(h);
      if (this.getH() < this.getMinH()) this.setH(this.getMinH());
    }
    this.displayHeight = this.vm[VM.H] - this.pageGWidgetHeight - tb;
    if (this.numChoicesHeight > this.displayHeight) {
      this.needScrollBar = true;
      const full = this.firstPageFullHeight(this.realLineHeight(), this.displayHeight) + this.pageGWidgetHeight + tb;
      this.setH(full < this.getMinH() ? this.getMinH() : Math.min(full, this.getMaxH()));
      this.displayHeight = this.vm[VM.H] - this.pageGWidgetHeight - tb;
      this.numTotalOffsetHeight = this.numChoicesHeight - this.displayHeight;
      this.initPage(this.realLineHeight());
    }
    if (this.isAutoScroll && this.needScrollBar) {
      this.isPartRowShow = true;
      this.offsetY = 5;
    }
  }

  private initPage(min: number): void {
    this.totalPage = 1;
    this.piePageHeight = [];
    if (this.messages == null) return;
    let h = 0;
    for (let i = 0; i < this.messages.length; i++) {
      const lh = this.textHeight(i, min);
      if (h + lh > this.displayHeight) {
        this.totalPage++;
        this.piePageHeight.push(h);
        h = lh;
      } else {
        h += lh;
      }
    }
  }

  private setLines(): void {
    this.pageGWidgetHeight = 0;
    this.initArea(0);
    if (this.gsb != null) {
      if (this.needScrollBar) this.initArea(this.gsb.getBarWidth() - this.gsb.vm[VM.OFFSET_X]);
      this.gsb.reset();
      this.gsb.maxScrollDis = this.numTotalOffsetHeight;
      this.gsb.showDis = this.displayHeight;
    } else {
      const page = this.getJavaChildByEvent(997);
      if (page != null) {
        page.setShow(false);
        if (this.needScrollBar) {
          page.setShow(true);
          this.pageGWidgetHeight = page.getH();
          this.initArea(0);
        }
        this.updatePageText();
      }
    }
  }

  private updatePageText(): void {
    const page = this.getJavaChildByEvent(997);
    if (page instanceof GLabel) page.setText(`${this.curPage + 1}/${this.totalPage}`);
  }

  /** IGCycle.cycle: alert timeout and the auto-scrolling marquee (one call per logic tick). */
  cycle(): void {
    if (this.alertCount > 0 && --this.alertCount <= 0) {
      this.alertMsg = null;
      this.setLines();
      return;
    }
    if (!this.needScrollBar || !this.isAutoScroll) return;
    if (++this.counter === 100) this.counter = 0;
    if (this.counter % 2 === 0) this.offsetY--;
    if (this.offsetY < -this.numChoicesHeight) this.offsetY = this.displayHeight;
  }

  private drawRowText(g: Graphics, i: number, x: number, y: number, w: number, minH: number, top: number, bottom: number): number {
    const m = this.messages![i];
    if (m == null) return 0;
    m.iconOffset = 0;
    const h = Math.max(m.height, minH);
    const lineBottom = y + h;
    if (lineBottom <= top) return h;
    if (!this.isPartRowShow && (y < top || lineBottom > bottom)) return h;
    const a = this.anchor;
    const xx = a & 1 ? ((w / 2) | 0) + x : a & 8 ? x + w : x;
    let yy = y;
    let anchor = a;
    if (a & 2) {
      yy = y + (((h - m.height) / 2) | 0);
      anchor = (a & -3) | 16;
    } else if (a & 32) {
      yy = y + (h - (((h - m.height) / 2) | 0));
    }
    g.setColor(this.textColor);
    m.draw(g, xx, yy, anchor);
    if (this.lineColor !== -1) {
      g.setColor(this.lineColor);
      g.drawLine(x, lineBottom, w + x, lineBottom);
    }
    return h;
  }

  paintData(g: Graphics): void {
    while (this.lastTick < uiClock.tick) {
      this.lastTick++;
      this.cycle();
    }
    if (this.messages == null) return;
    const w = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
    const top = this.vm[VM.OFFSET_Y] + this.vm[VM.YY] + this.vm[VM.BORDER_TOP];
    const x = this.vm[VM.OFFSET_X] + this.vm[VM.XX] + this.vm[VM.BORDER_LEFT];
    const bottom = top + this.displayHeight;
    g.clipRect(x, top, w, this.displayHeight);
    let y = this.offsetY + top;
    for (let i = 0; y < bottom && i < this.messages.length; i++) {
      y += this.drawRowText(g, i, x, y, w, this.realLineHeight(), top, bottom);
    }
  }
}

/** Utilities.getHotKeyValue: keypad key → hot key slot (-1 for other keys). */
export function getHotKeyValue(key: number): number {
  return { 49: 0, 51: 1, 55: 2, 57: 3, 42: 4, 48: 5, 35: 6 }[key] ?? -1;
}

export class GWindow extends GLinePanel {
  fullScreen = false;
  focusIndex = 0;
  oldFocusIndex = 0;
  focusWidget: GWidget | null = null;
  /** 1 = focus reached the first item of its row/column, 2 = the last. */
  moveFlag = 0;
  hotKeyTable: number[] | null = null;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(53);
    this.setCatchKey(true);
  }

  private canFocus(w: GWidget | null | undefined): w is GWidget {
    return w != null && w.isEnableFocus() && w.isShow();
  }

  /** Focus the next focusable item after index `from` in `list`, wrapping around. */
  private keyNext(list: GWidget[], from: number): void {
    const n = list.length;
    for (let i = 1; i <= n - 1; i++) {
      const w = list[(from + i) % n];
      if (this.canFocus(w)) return this.setFocus(w);
    }
  }

  private keyPrev(list: GWidget[], from: number): void {
    const n = list.length;
    if (n === 1) {
      if (this.canFocus(list[0])) this.setFocus(list[0]);
      return;
    }
    for (let i = 1; i <= n - 1; i++) {
      const w = list[(((from - i + n) % n) + n) % n];
      if (this.canFocus(w)) return this.setFocus(w);
    }
  }

  /** Grid layouts: move within the focused item's column (vertical) or row. */
  private doGridMove(vertical: boolean, next: boolean): void {
    if (this.focusIndex < 0) return;
    this.moveFlag = 0;
    const cols = this.getLayoutGColumn();
    const f = this.focusIndex;
    const line: GWidget[] = [];
    let at = 0;
    this.children.forEach((c, i) => {
      if (vertical ? i % cols === f % cols : ((i / cols) | 0) === ((f / cols) | 0)) {
        if (i === f) at = line.length;
        line.push(c);
      }
    });
    if (next) this.keyNext(line, at);
    else this.keyPrev(line, at);
    if (this.focusWidget != null) {
      if (this.focusWidget === line[0]) this.moveFlag = 1;
      else if (this.focusWidget === line[line.length - 1]) this.moveFlag = 2;
    }
  }

  private isGrid(): boolean {
    return this.layoutData[0] === LAYOUT_GRID || this.layoutData[0] === LAYOUT_GRID2;
  }

  keyPressUp(): void {
    if (!this.canCatchKey || !this.isGWidgetSetting(SETTING_KEY_UP)) return;
    if (this.isGrid()) this.doGridMove(true, false);
    else this.keyPrev(this.children, this.focusIndex);
  }

  keyPressDown(): void {
    if (!this.canCatchKey || !this.isGWidgetSetting(SETTING_KEY_DOWN)) return;
    if (this.isGrid()) this.doGridMove(true, true);
    else this.keyNext(this.children, this.focusIndex);
  }

  keyPressLeft(): void {
    if (!this.canCatchKey || !this.isGWidgetSetting(SETTING_KEY_LEFT)) return;
    if (this.isGrid()) this.doGridMove(false, false);
    else this.keyPrev(this.children, this.focusIndex);
  }

  keyPressRight(): void {
    if (!this.canCatchKey || !this.isGWidgetSetting(SETTING_KEY_RIGHT)) return;
    if (this.isGrid()) this.doGridMove(false, true);
    else this.keyNext(this.children, this.focusIndex);
  }

  /** Focus the i-th focusable child. */
  setFocusIndex(i: number): void {
    const list = this.children.filter((c) => this.canFocus(c));
    if (i >= 0 && i < list.length) {
      this.setFocus(list[i]);
      this.oldFocusIndex = this.focusIndex;
    }
  }

  setFirstFocus(): void {
    this.setFocusIndex(0);
  }

  /** Focus child i if it can take the focus, else the previous focusable one. */
  setPrevFocus(i: number): void {
    const w = this.getJavaChild(i);
    if (w != null && w.isEnableFocus()) this.setFocus(w);
    else this.keyPrev(this.children, i);
  }

  setFocus(w: GWidget | boolean | null): void {
    if (typeof w === 'boolean') return super.setFocus(w);
    const old = this.focusWidget;
    this.focusWidget = w;
    this.oldFocusIndex = this.focusIndex;
    this.focusIndex = this.getIndex(w);
    if (old != null && w != null && w.parent != null && this.gsb != null && this.gsb.maxScrollDis > 0) {
      w.parent.setSrollBar(old, w);
    }
    old?.setFocus(false);
    w?.setFocus(true);
  }

  // --- LR paging: a row of tab labels showing a window of a longer list (allSize entries) ---
  allSize = 0;
  isLRMove = false;

  setLRMove(): void {
    this.firstInViewIndex = 0;
    this.lastInViewIndex = this.children.length - 1;
    this.isLRMove = true;
  }

  isLRCanLeft(): boolean {
    return this.firstInViewIndex > 0;
  }

  isLRCanRight(): boolean {
    return this.lastInViewIndex < this.allSize - 1;
  }

  /**
   * Fills the tab labels with names[first…]; each label keeps its id as obj. With `focusId` the
   * labels page right until that id is shown and focused.
   */
  setLRContent(names: string[], ids: (number | null)[], focusId = -1): void {
    this.allSize = names.length;
    let found = false;
    const wanted = focusId !== -1 && ids.includes(focusId);
    if (wanted) {
      this.firstInViewIndex = 0;
      this.lastInViewIndex = this.children.length - 1;
    }
    for (;;) {
      this.children.forEach((c, i) => {
        const k = this.firstInViewIndex + i;
        const text = k >= 0 && k < names.length ? names[k] : null;
        if (c instanceof GLabel) c.setText(text ?? '');
        if (k >= 0 && k < ids.length) {
          c.setObj(ids[k]);
          if (ids[k] != null && ids[k] === focusId) {
            this.setFocus(c);
            found = true;
          }
        }
        c.setShow(text != null);
      });
      if (!wanted || found || !this.isLRCanRight()) return;
      this.doLRRight(true);
    }
  }

  doLRLeft(page: boolean): void {
    if (!page && this.focusIndex > 0) {
      this.keyPrev(this.children, this.focusIndex);
    } else if (this.isLRCanLeft()) {
      this.keyPrev(this.children, 0);
      this.firstInViewIndex = Math.max(0, this.firstInViewIndex - this.children.length);
      this.lastInViewIndex = Math.min(this.firstInViewIndex + this.children.length - 1, this.allSize - 1);
    }
  }

  doLRRight(page: boolean): void {
    if (!page && this.focusIndex < this.children.length - 1 && this.focusIndex < this.allSize - 1) {
      this.keyNext(this.children, this.focusIndex);
    } else if (this.isLRCanRight()) {
      this.keyNext(this.children, this.children.length - 1);
      this.lastInViewIndex = Math.min(this.lastInViewIndex + this.children.length, this.allSize - 1);
      this.firstInViewIndex = Math.max(0, this.lastInViewIndex - this.children.length + 1);
    }
  }

  /** Hot keys (1 3 7 9 * 0 #) focus the child whose hotKeyTable entry matches the key's slot. */
  hotKeyPress(key: number): void {
    if (this.hotKeyTable == null) return;
    const i = this.hotKeyTable.indexOf(getHotKeyValue(key));
    if (i >= 0) this.setFocus(this.getJavaChild(i));
  }
}

/** GLabel setting bit: iconValue is a frame of GameView.signSet (/common/3, the mission status signs). */
export const ICON_SIGN = 1024;

export class GLabel extends GWidget {
  label: string | null = null;
  /** GLabel.iconValue: the frame drawn before the text (-1 none); only the ICON_SIGN kind is ported. */
  iconValue = -1;
  labelColor = 0;
  selectLabelColor = 0;
  anchor = 0;
  borderColor = -1;
  selectBorderColor = -1;
  private setting = 0;
  strWidth = 0;
  cornerRes: ImageSet | null = null;
  cornFrameIndex = 0;
  bottomCornFrameIndex = 0;
  bgRes: ImageSet | null = null;
  bgFrameIndex = 0;
  bgFrameSelectIndex = 0;
  bgAnchor = 0;
  underLineColorTable: number[] | null = null;
  powerLabel: PowerString | null = null;
  isFocusLabelOffset: number[] | null = null;
  /** Marquee state: text x shift, pixels per step and ticks between steps. */
  scrollOffset = 0;
  speed = 3;
  speedDis = 1;
  speedCount = 0;
  private lastTick = uiClock.tick;

  /** BACK_LABEL: colour table plus corner frames. */
  setBack(colors: number[], setId: number, top: number, bottom: number): void {
    this.colorTable = colors;
    const set = getImageSet(setId);
    if (set != null) {
      this.cornerRes = set;
      this.cornFrameIndex = top;
      this.bottomCornFrameIndex = bottom;
    }
  }

  /** BACKGROUND_LABEL: an image frame drawn at an anchor point of the label (button faces). */
  setBackground(setId: number, frame: number, selectFrame: number, anchor: number): void {
    this.bgRes = getImageSet(setId);
    this.bgFrameIndex = frame;
    this.bgFrameSelectIndex = selectFrame;
    this.bgAnchor = anchor;
  }

  setLineColorTable(t: number[], bottom: boolean): void {
    this.underLineColorTable = t;
    this.setSetting(64, bottom);
  }

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(4);
  }

  setSetting(bit: number, on: boolean): void {
    this.setting = on ? this.setting | bit : this.setting & ~bit;
  }
  isSetting(bit: number): boolean {
    return (this.setting & bit) !== 0;
  }

  /** GLabel.setIconValue (the ICON_SIGN kind; the money / VIP kinds are not ported). */
  setIconValue(v: number, kind: number): void {
    this.iconValue = v;
    this.setSetting(kind, true);
  }

  setData(text: string, color: number, selectColor: number, anchor: number): void {
    this.label = text;
    this.labelColor = color;
    this.selectLabelColor = selectColor !== -1 ? selectColor : color;
    this.anchor = anchor;
    this.resetSize();
  }

  setText(s: string): void {
    this.label = s;
    this.resetSize();
    this.setScroll();
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    super.setBounds(x, y, w, h);
    this.setScroll();
  }

  /** Bit 4 = text wider than the box (eligible to scroll); restarts the marquee. */
  private setScroll(): void {
    this.setSetting(4, this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT] < this.strWidth);
    this.scrollOffset = 0;
    this.setSetting(1, false);
  }

  /** Bit 2 = marquee enabled (LABEL_STATUS or setNeedExecuteCycle). */
  needExecuteCycle(): boolean {
    return this.isSetting(2) && this.isSetting(4);
  }

  /** Bit 16 = scroll only while focused; bit 8 = wrap around instead of bouncing back. */
  cycle(): void {
    if (!this.needExecuteCycle()) return;
    if (this.isSetting(16) && !this.isFocus() && !this.parent?.isFocus()) {
      this.scrollOffset = 0;
      return;
    }
    this.computeScroll();
  }

  private computeScroll(): void {
    if (this.speedCount < this.speedDis) {
      this.speedCount++;
      return;
    }
    this.speedCount = 0;
    if (this.isSetting(1)) {
      if (this.scrollOffset > 2) this.setSetting(1, false);
      else this.scrollOffset += this.speed;
      return;
    }
    const inner = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
    if (!this.isSetting(8) && this.scrollOffset < inner - this.strWidth - 2) {
      this.setSetting(1, true);
      return;
    }
    this.scrollOffset -= this.speed;
    if (this.scrollOffset + this.strWidth < 0 && this.isSetting(8)) this.scrollOffset = inner;
  }

  protected getBaseFontHeight(): number {
    return this.powerLabel != null ? this.powerLabel.height : uiFont.height;
  }

  protected getStringWidth(): number {
    if (this.powerLabel != null) return this.powerLabel.width;
    return this.label == null ? 0 : uiFont.stringWidth(this.label);
  }

  /** Markup text drawn instead of the plain label (which must still be non-null to paint). */
  setPowerText(s: string): void {
    this.powerLabel = PowerString.createPowerString(s, uiFont);
    this.resetSize();
    this.setScroll();
  }

  getText(): string | null {
    return this.label;
  }

  setIsFocusLabelOffset(o: number[] | null): void {
    this.isFocusLabelOffset = o;
  }

  /** Minimum size grows to fit the text (drives H/V layouts). */
  resetSize(): void {
    const fh = this.getBaseFontHeight();
    this.strWidth = this.getStringWidth();
    if (fh > this.getMinH()) this.setMinHeight(fh);
    if (this.strWidth > this.getMinW()) this.setMinWidth(this.strWidth);
    if (this.getMinW() > this.getMaxW()) this.setMinWidth(this.getMaxW());
    if (this.getMinH() > this.getMaxH()) this.setMinHeight(this.getMaxH());
  }

  paint(g: Graphics): void {
    this.setPaintClip(g);
    const focus = this.isFocus();
    const table = focus ? this.focusColorTable : this.colorTable;
    if (table != null) {
      let x = this.vm[VM.XX];
      let w = this.vm[VM.W];
      if (this.isSetting(32)) {
        x -= table.length;
        w += table.length * 2;
      }
      drawFrameBox(g, x, this.vm[VM.YY], w, this.vm[VM.H], table,
        focus ? this.focusShadeColorTable : this.shadeColorTable,
        focus ? this.focusFragmentTable : this.fragmentTable, this.cornerRes, this.cornFrameIndex, this.bottomCornFrameIndex);
      const inset = this.colorTable != null ? this.colorTable.length - 1 : 0;
      const ly = this.isSetting(32) ? this.vm[VM.YY] : this.vm[VM.YY] + inset;
      const lh = this.isSetting(32) ? this.vm[VM.H] : this.vm[VM.H] - inset * 2;
      drawBoxLines(g, this.underLineColorTable, x + inset, ly, w - inset * 2 - 1, lh, this.isSetting(64), focus);
    }
    if (this.bgRes != null) {
      const a = this.bgAnchor;
      const bx = this.vm[VM.XX] + (a & HCENTER ? this.getW() >> 1 : a & RIGHT ? this.getW() : 0);
      const by = this.vm[VM.YY] + (a & VCENTER ? this.getH() >> 1 : a & BOTTOM ? this.getH() : 0);
      this.bgRes.drawFrame(g, focus ? this.bgFrameSelectIndex : this.bgFrameIndex, bx, by, 0, a);
    }
    while (this.lastTick < uiClock.tick) {
      this.lastTick++;
      this.cycle();
    }
    this.paintContent(g);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }

  /**
   * GLabel.paint text placement: inside the border insets (+ offset), horizontal anchor from
   * the label anchor, VCENTER converted to TOP with manual centring, clipped to the text box.
   * The text is shifted by the marquee offset; icon prefixes (set at runtime by UIHandler) are
   * not ported yet. Bit 512 underlines the text box.
   */
  protected paintContent(g: Graphics): void {
    if (this.label == null) return;
    const vm = this.vm;
    const x = vm[VM.OFFSET_X] + vm[VM.XX] + vm[VM.BORDER_LEFT];
    const y = vm[VM.OFFSET_Y] + vm[VM.YY] + vm[VM.BORDER_TOP];
    const w = vm[VM.W] - vm[VM.BORDER_LEFT] - vm[VM.BORDER_RIGHT];
    const h = vm[VM.H] - vm[VM.BORDER_TOP] - vm[VM.BORDER_BOTTOM];
    let anchor = this.anchor;
    // A sign icon sits 8 px into the text box, vertically centred; the text moves 16 px right.
    const sign = this.iconValue >= 0 && this.isSetting(ICON_SIGN);
    if (sign) getImageSet(3)?.drawFrame(g, this.iconValue, x + 8, y + ((h / 2) | 0), 0, 3);
    const sx = x + this.scrollOffset + (sign ? 16 : 0);
    const tx = anchor & HCENTER ? sx + ((w / 2) | 0) : anchor & RIGHT ? sx + w : sx;
    let ty: number;
    if (anchor & VCENTER) {
      ty = (((h - this.getBaseFontHeight()) / 2) | 0) + y;
      anchor = (anchor & ~VCENTER) | TOP;
    } else if (anchor & BOTTOM) {
      ty = h - (((h - this.getBaseFontHeight()) / 2) | 0) + y;
    } else {
      ty = y;
    }
    g.clipRect(x, y, w, h);
    const off = this.isFocus() ? this.isFocusLabelOffset : null;
    this.paintLabel(g, tx + (off?.[0] ?? 0), ty + (off?.[1] ?? 0), anchor === 0 ? TOP | 4 : anchor);
    if (this.isSetting(512)) {
      g.setColor(this.isFocus() ? this.selectLabelColor : this.labelColor);
      g.drawLine(x + 1, y + h - 1, x + w - 1, y + h - 1);
    }
  }

  /** GLabel.paintLabel: system-font text with an optional 4-way or drop-shadow border. */
  protected paintLabel(g: Graphics, tx: number, ty: number, anchor: number): void {
    const color = this.isFocus() ? this.selectLabelColor : this.labelColor;
    if (this.powerLabel != null) {
      g.setColor(color);
      this.powerLabel.draw(g, tx, ty, anchor);
      return;
    }
    if (!this.label) return;
    const border = this.isFocus() ? this.selectBorderColor : this.borderColor;
    if (border !== -1 && this.isSetting(128)) {
      g.setColor(border);
      g.drawString(this.label, tx + 1, ty + 1, anchor);
      g.setColor(color);
      g.drawString(this.label, tx, ty, anchor);
    } else if (border !== -1) drawBorderString(g, border, color, this.label, tx, ty, anchor);
    else {
      g.setColor(color);
      g.drawString(this.label, tx, ty, anchor);
    }
  }
}

export class GPixelLabel extends GLabel {
  pixelFont: PixelFont | null = null;
  pixelString: PixelString | null = null;
  pixelColorTable: number[] | null = null;
  focusPixelColorTable: number[] | null = null;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(5);
  }

  /** Falls back to the system font when the .t file is missing (Java: Font.getFont(-99,0,size)). */
  setFont(size: number): void {
    this.pixelFont = PixelFont.getFont(size);
  }

  setPixelColorTable(t: number[]): void {
    this.pixelColorTable = t.map((c) => c | 0xff000000);
  }

  setFocusPixelColorTable(t: number[]): void {
    this.focusPixelColorTable = t.map((c) => c | 0xff000000);
  }

  protected getBaseFontHeight(): number {
    return this.pixelString ? this.pixelString.getHeight() : super.getBaseFontHeight();
  }

  protected getStringWidth(): number {
    return this.pixelString ? this.pixelString.getWidth() : super.getStringWidth();
  }

  resetSize(): void {
    if (this.pixelFont != null) this.pixelString = new PixelString(this.label, this.pixelFont);
    super.resetSize();
  }

  protected paintLabel(g: Graphics, tx: number, ty: number, anchor: number): void {
    const ps = this.pixelString;
    if (ps == null) {
      const shift = (this.getBaseFontHeight() / 4 | 0) - 2;
      super.paintLabel(g, tx, shift > 0 ? ty + shift : ty, anchor);
      return;
    }
    let color = this.labelColor;
    let border = this.borderColor;
    let rows = this.pixelColorTable;
    if (this.isFocus()) {
      color = this.selectLabelColor;
      border = this.selectBorderColor;
      if (this.focusPixelColorTable != null) rows = this.focusPixelColorTable;
    }
    if (border !== -1) {
      if (this.isSetting(128)) ps.drawSimpleBorderString(g, border, color, tx, ty, anchor, rows);
      else ps.drawBorderString(g, border, color, tx, ty, anchor, rows);
    } else {
      ps.draw(g, tx, ty, anchor, color, rows);
    }
  }
}

export class GIcon extends GPixelLabel {
  iconRes: ImageSet | null = null;
  iconIndex = -1;
  trans = 0;
  anchor2 = 3;
  backColorIndex = -1;
  numberRes: ImageSet | null = null;
  numberIndex = -1;
  numberSpace = 0;
  numberRightDis = 0;
  numberBottomDis = 0;
  number = 0;
  isClear = false;
  hasMask = false;
  maskRgb = 0;
  /** Star / gem counts (drawn with GameView.starSet, not ported yet). */
  starnum = 0;
  gennum = 0;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(1);
  }

  /** DATA_ICON: frame `frame` of image set `setId`, drawn with `trans` at `anchor` (default centred). */
  setIconData(setId: number | ImageSet | null, frame: number, trans = 0, anchor = 3): void {
    const set = typeof setId === 'number' ? getImageSet(setId) : setId;
    if (set == null) return;
    this.iconRes = set;
    this.setIconIndex(frame);
    this.trans = trans;
    this.anchor2 = anchor;
  }

  /** Grows the minimum size to the frame (and sizes an unsized icon). */
  setIconIndex(frame: number, backColor = -1): void {
    this.iconIndex = frame;
    if (frame >= 0 && this.iconRes != null) {
      const w = this.iconRes.getFrameWidth(frame);
      const h = this.iconRes.getFrameHeight(frame);
      if (w > this.getMinW()) this.setMinWidth(w);
      if (h > this.getMinH()) this.setMinHeight(h);
      if (this.getW() === 0) this.setSize(this.getMinW(), this.getMinH());
    }
    this.backColorIndex = backColor;
  }

  setNumber(n: number): void {
    this.number = n;
  }

  /** Greys the icon out (default colour 0x8F000000). */
  setMask(on: boolean, rgb?: number): void {
    this.hasMask = on;
    if (rgb !== undefined) this.maskRgb = rgb;
    else if (this.maskRgb === 0) this.maskRgb = -1895825408;
  }

  clearsetIconStarNum(): void {
    this.gennum = 0;
    this.starnum = 0;
  }

  setIconStarNum(n: number, kind: number): void {
    if (kind === 0) this.gennum = n;
    else if (kind === 1) this.starnum = n;
  }

  /** ICON_NUM_DATA: a count drawn bottom-right with image digits. */
  setNumberData(setId: number, index: number, space: number, right: number, bottom: number): void {
    this.numberRes = getImageSet(setId);
    this.numberIndex = index;
    this.numberSpace = space;
    this.numberRightDis = right;
    this.numberBottomDis = bottom;
  }

  /**
   * GIcon.paint: the label first, then the icon (horizontally centred, vertically by anchor) and
   * its count. Bit 256 blinks the whole widget with GameCanvas.isMotion. Not ported: item back
   * plates (GameView.backIcons), set colour frames and star/gem counts.
   */
  paint(g: Graphics): void {
    if (this.isSetting(256) && isMotion() === 1) return;
    super.paint(g);
    const vm = this.vm;
    if (this.isClear) this.setPaintClip(g);
    if (this.iconRes != null && this.iconIndex >= 0) {
      const x = vm[VM.OFFSET_X] + vm[VM.XX] + ((vm[VM.W] / 2) | 0);
      let y = vm[VM.OFFSET_Y] + vm[VM.YY];
      if (this.anchor2 & 2) y += (vm[VM.H] / 2) | 0;
      let a = this.anchor2;
      if (this.backColorIndex >= 0) {
        // The grade back plate under the icon; a top-anchored icon is then centred on it.
        const back = getBackIcon(this.backColorIndex);
        drawGameImage(g, back, x, y, this.anchor2);
        if (this.anchor2 & 16 && back != null) {
          y += back.getHeight() >> 1;
          a = (a & ~16) | 2;
        }
      }
      this.iconRes.drawFrame(g, this.iconIndex, x, y, this.trans, a);
    }
    if (this.numberRes != null && this.numberIndex >= 0 && this.number > 0) {
      drawImageNumber(g, this.numberRes, this.numberIndex, String(this.number),
        vm[VM.OFFSET_X] + vm[VM.XX] + vm[VM.W] - this.numberRightDis,
        vm[VM.OFFSET_Y] + vm[VM.YY] + vm[VM.H] - this.numberBottomDis, this.numberSpace, 40);
    }
    if (this.hasMask) {
      g.setColor(this.maskRgb);
      g.fillRect(vm[VM.OFFSET_X] + vm[VM.XX], vm[VM.OFFSET_Y] + vm[VM.YY], vm[VM.W], vm[VM.H]);
    }
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }
}

/** Widgets whose behaviour is not ported yet (game icons, scroll bars, spinners). */
export class GPlaceholder extends GWidget {}

/** Port of GGameBar: HP/MP/EXP style bars (default), vertical bars and star rows. */
export class GGameBar extends GWidget {
  barType = 0;
  barValue1 = 0;
  barValue2 = 0;
  bgColor1 = -1;
  bgColor2 = -1;
  bgColor3 = -1;
  fgColor1 = -1;
  fgColor2 = -1;
  fgColor3 = -1;
  maxValue = 0;
  curValue = 0;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(7);
  }

  setBarType(t: number, v1: number, v2: number): void {
    this.barType = t;
    this.barValue1 = v1;
    this.barValue2 = v2;
  }
  setBgColor(a: number, b: number, c: number): void {
    [this.bgColor1, this.bgColor2, this.bgColor3] = [a, b, c];
  }
  setFgColor(a: number, b: number, c: number): void {
    [this.fgColor1, this.fgColor2, this.fgColor3] = [a, b, c];
  }
  setValue(max: number, cur: number): void {
    this.maxValue = max;
    this.curValue = cur > max ? max : cur;
  }

  private getDrawBarLength(len: number): number {
    if (this.maxValue <= 0) return 0;
    const v = ((len * this.curValue) / this.maxValue) | 0;
    return v <= 0 && this.curValue > 0 ? 1 : v;
  }

  paint(g: Graphics): void {
    this.setPaintClip(g);
    const x = this.vm[VM.XX] + this.vm[VM.OFFSET_X];
    const y = this.vm[VM.YY] + this.vm[VM.OFFSET_Y];
    const w = this.vm[VM.W];
    const h = this.vm[VM.H];
    if (this.barType === 0) this.drawBarDefault(g, x, y, w, h);
    else if (this.barType === 1) this.drawVDefault(g, x, y, w, h);
    else if (this.barType === 2) this.drawHStarDefault(g, x, y, w, h);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }

  private drawBarDefault(g: Graphics, x: number, y: number, w: number, h: number): void {
    if (this.bgColor1 >= 0) {
      g.setColor(this.bgColor1);
      fillArcRect(g, x, y, w, h);
    }
    if (this.bgColor2 >= 0) {
      g.setColor(this.bgColor2);
      fillArcRect2(g, x + 1, y + 1, w - 2, h - 2);
    }
    if (this.bgColor3 >= 0) {
      g.setColor(this.bgColor3);
      g.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
    const len = this.getDrawBarLength(w - 4);
    const bx = x + 2;
    const by = y + 2;
    const bh = h - 4;
    if (this.fgColor2 >= 0) {
      g.setColor(this.fgColor2);
      g.fillRect(bx, by, len, bh);
    }
    if (this.fgColor1 >= 0) {
      g.setColor(this.fgColor1);
      g.fillRect(bx, by, len, 1);
    }
    if (this.fgColor3 >= 0) {
      g.setColor(this.fgColor3);
      g.fillRect(bx, by + bh - 2, len, 2);
    }
    g.setClip(bx, by, len, bh);
    drawFrameBox(g, bx, by, len, bh, this.colorTable, this.shadeColorTable, this.fragmentTable, null, -1, -1);
  }

  private drawVDefault(g: Graphics, x: number, y: number, w: number, h: number): void {
    if (this.curValue <= 0) return;
    const len = this.getDrawBarLength(h);
    g.setClip(x, y + h - len, w, len);
    drawFrameBox(g, x, y, w, h, this.colorTable, this.shadeColorTable, this.fragmentTable, null, -1, -1);
  }

  /** curValue/10 stars (half star for odd counts) from frame barValue2 of set barValue1. */
  private drawHStarDefault(g: Graphics, x: number, y: number, w: number, h: number): void {
    if (this.curValue <= 0) return;
    const set = getImageSet(this.barValue1);
    if (set == null) return;
    const f = this.barValue2;
    const fw = set.getFrameWidth(f);
    const fh = set.getFrameHeight(f);
    if (fw <= 0) return;
    let n = (this.curValue / 10) | 0;
    if (n <= 0) n = 1;
    let sx = x + (((w - (((n + 1) / 2) | 0) * fw) / 2) | 0);
    const sy = y + (((h - fh) / 2) | 0);
    for (; n > 0; n -= 2) {
      if (n === 1) g.setClip(sx, sy, fw >> 1, fh);
      set.drawTopLeftFrame(g, f, sx, sy);
      sx += fw;
    }
  }
}

/** Port of GImageNumer: numbers drawn with digit frames from an image set. */
export class GImageNumer extends GWidget {
  anchor = 0;
  iNumber = 0;
  isShowSign = true;
  numberString: string | null = null;
  numerResName: ImageSet | null = null;
  plusStartIndex = 0;
  subStartIndex = 0;
  space = 0;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(3);
  }

  setData(setId: number, space: number, anchor: number): void {
    const set = getImageSet(setId);
    if (set == null) return;
    this.numerResName = set;
    this.plusStartIndex = 0;
    this.subStartIndex = 0;
    this.space = space;
    this.anchor = anchor;
    this.isShowSign = true;
  }

  setNumerString(s: string): void {
    this.numberString = s;
  }

  paint(g: Graphics): void {
    const set = this.numerResName;
    const scrolled = this.parentNeedScroll();
    if (scrolled) this.setPaintClip(g);
    if (set != null && this.numberString != null) {
      const start = this.iNumber >= 0 ? this.plusStartIndex : this.subStartIndex;
      const vm = this.vm;
      const x0 = vm[VM.OFFSET_X] + vm[VM.XX] + vm[VM.BORDER_LEFT];
      const y0 = vm[VM.OFFSET_Y] + vm[VM.YY] + vm[VM.BORDER_TOP];
      const w = vm[VM.W] - vm[VM.BORDER_LEFT] - vm[VM.BORDER_RIGHT];
      const h = vm[VM.H] - vm[VM.BORDER_TOP] - vm[VM.BORDER_BOTTOM];
      let a = this.anchor;
      const x = a & 1 ? x0 + ((w / 2) | 0) : a & 8 ? x0 + w : x0;
      const nh = set.getFrameHeight(start);
      let y = y0;
      if (a & 2) {
        y = y0 + (((h - nh) / 2) | 0);
        a = (a & ~2) | 16;
      } else if (a & 32) {
        y = y0 + (h - (((h - nh) / 2) | 0));
      }
      if (scrolled) g.clipRect(x0, y0, w, h);
      else g.setClip(x0, y0, w, h);
      drawImageNumber(g, set, start, this.numberString, x, y, this.space, a);
    }
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }
}

/** Port of GGameIcon: a sprite (e.g. the player's character) standing on the bottom centre. */
export class GGameIcon extends GWidget {
  backgroundRes: ImageSet | null = null;
  bgAnchor = 0;
  bgFrameIndex = 0;
  isAction = true;
  isClear = true;
  isRotate = false;
  sprite: GameSprite | null = null;
  /** setImage: a still image drawn centred (e.g. a pet portrait). */
  viewImage: Image | null = null;
  private lastTick = -1;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(2);
  }

  setBackground(setId: number, frame: number, anchor: number): void {
    this.backgroundRes = getImageSet(setId);
    this.bgFrameIndex = frame;
    this.bgAnchor = anchor;
  }

  setRotate(r: boolean): void {
    this.isRotate = r;
    this.sprite?.setRotate(r);
  }

  setData(sprite: GameSprite | null, action: boolean): void {
    this.sprite = sprite;
    this.setRotate(this.isRotate);
    this.isAction = action;
  }

  setSprite(sprite: GameSprite | null): void {
    this.sprite = sprite;
    this.setRotate(this.isRotate);
  }

  private drawSprite(g: Graphics): void {
    const vm = this.vm;
    if (this.backgroundRes != null) {
      const a = this.bgAnchor;
      const bx = vm[VM.XX] + (a & 1 ? this.getW() >> 1 : a & 8 ? this.getW() : 0);
      const by = vm[VM.YY] + (a & 2 ? this.getH() >> 1 : a & 32 ? this.getH() : 0);
      this.backgroundRes.drawFrame(g, this.bgFrameIndex, bx, by, 0, a);
    }
    if (this.isClear) g.setClip(0, 0, uiScreen.width, uiScreen.height);
    const sp = this.sprite;
    if (sp == null) return;
    if (this.isAction && this.lastTick !== uiClock.tick) {
      this.lastTick = uiClock.tick;
      sp.action();
    }
    let foot = vm[VM.OFFSET_Y] + vm[VM.YY] + vm[VM.H];
    if (sp.isHighTransport()) foot += 20;
    sp.draw(g, vm[VM.OFFSET_X] + vm[VM.XX] + (vm[VM.W] >> 1), foot);
  }

  setImage(img: Image | null): void {
    this.viewImage = img;
  }

  /** Focused with no focus colours: the sprite is drawn under the frame instead of over it. */
  paint(g: Graphics): void {
    this.setPaintClip(g);
    const [x, y, w, h] = [this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]];
    let spriteDone = false;
    if (this.isFocus()) {
      if (this.focusColorTable === DEFAULT_INT_ARRAY) {
        this.drawSprite(g);
        spriteDone = true;
      }
      drawFrameBox(g, x, y, w, h, this.focusColorTable, this.focusShadeColorTable, this.focusFragmentTable, null, -1, -1);
    } else if (this.colorTable != null) {
      drawFrameBox(g, x, y, w, h, this.colorTable, this.shadeColorTable, this.fragmentTable, null, -1, -1);
    }
    drawGameImage(g, this.viewImage, x + ((w / 2) | 0), y + ((h / 2) | 0), 3);
    if (!spriteDone) this.drawSprite(g);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }
}

export const GSB_STYLE_NORMAL = 1;
export const GSB_STYLE_TOUCH = 2;

/** Image set of the touch-style scroll bar (GameView.barSet); BAR_WIDTH is its frame 1 width. */
export const BAR_SET_ID = 103;

export class GScrollBar extends GWidget {
  align = 0;
  maxScrollDis = 0;
  scrollPos = 0;
  showDis = 0;
  style = GSB_STYLE_TOUCH;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(6);
  }

  /** ADD_SCROLLBAR: style, extra width, align (0 left, 1 centre, 2 right), offsets. */
  static getScrollBar(style: number, w: number, align: number, ox: number, oy: number): GScrollBar {
    const sb = new GScrollBar(new Int32Array(21));
    sb.setGWidgetSetting(32, true);
    sb.setGWidgetSetting(64, true);
    sb.style = style;
    const base = style === GSB_STYLE_NORMAL ? 4 : style === GSB_STYLE_TOUCH ? getImageSet(BAR_SET_ID)?.getFrameWidth(1) ?? 0 : 0;
    sb.setMinWidth(base + w);
    sb.setOffsetXY(ox, oy);
    sb.align = align;
    return sb;
  }

  getBarWidth(): number {
    return this.getMinW();
  }

  getTotalDis(): number {
    return this.maxScrollDis + this.showDis;
  }

  isRectInTop(x: number, y: number): boolean {
    return rectIn(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], (this.vm[VM.H] / 2) | 0, x, y);
  }

  reset(): void {
    this.scrollPos = 0;
    this.maxScrollDis = 0;
    this.showDis = 0;
  }

  paint(g: Graphics): void {
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
    const x = this.vm[VM.XX] + this.vm[VM.OFFSET_X];
    const y = this.vm[VM.YY] + this.vm[VM.OFFSET_Y];
    const h = this.vm[VM.H] - this.vm[VM.OFFSET_Y] * 2;
    if (this.style === GSB_STYLE_TOUCH) drawScrollBar(g, x, y, this.vm[VM.W], h, this.scrollPos, this.maxScrollDis, this.showDis);
    else if (this.style === GSB_STYLE_NORMAL) drawScrollBar2(g, x, y, this.vm[VM.W], h, this.scrollPos, this.maxScrollDis, this.showDis);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }
}

/** A slider: background frame, foreground frame clipped to curValue, and a knob frame. */
export class GSpinner extends GWidget {
  set: ImageSet | null = null;
  bgIndex = 0;
  fgIndex = 0;
  pointIndex = 0;
  maxValue = 0;
  curValue = 0;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(8);
  }

  setSpinnerData(set: ImageSet | null, bg: number, fg: number, point: number): void {
    this.set = set;
    this.bgIndex = bg;
    this.fgIndex = fg;
    this.pointIndex = point;
    if (set != null) this.maxValue = set.getFrameWidth(bg);
  }

  paint(g: Graphics): void {
    const [x, y, w, h] = [this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]];
    g.setClip(x, y, w, h);
    drawFrameBox(g, x, y, w, h, this.colorTable, this.shadeColorTable, this.fragmentTable, null, -1, -1);
    if (this.set != null) {
      const sx = this.vm[VM.OFFSET_X] + x;
      const sy = this.vm[VM.OFFSET_Y] + y + ((h / 2) | 0);
      this.set.drawFrame(g, this.bgIndex, sx, sy, 0, 6);
      g.setClip(sx, y, this.curValue, h);
      this.set.drawFrame(g, this.fgIndex, sx, sy, 0, 6);
      g.setClip(x, y, w, h);
      this.set.drawFrame(g, this.pointIndex, sx + this.curValue, sy, 0, 3);
    }
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }
}
