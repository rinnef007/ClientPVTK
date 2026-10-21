import { describe, expect, it } from 'vitest';
import { BAG_START, Item, PlayerBag } from '../src/game/actor/Item';

const item = (type: number) => Object.assign(new Item(), { type });

describe('Item classes and slots', () => {
  it('classifies like Item.getItemClass', () => {
    expect(item(32).getItemClass()).toBe(3);
    expect(item(27).getItemClass()).toBe(4);
    expect(item(31).getItemClass()).toBe(4);
    expect(item(15).getItemClass()).toBe(1);
    expect(item(9).getItemClass()).toBe(2);
    expect(item(30).getItemClass()).toBe(6);
  });

  it('finds the equipped item an item would replace', () => {
    const bag = new PlayerBag();
    const weapon = item(9);
    bag.setItem(2, weapon);
    expect(PlayerBag.getCompareEquip(bag, 9)).toBe(weapon);
    expect(PlayerBag.getCompareEquip(bag, 8)).toBeNull();
    bag.setItem(BAG_START, item(9));
    expect(bag.getItem(BAG_START)!.isEquited()).toBe(false);
    expect(weapon.isEquited()).toBe(true);
  });
});
