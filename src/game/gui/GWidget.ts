// Port of the com.hz.gui widget model (Vineflower decompile of classes2.dex; GContainer.layoutV
// from CFR, which Vineflower could not decompile): vmData slots, size/position setters and the
// container layouts actually used by the shipped .ui files (V 113×, G2 18×, G 11×, H 6×; no
// border layout). Painting follows GLabel.paint / GLinePanel.paint; text uses the system font
// until the .t pixel fonts are ported, and focus/scrolling/input are not ported yet.
import type { Graphics } from '../../midp/Graphics';
import { BOTTOM, HCENTER, RIGHT, TOP, VCENTER } from '../../midp/anchor';
import { drawBorderString, drawBoxLines, drawFrameBox, drawScrollBar, drawScrollBar2, drawImageNumber, fillArcRect, fillArcRect2, getImageSet } from '../main/GameView';
import type { ImageSet } from '../image/ImageSet';
import type { GameSprite } from '../sprite/GameSprite';
import { PixelFont, PixelString } from '../string/PixelFont';
import { PowerString } from '../string/PowerString';
import { isNullText } from '../common/Tool';

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

let keySeq = 0;

export class GWidget {
  vm: Int32Array;
  parent: GContainer | null = null;
  colorTable: number[] | null = [-1];
  focusColorTable: number[] | null = [-1];
  fragmentTable: number[] | null = null;
  focusFragmentTable: number[] | null = null;
  shadeColorTable: number[] | null = null;
  focusShadeColorTable: number[] | null = null;

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

  /** GContainer.paintChildren: visible, in-view children only. */
  paintChildren(g: Graphics): void {
    for (const c of this.children) if (c.isShow() && !c.isOutView()) c.paint(g);
    if (this.gsb != null && this.needScrollBar) this.gsb.paint(g);
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
    g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
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

export class GWindow extends GLinePanel {
  fullScreen = false;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(53);
  }
}

export class GLabel extends GWidget {
  label: string | null = null;
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
    return uiFont.height;
  }

  protected getStringWidth(): number {
    return this.label == null ? 0 : uiFont.stringWidth(this.label);
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
    g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
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
    const sx = x + this.scrollOffset;
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
    this.paintLabel(g, tx, ty, anchor === 0 ? TOP | 4 : anchor);
    if (this.isSetting(512)) {
      g.setColor(this.isFocus() ? this.selectLabelColor : this.labelColor);
      g.drawLine(x + 1, y + h - 1, x + w - 1, y + h - 1);
    }
  }

  /** GLabel.paintLabel: system-font text with an optional 4-way or drop-shadow border. */
  protected paintLabel(g: Graphics, tx: number, ty: number, anchor: number): void {
    if (!this.label) return;
    const color = this.isFocus() ? this.selectLabelColor : this.labelColor;
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
  iconSet = -1;
  iconFrame = -1;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(1);
  }

  setIconData(setId: number, frame: number): void {
    this.iconSet = setId;
    this.iconFrame = frame;
  }

  protected paintContent(g: Graphics): void {
    const set = getImageSet(this.iconSet);
    if (set) set.drawHVFrame(g, this.iconFrame, this.vm[VM.XX] + (this.vm[VM.W] >> 1), this.vm[VM.YY] + (this.vm[VM.H] >> 1));
    super.paintContent(g);
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
    g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
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
      g.setClip(x0, y0, w, h);
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

  paint(g: Graphics): void {
    g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
    if (this.colorTable != null) {
      drawFrameBox(g, this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H], this.colorTable, this.shadeColorTable, this.fragmentTable, null, -1, -1);
    }
    this.drawSprite(g);
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
