// Port of com.hz.main.WorldPanel's movement code (Vineflower decompile of classes2.dex):
// held-key movement with wall sliding, and pointer movement along GameMap.findPath.
// Not ported: the world HUD panel (gameworldPanelUI), escort mode, auto-move cancel dialog.
import type { Model } from '../actor/Model';
import type { Player } from '../actor/Player';
import { getXKey, getYKey, setKeyXY } from '../common/Tool';
import type { GameMap } from '../map/GameMap';
import { Control } from './Control';
import * as GameWorld from './GameWorld';

/** Fallback cells tried around a blocked pointer target, nearest first. */
const POINTER_NEARFY: [number, number][] = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
  [-2, 2], [-2, 1], [-2, 0], [-2, -1], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [2, -1], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2],
];

/** Queued pixel moves from the last pointer path, each packed with setKeyXY(dx, dy). */
export let myMoveVector: number[] = [];
let pointNpcId = -1;

const sx16 = (v: number) => (v << 16) >> 16;
const keyX = (k: number) => sx16(getXKey(k));
const keyY = (k: number) => sx16(getYKey(k));

export function clearMyMove(): void {
  myMoveVector = [];
}

export function getDirByKeyPressed(key: number): number {
  if (key === 50) return 3;
  if (key === 52) return 1;
  if (key === 54) return 0;
  return key !== 56 ? 8 : 2;
}

export function getDirByMovePixels(dx: number, dy: number, diagonal: boolean): number {
  if (dx > 0) {
    if (diagonal) {
      if (dy > 0) return 7;
      if (dy < 0) return 6;
    }
    return 0;
  }
  if (dx < 0) {
    if (diagonal) {
      if (dy > 0) return 5;
      if (dy < 0) return 4;
    }
    return 1;
  }
  if (dy > 0) return 2;
  return dy < 0 ? 3 : 8;
}

/** Neighbour cell in direction `d`, packed with setKeyXY. */
export function getFaceXY(gx: number, gy: number, d: number): number {
  switch (d) {
    case 0:
      return setKeyXY(gx + 1, gy);
    case 1:
      return setKeyXY(gx - 1, gy);
    case 2:
      return setKeyXY(gx, gy + 1);
    case 3:
      return setKeyXY(gx, gy - 1);
    case 4:
      return setKeyXY(gx - 1, gy - 1);
    case 5:
      return setKeyXY(gx - 1, gy + 1);
    case 6:
      return setKeyXY(gx + 1, gy - 1);
    case 7:
      return setKeyXY(gx + 1, gy + 1);
    default:
      return setKeyXY(gx, gy);
  }
}

export function getMoveXByDir(d: number, n: number): number {
  return d === 0 ? n : d === 1 ? -n : 0;
}

export function getMoveYByDir(d: number, n: number): number {
  return d === 2 ? n : d === 3 ? -n : 0;
}

export function getReverseDir(d: number): number {
  if (d === 0) return 1;
  if (d === 1) return 0;
  if (d === 2) return 3;
  return d !== 3 ? 8 : 2;
}

function map(): GameMap | null {
  return GameWorld.gameMap;
}

/**
 * How far (up to `want`, signed) a body whose top-left is (px, py) can move horizontally.
 * The body may straddle two rows, so both rows must be free.
 */
export function getCanMoveDisX(px: number, py: number, want: number): number {
  const m = map();
  if (m == null) return 0;
  let col = (px / 24) | 0;
  const rem = px % 24;
  const row0 = (py / 24) | 0;
  const row1 = ((py + 23) / 24) | 0;
  let dist = 0;
  if (want < 0) {
    if (rem !== 0) {
      dist = -rem;
      if (dist <= want) return want;
    }
    for (;;) {
      const next = col - 1;
      if (next < 0) return dist;
      if (!m.isCanPass(next, row0)) return dist;
      if (row1 !== row0 && !m.isCanPass(next, row1)) return dist;
      dist -= 24;
      col = next;
      if (dist <= want) return want;
    }
  }
  col = ((px + 23) / 24) | 0;
  if (rem !== 0) {
    dist = 24 - rem;
    if (dist >= want) return want;
  }
  for (;;) {
    const next = col + 1;
    if (next >= m.mapColumns) return dist;
    if (!m.isCanPass(next, row0)) return dist;
    if (row1 !== row0 && !m.isCanPass(next, row1)) return dist;
    dist += 24;
    col = next;
    if (dist >= want) return want;
  }
}

export function getCanMoveDisY(px: number, py: number, want: number): number {
  const m = map();
  if (m == null) return 0;
  let row = (py / 24) | 0;
  const rem = py % 24;
  const col0 = (px / 24) | 0;
  const col1 = ((px + 23) / 24) | 0;
  let dist = 0;
  if (want < 0) {
    if (rem !== 0) {
      dist = -rem;
      if (dist <= want) return want;
    }
    for (;;) {
      const next = row - 1;
      if (next < 0) return dist;
      if (!m.isCanPass(col0, next)) return dist;
      if (col1 !== col0 && !m.isCanPass(col1, next)) return dist;
      dist -= 24;
      row = next;
      if (dist <= want) return want;
    }
  }
  row = ((py + 23) / 24) | 0;
  if (rem !== 0) {
    dist = 24 - rem;
    if (dist >= want) return want;
  }
  for (;;) {
    const next = row + 1;
    if (next >= m.mapRows) return dist;
    if (!m.isCanPass(col0, next)) return dist;
    if (col1 !== col0 && !m.isCanPass(col1, next)) return dist;
    dist += 24;
    row = next;
    if (dist >= want) return want;
  }
}

/**
 * Distance to the nearest free column in direction `dir` (1 = left, 0 = right) along row
 * py/24, 0 if (px, py) already fits, -1 if none.
 */
function getCanNotMoveDisX(px: number, py: number, dir: number): number {
  const m = map();
  if (m == null) return 0;
  const c0 = (px / 24) | 0;
  const rem = px % 24;
  const c1 = ((px + 23) / 24) | 0;
  const row = (py / 24) | 0;
  if (row < 0 || row >= m.mapRows) return -1;
  if (dir === 1) {
    let d = 0;
    if (rem !== 0) {
      if (m.isCanPass(c0, row) && m.isCanPass(c1, row)) return 0;
      d = rem;
    }
    for (let c = ((px - d) / 24) | 0; c >= 0; c--) {
      if (m.isCanPass(c, row)) return d;
      d += 24;
    }
    return -1;
  }
  if (dir === 0) {
    let d = 0;
    if (rem !== 0) {
      if (m.isCanPass(c0, row) && m.isCanPass(c1, row)) return 0;
      d = 24 - rem;
    }
    for (let c = ((px + d) / 24) | 0; c < m.mapColumns; c++) {
      if (m.isCanPass(c, row)) return d;
      d += 24;
    }
  }
  return -1;
}

/** Vertical counterpart: 3 = up, 2 = down, along column px/24. */
function getCanNotMoveDisY(px: number, py: number, dir: number): number {
  const m = map();
  if (m == null) return 0;
  const r0 = (py / 24) | 0;
  const rem = py % 24;
  const r1 = ((py + 23) / 24) | 0;
  const col = (px / 24) | 0;
  if (col < 0 || col >= m.mapColumns) return -1;
  if (dir === 3) {
    let d = 0;
    if (rem !== 0) {
      if (m.isCanPass(col, r0) && m.isCanPass(col, r1)) return 0;
      d = rem;
    }
    for (let r = ((py - d) / 24) | 0; r >= 0; r--) {
      if (m.isCanPass(col, r)) return d;
      d += 24;
    }
    return -1;
  }
  if (dir === 2) {
    let d = 0;
    if (rem !== 0) {
      if (m.isCanPass(col, r0) && m.isCanPass(col, r1)) return 0;
      d = 24 - rem;
    }
    for (let r = ((py + d) / 24) | 0; r < m.mapRows; r++) {
      if (m.isCanPass(col, r)) return d;
      d += 24;
    }
  }
  return -1;
}

/**
 * Blocked straight ahead: slide sideways towards the nearer opening of the cell ahead, so the
 * player rounds corners instead of sticking to them.
 */
function findMoveDis(px: number, py: number, dx: number, dy: number, speed: number): number {
  if (map() == null) return 0;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx === 0) return 0;
    const ahead = px + (dx >= 0 ? 24 : -24);
    let up = getCanNotMoveDisY(ahead, py, 3);
    if (up !== -1) {
      const can = -getCanMoveDisY(px, py, -up);
      if (can === 0 || can < up) up = -1;
    }
    let down = getCanNotMoveDisY(ahead, py, 2);
    if (down !== -1) {
      const can = getCanMoveDisY(px, py, down);
      if (can === 0 || can < down) down = -1;
    }
    if (up === -1 && down === -1) return 0;
    return (up === -1 || up >= down) && down !== -1 ? setKeyXY(0, Math.min(speed, down)) : setKeyXY(0, -Math.min(speed, up));
  }
  if (dy === 0) return 0;
  const ahead = py + (dy >= 0 ? 24 : -24);
  let left = getCanNotMoveDisX(px, ahead, 1);
  if (left !== -1) {
    const can = -getCanMoveDisX(px, py, -left);
    if (can === 0 || can < left) left = -1;
  }
  let right = getCanNotMoveDisX(px, ahead, 0);
  if (right !== -1) {
    const can = getCanMoveDisX(px, py, right);
    if (can === 0 || can < right) right = -1;
  }
  if (left === -1 && right === -1) return 0;
  return (left === -1 || left >= right) && right !== -1 ? setKeyXY(Math.min(speed, right), 0) : setKeyXY(-Math.min(speed, left), 0);
}

/** Clamp a wanted move to free space; if fully blocked, try sliding (findMoveDis). */
export function correctMoveDis(px: number, py: number, dx: number, dy: number, speed: number): number {
  const x = dx !== 0 ? getCanMoveDisX(px, py, dx) : 0;
  const y = dy !== 0 ? getCanMoveDisY(px, py, dy) : 0;
  return x === 0 && y === 0 ? findMoveDis(px, py, dx, dy, speed) : setKeyXY(x, y);
}

/** Bumping into an NPC talks to it instead of moving (NPC UI not ported: doNpc is a hook). */
export function checkNpc(p: Player, x: number, y: number, pointer: boolean): boolean {
  let cells: number[][];
  if (pointer) {
    pointNpcId = -1;
    cells = [[x, y]];
  } else {
    cells = p.getNextMovePos(x, y);
  }
  for (const [cx, cy] of cells) {
    // Java uses getPointCheckNPC for pointer hits (a larger hit box); grid lookup here.
    const npc = pointer ? GameWorld.getNPC((cx / 24) | 0, (cy / 24) | 0) : GameWorld.getNPC(cx, cy);
    if (npc != null && npc.npcType !== 1 && npc.npcType !== 4 && npc.isEnable()) {
      if (pointer) {
        pointNpcId = npc.getId();
        return true;
      }
      if (myMoveVector.length <= 0 || pointNpcId === npc.getId()) return GameWorld.doNpc(npc);
    }
  }
  return false;
}

/**
 * Per-tick player input (GameCanvas calls this after the player's logic). `pressingKey` is the
 * held key; `pointer` is the released pointer position (or null). Only queues a move when the
 * previous one has been executed, so the player moves at most `speed` px per tick.
 */
export function handleKey(pressingKey: number, pointer: [number, number] | null): void {
  const p = GameWorld.myPlayer;
  if (p == null) return;
  const speed = GameWorld.getSpeed(p);
  if (pointer) handleWorldPointer(p, pointer[0], pointer[1], speed);
  if (!p.isControlListEmpty()) return;
  const dir = getDirByKeyPressed(pressingKey);
  let queued = 0;
  if (dir === 8) {
    if (myMoveVector.length > 0) queued = myMoveVector.shift()!;
  } else {
    myMoveVector = [];
  }
  if (dir === 8 && queued === 0) return;
  if (!p.isCanMove()) return;
  let mv = queued;
  if (queued === 0) mv = correctMoveDis(p.getPx(), p.getPy(), getMoveXByDir(dir, speed), getMoveYByDir(dir, speed), speed);
  if (mv !== 0) handleMoveKey(p, keyX(mv), keyY(mv));
}

export function handleMoveKey(p: Player, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  if (!checkNpc(p, dx, dy, false)) p.addControl(Control.createPixelMove(p.getId(), dx, dy, p.getType()));
}

function handleWorldPointer(p: Player, x: number, y: number, speed: number): void {
  if (x === -1 || y === -1) return;
  if (!p.isCanMove()) return;
  updatePointerMoveVector(p, x, y, speed);
}

/** Path to the tapped cell (or the nearest free cell around it), as pixel steps. */
function updatePointerMoveVector(p: Player, sx: number, sy: number, speed: number): void {
  const m = map();
  if (m == null) return;
  const wx = sx - m.offsetLeftX;
  const wy = sy - m.offsetTopY;
  let gx = Math.min((wx / 24) | 0, m.mapColumns - 1);
  let gy = Math.min((wy / 24) | 0, m.mapRows - 1);
  const onNpc = checkNpc(p, wx, wy, true);
  if (onNpc) {
    const npc = GameWorld.getNpcByID(pointNpcId);
    if (npc != null) {
      gx = npc.getGx();
      gy = npc.getGy();
    }
  }
  let tx = gx;
  let ty = gy;
  for (let i = 0; ; i++) {
    if (i >= POINTER_NEARFY.length) break;
    const cx = POINTER_NEARFY[i][0] + gx;
    const cy = POINTER_NEARFY[i][1] + gy;
    if (m.isCanPass(cx, cy) || (i === 0 && onNpc)) {
      tx = cx;
      ty = cy;
      break;
    }
    if (i === POINTER_NEARFY.length - 1) return;
  }
  myMoveVector = changeDirMoveVectorToPixelMove(p, speed, m.findPath(p.getGx(), p.getGy(), tx, ty, 24));
}

/**
 * Turns a grid direction list into per-tick pixel moves of at most `speed` px. Two different
 * consecutive directions become one diagonal cell when the corner cell is free. Moves that bring
 * the player closer to grid alignment reset the list (snap first, then follow the path), and the
 * initial off-grid offset is prepended.
 */
export function changeDirMoveVectorToPixelMove(mdl: Model, speed: number, dirs: number[] | null): number[] {
  const out: number[] = [];
  const m = map();
  if (dirs == null || m == null) return out;
  const px = mdl.getPx();
  const py = mdl.getPy();
  let gx = mdl.getGx();
  let gy = mdl.getGy();
  let alignX = gx * 24;
  let alignY = gy * 24;
  let curX = alignX;
  let curY = alignY;
  let best = Math.abs(px - alignX) + Math.abs(py - alignY);
  const n = dirs.length;
  let i = 0;
  while (i < n) {
    const d = dirs[i];
    const nextI = i + 1;
    if (d === 8) {
      i = nextI;
      continue;
    }
    const d2 = nextI < n ? dirs[nextI] : 8;
    let diagonal = !(d2 === 8 || d2 === d);
    const corner = getFaceXY(gx, gy, d2);
    if (!m.isCanPass(getXKey(corner), getYKey(corner))) diagonal = false;
    if (!diagonal) {
      for (let left = 24; left > 0; left -= speed) {
        const s = Math.min(left, speed);
        const mx = getMoveXByDir(d, s);
        const my = getMoveYByDir(d, s);
        out.push(setKeyXY(mx, my));
        curX += mx;
        curY += my;
        if (best > 0) {
          const dist = Math.abs(px - curX) + Math.abs(py - curY);
          if (dist <= best) {
            out.length = 0;
            best = dist;
            alignY = curY;
            alignX = curX;
          }
        }
      }
      const k = getFaceXY(gx, gy, d);
      gx = getXKey(k);
      gy = getYKey(k);
      i = nextI;
    } else {
      for (let left = 24; left > 0; left -= speed) {
        const s = Math.min(left, speed);
        const mx = getMoveXByDir(d, s) + getMoveXByDir(d2, s);
        const my = getMoveYByDir(d, s) + getMoveYByDir(d2, s);
        out.push(setKeyXY(mx, my));
        curX += mx;
        curY += my;
        if (best > 0) {
          const dist = Math.abs(px - curX) + Math.abs(py - curY);
          if (dist <= best) {
            out.length = 0;
            best = dist;
            alignY = curY;
            alignX = curX;
          }
        }
      }
      const k1 = getFaceXY(gx, gy, d);
      const k2 = getFaceXY(getXKey(k1), getYKey(k1), d2);
      gx = getXKey(k2);
      gy = getYKey(k2);
      i += 2;
    }
  }
  // Prepend the moves from the current pixel position to the alignment point.
  const pre: number[] = [];
  if (alignX !== px) {
    if (alignX > px) for (let r = alignX - px; r > 0; r -= speed) pre.push(setKeyXY(Math.min(r, speed), 0));
    else for (let r = px - alignX; r > 0; r -= speed) pre.push(setKeyXY(-Math.min(r, speed), 0));
  }
  if (alignY !== py) {
    if (alignY > py) for (let r = alignY - py; r > 0; r -= speed) pre.push(setKeyXY(0, Math.min(r, speed)));
    else for (let r = py - alignY; r > 0; r -= speed) pre.push(setKeyXY(0, -Math.min(r, speed)));
  }
  return [...pre, ...out];
}
