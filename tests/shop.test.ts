import { describe, expect, it } from 'vitest';
import { BAG_END, BAG_START, Item, PlayerBag } from '../src/game/actor/Item';
import { ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, Player } from '../src/game/actor/Player';
import { ShopItem } from '../src/game/core/ShopItem';
import { simBuy, simSell } from '../src/game/main/ShopServer';

function goods(fields: Partial<ShopItem>): ShopItem {
  return Object.assign(new ShopItem(), { id: 1, name: 'Bình', quantity: 1 }, fields);
}

function player(m1 = 0, m2 = 0, m3 = 0): Player {
  const p = new Player();
  p.bag = new PlayerBag();
  p.set(ATTR_MONEY1, m1);
  p.set(ATTR_MONEY2, m2);
  p.set(ATTR_MONEY3, m3);
  return p;
}

describe('ShopItem', () => {
  it('prices in KNB, then Lá, then Bạc', () => {
    expect([goods({ money1: 5, money3: 9 }).getPrice(), goods({ money1: 5 }).getMoneyIconIndex()]).toEqual([5, 0]);
    expect([goods({ money2: 7 }).getPrice(), goods({ money2: 7 }).getMoneyIconIndex()]).toEqual([7, 1]);
    expect([goods({ money3: 3 }).getPrice(), goods({ money3: 3 }).getMoneyIconIndex()]).toEqual([3, 2]);
  });

  it('shows the price, limit and stock before the description', () => {
    const d = goods({ money3: 10, maxBuy: 0, allCount: 4, description: 'Mô tả' }).getDesc();
    expect(d).toContain('Ô: ');
    expect(d).toContain('Bạc10');
    expect(d).toContain('Giới hạn mua:');
    expect(d).toContain('Trong kho:');
    expect(d.endsWith('Mô tả')).toBe(true);
  });
});

describe('PlayerBag.addItem', () => {
  it('tops up stacks of the same id, then fills free slots', () => {
    const bag = new PlayerBag();
    bag.setItem(BAG_START, Object.assign(new Item(), { id: 1, quantity: 95, stackNum: 99 }));
    expect(bag.addItem(Object.assign(new Item(), { id: 1, stackNum: 99 }), 10)).toBe(true);
    expect(bag.getItem(BAG_START)?.quantity).toBe(99);
    expect(bag.getItem(BAG_START + 1)?.quantity).toBe(6);
    expect(bag.getItemNumByIdInBag(1)).toBe(105);
  });

  it('adds nothing when the bag cannot hold them all', () => {
    const bag = new PlayerBag();
    for (let s = BAG_START; s < BAG_END - 1; s++) bag.setItem(s, Object.assign(new Item(), { id: 2 }));
    expect(bag.addItem(Object.assign(new Item(), { id: 3 }), 2)).toBe(false);
    expect(bag.getItemNumByIdInBag(3)).toBe(0);
    expect(bag.addItem(Object.assign(new Item(), { id: 3 }), 1)).toBe(true);
  });
});

describe('ShopServer (local simulation)', () => {
  it('buys: charges, adds to the bag, counts down limit and stock', () => {
    const p = player(0, 0, 100);
    const it = goods({ money3: 10, stackNum: 99, maxBuy: 5, allCount: 8 });
    const r = simBuy(p, it, 3);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Khấu trừ');
    expect(p.get(ATTR_MONEY3)).toBe(70);
    expect(p.bag?.getItemNumByIdInBag(1)).toBe(3);
    expect([it.maxBuy, it.allCount]).toEqual([2, 5]);
    expect(simBuy(p, it, 3).ok).toBe(false); // over the limit
    expect(simBuy(player(0, 0, 5), goods({ money3: 10 }), 1).ok).toBe(false); // not enough Bạc
  });

  it('sells for the item price in Bạc', () => {
    const p = player(0, 0, 0);
    const it = Object.assign(new Item(), { id: 4, quantity: 5, price: 3 });
    p.bag?.setItem(BAG_START, it);
    expect(simSell(p, it, 2).ok).toBe(true);
    expect([it.quantity, p.get(ATTR_MONEY3), p.get(ATTR_MONEY2)]).toEqual([3, 6, 0]);
    expect(simSell(p, it, 3).ok).toBe(true);
    expect(p.bag?.getItem(BAG_START)).toBeNull();
    expect(simSell(p, it, 1).ok).toBe(false);
  });
});
