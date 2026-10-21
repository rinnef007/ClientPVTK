// Port of the com.hz.gui widget model (Vineflower decompile of classes2.dex; GContainer.layoutV
// from CFR, which Vineflower could not decompile): vmData slots, size/position setters and the
// container layouts actually used by the shipped .ui files (V 113×, G2 18×, G 11×, H 6×; no
// border layout). Painting follows GLabel.paint / GLinePanel.paint; text uses the system font
// until the .t pixel fonts are ported, and focus/scrolling/input are not ported yet.
import type { Graphics } from '../../midp/Graphics';
import { BOTTOM, HCENTER, RIGHT, TOP, VCENTER } from '../../midp/anchor';
import { drawBorderString, drawFrameBox, getImageSet } from '../main/GameView';
import { PixelFont, PixelString } from '../string/PixelFont';

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
  }

  setAbs(): void {
    for (const c of this.children) {
      c.vm[VM.XX] = c.getAbsX();
      c.vm[VM.YY] = c.getAbsY();
      if (c instanceof GContainer) c.setAbs();
    }
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
    if (this.needScrollBar) this.outHeight = (usedRows - rows) * (vgap + ch);
    this.firstInViewIndex = 0;
    this.lastInViewIndex = this.needScrollBar ? visible - 1 : n - 1;
    this.children.forEach((w, i) => w.setOutView(i >= visible));
  }

  align(): void {
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
  }

  paint(g: Graphics): void {
    this.paintChildren(g);
  }
}

export class GLinePanel extends GContainer {
  isLeftRightBgColorDisable = false;
  underLineColor = -1;

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
        focus ? this.focusFragmentTable : this.fragmentTable, null, -1, -1);
    }
    if (this.underLineColor !== -1) {
      g.setColor(this.underLineColor);
      const x = this.vm[VM.OFFSET_X] + this.vm[VM.XX];
      const y = this.vm[VM.OFFSET_Y] + this.vm[VM.YY] + this.getH() - 1;
      g.drawLine(x, y, this.getW() + x - 2, y);
    }
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
    this.paintChildren(g);
  }
}

export class GTextArea extends GLinePanel {
  text = '';
  textColor = 0xffffff;

  constructor(vm: Int32Array) {
    super(vm);
    this.setType(52);
  }

  setText(s: string): void {
    this.text = s;
  }

  /** Word-wrapped text (GTextArea.paintData); PowerString markup is not interpreted yet. */
  paint(g: Graphics): void {
    super.paint(g);
    if (!this.text) return;
    g.setClip(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], this.vm[VM.H]);
    g.setColor(this.textColor);
    const maxW = this.vm[VM.W] - this.vm[VM.BORDER_LEFT] - this.vm[VM.BORDER_RIGHT];
    let y = this.vm[VM.YY] + this.vm[VM.BORDER_TOP];
    let line = '';
    const flush = () => {
      g.drawString(line, this.vm[VM.XX] + this.vm[VM.BORDER_LEFT], y, TOP | 4);
      y += uiFont.height;
      line = '';
    };
    for (const ch of this.text.replace(/\/[a-z][0-9a-f]{0,6}/gi, '')) {
      if (ch === '\n') {
        flush();
        continue;
      }
      if (uiFont.stringWidth(line + ch) > maxW && line) flush();
      line += ch;
    }
    if (line) flush();
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
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
        focus ? this.focusFragmentTable : this.fragmentTable, null, -1, -1);
    }
    this.paintContent(g);
    g.setClip(0, 0, uiScreen.width, uiScreen.height);
  }

  /** Text placed by anchor inside the box, vertically centred like GLabel.paint. */
  protected paintContent(g: Graphics): void {
    if (!this.label) return;
    const a = this.anchor;
    const x = this.vm[VM.XX];
    const y = this.vm[VM.YY];
    const w = this.vm[VM.W];
    const h = this.vm[VM.H];
    const tx = a & HCENTER ? x + (w >> 1) : a & RIGHT ? x + w : x;
    const fh = this.getBaseFontHeight();
    const ty = a & VCENTER ? y + ((h - fh) >> 1) : a & BOTTOM ? y + h - ((h - fh) >> 1) - fh : y;
    const anchor = (a & (HCENTER | RIGHT)) | TOP | (a & HCENTER || a & RIGHT ? 0 : 4);
    this.paintLabel(g, tx, ty, anchor);
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

/** Widgets whose behaviour is not ported yet (game icons, numbers, bars, scroll bars, spinners). */
export class GPlaceholder extends GWidget {
  paint(g: Graphics): void {
    if (this.getType() === 7) {
      g.setColor(0x804060a0);
      g.fillRect(this.vm[VM.XX], this.vm[VM.YY], this.vm[VM.W], Math.max(2, this.vm[VM.H]));
    }
  }
}
