import { describe, expect, it } from 'vitest';
import { Item, PlayerBag } from '../src/game/actor/Item';
import { Player } from '../src/game/actor/Player';
import { Message } from '../src/net/Message';
import { createPlayerBagMessage, readAttributeUpdate } from '../src/net/online/BagMessages';

function item(slot: number, type: number, id = 1): Item {
  const it = new Item();
  Object.assign(it, { id, type, quantity: 1 });
  it.slotPos = slot;
  return it;
}

describe('PlayerBag.equipItem / unequipItem', () => {
  it('equips armour into its slot and swaps the old piece back into the bag', () => {
    const bag = new PlayerBag();
    bag.setItem(7, item(7, 0, 10)); // helmet (type 0 → slot 7)
    bag.setItem(30, item(30, 0, 11));
    expect(bag.equipItem(30)).toBe(1);
    expect(bag.getItem(7)!.id).toBe(11);
    expect(bag.getItem(30)!.id).toBe(10);
  });

  it('a two-hand weapon takes slot 8 and sends both held weapons to the bag', () => {
    const bag = new PlayerBag();
    bag.setItem(8, item(8, 13, 1)); // one-hand sword
    bag.setItem(10, item(10, 13, 2));
    bag.setItem(30, item(30, 14, 3)); // two-hand sword
    expect(bag.equipItem(30)).toBe(1);
    expect(bag.getItem(8)!.id).toBe(3);
    expect(bag.getItem(10)).toBeNull();
    expect(bag.bagItems().map(([, it]) => it.id).sort()).toEqual([1, 2]);
  });

  it('unequips into the first free bag slot', () => {
    const bag = new PlayerBag();
    const helm = item(7, 0, 10);
    bag.setItem(7, helm);
    bag.setItem(30, item(30, 27, 5));
    expect(bag.unequipItem(helm)).toBe(31);
    expect(bag.getItem(31)).toBe(helm);
    expect(bag.getItem(7)).toBeNull();
  });
});

describe('12001 / 11004', () => {
  it('writes mode, op, slot, the wanted slot for equip, then the flag', () => {
    const m = createPlayerBagMessage(0, 1, item(31, 0), 7);
    const r = new Message(12001, m.payload());
    expect([r.getByte(), r.getByte(), r.getShort(), r.getByte(), r.getBoolean()]).toEqual([0, 1, 31, 7, false]);
  });

  it('applies n + 1 value pairs (the backend heal after a battle)', () => {
    const p = new Player();
    p.formulas = true;
    [p.str, p.con, p.agi, p.ilt, p.wis] = [5, 5, 5, 5, 5];
    p.set(106, 1);
    p.set(2, 10);
    p.set(3, 5);
    const w = new Message(11004, 64);
    w.putByte(2);
    w.putShort(2); w.putInt(999999);
    w.putShort(12); w.putInt(7);
    w.putShort(3); w.putInt(999999);
    readAttributeUpdate(new Message(11004, w.payload()), p);
    expect(p.get(2)).toBe(p.get(29));
    expect(p.get(3)).toBe(p.get(30));
    expect(p.get(12)).toBe(7);
  });
});
