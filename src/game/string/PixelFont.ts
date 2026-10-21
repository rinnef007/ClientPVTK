// Port of com.hz.string.PixelFont / PixelString: the game's 1-bit bitmap fonts (common/N.t).
// File: short count, then per glyph a u16 char code and rows of MSB-first bits; ASCII 32..126
// glyphs are half width. Only Chinese + ASCII glyphs ship; missing glyphs keep their width
// but draw nothing, as in Java.
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { getFileByte } from '../common/Utilities';

export const PIXEL_FONT_SIZES = [12, 14, 16, 18, 20];

export function isEnChar(c: number): boolean {
  return c >= 32 && c <= 126;
}

export class PixelFont {
  readonly bytePerRowChar: number;
  readonly bytePerRowEn: number;
  private readonly glyphs = new Map<number, Uint8Array>();

  private constructor(
    readonly fontWidth: number,
    readonly fontHeight: number,
  ) {
    this.bytePerRowChar = ((fontWidth / 8) | 0) + (fontWidth % 8 === 0 ? 0 : 1);
    const half = (fontWidth / 2) | 0;
    this.bytePerRowEn = ((half / 8) | 0) + (half % 8 === 0 ? 0 : 1);
  }

  private static cache = new Map<number, PixelFont | null>();

  static getFont(size = 12): PixelFont | null {
    if (!PixelFont.cache.has(size)) PixelFont.cache.set(size, PixelFont.load(size));
    return PixelFont.cache.get(size) ?? null;
  }

  private static load(size: number): PixelFont | null {
    const data = getFileByte(`/common/${size}.t`);
    if (!data) return null;
    try {
      const f = new PixelFont(size, size);
      const dis = new DataInputStream(data);
      const n = dis.readShort();
      for (let i = 0; i < n; i++) {
        const c = dis.readShort() & 0xffff;
        const bytes = new Uint8Array(isEnChar(c) ? f.enLength() : f.charLength());
        dis.readFully(bytes);
        f.glyphs.set(c, bytes);
      }
      return f;
    } catch {
      return null;
    }
  }

  charLength(): number {
    return this.bytePerRowChar * this.fontHeight;
  }

  enLength(): number {
    return this.bytePerRowEn * this.fontHeight;
  }

  getChar(c: number): Uint8Array | null {
    return this.glyphs.get(c) ?? null;
  }

  getHeight(): number {
    return this.fontHeight;
  }
}

export class PixelString {
  private readonly datas: (Uint8Array | null)[] = [];
  readonly width: number = 0;

  constructor(
    text: string | null,
    readonly font: PixelFont,
  ) {
    if (text == null) return;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      this.datas.push(font.getChar(c));
      w += isEnChar(c) ? font.fontWidth >> 1 : font.fontWidth;
    }
    this.width = w;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.font.getHeight();
  }

  /**
   * Draws in `color`, or per pixel row from `rowColors` (gradient titles). Java renders into an
   * ARGB buffer and blits it with drawRGB; drawing horizontal runs gives the same pixels.
   */
  draw(g: Graphics, x: number, y: number, anchor: number, color: number, rowColors: number[] | null = null): void {
    const h = this.font.getHeight();
    let left = x;
    if (anchor & 8) left -= this.width;
    else if (anchor & 1) left -= this.width >> 1;
    let top = y;
    if (anchor & 32) top -= h;
    else if (anchor & 2) top -= h >> 1;
    let gx = left;
    for (const glyph of this.datas) {
      if (glyph == null) continue;
      const en = glyph.length < this.font.charLength();
      const gw = en ? this.font.fontWidth >> 1 : this.font.fontWidth;
      const bpr = en ? this.font.bytePerRowEn : this.font.bytePerRowChar;
      for (let row = 0; row < h; row++) {
        g.setColor((rowColors && row < rowColors.length ? rowColors[row] : color) | 0xff000000);
        let run = 0;
        for (let col = 0; col < gw; col++) {
          const idx = row * bpr + (col >> 3);
          const on = idx < glyph.length && (glyph[idx] & (1 << (7 - (col & 7)))) !== 0;
          if (on) run++;
          else if (run > 0) {
            g.fillRect(gx + col - run, top + row, run, 1);
            run = 0;
          }
        }
        if (run > 0) g.fillRect(gx + gw - run, top + row, run, 1);
      }
      gx += gw;
    }
  }

  drawBorderString(g: Graphics, border: number, color: number, x: number, y: number, anchor: number, rowColors: number[] | null): void {
    this.draw(g, x, y + 1, anchor, border);
    this.draw(g, x + 2, y + 1, anchor, border);
    this.draw(g, x + 1, y + 2, anchor, border);
    this.draw(g, x + 1, y, anchor, border);
    this.draw(g, x + 1, y + 1, anchor, color, rowColors);
  }

  drawSimpleBorderString(g: Graphics, border: number, color: number, x: number, y: number, anchor: number, rowColors: number[] | null): void {
    this.draw(g, x + 2, y + 2, anchor, border);
    this.draw(g, x + 1, y + 1, anchor, color, rowColors);
  }
}
