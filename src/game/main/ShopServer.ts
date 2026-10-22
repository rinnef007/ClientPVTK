// Offline stand-in for the server side of the NPC item shop. In the game the goods list
// (ShopItem.getShopItemList), buying (doItemShopBuyMsg) and selling (doItemshopSellMsg) are requests;
// the client then applies the answer: the new money totals (Model.setPlayerMoney), the bag change,
// the buy limit and stock. Here the answer is made up locally:
// - the goods are the demo list registered for the shop id (made-up names and prices);
// - buying takes the listed price × count and adds the item to the bag (stacking by stackNum);
// - selling pays the item's own price × count in Bạc — the real sell price is the server's.
import { copyAsItem, type Item } from '../actor/Item';
import { ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, type Player } from '../actor/Player';
import { COLOR_MONEY2, COLOR_MONEY3, ShopItem } from '../core/ShopItem';
import { PowerString } from '../string/PowerString';

const STR_DEDUCT = 'Khấu trừ';
const STR_ADD = 'Tăng';
const STR_BAG_FULL = 'Túi đầy';

const shops = new Map<number, () => ShopItem[]>();

/** Registers a demo shop's goods (made up; the server sends them in the game). */
export function setDemoShop(shopId: number, goods: () => ShopItem[]): void {
  shops.set(shopId, goods);
}

/** getShopItemList: null when the shop has no goods (the shop then does not open). */
export function simShopList(shopId: number): ShopItem[] | null {
  const list = shops.get(shopId)?.();
  return list != null && list.length > 0 ? list : null;
}

/** Model.setPlayerMoney: sets the totals and lists the changes ("Khấu trừ" / "Tăng" per money). */
export function setPlayerMoney(p: Player, money1: number, money2: number, money3: number): string {
  let s = '';
  const line = (d: number, text: string, color: number) => {
    if (d < 0) s += `${STR_DEDUCT}${PowerString.makeColorString(`${text}${-d}`, color)}\n`;
    else if (d > 0) s += `${STR_ADD}${PowerString.makeColorString(`${text}${d}`, color)}\n`;
  };
  line(money1 - p.get(ATTR_MONEY1), 'KNB', 16776960);
  line(money2 - p.get(ATTR_MONEY2), 'Lá', COLOR_MONEY2);
  line(money3 - p.get(ATTR_MONEY3), 'Bạc', COLOR_MONEY3);
  p.set(ATTR_MONEY1, money1);
  p.set(ATTR_MONEY2, money2);
  p.set(ATTR_MONEY3, money3);
  return s;
}

export interface ShopResult {
  ok: boolean;
  /** The error text, or the money changes on success. */
  text: string;
}

/** Buys `n`: checks the limits and the bag, then charges and adds the item. */
export function simBuy(p: Player, item: ShopItem, n: number): ShopResult {
  if (item.allCount >= 0 && item.allCount < n) return { ok: false, text: 'Không đủ hàng trong kho.' };
  if (item.maxBuy >= 0 && item.maxBuy < n) return { ok: false, text: 'Vượt quá giới hạn mua.' };
  const [m1, m2, m3] = [item.money1 * n, item.money2 * n, item.money3 * n];
  if (p.get(ATTR_MONEY1) < m1 || p.get(ATTR_MONEY2) < m2 || p.get(ATTR_MONEY3) < m3) return { ok: false, text: 'Tiền không đủ' };
  const bag = p.bag;
  if (bag == null || !bag.addItem(copyAsItem(item), n)) return { ok: false, text: STR_BAG_FULL };
  if (item.allCount > 0) item.allCount -= n;
  if (item.maxBuy > 0) item.maxBuy -= n;
  return { ok: true, text: setPlayerMoney(p, p.get(ATTR_MONEY1) - m1, p.get(ATTR_MONEY2) - m2, p.get(ATTR_MONEY3) - m3) };
}

/** Sells `n` of a bag item for its price in Bạc. */
export function simSell(p: Player, item: Item, n: number): ShopResult {
  const bag = p.bag;
  if (bag == null || bag.getItem(item.slotPos) !== item || n <= 0 || n > item.quantity) return { ok: false, text: 'Không thể bán.' };
  item.quantity -= n;
  if (item.quantity <= 0) bag.setItem(item.slotPos, null);
  return { ok: true, text: setPlayerMoney(p, p.get(ATTR_MONEY1), p.get(ATTR_MONEY2), p.get(ATTR_MONEY3) + item.getPrice() * n) };
}
