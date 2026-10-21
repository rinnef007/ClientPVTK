// Made-up player data for the offline test map. In the real game all of this comes from the
// server at login; nothing here is taken from server data. Icon frames are picked from the item
// sheet /common/1 without knowing which frame is which item type.
import { BAG_START, ITEM_TYPE_PET, Item, PlayerBag, SLOT_PET } from '../actor/Item';
import { ATTR_PET_GRADE, ATTR_PET_GROW_LEVEL, MyPet } from '../actor/MyPet';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_LEVEL, ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, ATTR_MP, ATTR_MP_MAX, type Player } from '../actor/Player';

function item(name: string, bagIcon: number, grade: number, quantity = 1, description = '', type = 0): Item {
  const it = new Item();
  it.type = type;
  it.name = name;
  it.bagIcon = bagIcon;
  it.grade = grade;
  it.quantity = quantity;
  it.description = description || `${name}\n(Dữ liệu giả – vật phẩm thật do server gửi.)`;
  return it;
}

/** Equipment slot → item, and bag items from slot 30. */
export function makeDemoBag(): PlayerBag {
  const bag = new PlayerBag();
  const equip: [number, Item][] = [
    [0, item('Mũ demo', 10, 1)],
    [3, item('Áo demo', 12, 2)],
    [2, item('Vũ khí demo', 3, 3)],
    [4, item('Giày demo', 16, 1)],
    [6, item('Nhẫn demo', 20, 4)],
  ];
  for (const [slot, it] of equip) bag.setItem(slot, it);
  const bagItems = [
    item('Bình máu demo', 30, 0, 25, 'Hồi 500 HP (dữ liệu giả).', 27),
    item('Bình mana demo', 31, 0, 12, 'Hồi 300 MP (dữ liệu giả).', 27),
    item('Đá cường hóa demo', 40, 2, 5),
    item('Bảo thạch demo', 45, 3, 2),
    item('Cuộn dịch chuyển demo', 50, 1, 3, 'Về thành (dữ liệu giả).', 31),
    item('Trang bị demo', 14, 5),
  ];
  bagItems.forEach((it, i) => bag.setItem(BAG_START + i, it));
  // Pet items (type 32): the active pet sits in equipment slot 1, two more wait in the bag.
  bag.setItem(SLOT_PET, petItem('Pet demo', 18, 2n, 3));
  bag.setItem(BAG_START + 6, petItem('Pet túi demo A', 12, 6n, 1));
  bag.setItem(BAG_START + 7, petItem('Pet túi demo B', 9, 10n, 0));
  return bag;
}

/** A pet item; `icon` picks the sprite (kind + 499, so 2 → 501). */
function petItem(name: string, level: number, icon: bigint, grade: number): Item {
  const it = item(name, 60, grade, 1, `${name} (dữ liệu giả).`, ITEM_TYPE_PET);
  it.reqLv = level;
  it.icon = icon;
  return it;
}

/** Sprites the demo pets use (for preloading). */
export const DEMO_PET_SPRITES = [501, 505, 509];

export const DEMO_PLAYER_VALUES: [number, number][] = [
  [ATTR_LEVEL, 25],
  [ATTR_HP, 820],
  [ATTR_HP_MAX, 1000],
  [ATTR_MP, 310],
  [ATTR_MP_MAX, 500],
  [ATTR_EXP, 4200],
  [ATTR_EXP_MAX, 10000],
  [ATTR_MONEY1, 123456],
  [ATTR_MONEY2, 789],
  [ATTR_MONEY3, 50],
];

export function fillDemoPlayer(p: Player): void {
  p.bag = makeDemoBag();
  for (const [k, v] of DEMO_PLAYER_VALUES) p.set(k, v);
  // Base attributes, totals with equipment bonus, and points left to assign.
  [p.str, p.con, p.agi, p.ilt, p.wis] = [40, 32, 25, 18, 20];
  [[6, 52], [7, 40], [8, 25], [9, 18], [10, 26], [4, 5]].forEach(([k, v]) => p.set(k, v));
  p.job = 3;
  p.race = 0;
  p.countryName = 'Quốc gia demo';
  p.countryRank = 'Dân thường';
  // The active pet: the item in slot 1 as a MyPet, with made-up stats.
  const petItemInSlot = p.bag.getItem(SLOT_PET);
  if (petItemInSlot != null) {
    const pet = MyPet.createItemPet(petItemInSlot, p);
    pet.petItem = petItemInSlot;
    [[ATTR_HP, 450], [ATTR_HP_MAX, 600], [ATTR_MP, 120], [ATTR_MP_MAX, 300], [ATTR_EXP, 700], [ATTR_EXP_MAX, 2000], [ATTR_PET_GROW_LEVEL, 7], [ATTR_PET_GRADE, petItemInSlot.grade]]
      .forEach(([k, v]) => pet.set(k, v));
    [pet.str, pet.con, pet.agi, pet.ilt, pet.wis] = [22, 18, 15, 12, 10];
    [[6, 25], [7, 18], [8, 17], [9, 12], [10, 10]].forEach(([k, v]) => pet.set(k, v));
    Object.assign(pet, { cp: 6, grow: 72, compre: 55, growLevel: 7, petAge: 1200, petmaxage: 2000, petHeadIcon: 501 });
    p.pet = pet;
  }
}
