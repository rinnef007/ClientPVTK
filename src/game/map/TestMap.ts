// Web-only: map layouts are sent by the server (MsgHandler → GameMap.loadMap), so none ship in
// the APK. This builds a hand-made layout in exactly that binary format, using images from the
// local map/1 pack, so the real GameMap parser and renderer run unchanged.
import { DataOutputStream } from '../common/DataStream';
import { TILE } from './TileLayer';

export const TEST_MAP_COLS = 40;
export const TEST_MAP_ROWS = 30;

// Indices into the map's image table (ids are map/1.pn entries).
const IMG = {
  grass: 0, // 369: 72×72 → 3×3 tiles
  sand: 1, // 315: 72×72 → 3×3 tiles
  stone: 2, // 162: 48×48 → 2×2 tiles
  pine: 3, // 1231
  tree: 4, // 1232
  palm: 5, // 1104
  bush: 6, // 268
  statue: 7, // 276
  arch: 8, // 890
  cart: 9, // 1105
  lawn: 10, // 444: bright grass decal
} as const;
const IMAGE_IDS = [369, 315, 162, 1231, 1232, 1104, 268, 276, 890, 1105, 444];

// Tile index ranges produced by the tileset groups below.
const T_GRASS = 0;
const T_SAND = 9;
const T_STONE = 18;
const TILE_COUNT = 22;

/** Map-sprite ids used by the player layer (animated objects). */
export const TEST_MAP_SPRITES = [1338];

interface Obj {
  img: number;
  /** Centre x and bottom y in world pixels. */
  cx: number;
  by: number;
  /** Grid cells (relative to the foot cell) that become blocked. */
  block?: [number, number][];
}

function isRoad(gx: number, gy: number): boolean {
  return gy === 14 || gy === 15 || gx === 20 || gx === 21;
}

function isPlaza(gx: number, gy: number): boolean {
  return gx >= 15 && gx <= 26 && gy >= 9 && gy <= 20;
}

export function buildTestMap(): Uint8Array {
  const cols = TEST_MAP_COLS;
  const rows = TEST_MAP_ROWS;
  const out = new DataOutputStream();
  out.writeUTF('Bản đồ thử (offline)');
  out.writeByte(cols);
  out.writeByte(rows);

  out.writeByte(IMAGE_IDS.length);
  for (const id of IMAGE_IDS) {
    out.writeShort(id);
    out.writeByte(0); // palette id 0 = original colours
  }

  // Tileset: total tiles, then groups of (image, transform, columns, rows).
  out.writeByte(TILE_COUNT);
  out.writeByte(3);
  for (const [img, c, r] of [
    [IMG.grass, 3, 3],
    [IMG.sand, 3, 3],
    [IMG.stone, 2, 2],
  ]) {
    out.writeByte(img);
    out.writeByte(0);
    out.writeByte(c);
    out.writeByte(r);
  }

  const objects: Obj[] = [];
  const blocked = new Set<number>();
  const block = (gx: number, gy: number) => {
    if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) blocked.add(gy * cols + gx);
  };
  // Tree border with gaps where the roads leave the map.
  for (let gx = 0; gx < cols; gx += 3) {
    if (gx >= 19 && gx <= 22) continue;
    objects.push({ img: gx % 2 ? IMG.pine : IMG.tree, cx: gx * TILE + 12, by: 2 * TILE, block: [[0, 1]] });
    objects.push({ img: gx % 2 ? IMG.tree : IMG.pine, cx: gx * TILE + 12, by: rows * TILE - 4, block: [[0, -1]] });
  }
  for (let gy = 4; gy < rows - 2; gy += 3) {
    if (gy >= 13 && gy <= 16) continue;
    objects.push({ img: IMG.palm, cx: 24, by: gy * TILE + 20, block: [[0, 0]] });
    objects.push({ img: IMG.pine, cx: cols * TILE - 24, by: gy * TILE + 20, block: [[0, 0]] });
  }
  // Plaza furniture.
  objects.push({ img: IMG.statue, cx: 18 * TILE, by: 12 * TILE, block: [[0, -1], [-1, -1]] });
  objects.push({ img: IMG.statue, cx: 24 * TILE, by: 12 * TILE, block: [[0, -1], [-1, -1]] });
  objects.push({ img: IMG.arch, cx: 21 * TILE, by: 9 * TILE });
  objects.push({ img: IMG.cart, cx: 25 * TILE, by: 19 * TILE, block: [[0, -1], [-1, -1]] });
  for (const [gx, gy] of [
    [8, 8],
    [10, 22],
    [31, 6],
    [33, 23],
    [6, 18],
  ]) {
    objects.push({ img: IMG.bush, cx: gx * TILE + 12, by: (gy + 1) * TILE, block: [[0, 0], [-1, 0], [1, 0]] });
  }
  for (const o of objects) {
    const fx = Math.floor(o.cx / TILE);
    const fy = Math.floor((o.by - 1) / TILE);
    for (const [dx, dy] of o.block ?? []) block(fx + dx, fy + dy);
  }

  // Collision bitmap, one bit per cell (GameMap.isCanPass).
  const words = Math.ceil((cols * rows) / 32);
  const bits = new Int32Array(words);
  for (const b of blocked) bits[b >> 5] |= 1 << (b & 31);
  out.writeByte(words);
  for (const w of bits) out.writeInt(w);

  // Layers: ground tiles, flat decals, then the player layer (objects drawn with depth).
  out.writeByte(3);

  out.writeByte(2);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (isRoad(gx, gy)) out.writeByte(T_STONE + (gy % 2) * 2 + (gx % 2));
      else if (isPlaza(gx, gy)) out.writeByte(T_SAND + (gy % 3) * 3 + (gx % 3));
      else out.writeByte(T_GRASS + (gy % 3) * 3 + (gx % 3));
    }
  }

  const decals: [number, number][] = [
    [5, 5],
    [12, 24],
    [30, 10],
    [34, 19],
    [9, 13],
  ];
  out.writeByte(3);
  out.writeShort(decals.length);
  for (const [gx, gy] of decals) {
    out.writeShort(gx * TILE);
    out.writeShort(gy * TILE);
    out.writeByte(IMG.lawn);
    out.writeByte(0);
  }

  out.writeByte(4);
  out.writeByte(TEST_MAP_SPRITES.length);
  for (const id of TEST_MAP_SPRITES) out.writeShort(id);
  const entries: [number, number, number, number][] = objects.map((o) => [o.cx, o.by, o.img, 0]);
  // Animated portal (map sprite 0, transform -2 = not mirrored) at the end of the east road.
  entries.push([37 * TILE, 15 * TILE + 20, 0, -2]);
  out.writeShort(entries.length);
  for (const [cx, by, idx, tr] of entries) {
    out.writeShort(cx);
    out.writeShort(by);
    out.writeByte(idx);
    out.writeByte(tr);
  }
  return out.toByteArray();
}
