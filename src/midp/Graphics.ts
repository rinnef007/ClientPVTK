import {
  BASELINE,
  BOTTOM,
  HCENTER,
  RIGHT,
  TRANS_MIRROR,
  TRANS_MIRROR_ROT180,
  TRANS_MIRROR_ROT270,
  TRANS_MIRROR_ROT90,
  TRANS_ROT180,
  TRANS_ROT270,
  TRANS_ROT90,
  VCENTER,
  anchorBox,
  swapsAxes,
} from './anchor';

export type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

/** MIDP-style image whose pixels may still be decoding (see game/image/Image). */
export interface DeferredImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource | null;
}

export type ImageLike = Drawable | DeferredImage;

function resolve(img: ImageLike | null | undefined): [CanvasImageSource, number, number] | null {
  if (!img) return null;
  if ('source' in img) return img.source ? [img.source, img.width, img.height] : null;
  return [img, img.width, img.height];
}

/** Pixel sizes used by the Android MIDP shim (Font.SIZE_SMALL/MEDIUM/LARGE). */
export const FONT_SMALL = 12;
export const FONT_MEDIUM = 16;
export const FONT_LARGE = 20;

/**
 * Colour as the Android MIDP shim treats it: a zero alpha byte means opaque (plain MIDP RGB),
 * any other alpha byte is kept (the game relies on this for translucent panels).
 */
function cssColor(argb: number): string {
  const rgb = '#' + (argb & 0xffffff).toString(16).padStart(6, '0');
  const a = (argb >>> 24) & 0xff;
  return a === 0 ? rgb : rgb + a.toString(16).padStart(2, '0');
}

/**
 * javax.microedition.lcdui.Graphics on top of CanvasRenderingContext2D.
 * Keeps MIDP semantics: integer colors, anchors, a single rectangular clip, translate offsets.
 */
export class Graphics {
  private color = 0;
  private fontSize = FONT_MEDIUM;
  private tx = 0;
  private ty = 0;
  private clip: [number, number, number, number];

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
  ) {
    this.clip = [0, 0, width, height];
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    this.applyFont();
    this.applyClip();
  }

  // --- state ---

  setColor(argb: number): void {
    this.color = argb | 0;
    const c = cssColor(this.color);
    this.ctx.fillStyle = c;
    this.ctx.strokeStyle = c;
  }

  getColor(): number {
    return this.color & 0xffffff;
  }

  setFontSize(px: number): void {
    this.fontSize = px;
    this.applyFont();
  }

  getFontHeight(): number {
    return this.fontSize + 2;
  }

  stringWidth(s: string): number {
    return Math.ceil(this.ctx.measureText(s).width);
  }

  translate(x: number, y: number): void {
    this.tx += x;
    this.ty += y;
  }

  getTranslateX(): number {
    return this.tx;
  }

  getTranslateY(): number {
    return this.ty;
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clip = [x + this.tx, y + this.ty, w, h];
    this.applyClip();
  }

  clipRect(x: number, y: number, w: number, h: number): void {
    const [cx, cy, cw, ch] = this.clip;
    const nx = Math.max(cx, x + this.tx);
    const ny = Math.max(cy, y + this.ty);
    const nr = Math.min(cx + cw, x + this.tx + w);
    const nb = Math.min(cy + ch, y + this.ty + h);
    this.clip = [nx, ny, Math.max(0, nr - nx), Math.max(0, nb - ny)];
    this.applyClip();
  }

  getClipX(): number {
    return this.clip[0] - this.tx;
  }
  getClipY(): number {
    return this.clip[1] - this.ty;
  }
  getClipWidth(): number {
    return this.clip[2];
  }
  getClipHeight(): number {
    return this.clip[3];
  }

  // --- primitives ---

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ctx.fillRect(x + this.tx, y + this.ty, w, h);
  }

  // MIDP outlines cover (w+1)×(h+1) pixels; the 0.5 offset keeps 1px strokes crisp.
  drawRect(x: number, y: number, w: number, h: number): void {
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + this.tx + 0.5, y + this.ty + 0.5, w, h);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number): void {
    const c = this.ctx;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x1 + this.tx + 0.5, y1 + this.ty + 0.5);
    c.lineTo(x2 + this.tx + 0.5, y2 + this.ty + 0.5);
    c.stroke();
  }

  fillRoundRect(x: number, y: number, w: number, h: number, aw: number, ah: number): void {
    const c = this.ctx;
    c.beginPath();
    c.roundRect(x + this.tx, y + this.ty, w, h, [Math.min(aw, ah) / 2]);
    c.fill();
  }

  drawRoundRect(x: number, y: number, w: number, h: number, aw: number, ah: number): void {
    const c = this.ctx;
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(x + this.tx + 0.5, y + this.ty + 0.5, w, h, [Math.min(aw, ah) / 2]);
    c.stroke();
  }

  fillArc(x: number, y: number, w: number, h: number, start: number, arc: number): void {
    const c = this.ctx;
    const cx = x + this.tx + w / 2;
    const cy = y + this.ty + h / 2;
    // MIDP angles are counter-clockwise from 3 o'clock; canvas is clockwise.
    const a0 = (-start * Math.PI) / 180;
    const a1 = (-(start + arc) * Math.PI) / 180;
    c.beginPath();
    c.moveTo(cx, cy);
    c.ellipse(cx, cy, w / 2, h / 2, 0, a0, a1, arc > 0);
    c.closePath();
    c.fill();
  }

  // --- text ---

  drawString(s: string, x: number, y: number, anchor: number): void {
    const w = this.stringWidth(s);
    const h = this.getFontHeight();
    let ax = x;
    if (anchor & HCENTER) ax -= w >> 1;
    else if (anchor & RIGHT) ax -= w;
    let ay = y;
    if (anchor & BOTTOM) ay -= h;
    else if (anchor & BASELINE) ay -= this.fontSize;
    else if (anchor & VCENTER) ay -= h >> 1;
    this.ctx.fillText(s, ax + this.tx, ay + this.ty + 1);
  }

  // --- images ---

  drawImage(img: ImageLike | null | undefined, x: number, y: number, anchor: number): void {
    const r = resolve(img);
    if (!r) return;
    const [src, w, h] = r;
    const [ax, ay] = anchorBox(x, y, w, h, anchor);
    this.ctx.drawImage(src, ax + this.tx, ay + this.ty);
  }

  drawRegion(
    img: ImageLike | null | undefined,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    transform: number,
    x: number,
    y: number,
    anchor: number,
  ): void {
    const r = resolve(img);
    if (!r || sw <= 0 || sh <= 0) return;
    const src = r[0];
    const dw = swapsAxes(transform) ? sh : sw;
    const dh = swapsAxes(transform) ? sw : sh;
    const [ax, ay] = anchorBox(x, y, dw, dh, anchor);
    const c = this.ctx;
    c.save();
    c.translate(ax + this.tx, ay + this.ty);
    // Map the source rect (sw×sh at origin) into the dw×dh destination box.
    switch (transform) {
      case TRANS_MIRROR:
        c.transform(-1, 0, 0, 1, dw, 0);
        break;
      case TRANS_ROT180:
        c.transform(-1, 0, 0, -1, dw, dh);
        break;
      case TRANS_MIRROR_ROT180:
        c.transform(1, 0, 0, -1, 0, dh);
        break;
      case TRANS_ROT90:
        c.transform(0, 1, -1, 0, dw, 0);
        break;
      case TRANS_ROT270:
        c.transform(0, -1, 1, 0, 0, dh);
        break;
      case TRANS_MIRROR_ROT90:
        c.transform(0, -1, -1, 0, dw, dh);
        break;
      case TRANS_MIRROR_ROT270:
        c.transform(0, 1, 1, 0, 0, 0);
        break;
    }
    c.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    c.restore();
  }

  // --- internals ---

  private applyFont(): void {
    this.ctx.font = `${this.fontSize}px Roboto, Arial, "Liberation Sans", Helvetica, sans-serif`;
  }

  // Canvas clips only shrink, so reset to a saved base state and clip once.
  private applyClip(): void {
    const c = this.ctx;
    c.restore();
    c.save();
    c.beginPath();
    c.rect(this.clip[0], this.clip[1], this.clip[2], this.clip[3]);
    c.clip();
    c.fillStyle = c.strokeStyle = cssColor(this.color);
    this.applyFont();
    c.textBaseline = 'top';
    c.imageSmoothingEnabled = false;
  }
}
