// Port of the parts of com.hz.common.Tool used by the sprite and map code.

export function byte2short(b: number): number {
  return b & 0xff;
}

export function setKeyXY(x: number, y: number): number {
  return (x & 0xffff) | ((y & 0xffff) << 16);
}

export function getXKey(k: number): number {
  return k & 0xffff;
}

export function getYKey(k: number): number {
  return (k >> 16) & 0xffff;
}

/** Big-endian int at offset i; 0 when out of range (Java returns 0 too). */
export function getInt(b: Uint8Array | null, i: number): number {
  if (!b || i + 3 >= b.length) return 0;
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) | 0;
}

export function binarySearch(arr: ArrayLike<number> | null, key: number): number {
  if (!arr) return -1;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = arr[mid];
    if (key === v) return mid;
    if (key > v) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Camera offset that centres `pos` in a viewport, clamped to the map (Tool.getOffsetValue). */
export function getOffsetValue(pos: number, mapSize: number, screenSize: number, screenHalf: number): number {
  if (mapSize <= screenSize) return ((screenSize - mapSize) / 2) | 0;
  const v = screenHalf - pos;
  if (v > 0) return 0;
  const min = screenSize - mapSize;
  return v < min ? min : v;
}

/** Java (short) cast. */
export function toShort(v: number): number {
  return (v << 16) >> 16;
}

/** Java (byte) cast. */
export function toByte(v: number): number {
  return (v << 24) >> 24;
}
