// NPC item shop requests and replies of client 1.2.0 (MsgHandler.createItemShopListMsg /
// createItemShopBuy / createItemShopSell, processItemShopSell; ShopItem.getShopItemList /
// fromBytesShopItem / doItemShopBuyMsg; jadx decompile). Country shops (ids 22000–23999, which
// send their prices back) and exchange shops (30000–30199, item costs) are not ported.
import { ShopItem } from '../../game/core/ShopItem';
import { Message } from '../Message';
import { readItemAtts2 } from './EnterGame';
import { ServerError } from './LoginMessages';

export const MSG_SHOP_LIST = 12004;
export const MSG_SHOP_BUY = 12005;
export const MSG_SHOP_SELL = 12006;

/** Define.isCountryShop / isExchangeShop. */
const isCountryShop = (id: number) => id >= 22000 && id <= 23999;
const isExchangeShop = (id: number) => id >= 30000 && id < 30200;

export function createItemShopListMsg(shopId: number): Message {
  const m = new Message(MSG_SHOP_LIST);
  m.putShort(shopId);
  return m;
}

/** ShopItem.fromBytesShopItem: the item data, discount prices, prices, limits, the hot / new mark. */
export function readShopItem(m: Message, shopId: number): ShopItem {
  if (isExchangeShop(shopId)) throw new ServerError('Cửa hàng đổi vật phẩm chưa được hỗ trợ.');
  const it = new ShopItem();
  readItemAtts2(m, it);
  m.getInt(); // dismoney1
  m.getInt(); // dismoney2
  m.getInt(); // dismoney3
  m.getByte(); // discount
  it.money1 = m.getInt();
  it.money2 = m.getInt();
  it.money3 = m.getInt();
  m.getShort(); // status
  it.maxBuy = m.getShort();
  it.allCount = m.getShort();
  it.hotTypeOrNewItem = m.getByte();
  it.quantity = 1;
  return it;
}

/** processItemShopListMsg + getShopItemList: a status byte, an unsigned count, the goods. */
export function readShopList(m: Message, shopId: number): ShopItem[] {
  if (m.getByte() !== 0) throw new ServerError(m.getString());
  const out: ShopItem[] = [];
  for (let n = m.getByte() & 0xff; n > 0; n--) out.push(readShopItem(m, shopId));
  return out;
}

export function createItemShopBuy(shopId: number, item: ShopItem, count: number): Message {
  const country = isCountryShop(shopId);
  const m = new Message(MSG_SHOP_BUY);
  m.putShort(shopId);
  m.putInt(item.id);
  m.putByte(count);
  m.putBoolean(country);
  if (country) {
    m.putInt(item.money1);
    m.putInt(item.money2);
    m.putInt(item.money3);
  }
  return m;
}

export type BuyReply =
  | { kind: 'bought'; id: number; count: number; money: [number, number, number]; maxBuy: number; allCount: number }
  | { kind: 'priceChanged' }
  | { kind: 'appearance' };

/** doItemShopBuyMsg's reading of the reply: <0 error, 1 prices changed, 2 hair / face, 0 bought. */
export function readBuyReply(m: Message): BuyReply {
  const b = m.getByte();
  if (b < 0) throw new ServerError(m.getString());
  if (b === 1) return { kind: 'priceChanged' };
  if (b === 2) return { kind: 'appearance' };
  const id = m.getInt();
  m.getShort();
  const count = m.getByte();
  const money: [number, number, number] = [m.getInt(), m.getInt(), m.getInt()];
  return { kind: 'bought', id, count, money, maxBuy: m.getShort(), allCount: m.getShort() };
}

export function createItemShopSell(shopId: number, itemId: number, slot: number, count: number): Message {
  const m = new Message(MSG_SHOP_SELL);
  m.putShort(shopId);
  m.putInt(itemId);
  m.putShort(slot);
  m.putByte(count);
  return m;
}

/** processItemShopSell: the player's new Bạc total. */
export function readSellReply(m: Message): number {
  if (m.getByte() < 0) throw new ServerError(m.getString());
  return m.getInt();
}
