import { describe, expect, it } from 'vitest';
import { Message } from '../src/net/Message';
import { createJumpCityMsg } from '../src/net/online/MapMessages';
import {
  createWorldMapEnterMsg, createWorldMapListMsg, readWorldMap, readWorldMapEnter, readWorldMapList,
} from '../src/net/online/WorldMapMessages';

const again = (m: Message) => new Message(m.type, m.payload());

describe('world map 10521 / 10522 / 10523 and city 10510', () => {
  it('reads the regions (u8 id, x, y, name, status)', () => {
    const w = new Message(10521, 64);
    w.putByte(1);
    w.putByte(200);
    w.putShort(160);
    w.putShort(120);
    w.putString('Thành Thái Dương');
    w.putByte(1);
    expect(readWorldMap(again(w))).toEqual([{ id: 200, x: 160, y: 120, name: 'Thành Thái Dương', status: 1 }]);
  });

  it('asks for a region and reads its maps', () => {
    const q = again(createWorldMapListMsg(7));
    expect(q.getInt()).toBe(7);
    const w = new Message(10522, 64);
    w.putByte(1);
    w.putShort(2);
    w.putString('Rừng Tre');
    w.putString('Rừng phía đông');
    w.putByte(0);
    w.putByte(1);
    expect(readWorldMapList(again(w))).toEqual([{ id: 2, name: 'Rừng Tre', desc: 'Rừng phía đông', status: 0, needStone: 1 }]);
  });

  it('enters with map id and block 64; a used stone comes before the blocks', () => {
    const q = again(createWorldMapEnterMsg(2));
    expect([q.getInt(), q.getInt()]).toEqual([2, 64]);
    const w = new Message(10523, 64);
    w.putByte(1);
    w.putShort(31);
    w.putInt(40001);
    w.putInt(2);
    w.putByte(5);
    w.putByte(15);
    w.putInt(0);
    const r = readWorldMapEnter(again(w));
    expect(r.usedItem).toEqual({ slot: 31, id: 40001 });
    expect([r.blocks.mapId, r.blocks.gx, r.blocks.gy]).toEqual([2, 5, 15]);
  });

  it('writes the city master id and the blocks wanted', () => {
    const q = again(createJumpCityMsg(1234));
    expect([q.type, q.getInt(), q.getInt()]).toEqual([10510, 1234, 64]);
  });
});
