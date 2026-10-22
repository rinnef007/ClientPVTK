import { describe, expect, it } from 'vitest';
import { PlayerBag } from '../src/game/actor/Item';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_MONEY2, ATTR_MONEY3, Player } from '../src/game/actor/Player';
import { CONDITION_KILL_MONSTER, CONDITION_MISSION_FINISHED, Mission } from '../src/game/core/Mission';
import { Message } from '../src/net/Message';
import { readMissionData, readMissionReward } from '../src/net/online/MissionMessages';
import { MoveSync } from '../src/net/online/MoveSync';
import { readBuyReply, readSellReply, readShopList } from '../src/net/online/ShopMessages';

function reply(type: number, write: (m: Message) => void): Message {
  const w = new Message(type, 4096);
  write(w);
  return new Message(type, w.payload());
}

/** DataOutputStream bytes for Mission.fromBytes. */
class Out {
  b: number[] = [];
  u8(...v: number[]) {
    for (const x of v) this.b.push(x & 255);
    return this;
  }
  i16(v: number) {
    return this.u8(v >> 8, v);
  }
  i32(v: number) {
    return this.u8(v >> 24, v >> 16, v >> 8, v);
  }
  utf(s: string) {
    const e = new TextEncoder().encode(s);
    this.i16(e.length);
    this.b.push(...e);
    return this;
  }
}

/** A "kill 3 cats" mission, accepted after mission 1, as the backend encodes it. */
function missionBlob(): Uint8Array {
  const o = new Out().i16(2).utf('Gấu Trúc').u8(1).utf('Đánh gấu').utf('Mô tả').i16(0).i16(1).u8(1).i16(0);
  o.utf('Chưa được').utf('Chưa xong').utf('Xong rồi').i32(120).i16(10).i16(50);
  o.u8(1).i16(121).u8(2).utf('Bình Máu').u8(9).u8(0); // one reward item
  o.u8(0); // no item to choose
  const done = new Out().i16(1).utf('Mèo');
  o.u8(1).u8(CONDITION_MISSION_FINISHED, 0, done.b.length).u8(...done.b);
  const kill = new Out().i16(2).utf('Gấu Trúc').u8(3, 1);
  o.u8(1).u8(CONDITION_KILL_MONSTER, 0, kill.b.length).u8(...kill.b);
  return new Uint8Array(o.b);
}

describe('Mission.fromBytes (1.2.0)', () => {
  it('reads the mission, its reward items and conditions', () => {
    const [m] = readMissionData(reply(14501, (w) => (w.putByte(1), w.putBytes(missionBlob()), w.putByte(0), w.putByte(0))));
    expect([m.getId(), m.name, m.npcId, m.mapId, m.exp, m.money2, m.money3]).toEqual([2, 'Gấu Trúc', 1, 1, 120, 10, 50]);
    expect(m.rewardItems.map((i) => [i.id, i.quantity, i.name])).toEqual([[121, 2, 'Bình Máu']]);
    expect(m.acceptCondition?.map((c) => [c.type, c.itemId, c.name])).toEqual([[9, 1, 'Mèo']]);
    expect(m.submitCondition?.map((c) => [c.type, c.itemId, c.need, c.done])).toEqual([[2, 2, 3, 1]]);
    const p = new Player();
    expect(m.isCanAccept(p)).toBe(false); // mission 1 not finished
    Mission.setMissionStatus(p, 1, true);
    expect(m.isCanAccept(p)).toBe(false); // level 1 needed, level 0 player
  });
});

describe('processMissionReward (1.2.0)', () => {
  it('applies money, the level-up and the items given', () => {
    const p = new Player();
    p.bag = new PlayerBag();
    p.set(ATTR_EXP, 350);
    p.set(ATTR_EXP_MAX, 400);
    const r = reply(14503, (w) => {
      w.putBoolean(true); // finished
      w.putShort(0); w.putInt(0); w.putInt(0); // costs
      w.putInt(10); w.putInt(50); // Lá, Bạc
      w.putInt(80); w.putByte(1); w.putInt(30); w.putInt(800); w.putShort(10); w.putByte(1); // level-up
      w.putInt(0); w.putByte(0); // god level
      w.putBoolean(false); // pet
      w.putByte(0); // items taken
      w.putByte(1); // one item given: kind 1, count 3, then Item.fromBytes
      w.putByte(1); w.putByte(3); w.putShort(0);
      w.putShort(3); w.putShort(0); w.putByte(0); w.putByte(0); w.putShort(0); w.putShort(0); w.putShort(0);
      w.putByte(27); w.putShort(121); w.putString('Bình Máu'); w.putByte(9); w.putString(''); w.putByte(0); w.putByte(0); w.putByte(99);
      w.putByte(1); w.putShort(0); w.putByte(0); w.putInt(10); w.putByte(1); w.putByte(0); w.putByte(49); w.putShort(100); w.putByte(0); w.putShort(0); w.putByte(0);
      w.putBoolean(false); w.putBoolean(false);
    });
    const { finished, text } = readMissionReward(r, p, 1);
    expect(finished).toBe(true);
    expect(Mission.isMissionFinish(p, 1)).toBe(true);
    expect([p.get(ATTR_MONEY2), p.get(ATTR_MONEY3), p.getLevel(), p.get(ATTR_EXP), p.get(ATTR_EXP_MAX)]).toEqual([10, 50, 1, 30, 800]);
    expect(p.bag.getItemNumByIdInBag(121)).toBe(3);
    expect(text).toContain('Lá10');
    expect(text).toContain('Bình Máu');
    expect(r.remaining).toBe(0);
  });
});

describe('item shop (1.2.0)', () => {
  it('reads the goods and the buy / sell replies', () => {
    const [it] = readShopList(reply(12004, (w) => {
      w.putByte(0); w.putByte(1);
      w.putByte(27); w.putShort(121); w.putString('Bình Máu'); w.putByte(9); w.putString(''); w.putByte(0); w.putByte(0); w.putByte(99);
      w.putByte(1); w.putShort(0); w.putByte(0); w.putInt(10); w.putByte(1); w.putByte(0); w.putByte(49); w.putShort(100); w.putByte(0); w.putShort(0); w.putByte(0);
      w.putInt(0); w.putInt(0); w.putInt(10); w.putByte(0); // discount prices
      w.putInt(0); w.putInt(0); w.putInt(10); // prices
      w.putShort(0); w.putShort(-1); w.putShort(-1); w.putByte(0);
    }), 2);
    expect([it.id, it.name, it.getPrice(), it.getMoneyIconIndex(), it.stackNum, it.maxBuy]).toEqual([121, 'Bình Máu', 10, 2, 99, -1]);
    const b = readBuyReply(reply(12005, (w) => (w.putByte(0), w.putInt(121), w.putShort(0), w.putByte(1), w.putInt(500), w.putInt(200), w.putInt(990), w.putShort(-1), w.putShort(-1))));
    expect(b).toEqual({ kind: 'bought', id: 121, count: 1, money: [500, 200, 990], maxBuy: -1, allCount: -1 });
    expect(readSellReply(reply(12006, (w) => (w.putByte(0), w.putInt(1002))))).toBe(1002);
    expect(() => readBuyReply(reply(12005, (w) => (w.putByte(-1), w.putString('Không đủ Bạc.'))))).toThrow('Không đủ Bạc.');
  });
});

describe('MoveSync (doSoftSync / syncMoveTo)', () => {
  it('sends the cell every 5 s, only when it changed', () => {
    const sent: number[][] = [];
    const s = new MoveSync(20, 15, (m) => sent.push([...m.payload()]));
    s.tick(20, 15, 0);
    s.tick(21, 15, 1000); // too soon
    s.tick(21, 15, 5000);
    s.tick(21, 15, 10000); // unchanged
    expect(sent).toEqual([[21, 15]]);
  });
});
