import { describe, expect, it } from 'vitest';
import { Message } from '../src/net/Message';
import { readEnterGame } from '../src/net/online/EnterGame';
import { readListPlayer, readUserLogin, ServerError } from '../src/net/online/LoginMessages';
import { gunzip, readNpcList } from '../src/net/online/WorldData';

/** A reply as the client sees it: written, then read back from the start. */
function reply(type: number, write: (m: Message) => void): Message {
  const w = new Message(type, 4096);
  write(w);
  return new Message(type, w.payload());
}

/** Player.fromBytes (1.2.0) for a level-7 character with no country, partner or titles. */
function writePlayer(m: Message): void {
  m.putInt(42);
  m.putString('Tester');
  m.putString('');
  m.putString('');
  m.putString('Danh hiệu');
  [0, 0, 2, 7, 0].forEach((b) => m.putByte(b));
  m.putInt(0);
  m.putInt(100);
  [1n, 2n, 3n].forEach((l) => m.putLong(l));
  m.putInt(0);
  m.putInt(0);
  m.putByte(0);
  m.putInt(-1); // no country
  [350, 2800, 210, 90].forEach((v) => m.putInt(v));
  m.putShort(3);
  m.putInt(40);
  [11, 12, 13, 14, 15].forEach((v) => m.putShort(v));
  [500, 200, 1000].forEach((v) => m.putInt(v));
  m.putByte(30);
  m.putByte(30);
  [0, -1, 9, 4, 1].forEach((v) => m.putInt(v));
  m.putByte(0);
  m.putInt(-1); // no partner
  m.putString('');
  m.putString('');
  for (let i = 0; i < 10; i++) m.putInt(i === 3 ? 777 : 0); // integral, arena, sky arena, combat, ignore_*
  [1, 0, 0, 0, 1, 0].forEach((b) => m.putByte(b));
  m.putByte(1); // one auto skill
  m.putShort(201);
  m.putShort(-1);
  m.putByte(0); // item sets
  m.putByte(0);
  m.putShort(0);
  m.putByte(1); // one title power
  m.putByte(5);
  m.putShort(10);
  m.putByte(0);
  m.putInt(0);
  m.putByte(0);
}

describe('login replies', () => {
  it('reads the CMN login reply and reports refusals', () => {
    expect(readUserLogin(reply(5002, (m) => (m.putByte(0), m.putLong(7n), m.putInt(9), m.putString('x'), m.putInt(0))))).toEqual({ ukey: 7n, sessionID: 9 });
    expect(() => readUserLogin(reply(5002, (m) => (m.putByte(-1), m.putString('Sai token'))))).toThrow(ServerError);
  });

  it('reads a character of the list', () => {
    const p = readListPlayer(reply(10001, (m) => {
      m.putInt(5);
      m.putString('An');
      [1, 0, 3, 12, 0, 0].forEach((b) => m.putByte(b));
      m.putString('Tân Thủ Thôn');
      [1n, 2n, 3n].forEach((l) => m.putLong(l));
      m.putInt(0);
    }));
    expect(p).toMatchObject({ id: 5, name: 'An', sex: 1, job: 3, level: 12, mapName: 'Tân Thủ Thôn', icon3: 3n });
  });
});

describe('enter game (processDataBlockFlagMsg)', () => {
  it('reads the player, bag, skills and the map block in bit order', () => {
    const m = reply(2, (w) => {
      w.putInt(0); // loginSetting
      w.putByte(11); w.putInt(100); // DELETE_SKILL_MONEY
      w.putByte(11); w.putInt(100); w.putInt(100); // DEL_ARRTIBUTE
      w.putByte(11); w.putInt(100); // ACTIVATE_MONEY
      w.putByte(11); w.putShort(100); // PET_CHANGE_NAME_MONEY
      w.putByte(11); w.putInt(100); // PARTNER_ADD_MONEY
      w.putInt(1);
      w.putByte(20);
      w.putByte(15);
      w.putInt(2 | 4 | 8 | 16 | 32 | 512 | 1048576);
      writePlayer(w);
      w.putByte(-1); // no pet
      w.putByte(0); // no mercenaries
      w.putBoolean(false);
      w.putBytes(new Uint8Array([1, 0, 0]));
      w.putByte(0); // no missions
      w.putShort(1); // one potion (type 27, class 4)
      w.putShort(5); w.putShort(0); w.putByte(0); w.putByte(0); w.putShort(0); w.putShort(31); w.putShort(0);
      w.putByte(27); w.putShort(121); w.putString('Bình Máu'); w.putByte(9); w.putString(''); w.putByte(0); w.putByte(0);
      w.putByte(99); w.putByte(1); w.putShort(0); w.putByte(0); w.putInt(10); w.putByte(1); w.putByte(0);
      w.putByte(49); w.putShort(100); w.putByte(0); w.putShort(0); w.putByte(0);
      w.putShort(1); // one passive skill (type 1: no battle part)
      w.putShort(9); w.putByte(2); w.putString('Đồ Giám'); w.putByte(1); w.putString(''); w.putByte(0);
      for (let i = 0; i < 3; i++) (w.putByte(0), w.putShort(0));
      w.putBoolean(false);
      w.putByte(1); // addLevel
      w.putBytes(new Uint8Array([9, 9, 9]));
      w.putString('Tân Thủ Thôn');
      w.putString('Mẹo');
      w.putByte(0);
      w.putByte(123); // formations: not read
    });
    const d = readEnterGame(m);
    expect([d.mapId, d.gx, d.gy]).toEqual([1, 20, 15]);
    expect(d.player).toMatchObject({ id: 42, name: 'Tester', title: 'Danh hiệu', job: 2, level: 7, hp: 210, money3: 1000, combatPoint: 777, autoSkillID: [201] });
    expect(d.pet).toBeNull();
    expect([...d.missionStatus!]).toEqual([1, 0, 0]);
    expect(d.items.map((i) => [i.slotPos, i.id, i.name, i.quantity, i.stackNum, i.price])).toEqual([[31, 121, 'Bình Máu', 5, 99, 10]]);
    expect(d.skills.map((s) => [s.id, s.name, s.level, s.addLevel])).toEqual([[9, 'Đồ Giám', 2, 1]]);
    expect([...d.mapBytes!]).toEqual([9, 9, 9]);
    expect([d.mapName, d.mapTip, m.remaining]).toEqual(['Tân Thủ Thôn', 'Mẹo', 1]);
  });
});

describe('NPC block (NPC.loadNPC)', () => {
  /** DataOutputStream.writeUTF for ASCII / Vietnamese text. */
  const utf = (s: string) => {
    const b = new TextEncoder().encode(s);
    return [b.length >> 8, b.length & 255, ...b];
  };

  it('reads a shop NPC and a portal, inflating gzip data', async () => {
    const raw = new Uint8Array([
      2,
      3, 2, 0, 2, 0, 113, 0, 0, ...utf('Thợ Rèn'), ...utf(''), ...utf('Chào'), 3, 0, 24, 15, 0, 0, ...utf('Mua bán'), 0, 1,
      0, 30, 0, 3, 0, 108, 0, 0, ...utf('Cổng'), ...utf(''), ...utf(''), 1, 0, 36, 15, 0, 0, ...utf('Đi rừng'), 0, 2, 5, 6,
    ]);
    const gz = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const [shop, gate] = readNpcList(await gunzip(gz));
    expect(shop).toMatchObject({ sign: 3, id: 2, npcType: 2, icon1: 113, name: 'Thợ Rèn', talkDetail: 'Chào', topic: 'Mua bán', shopID: [1], gx: 24, gy: 15 });
    expect(gate.jumpMap[0]).toMatchObject({ text: 'Đi rừng', id: 2, gx: 5, gy: 6 });
  });
});
