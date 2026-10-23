import { afterEach, describe, expect, it } from 'vitest';
import { Player } from '../src/game/actor/Player';
import { applyAutoMove } from '../src/game/main/AutoMove';
import * as GameWorld from '../src/game/main/GameWorld';
import { Message } from '../src/net/Message';
import { AutoMoveError, createAutoMoveMissionMsg, readAutoMove } from '../src/net/online/AutoMoveMessages';

afterEach(() => {
  GameWorld.setMyPlayer(null);
  GameWorld.setMapJumper(null);
  Player.hasUI = () => false;
});

describe('10518 path finding', () => {
  it('asks with mode 2 and the mission id', () => {
    const r = new Message(10518, createAutoMoveMissionMsg(3).payload());
    expect([r.getByte(), r.getShort()]).toEqual([2, 3]);
  });

  it('reads the crossings and the last cell (the backend reply for a mission on another map)', () => {
    const w = new Message(10518, 32);
    w.putByte(0);
    w.putByte(1);
    w.putByte(20);
    w.putByte(15);
    w.putShort(2);
    w.putByte(12);
    w.putByte(14);
    w.putByte(12);
    w.putByte(14);
    expect(readAutoMove(new Message(10518, w.payload()))).toEqual({
      legs: [{ gx: 20, gy: 15, mapId: 2, toGx: 12, toGy: 14 }], gx: 12, gy: 14,
    });
  });

  it('a refusal keeps its code', () => {
    const w = new Message(10518, 32);
    w.putByte(-26);
    w.putString('x');
    try {
      readAutoMove(new Message(10518, w.payload()));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AutoMoveError);
      expect((e as AutoMoveError).code).toBe(-26);
    }
  });

  it('the route runs as the auto-move list: walk, jump, then the NPC; dialogs pause it', () => {
    const me = new Player();
    me.id = 1;
    me.setPosition(20, 15);
    GameWorld.setMyPlayer(me);
    const jumps: number[][] = [];
    GameWorld.setMapJumper((...a) => jumps.push(a));
    applyAutoMove(me, { legs: [{ gx: 20, gy: 15, mapId: 2, toGx: 12, toGy: 14 }], gx: 12, gy: 14 });
    expect(me.isAutoMove()).toBe(true);
    Player.hasUI = () => true;
    me.logic();
    expect(me.autoMoveControlList.length).toBe(3);
    Player.hasUI = () => false;
    me.logic(); // already on (20, 15): the walk ends
    me.logic(); // the jump
    expect(jumps).toEqual([[2, 12, 14]]);
    expect(me.autoMoveControlList.length).toBe(1);
    me.clearAutoMoveList();
    expect(me.isAutoMove()).toBe(false);
  });
});
