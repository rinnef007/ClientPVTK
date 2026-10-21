// Made-up player data for the offline test map. In the real game all of this comes from the
// server at login; nothing here is taken from server data. Icon frames are picked from the item
// sheet /common/1 without knowing which frame is which item type.
import { BAG_START, Item, PlayerBag } from '../actor/Item';
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
    [1, item('Áo demo', 12, 2)],
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
  return bag;
}

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
}
