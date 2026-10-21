// Port of com.hz.string.PowerString / StringEntity (Vineflower decompile) and the word wrap of
// Utilities.splitString. Markup: "/cRRGGBB…/p" colours (nestable, "{}" right after the colour
// underlines), "/iAABBC" an image-set icon, "/fNN" a face icon, "\n" a line break.
// Face icons (GameView.faceImage) and the item back icons (GameView.backIcons) are not loaded
// yet, so face icons take no space and item icons are drawn without their back plate.
import type { Graphics } from '../../midp/Graphics';
import { drawImageNumber, getImageSet } from '../main/GameView';
import type { ImageSet } from '../image/ImageSet';

/** The subset of javax.microedition.lcdui.Font that the text code uses. */
export interface TextFont {
  height: number;
  stringWidth(s: string): number;
}

export const TYPE_COLOR_STRING = 1;
export const TYPE_ICON = 3;
export const TYPE_FACE_ICON = 4;
export const TYPE_ENTER = 7;

const UNDERLINE_CHAR = '{}';

/** Tool.parseInt: decimal, or `def` when the text is not a number. */
function parseIntOr(s: string, def: number): number {
  const t = s.trim();
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : def;
}

/** Tool.parseInt16. */
function parseInt16(s: string, def: number): number {
  const t = s.trim();
  return /^[+-]?[0-9a-fA-F]+$/.test(t) ? parseInt(t, 16) | 0 : def;
}

export function isChinese(c: number): boolean {
  return (c >= 11904 && c < 44032) || (c >= 63744 && c < 64256) || (c >= 65280 && c < 65504);
}

/** End of the next unbreakable run starting at i (a CJK char alone, or a word plus its space). */
function nextBreak(s: string, i: number): number {
  let p = i;
  if (isChinese(s.charCodeAt(i))) return i + 1;
  for (;;) {
    let end = s.indexOf(' ', p);
    if (end !== 0) {
      end = end === -1 ? s.length : end + 1;
      while (++p < end) if (isChinese(s.charCodeAt(p))) return p;
      return end;
    }
    p++;
  }
}

/** Utilities.splitString: wraps at word / CJK boundaries, hard-breaking words that do not fit. */
export function splitString(s: string | null, font: TextFont, maxW: number): string[] {
  if (s == null || s === '') return [''];
  const out: string[] = [];
  const n = s.length;
  let line: string | null = null;
  let start = 0;
  let end: number;
  do {
    const nl = s.indexOf('\n', start);
    let p = start;
    for (;;) {
      end = nextBreak(s, p);
      if (nl > -1 && nl < end) end = nl;
      const sub = s.substring(start, end);
      if (font.stringWidth(sub) > maxW) {
        if (p !== start) {
          end = p;
          break;
        }
        let k = sub.length - 1;
        for (; k > 0; k--) {
          line = sub.substring(0, k);
          if (font.stringWidth(line) <= maxW) {
            end = p + k;
            break;
          }
        }
        if (k > 0) break;
        line = sub;
        break;
      }
      line = sub;
      if (end === nl) {
        end++;
        break;
      }
      if (end >= n) break;
      p = end;
    }
    out.push(line ?? '');
    start = end;
  } while (end < n);
  return out;
}

/** Integer.toHexString, left-padded to 6 digits. */
function toHexString(v: number): string {
  const h = (v >>> 0).toString(16);
  return h.length > 0 && h.length < 6 ? h.padStart(6, '0') : h;
}

function makeIndexValue(c: string, a: number, b: number, d: number): string {
  let s = `/${c}${a < 10 ? '0' : ''}${a}`;
  if (b >= 0) s += `${b < 10 ? '0' : ''}${b}`;
  if (d >= 0) s += `${d}`;
  return s;
}

export class StringEntity {
  index = 0;
  backColorIconIndex = -1;
  itemNum = 0;
  obj: string | ImageSet | null = null;
  width = 0;
  height = 0;
  length = 0;
  underLine = false;
  iconOffset = 0;

  constructor(readonly type: number) {}

  isStringEntity(): boolean {
    return typeof this.obj === 'string';
  }

  getStrValue(): string {
    return typeof this.obj === 'string' ? this.obj : '';
  }

  initStringData(s: string, color: number, underLine: boolean, font: TextFont): void {
    this.obj = s;
    this.index = color;
    this.underLine = underLine;
    this.width = font.stringWidth(s);
    this.height = font.height;
    this.length = s.length;
  }

  initIconData(a: number, frame: number, c: number): void {
    this.backColorIconIndex = ((c - 1) << 24) >> 24;
    let setId = a;
    if (this.backColorIconIndex >= 0) {
      this.itemNum = (a << 24) >> 24;
      setId = 1;
    }
    const set = getImageSet(setId);
    this.obj = set;
    this.index = frame;
    this.length = 7;
    if (set != null) {
      this.width = set.getFrameWidth(frame);
      this.height = set.getFrameHeight(frame);
    }
  }

  initFaceIconData(i: number): void {
    this.index = i;
    this.length = 4;
  }

  draw(g: Graphics, x: number, y: number, anchor: number): void {
    let left = x;
    if (anchor & 1) left -= this.width >> 1;
    else if (anchor & 8) left -= this.width;
    let top = y;
    if (anchor & 2) top -= this.height >> 1;
    else if (anchor & 32) top -= this.height;
    if (this.type === TYPE_COLOR_STRING) {
      if (this.index !== -1) g.setColor(this.index);
      if (typeof this.obj === 'string') g.drawString(this.obj, left, top, 20);
      if (this.underLine) {
        const yy = top + this.height - 2;
        g.drawLine(left + 1, yy, left + this.width - 2, yy);
      }
    } else if (this.type === TYPE_ICON || this.type === TYPE_FACE_ICON) {
      const set = this.obj as ImageSet | null;
      const iy = top + this.iconOffset;
      if (set == null || this.index < 0) return;
      if (this.backColorIconIndex >= 0) {
        set.drawHVFrame(g, this.index, left + (this.width >> 1), iy + (this.height >> 1));
        if (this.itemNum > 0) {
          drawImageNumber(g, getImageSet(1002), 0, String(this.itemNum), left + this.width - 1, iy + this.height - 1, 0, 40);
        }
      } else {
        set.drawTopLeftFrame(g, this.index, left, iy);
      }
    }
  }
}

export class PowerString {
  entities: StringEntity[] | null = null;
  width = 0;
  height = 0;
  iconOffset = 0;

  private constructor(readonly font: TextFont) {}

  /** "/cRRGGBB" + text + "/p" ("{}" after the colour underlines). */
  static makeColorString(text: string, rgb: number, underLine = false): string {
    return `/c${toHexString(rgb)}${underLine ? UNDERLINE_CHAR : ''}${text}/p`;
  }

  /** "/i" + set id (2 digits) + frame (2 digits) + "0": an image-set icon inline. */
  static makeIconString(setId: number, frame: number): string {
    return makeIndexValue('i', setId, frame, 0);
  }

  static createPowerString(s: string | null, font: TextFont): PowerString {
    const p = new PowerString(font);
    try {
      p.analyzeString(s, -1, false);
    } catch {
      // Java swallows malformed markup and keeps the entities parsed so far.
    }
    p.initWidthAndHeight();
    return p;
  }

  static splitPowerString(s: string | null, font: TextFont, maxW: number): PowerString[] | null {
    return PowerString.createPowerString(s, font).split(maxW);
  }

  private addEntity(e: StringEntity): void {
    (this.entities ??= []).push(e);
  }

  private addNormalStringEntity(s: string, color: number, underLine: boolean): StringEntity {
    const e = new StringEntity(TYPE_COLOR_STRING);
    e.initStringData(s, color, underLine, this.font);
    this.addEntity(e);
    return e;
  }

  /** Index of the "/p" closing the colour run that starts before `from`, skipping nested runs. */
  private findEndCharIndex(s: string, from: number, n: number): number {
    let depth = 0;
    let i = from;
    while (i < n) {
      if (s[i] === '/' && i + 1 < n) {
        const d = s[i + 1];
        if (d === 'c') {
          depth++;
          i += 2;
          continue;
        }
        if (d === 'p') {
          if (depth <= 0) return i;
          depth--;
          i += 2;
          continue;
        }
      }
      i++;
    }
    return -1;
  }

  private analyzeString(s: string | null, color: number, underLine: boolean): void {
    if (s == null || s === '') return;
    const n = s.length;
    let i = 0;
    let start = 0;
    const flush = () => {
      if (start < i) this.addNormalStringEntity(s.substring(start, i), color, underLine);
    };
    while (i < n) {
      const c = s[i];
      if (c === '\n') {
        flush();
        const e = new StringEntity(TYPE_ENTER);
        e.length = 1;
        this.addEntity(e);
        start = i = i + 1;
        continue;
      }
      if (c === '/' && i + 1 < n) {
        const d = s[i + 1];
        if (d === 'c') {
          const body = i + 8;
          if (body < n) {
            const end = this.findEndCharIndex(s, body, n);
            if (end !== -1) {
              flush();
              const rgb = parseInt16(s.substring(i + 2, body), -1);
              let sub = s.substring(body, end);
              let ul = false;
              if (sub.length >= 2 && sub.startsWith(UNDERLINE_CHAR)) {
                sub = sub.substring(2);
                ul = true;
              }
              this.analyzeString(sub, rgb, ul);
              start = i = end + 2;
              continue;
            }
          }
        } else if (d === 'f') {
          if (i + 4 <= n) {
            flush();
            const e = new StringEntity(TYPE_FACE_ICON);
            e.initFaceIconData(parseIntOr(s.substring(i + 2, i + 4), -1));
            this.addEntity(e);
            start = i = i + e.length;
            continue;
          }
        } else if (d === 'i') {
          if (i + 7 <= n) {
            flush();
            const e = new StringEntity(TYPE_ICON);
            e.initIconData(
              parseIntOr(s.substring(i + 2, i + 4), -1),
              parseIntOr(s.substring(i + 4, i + 6), -1),
              parseIntOr(s.substring(i + 6, i + 7), -1),
            );
            this.addEntity(e);
            start = i = i + e.length;
            continue;
          }
        }
      }
      i++;
    }
    if (start < n) this.addNormalStringEntity(s.substring(start, n), color, underLine);
  }

  private initWidthAndHeight(): void {
    if (this.entities == null) return;
    let w = 0;
    let h = 0;
    for (const e of this.entities) {
      w += e.width;
      if (e.height > h) h = e.height;
    }
    this.width = w;
    this.height = h;
  }

  /** Breaks into lines no wider than maxW; a trailing empty line is dropped. */
  split(maxW: number): PowerString[] | null {
    if (this.entities == null) return [this];
    const lines: PowerString[] = [];
    let cur = new PowerString(this.font);
    let w = 0;
    for (const e of this.entities) {
      if (e.type === TYPE_ENTER) {
        lines.push(cur);
        cur = new PowerString(this.font);
        w = e.width;
      } else if (e.width + w <= maxW) {
        w += e.width;
        cur.addEntity(e);
      } else if (!e.isStringEntity()) {
        lines.push(cur);
        cur = new PowerString(this.font);
        cur.addEntity(e);
        w = e.width;
      } else {
        const str = e.getStrValue();
        const room = maxW - w;
        const parts = splitString(str, this.font, room);
        if (parts.length > 0) {
          let rest = str;
          if (this.font.stringWidth(parts[0]) <= room) {
            cur.addNormalStringEntity(parts[0], e.index, e.underLine);
            rest = parts.slice(1).join('');
          }
          lines.push(cur);
          cur = new PowerString(this.font);
          const more = splitString(rest, this.font, maxW);
          if (more.length > 0) {
            for (let k = 0; k < more.length - 1; k++) {
              const line = new PowerString(this.font);
              line.addNormalStringEntity(more[k], e.index, e.underLine);
              lines.push(line);
            }
            cur = new PowerString(this.font);
            w = cur.addNormalStringEntity(more[more.length - 1], e.index, e.underLine).width;
          } else {
            w = 0;
          }
        }
      }
    }
    if (w !== 0) lines.push(cur);
    if (lines.length === 0) return null;
    for (const l of lines) l.initWidthAndHeight();
    return lines;
  }

  /** Entities are laid left to right, vertically centred on the line; -1 colours keep g's colour. */
  draw(g: Graphics, x: number, y: number, anchor: number): void {
    if (this.entities == null) return;
    let left = x;
    if (anchor & 1) left -= this.width >> 1;
    else if (anchor & 8) left -= this.width;
    let top = y;
    if (anchor & 2) top -= this.height >> 1;
    else if (anchor & 32) top -= this.height;
    const color = g.getColor();
    let xx = left;
    for (const e of this.entities) {
      e.iconOffset = this.iconOffset;
      e.draw(g, xx, top + (this.height >> 1), 6);
      g.setColor(color);
      xx += e.width;
    }
  }

  getValue(): string {
    return this.entities?.map((e) => e.getStrValue()).join('') ?? '';
  }
}
