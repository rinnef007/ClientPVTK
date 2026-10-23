import { afterEach, describe, expect, it } from 'vitest';
import { NPC } from '../src/game/actor/NPC';
import { Player } from '../src/game/actor/Player';
import { Mission } from '../src/game/core/Mission';
import * as GameWorld from '../src/game/main/GameWorld';
import { GameMap } from '../src/game/map/GameMap';
import { Message } from '../src/net/Message';
import { readDataBlocks } from '../src/net/online/EnterGame';
import { createJumpMapMsg, readJumpMap } from '../src/net/online/MapMessages';
import { handlePush } from '../src/net/online/PushHandler';

/** The bytes of encoders.write_other_player (Model.fromBytes + no pet + no mercenaries). */
function putOtherPlayer(w: Message, id: number, name: string, gx: number, gy: number): void {
  for (let i = 0; i < 4; i++) w.putByte(0);
  w.putInt(id);
  w.putString(name);
  w.putString('');
  w.putString('Tân thủ');
  w.putByte(12);
  w.putByte(0);
  w.putLong(1n);
  w.putLong(2n);
  w.putLong(3n);
  w.putInt(0);
  w.putInt(0);
  w.putByte(0); // mode
  w.putInt(-1); // no country
  w.putByte(gx);
  w.putByte(gy);
  w.putByte(0);
  w.putByte(-1); // no pet
  w.putByte(0); // mercenaries
  w.putString('');
  w.putInt(0);
  w.putShort(0);
}

function reply(w: Message): Message {
  return new Message(w.type, w.payload());
}

afterEach(() => {
  GameWorld.setMyPlayer(null);
  GameWorld.setGameMap(null);
  GameWorld.setMapJumper(null);
  GameWorld.otherModels.clear();
  GameWorld.setNpcList([]);
});

describe('10506 jump map', () => {
  it('writes map id, cell and the wanted blocks (64)', () => {
    const r = reply(createJumpMapMsg(2, 5, 15));
    expect([r.getShort(), r.getByte(), r.getByte(), r.getInt()]).toEqual([2, 5, 15, 64]);
  });

  it('reads the blocks of the reply in bit order: players, teams, map, NPCs, images, name', () => {
    const w = new Message(10506, 512);
    w.putByte(0);
    w.putInt(2);
    w.putByte(5);
    w.putByte(15);
    w.putInt(64 | 512 | 1024 | 8192 | 16384);
    w.putShort(1);
    putOtherPlayer(w, 77, 'Khách', 6, 14);
    w.putShort(1); // one team: 77 leads 88
    w.putInt(77);
    w.putByte(1);
    w.putInt(88);
    w.putBytes(new Uint8Array([1, 2, 3]));
    w.putString('Rừng Tre');
    w.putString('tip');
    w.putByte(0);
    w.putBytes(new Uint8Array([9]));
    w.putByte(1);
    w.putShort(7);
    w.putString('Rừng Tre (mới)');
    w.putInt(0);
    w.putInt(0);
    const d = readJumpMap(reply(w));
    expect([d.mapId, d.gx, d.gy]).toEqual([2, 5, 15]);
    expect(d.players?.map((p) => [p.id, p.name, p.title, p.level, p.gx, p.gy, p.pet])).toEqual([[77, 'Khách', 'Tân thủ', 12, 6, 14, null]]);
    expect(d.teams).toEqual([[77, [88]]]);
    expect(Array.from(d.mapBytes ?? [])).toEqual([1, 2, 3]);
    expect(d.mapName).toBe('Rừng Tre');
    expect(Array.from(d.npcBytes ?? [])).toEqual([9]);
    expect(d.mapImageIds).toEqual([7]);
    expect(d.newMapName).toBe('Rừng Tre (mới)');
    expect(d.unread).toBe(0);
  });

  it('a refusal throws its text', () => {
    const w = new Message(10506, 64);
    w.putByte(-1);
    w.putString('Cần đạt cấp 20.');
    expect(() => readJumpMap(reply(w))).toThrow('Cần đạt cấp 20.');
  });

  it('a mirror map (30000–31999) carries the original map id', () => {
    const w = new Message(10503, 64);
    w.putInt(30005);
    w.putShort(3);
    w.putByte(1);
    w.putByte(2);
    w.putInt(0);
    const d = readDataBlocks(reply(w));
    expect([d.mapId, d.orgMapId, d.gx, d.gy]).toEqual([30005, 3, 1, 2]);
  });

  it('stops at an unported block after the map instead of failing', () => {
    const w = new Message(2, 64);
    w.putInt(1);
    w.putByte(1);
    w.putByte(1);
    w.putInt(512 | 65536);
    w.putBytes(new Uint8Array([1]));
    w.putString('a');
    w.putString('b');
    w.putByte(0);
    expect(readDataBlocks(reply(w)).unread).toBe(65536);
  });
});

describe('GameWorld.doJumpMap', () => {
  function world(mapId: number): Player {
    const me = new Player();
    me.id = 1;
    me.setPosition(3, 3);
    GameWorld.setMyPlayer(me);
    const map = new GameMap();
    map.setMapID(mapId);
    GameWorld.setGameMap(map);
    return me;
  }

  it('on the same map only moves the player', () => {
    const me = world(1);
    const calls: number[][] = [];
    GameWorld.setMapJumper((...a) => calls.push(a));
    GameWorld.doJumpMap(1, 10, 12);
    expect([me.getGx(), me.getGy()]).toEqual([10, 12]);
    expect(calls).toEqual([]);
  });

  it('another map goes to the scene; a stall refuses', () => {
    const me = world(1);
    const calls: number[][] = [];
    const alerts: string[] = [];
    GameWorld.setMapJumper((...a) => calls.push(a));
    GameWorld.setAlertHook((t) => alerts.push(t));
    GameWorld.doJumpMap(2, 5, 15);
    expect(calls).toEqual([[2, 5, 15]]);
    me.mode = 1;
    GameWorld.doJumpMap(3, 5, 15);
    expect(calls.length).toBe(1);
    expect(alerts.length).toBe(1);
  });

  it('a jump-area NPC (type 8) is found anywhere in its range', () => {
    const n = new NPC();
    n.npcType = 8;
    n.setSource(10, 10, 2, 1);
    n.setVisible(true);
    GameWorld.setNpcList([n]);
    expect(GameWorld.getNPC(12, 11)).toBe(n);
    expect(GameWorld.getNPC(13, 10)).toBeNull();
  });
});

describe('other players pushed by the server', () => {
  it('10501 adds, 10505 walks near ones and places far ones, 10502 removes', () => {
    const me = new Player();
    me.id = 1;
    GameWorld.setMyPlayer(me);
    const enter = new Message(10501, 256);
    putOtherPlayer(enter, 77, 'Khách', 6, 14);
    handlePush(reply(enter), me);
    const other = GameWorld.getModel(77)!;
    expect(other.getName()).toBe('Khách');

    const near = new Message(10505, 64);
    near.putShort(1);
    near.putInt(77);
    near.putByte(8);
    near.putByte(14);
    near.putByte(0);
    handlePush(reply(near), me);
    expect(other.isControlListEmpty()).toBe(false);
    expect([other.getGx(), other.getGy()]).toEqual([6, 14]);

    const far = new Message(10505, 64);
    far.putShort(1);
    far.putInt(77);
    far.putByte(30);
    far.putByte(2);
    far.putByte(0);
    handlePush(reply(far), me);
    expect([other.getGx(), other.getGy()]).toEqual([30, 2]);

    const leave = new Message(10502, 16);
    leave.putInt(77);
    handlePush(reply(leave), me);
    expect(GameWorld.getModel(77)).toBeNull();
  });
});

describe('Mission.checkPlayerMissionStatus', () => {
  it('no mission passes; bit 8 wants it not taken, bit 1 finished', () => {
    const p = new Player();
    p.missionStatus = new Uint8Array(4);
    expect(Mission.checkPlayerMissionStatus(p, 0, 0)).toBe(true);
    expect(Mission.checkPlayerMissionStatus(p, 5, 8)).toBe(true);
    expect(Mission.checkPlayerMissionStatus(p, 5, 1)).toBe(false);
    Mission.setMissionStatus(p, 5, true);
    expect(Mission.checkPlayerMissionStatus(p, 5, 1)).toBe(true);
    expect(Mission.checkPlayerMissionStatus(p, 5, 8)).toBe(false);
  });
});

describe('NPC.isNeedLoadFromServer', () => {
  it('only server sprites (≥ 4000) without a sprite wait for the default image', () => {
    const n = new NPC();
    expect(n.isNeedLoadFromServer(108)).toBe(false);
    expect(n.isTabStatus(65536)).toBe(false);
    expect(n.isNeedLoadFromServer(4001)).toBe(true);
    expect(n.isTabStatus(65536)).toBe(true);
  });
});

describe('mercenaries of other players', () => {
  it('block 64 mercenaries start on their owner and follow it', async () => {
    const { buildOtherPlayer } = await import('../src/game/main/OnlineWorld');
    const { readOtherPlayer } = await import('../src/net/online/OtherPlayers');
    const w = new Message(64, 512);
    for (let i = 0; i < 4; i++) w.putByte(0);
    w.putInt(77);
    w.putString('Khách');
    w.putString('');
    w.putString('');
    w.putByte(10);
    w.putByte(0);
    w.putLong(1n);
    w.putLong(2n);
    w.putLong(3n);
    w.putInt(0);
    w.putInt(0);
    w.putByte(0);
    w.putInt(-1);
    w.putByte(6);
    w.putByte(14);
    w.putByte(0);
    w.putByte(-1); // no pet
    w.putByte(1); // one mercenary: group 9, look, no pet
    w.putShort(9);
    w.putInt(500);
    w.putLong(4n);
    w.putLong(5n);
    w.putLong(6n);
    w.putInt(-1);
    w.putString('');
    w.putInt(0);
    w.putShort(0);
    const d = readOtherPlayer(new Message(64, w.payload()));
    expect(d.mercenaries).toEqual([{ groupId: 9, look: { id: 500, icon1: 4n, icon2: 5n, icon3: 6n }, pet: null }]);
    const { model, ready } = buildOtherPlayer(d);
    await ready;
    GameWorld.addModel(model);
    const merc = model.getMercenaryById(9)!;
    expect([merc.getGx(), merc.getGy(), merc.getType()]).toEqual([6, 14, 5]);
    model.setPosition(10, 14);
    merc.logic(); // queues a step towards the owner
    merc.logic(); // takes it
    expect(merc.getPx()).toBeGreaterThan(6 * 24);
  });
});
