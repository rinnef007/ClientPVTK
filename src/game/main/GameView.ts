// Port of the panel/box drawing helpers of com.hz.main.GameView (Vineflower decompile).
// The special pre-loaded image sets (money, icons, VIP…) are created on demand from
// /common/<id> like every other id; GameView.initImage's custom loading is not ported yet.
import type { Graphics } from '../../midp/Graphics';
import { PATH_COMMON, readPNGFile } from '../common/Utilities';
import type { Image } from '../image/Image';
import { ImageSet } from '../image/ImageSet';

const imageSetMap = new Map<number, ImageSet | null>();

export function getImageSet(id: number): ImageSet | null {
  if (id < 0) return null;
  if (!imageSetMap.has(id)) imageSetMap.set(id, ImageSet.createImageSet(PATH_COMMON, id));
  return imageSetMap.get(id) ?? null;
}

/** Every image-set id referenced by a set of UI files can be preloaded with these paths. */
export function imageSetFiles(id: number): string[] {
  return [`common/${id}.fr`, `common/${id}.png`];
}

/** GameView.backIcons: the item slot back plates /common/ic0..ic5.png, by item grade. */
const backIcons: (Image | null | undefined)[] = [];
export const BACK_ICON_COUNT = 6;

export function getBackIcon(i: number): Image | null {
  if (i < 0 || i >= BACK_ICON_COUNT) return null;
  if (backIcons[i] === undefined) backIcons[i] = readPNGFile(`/common/ic${i}.png`);
  return backIcons[i] ?? null;
}

export function backIconFiles(): string[] {
  return Array.from({ length: BACK_ICON_COUNT }, (_, i) => `common/ic${i}.png`);
}

export function clearImageSetMap(): void {
  imageSetMap.clear();
}

/** Linear blend between two RGB colours at step i of n. */
export function changeColor(c0: number, c1: number, i: number, n: number): number {
  if (i === 0) return c0;
  if (i === n) return c1;
  const r0 = (c0 >> 16) & 0xff;
  const g0 = (c0 >> 8) & 0xff;
  const b0 = c0 & 0xff;
  return (
    (((((c1 >> 16) & 0xff) - r0) * i / n + r0) << 16) |
    (((((c1 >> 8) & 0xff) - g0) * i / n + g0) << 8) |
    ((((c1 & 0xff) - b0) * i / n + b0) | 0)
  );
}

export function fillAlphaRect(g: Graphics, argb: number, x: number, y: number, w: number, h: number): void {
  g.setColor(argb);
  g.fillRect(x, y, w, h);
}

export function drawBorderString(g: Graphics, border: number, color: number, s: string, x: number, y: number, anchor: number): void {
  g.setColor(border);
  g.drawString(s, x - 1, y, anchor);
  g.drawString(s, x + 1, y, anchor);
  g.drawString(s, x, y + 1, anchor);
  g.drawString(s, x, y - 1, anchor);
  g.setColor(color);
  g.drawString(s, x, y, anchor);
}

/** Vertical gradient in `steps` bands from c0 to c1. */
export function drawShadeBoxColors(g: Graphics, x: number, y: number, w: number, h: number, c0: number, c1: number, steps: number): void {
  if (h === 0 || steps === 0) return;
  const band = (h / steps) | 0;
  if (band < 1) {
    g.setColor(c0);
    g.fillRect(x, y, w, h);
    return;
  }
  let yy = y;
  for (let i = 0; i < steps; i++) {
    g.setColor(changeColor(c0, c1, i, steps));
    const bh = i < h % steps ? band + 1 : band;
    g.fillRect(x, yy, w, bh);
    yy += bh;
  }
}

/** shade = [mode, offset, height, c0, c1, steps]; mode 0 top, 1 bottom, 2 mirrored around middle. */
export function drawShadeBox(g: Graphics, x: number, y: number, w: number, h: number, shade: number[] | null): void {
  if (shade == null || shade.length < 6) return;
  const [mode, off, sh, c0, c1, steps] = shade;
  let yy: number;
  let hh: number;
  if (mode === 0) {
    yy = y + off;
    hh = sh;
  } else if (mode === 1) {
    yy = y + h - off - sh;
    hh = sh;
  } else if (mode === 2) {
    yy = y + off;
    hh = (sh / 2) | 0;
  } else {
    yy = 0;
    hh = sh;
  }
  drawShadeBoxColors(g, x, yy, w, hh, c0, c1, steps);
  if (mode === 2) drawShadeBoxColors(g, x, yy + hh, w, hh, c1, c0, steps);
}

/** Tiles frame `frame` of image set `setId` over the rectangle (fillImageMap cache omitted). */
export function drawBackGround(g: Graphics, x: number, y: number, w: number, h: number, setId: number, frame: number): void {
  if (w <= 0 || h <= 0) return;
  const set = getImageSet(setId);
  if (set == null) return;
  const fw = set.getFrameWidth(frame);
  const fh = set.getFrameHeight(frame);
  if (fw <= 0 || fh <= 0) return;
  const cx = g.getClipX();
  const cy = g.getClipY();
  const cw = g.getClipWidth();
  const ch = g.getClipHeight();
  g.clipRect(x, y, w, h);
  for (let yy = y; yy < y + h; yy += fh) {
    for (let xx = x; xx < x + w; xx += fw) set.drawTopLeftFrame(g, frame, xx, yy);
  }
  g.setClip(cx, cy, cw, ch);
}

export function drawBoxCorner(g: Graphics, x: number, y: number, w: number, h: number, set: ImageSet, top: number, bottom: number): void {
  const r = x + w;
  const b = y + h;
  if (top >= 0) {
    set.drawFrame(g, top, x, y, 0, 20);
    set.drawFrame(g, top, r, y, 1, 24);
  }
  if (bottom >= 0) {
    set.drawFrame(g, bottom, x, b, 2, 36);
    set.drawFrame(g, bottom, r, b, 4, 40);
  }
}

export function drawBoxLines(g: Graphics, colors: number[] | null, x: number, y: number, w: number, h: number, bottom: boolean, second: boolean): void {
  if (colors == null) return;
  const n = (colors.length / 2) | 0;
  let yy = bottom ? y + h - 1 : y;
  if (bottom) yy -= n - 1;
  const start = second ? n : 0;
  for (let i = start; i < n + start; i++) {
    g.setColor(colors[i]);
    g.drawLine(x, yy, x + w, yy);
    yy++;
  }
}

/**
 * fragmentTable entries are 6 ints: [setId, frame, dx, dy, trans, anchor]. A negative anchor
 * means "tile as background over the inner box". With `backgroundOnly` only the first entry is
 * considered (and only if it is a background); returns the index to resume from.
 */
function drawFragmentBox(
  g: Graphics, ix: number, iy: number, iw: number, ih: number, ox: number, oy: number,
  table: number[] | null, from: number, backgroundOnly: boolean,
): number {
  if (table == null) return 0;
  const n = table.length;
  let i = from;
  while (i < n) {
    const [setId, frame, dx, dy, trans, anchor] = table.slice(i, i + 6);
    i += 6;
    if (backgroundOnly) {
      if (anchor >= 0) return 0;
      drawBackGround(g, ix, iy, iw, ih, setId, frame);
      return i;
    }
    if (anchor < 0) drawBackGround(g, ix, iy, iw, ih, setId, frame);
    else getImageSet(setId)?.drawFrame(g, frame, ox + dx, oy + dy, trans, anchor);
  }
  return n;
}

/**
 * The standard panel: colors = [fillARGB(-1 none), border1, border2, …] where each border colour
 * draws a 1px inset frame; a negative entry switches to an image-frame border described by the
 * following ints (set id = -entry, corner/edge frame indices). Then the shade, background
 * fragments, optional corners, image border and remaining fragments are drawn in that order.
 */
export function drawFrameBox(
  g: Graphics, x: number, y: number, w: number, h: number,
  colors: number[] | null, shade: number[] | null, fragments: number[] | null,
  corner: ImageSet | null, cornerTop: number, cornerBottom: number,
): void {
  if (colors == null || colors.length <= 0) return;
  let ix = x;
  let iy = y;
  let iw = w;
  let ih = h;
  let imageBorder = false;
  for (let i = 1; i < colors.length; i++) {
    const c = colors[i];
    if (c < 0) {
      ix += 2;
      iy += 2;
      iw -= 4;
      ih -= 4;
      imageBorder = true;
      break;
    }
    g.setColor(c);
    g.fillRect(ix, iy, iw, ih);
    ix++;
    iy++;
    iw -= 2;
    ih -= 2;
  }
  if (colors[0] !== -1) {
    fillAlphaRect(g, colors[0], ix, iy, iw, ih);
    drawShadeBox(g, ix, iy, iw, ih, shade);
  }
  const resume = drawFragmentBox(g, ix, iy, iw, ih, x, y, fragments, 0, true);
  if (corner != null) drawBoxCorner(g, ix, iy, iw, ih, corner, cornerTop, cornerBottom);
  if (imageBorder && colors.length >= 5) {
    const set = -colors[1];
    const [, , a, b, c] = colors;
    const [d, e, f] = colors.length >= 8 ? [colors[5], colors[6], colors[7]] : [a, b, c];
    drawImageBox(g, x, y, w, h, set, a, b, c, d, e, f);
  }
  drawFragmentBox(g, ix, iy, iw, ih, x, y, fragments, resume, false);
}

/**
 * Image border: top/bottom edges tiled with frames `topEdge`/`bottomEdge`, left/right edges
 * with `sideEdge` (switching to `sideEdge2` for the lower half), corners `topCorner`/`bottomCorner`.
 */
export function drawImageBox(
  g: Graphics, x: number, y: number, w: number, h: number, setId: number,
  topCorner: number, sideEdge: number, topEdge: number, bottomCorner: number, sideEdge2: number, bottomEdge: number,
): void {
  const set = getImageSet(setId);
  if (set == null) return;
  const r = x + w;
  const b = y + h;
  const mid = y + (h >> 1);
  const cx = g.getClipX();
  const cy = g.getClipY();
  const cw = g.getClipWidth();
  const ch = g.getClipHeight();
  const ew = set.getFrameWidth(topEdge);
  if (ew > 0) {
    g.clipRect(x + 8, y, w - 16, h);
    for (let xx = x; xx < r; xx += ew) {
      set.drawFrame(g, topEdge, xx, y, 0, 20);
      set.drawFrame(g, bottomEdge, xx, b, 2, 36);
    }
    g.setClip(cx, cy, cw, ch);
  }
  const eh = set.getFrameHeight(sideEdge);
  if (eh > 0) {
    g.clipRect(x, y + 8, w, h - 16);
    let frame = sideEdge;
    let switched = false;
    for (let yy = y; yy < b; yy += eh) {
      let drawY = yy;
      if (!switched && yy >= mid) {
        frame = sideEdge2;
        switched = true;
        drawY = mid;
        yy = mid;
      }
      set.drawFrame(g, frame, x, drawY, 0, 20);
      set.drawFrame(g, frame, r, drawY, 1, 24);
    }
    g.setClip(cx, cy, cw, ch);
  }
  drawBoxCorner(g, x, y, w, h, set, topCorner, bottomCorner);
}

/** GameView.fillTriangle: a fan of lines from (x, y) to a base `w` wide centred on `baseX`, `h` above (dir 3: below). */
export function fillTriangle(g: Graphics, color: number, x: number, y: number, h: number, w: number, baseX: number, dir: number): void {
  const x0 = baseX - (w >> 1);
  const by = dir === 3 ? y + h : y - h;
  g.setColor(color);
  for (let i = 0; i < w; i++) g.drawLine(x, y, i + x0, by);
}

/** Rectangle with 2px-rounded corners. */
export function fillArcRect(g: Graphics, x: number, y: number, w: number, h: number): void {
  if (h > 4) {
    g.fillRect(x + 2, y, w - 4, h);
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillRect(x, y + 2, w, h - 4);
  } else g.fillRect(x, y, w, h);
}

/** Rectangle with 1px-rounded corners. */
export function fillArcRect2(g: Graphics, x: number, y: number, w: number, h: number): void {
  if (h > 2) {
    g.fillRect(x, y + 1, w, h - 2);
    g.fillRect(x + 1, y, w - 2, h);
  } else g.fillRect(x, y, w, h);
}

/**
 * Digits from an image set: frames start+0..9, then '/', '+', '-' at start+10..12 (other
 * characters use their char code, as in Java). Returns the drawn width.
 */
export function drawImageNumber(g: Graphics, set: ImageSet | null, start: number, s: string, x: number, y: number, space: number, anchor: number): number {
  if (set == null) return 0;
  const fw = set.getFrameWidth(start);
  const fh = set.getFrameHeight(start);
  const total = fw * s.length;
  const left = anchor & 8 ? x - total : anchor & 1 ? x - (total >> 1) : x;
  const top = anchor & 32 ? y - fh : anchor & 2 ? y - (fh >> 1) : y;
  let cx = left;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    const k = c >= 48 && c <= 57 ? c - 48 : ch === '/' ? 10 : ch === '+' ? 11 : ch === '-' ? 12 : c;
    set.drawTopLeftFrame(g, k + start, cx, top);
    cx += fw + space;
  }
  return cx - left;
}

const barColorTable = [5329761, 12490818];
const barColorTable2 = [512, 512];

/** Touch scroll bar from image set 103: end caps (frame 0), thumb caps (1) and thumb body (2). */
export function drawScrollBar(g: Graphics, x: number, y: number, _w: number, h: number, pos: number, max: number, show: number): void {
  const set = getImageSet(103);
  if (set == null) return;
  const fw = set.getFrameWidth(0);
  const capH = set.getFrameHeight(0);
  const thumbCapH = set.getFrameHeight(1);
  const bodyH = set.getFrameHeight(2);
  const track = h - capH * 2;
  const top = y + capH;
  if (max <= 0) return;
  const total = max + show;
  if (total <= 0) return;
  const thumb = ((show * track) / total) | 0;
  let off = ((pos * track) / total) | 0;
  if (pos === max) off = track - thumb;
  drawFrameBox(g, x + 5, top, fw - 10, track, barColorTable, null, null, null, 0, 0);
  const n = ((thumb / bodyH) | 0) + (thumb % bodyH !== 0 ? 1 : 0);
  const ty = top + off;
  const [cx, cy, cw, ch] = [g.getClipX(), g.getClipY(), g.getClipWidth(), g.getClipHeight()];
  g.setClip(x, ty + 3, fw, thumb - 6);
  for (let i = 0, yy = ty; i < n; i++, yy += bodyH) set.drawFrame(g, 2, x, yy, 0, 0);
  g.setClip(cx, cy, cw, ch);
  set.drawFrame(g, 1, x, ty, 0, 0);
  set.drawFrame(g, 1, x, ty + thumb - thumbCapH, 2, 0);
  set.drawFrame(g, 0, x, top - capH, 0, 0);
  set.drawFrame(g, 0, x, top + track, 2, 0);
}

/** Plain scroll bar: a dark track with a coloured thumb. */
export function drawScrollBar2(g: Graphics, x: number, y: number, w: number, h: number, pos: number, max: number, show: number): void {
  if (max <= 0) return;
  const total = max + show;
  if (total <= 0) return;
  const thumb = ((show * h) / total) | 0;
  let off = ((pos * h) / total) | 0;
  if (pos === max) off = h - thumb;
  drawFrameBox(g, x, y, w, h, barColorTable2, null, null, null, 0, 0);
  g.setColor(10980950);
  g.fillRect(x, y + off, w - 1, thumb);
}
