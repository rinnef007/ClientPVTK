// Port of the resource and drawing helpers from com.hz.common.Utilities.
import type { Graphics } from '../../midp/Graphics';
import { Image } from '../image/Image';
import type { AssetFS } from '../main/AssetFS';
import { getInt } from './Tool';

export const NAME_SUFFIX_FRAGMENT = '.fr';
export const NAME_SUFFIX_MAP = '.m';
export const NAME_SUFFIX_MAP_MINI = '_mini.m';
export const NAME_SUFFIX_PAGE_DATA = '.pd';
export const NAME_SUFFIX_PAGE_NAME = '.pn';
export const NAME_SUFFIX_PL = '.pl';
export const NAME_SUFFIX_PNG = '.png';
export const NAME_SUFFIX_SPRITE = '.spr';
export const NAME_SUFFIX_UI = '.ui';
export const PATH_ANI = '/ani/';
export const PATH_ANI_2 = '/ani/ani2/';
export const PATH_COMMON = '/common/';
export const PATH_MAP = '/map/';
export const PATH_UI = '/ui/';

// Java reads through PipActivity's class loader; here every read goes through one AssetFS.
let fs: AssetFS | null = null;

export function setAssetFS(f: AssetFS): void {
  fs = f;
}

export function getAssetFS(): AssetFS {
  if (!fs) throw new Error('AssetFS not set');
  return fs;
}

export function getFileByte(path: string): Uint8Array | null {
  return fs?.get(path) ?? null;
}

/** Maps the tool-side transform ids stored in resources to MIDP Sprite.TRANS_* values. */
export function getTranslate(b: number): number {
  switch (b) {
    case 1:
      return 2;
    case 2:
      return 1;
    case 3:
      return 5;
    case 4:
      return 3;
    case 5:
      return 6;
    case 6:
      return 4;
    case 7:
      return 7;
    default:
      return 0;
  }
}

/** Transform to use when the whole sprite is mirrored horizontally. */
export function getTransfromAfterMirror(i: number): number {
  if (i === 0) return 2;
  if (i === 1) return 3;
  if (i === 3) return 1;
  if (i === 4) return 5;
  if (i === 5) return 4;
  if (i !== 6) return i !== 7 ? 0 : 6;
  return 7;
}

export function setPlKey(nameId: number, palId: number): number {
  return ((nameId & 32767) << 5) | (palId & 31);
}

export function drawGameRegion(
  g: Graphics,
  image: Image | null,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  transform: number,
  x: number,
  y: number,
  anchor: number,
): void {
  if (!image) return;
  g.drawRegion(image, sx, sy, sw, sh, transform, x, y, anchor);
}

export function drawGameImage(g: Graphics, image: Image | null, x: number, y: number, anchor: number, trans = -1): void {
  if (!image) return;
  if (trans >= 0) {
    drawGameRegion(g, image, 0, 0, image.getWidth(), image.getHeight(), getTranslate(trans), x, y, anchor);
    return;
  }
  // The decompiled 5-arg overload is garbled; its intent is plain anchor math with TOP|LEFT drawing.
  let ax = x;
  let ay = y;
  if (anchor & 8) ax -= image.getWidth();
  else if (anchor & 1) ax -= image.getWidth() >> 1;
  if (anchor & 32) ay -= image.getHeight();
  else if (anchor & 2) ay -= image.getHeight() >> 1;
  g.drawImage(image, ax, ay, 20);
}

/** PNG bytes → Image, optionally swapping in a palette (.pl) first. */
export function loadColorImage(png: Uint8Array | null, pal: Uint8Array | null): Image | null {
  if (!png) return null;
  try {
    if (!pal) return Image.createImageFromBytes(png);
    const copy = png.slice();
    const at = parsePalette(copy);
    if (at >= 0) applyPalette(copy, pal, at);
    return Image.createImageFromBytes(copy);
  } catch {
    return null;
  }
}

/** Offset of the PLTE chunk (its length field), or -1. */
export function parsePalette(b: Uint8Array): number {
  let i = 8;
  const end = b.length - 8;
  while (i < end) {
    const len = getInt(b, i);
    if (b[i + 4] === 80 && b[i + 5] === 76 && b[i + 6] === 84 && b[i + 7] === 69) return i;
    i = i + 12 + len;
  }
  return -1;
}

/**
 * Overwrites PLTE data + CRC with the .pl bytes, exactly like the Java code.
 * Web-only addition: the CRC is recomputed afterwards, because a few .pl files are shorter than
 * the chunk and browsers reject PNGs with a bad critical-chunk CRC (Android's decoder did not).
 */
export function applyPalette(b: Uint8Array, pal: Uint8Array, at: number): void {
  const dataStart = at + 8;
  const chunkLen = getInt(b, at);
  const n = Math.min(chunkLen + 4, pal.length);
  for (let k = 0; k < n; k++) b[dataStart + k] = pal[k];
  const crc = crc32(b, at + 4, chunkLen + 4);
  const p = dataStart + chunkLen;
  b[p] = crc >>> 24;
  b[p + 1] = (crc >>> 16) & 0xff;
  b[p + 2] = (crc >>> 8) & 0xff;
  b[p + 3] = crc & 0xff;
}

let crcTable: Uint32Array | null = null;

export function crc32(b: Uint8Array, off: number, len: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = off; i < off + len; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function readPNGFile(path: string): Image | null {
  return loadColorImage(getFileByte(path), null);
}
