// The parts of com.hz.main.GameWorld that world movement uses (Vineflower decompile of
// classes2.dex): the model registry, NPC lookups, move speed and BFS grid path search.
import type { Model } from '../actor/Model';
import type { NPC } from '../actor/NPC';
import type { Player } from '../actor/Player';
import { GameMap } from '../map/GameMap';

export let gameMap: GameMap | null = null;
export let myPlayer: Player | null = null;
export const otherModels = new Map<number, Model>();
export let npcList: NPC[] = [];
let myMoveSpeed = 6;
let head = 0;
let tail = 0;

export function setGameMap(m: GameMap | null): void {
  gameMap = m;
  GameMap.npcAt = (gx, gy) => getNPC(gx, gy) != null;
  GameMap.smallMapInfo = () => ({
    me: myPlayer == null ? null : { gx: myPlayer.getGx(), gy: myPlayer.getGy(), dir: myPlayer.getDir() },
    npcs: npcList.map((n) => ({
      gx: n.getGx(), gy: n.getGy(), npcType: n.npcType, sign: n.getSign(), jumpIcon: n.isJumpIcon(), visible: n.isVisible(),
    })),
  });
}

export function setMyPlayer(p: Player | null): void {
  myPlayer = p;
}

export function setNpcList(list: NPC[]): void {
  npcList = list;
}

export function getModel(id: number): Model | null {
  if (myPlayer != null && id === myPlayer.getId()) return myPlayer;
  return otherModels.get(id) ?? null;
}

export function getNpcByID(id: number): NPC | null {
  return npcList.find((n) => n.getId() === id) ?? null;
}

/** Visible NPC standing on grid (gx, gy). (Jump-map NPC areas are not ported.) */
export function getNPC(gx: number, gy: number): NPC | null {
  for (const n of npcList) if (n.isVisible() && n.getGx() === gx && n.getGy() === gy) return n;
  return null;
}

/** NPC.doNpc opens the NPC's dialog/shop/quest UI, which is not ported yet. */
export let doNpc: (npc: NPC) => boolean = () => false;

export function setDoNpc(fn: (npc: NPC) => boolean): void {
  doNpc = fn;
}

/** Map change; offline there is only one map. */
export let doJumpMap: (mapId: number, gx: number, gy: number) => void = () => {};

export function getSpeed(m: Model): number {
  return m === myPlayer ? myMoveSpeed : 6;
}

export function setMyMoveSpeed(v: number): void {
  myMoveSpeed = v;
}

export function logicOtherModels(): void {
  for (const m of otherModels.values()) m.logicPlayer();
}

/** Ticks NPCs. Java returns true when a monster NPC starts a battle (battles not ported). */
export function logicNPCs(): boolean {
  if (myPlayer == null) return false;
  for (const n of npcList) n.logic();
  return false;
}

function canSearchCross(gx: number, gy: number): boolean {
  return gameMap!.isCanPass(gx, gy);
}

/**
 * Breadth-first search on the grid (neighbour order: left, down, right, up), used for
 * server-driven MoveTo. Returns directions 0 right, 1 left, 2 down, 3 up. Step counts live in
 * byte tables as in Java, so paths longer than 127 steps are not representable.
 */
export function searchPath(sx: number, sy: number, tx: number, ty: number, _ignoreNpc: boolean): number[] {
  const out: number[] = [];
  const m = gameMap;
  if (m == null) return out;
  if (sx < 0 || sy < 0 || sx >= m.mapColumns || sy >= m.mapRows) return out;
  m.clearSearchTable();
  tail = 0;
  head = 0;
  m.searchStep[sy][sx] = 0;
  m.nextSearchPosX[head] = sx;
  m.nextSearchPosY[head++] = sy;
  while (head > tail) {
    const x = m.nextSearchPosX[tail];
    const y = m.nextSearchPosY[tail++];
    const step = (m.searchStep[y][x] + 1) << 24 >> 24;
    const visit = (nx: number, ny: number): boolean => {
      if (!canSearchCross(nx, ny) || m.searchStep[ny][nx] !== -1) return false;
      m.nextSearchPosX[head] = nx;
      m.nextSearchPosY[head++] = ny;
      m.searchStep[ny][nx] = step;
      if (nx === tx && ny === ty) {
        findPath(sx, sy, tx, ty, m.searchStep[ty][tx], out);
        return true;
      }
      return false;
    };
    if (x - 1 >= 0 && visit(x - 1, y)) break;
    if (y + 1 < m.mapRows && visit(x, y + 1)) break;
    if (x + 1 < m.mapColumns && visit(x + 1, y)) break;
    if (y - 1 >= 0 && visit(x, y - 1)) break;
  }
  return out;
}

/** Walks back from the target through decreasing step numbers, prepending directions. */
function findPath(_sx: number, _sy: number, x: number, y: number, step: number, out: number[]): void {
  const m = gameMap!;
  while (step > 0) {
    const prev = (step - 1) << 24 >> 24;
    if (x - 1 >= 0 && m.searchStep[y][x - 1] === prev) {
      out.unshift(0);
      x--;
    } else if (x + 1 < m.mapColumns && m.searchStep[y][x + 1] === prev) {
      out.unshift(1);
      x++;
    } else if (y - 1 >= 0 && m.searchStep[y - 1][x] === prev) {
      out.unshift(2);
      y--;
    } else if (y + 1 < m.mapRows && m.searchStep[y + 1][x] === prev) {
      out.unshift(3);
      y++;
    }
    step = prev;
  }
}
