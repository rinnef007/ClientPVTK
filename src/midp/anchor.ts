// MIDP anchor and transform constants (javax.microedition.lcdui.Graphics / game.Sprite).

export const HCENTER = 1;
export const VCENTER = 2;
export const LEFT = 4;
export const RIGHT = 8;
export const TOP = 16;
export const BOTTOM = 32;
export const BASELINE = 64;

export const TRANS_NONE = 0;
export const TRANS_MIRROR_ROT180 = 1;
export const TRANS_MIRROR = 2;
export const TRANS_ROT180 = 3;
export const TRANS_MIRROR_ROT270 = 4;
export const TRANS_ROT90 = 5;
export const TRANS_ROT270 = 6;
export const TRANS_MIRROR_ROT90 = 7;

/** Top-left corner of a w×h box placed at (x, y) with the given anchor. Anchor 0 means TOP|LEFT. */
export function anchorBox(x: number, y: number, w: number, h: number, anchor: number): [number, number] {
  let ax = x;
  let ay = y;
  if (anchor & HCENTER) ax -= w >> 1;
  else if (anchor & RIGHT) ax -= w;
  if (anchor & VCENTER) ay -= h >> 1;
  else if (anchor & BOTTOM) ay -= h;
  return [ax, ay];
}

/** Whether a transform swaps width and height (90°/270° rotations). */
export function swapsAxes(transform: number): boolean {
  return transform >= TRANS_MIRROR_ROT270;
}
