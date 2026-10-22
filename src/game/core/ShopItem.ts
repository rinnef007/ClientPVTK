// The NPC item shop's goods: the parts of com.hz.core.ShopItem (jadx decompile) the shop screen
// reads. In the game the list comes from the server (getShopItemList → fromBytesShopItem); offline
// main/ShopServer.ts fills it with demo goods. Not ported: discounts, exchange items ("needs"), arena /
// integral prices, VIP shops, player stalls and the goods market.
import { Item } from '../actor/Item';
import { PowerString } from '../string/PowerString';
import { isNullText } from '../common/Tool';

/** Utilities.COLOR_MONEY2 / COLOR_MONEY3. */
export const COLOR_MONEY2 = 10144511;
export const COLOR_MONEY3 = 12867346;
const STR_MONEY1 = 'KNB';
const STR_MONEY2 = 'Lá';
const STR_MONEY3 = 'Bạc';
const STR_SHOP_ITEM_PRICE = 'Ô: %U';
const STR_ITEM_MAXBUY_INFO = 'Giới hạn mua:  %U';
const STR_ITEM_ALLCOUNT_INFO = 'Trong kho: %U cái';

export class ShopItem extends Item {
  money1 = 0;
  money2 = 0;
  money3 = 0;
  /** Buys left for this player (-1 no limit) and stock left (-1 unlimited). */
  maxBuy = -1;
  allCount = -1;
  /** 1 "hot", 2 "new" marker. */
  hotTypeOrNewItem = 0;

  /** The first non-zero price: KNB, then Lá, then Bạc. */
  override getPrice(): number {
    return this.money1 > 0 ? this.money1 : this.money2 > 0 ? this.money2 : this.money3 > 0 ? this.money3 : 0;
  }

  override getMoneyIconIndex(): number {
    return this.money1 > 0 ? 0 : this.money2 > 0 ? 1 : 2;
  }

  /** Price line, buy limit, stock, then the item's own description. */
  override getDesc(): string {
    let s = '';
    if (this.money1 > 0) s += PowerString.makeColorString(` ${STR_MONEY1}${this.money1}`, 16776960);
    if (this.money2 > 0) s += PowerString.makeColorString(` ${STR_MONEY2}${this.money2}`, COLOR_MONEY2);
    if (this.money3 > 0) s += PowerString.makeColorString(` ${STR_MONEY3}${this.money3}`, COLOR_MONEY3);
    if (!isNullText(s)) s = STR_SHOP_ITEM_PRICE.replace('%U', `${s}\n`);
    if (this.maxBuy >= 0) {
      s += `${STR_ITEM_MAXBUY_INFO.replace('%U', PowerString.makeColorString(`${this.maxBuy}`, this.maxBuy === 0 ? 16711680 : 65280))}  `;
    }
    if (this.allCount >= 0) {
      s += `${STR_ITEM_ALLCOUNT_INFO.replace('%U', PowerString.makeColorString(`${this.allCount}`, this.allCount !== 0 ? 65280 : 16711680))}\n`;
    }
    return s + super.getDesc();
  }

  /** Sold out or over the limit: the grid greys the icon. */
  isSoldOut(): boolean {
    return this.allCount === 0 || this.maxBuy === 0;
  }
}
