import { beforeEach, describe, expect, it } from 'vitest';
import { Model, TYPE_PLAYER } from '../src/game/actor/Model';
import { NPC } from '../src/game/actor/NPC';
import { Player } from '../src/game/actor/Player';
import { getCost, getXKey, getYKey, sqrt } from '../src/game/common/Tool';
import { Control } from '../src/game/main/Control';
import * as GameWorld from '../src/game/main/GameWorld';
import * as WorldPanel from '../src/game/main/WorldPanel';
import { GameMap } from '../src/game/map/GameMap';
import { buildTestMap } from '../src/game/map/TestMap';
import { KEY_RIGHT, KEY_UP } from '../src/midp/Input';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

let map: GameMap;
let me: Player;

/** One world tick in GameCanvas order. */
function tick(held = 0, pointer: [number, number] | null = null): void {
  GameWorld.logicOtherModels();
  me.logicPlayer();
  if (GameWorld.logicNPCs()) WorldPanel.clearMyMove();
  else {
    WorldPanel.handleKey(held, pointer);
    map.setCameraToPlayer(me);
  }
}

function walkable(path: number[], gx: number, gy: number): [number, number] {
  for (const d of path) {
    gx += DX[d];
    gy += DY[d];
    expect(map.isCanPass(gx, gy)).toBe(true);
  }
  return [gx, gy];
}

beforeEach(() => {
  map = GameMap.loadMap(buildTestMap())!;
  map.initGameMapData(320, 480, 20, 0);
  GameWorld.setGameMap(map);
  me = new Player();
  me.id = 1;
  me.setPosition(20, 17);
  GameWorld.setMyPlayer(me);
  GameWorld.otherModels.clear();
  GameWorld.setNpcList([]);
  WorldPanel.clearMyMove();
  map.setCameraToPlayer(me);
});

describe('Tool.sqrt / getCost', () => {
  it('matches floor(sqrt) like the J2ME integer version', () => {
    for (let i = 0; i < 200000; i += 37) expect(sqrt(i)).toBe(Math.floor(Math.sqrt(i)));
    expect(getCost(0, 0, 30, 40)).toBe(50);
  });
});

describe('GameWorld.searchPath (BFS)', () => {
  it('finds a shortest walkable path', () => {
    const path = GameWorld.searchPath(20, 17, 30, 15, false);
    expect(walkable(path, 20, 17)).toEqual([30, 15]);
    expect(path.length).toBe(12); // open road: Manhattan distance
  });

  it('routes around blocked cells and returns [] when unreachable', () => {
    const blocked: [number, number] = [18, 10]; // statue base (row above the statue's foot)
    expect(map.isCanPass(...blocked)).toBe(false);
    const path = GameWorld.searchPath(18, 12, 18, 8, false);
    expect(walkable(path, 18, 12)).toEqual([18, 8]);
    expect(path.length).toBeGreaterThan(4);
    expect(GameWorld.searchPath(20, 17, ...blocked, false)).toEqual([]);
  });
});

describe('GameMap.findPath (pointer path)', () => {
  it('reaches the goal over walkable cells', () => {
    const path = map.findPath(20, 17, 8, 22, 24)!;
    expect(path).not.toBeNull();
    expect(walkable(path, 20, 17)).toEqual([8, 22]);
  });

  it('returns null for the same cell or an enclosed goal', () => {
    expect(map.findPath(20, 17, 20, 17, 24)).toBeNull();
    expect(map.findPath(20, 17, 18, 10, 24)).toBeNull();
  });
});

describe('WorldPanel.handleKey (held keys)', () => {
  it('moves 6 px per tick along the road', () => {
    for (let i = 0; i < 8; i++) tick(KEY_RIGHT);
    // A move is queued on tick n and executed on tick n+1.
    expect(me.getPx()).toBe(20 * 24 + 7 * 6);
    expect(me.getPy()).toBe(17 * 24);
    expect(me.getDir()).toBe(0);
  });

  it('stops at the map edge / obstacles instead of entering them', () => {
    for (let i = 0; i < 400; i++) tick(KEY_UP);
    for (let gy = me.getGy(); gy <= (me.getPy() + 23) / 24; gy++) expect(map.isCanPass(me.getGx(), gy | 0)).toBe(true);
    const y = me.getPy();
    tick(KEY_UP);
    tick(KEY_UP);
    expect(me.getPy()).toBe(y);
  });

  it('slides around a corner when the way ahead is half blocked', () => {
    // Straddle columns 17/18 right under the statue base (both blocked), and push up:
    // findMoveDis picks the nearer opening (column 19, 12 px away) and slides right.
    me.px = 17 * 24 + 12;
    me.py = 11 * 24;
    tick(KEY_UP);
    tick(KEY_UP);
    expect(me.getPx()).toBe(17 * 24 + 18);
    expect(me.getPy()).toBe(11 * 24);
    for (let i = 0; i < 20; i++) tick(KEY_UP);
    expect(me.getGx()).toBe(19);
    expect(me.getPy()).toBeLessThan(11 * 24);
  });
});

describe('tap to walk', () => {
  it('walks to the tapped cell using findPath + changeDirMoveVectorToPixelMove', () => {
    const target: [number, number] = [26, 21];
    const sx = target[0] * 24 + 5 + map.offsetLeftX;
    const sy = target[1] * 24 + 5 + map.offsetTopY;
    tick(0, [sx, sy]);
    for (let i = 0; i < 200 && WorldPanel.myMoveVector.length + me.controlList.length > 0; i++) tick();
    expect([me.getGx(), me.getGy()]).toEqual(target);
    expect(me.getPx() % 24).toBe(0);
    expect(me.getPy() % 24).toBe(0);
  });

  it('snaps to the grid first when starting off-grid', () => {
    me.px += 10;
    const v = WorldPanel.changeDirMoveVectorToPixelMove(me, 6, [0, 0]);
    const sum = v.reduce((a, k) => [a[0] + ((getXKey(k) << 16) >> 16), a[1] + ((getYKey(k) << 16) >> 16)], [0, 0]);
    expect(me.getPx() + sum[0]).toBe(22 * 24);
    expect(sum[1]).toBe(0);
  });
});

describe('Control.MoveTo (server-driven moves)', () => {
  it('walks another player to the destination at 6 px/tick', () => {
    const o = new Model(TYPE_PLAYER);
    o.id = 7;
    o.setPosition(20, 17);
    GameWorld.otherModels.set(7, o);
    o.addControl(Control.createMoveTo(7, 30, 15));
    let ticks = 0;
    while (!o.isControlListEmpty() && ticks < 500) {
      tick();
      ticks++;
    }
    expect([o.getGx(), o.getGy(), o.getPx() % 24, o.getPy() % 24]).toEqual([30, 15, 0, 0]);
    expect(ticks).toBe(12 * 4 + 1); // 12 cells × 4 ticks (first step runs on the set-up tick) + final pop
  });
});

describe('NPC wandering', () => {
  it('stays inside its range box on walkable cells', () => {
    const n = new NPC();
    n.id = 9;
    n.setSource(8, 6, 3, 2);
    GameWorld.setNpcList([n]);
    me.setPosition(8, 8); // keep the NPC on screen
    map.setCameraToPlayer(me);
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      // A random walk can end back on its start cell, so check that it moved at some point.
      let moved = false;
      for (let i = 0; i < 3000; i++) {
        now += 50;
        tick();
        expect(Math.abs(n.getGx() - 8)).toBeLessThanOrEqual(3);
        expect(Math.abs(n.getGy() - 6)).toBeLessThanOrEqual(2);
        if (n.getPx() !== 8 * 24 || n.getPy() !== 6 * 24) moved = true;
      }
      expect(moved).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });
});
