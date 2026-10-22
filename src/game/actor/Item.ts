// The parts of com.hz.item.Item and com.hz.actor.PlayerBag the UI screens read: icon frame in
// image set 1 (bagIcon), grade (back plate), count, stars, suit id and expiry. Real items come
// from the server; the test map builds a few by hand.
import { PowerString } from '../string/PowerString';
export const ITEM_ID_QUICK_FILL_HP = -10000;
export const ITEM_TYPE_PET = 32;
/** Equipment slot of the active pet. */
export const SLOT_PET = 1;

/** Define.getGradeColor: item / pet grade 0..5 → text colour. */
export function getGradeColor(g: number): number {
  return [0xe5e5e5, 4978754, 4369912, 16753920, 12991465, 0xff0000][g] ?? 0xffffff;
}

export class Item {
  id = 0;
  name = '';
  /** Frame in /common/1 (the item icon sheet); -1 = none. */
  bagIcon = -1;
  /** Quality 0..5: picks the slot back plate /common/ic<grade>.png. */
  grade = 0;
  quantity = 0;
  star = 0;
  ascensionStar = 0;
  attachDone = 0;
  itemSetID = 0;
  /** 0 = never; otherwise an absolute time in ms (the fashion slot greys out once expired). */
  expireTime = 0;
  isUpgradeItem = false;
  /** Free text the item info box shows (stats in the real game). */
  description = '';
  /** Item.type: 27/28/31 are usable from the world item list (isCanUse(1)); 32 is a pet. */
  type = 0;
  /** Bag slot the item sits in (set by PlayerBag.setItem); slot 1 holds the active pet. */
  slotPos = -1;
  /** Required level; a pet item's level. */
  reqLv = 0;
  /** Appearance long (a pet item's sprite icon). */
  icon = 0n;
  info = '';

  /** Selling price (shown as an icon and number in the item box). */
  price = 0;
  /** Bound to the character (no "Khóa" option); server data. */
  binded = false;
  /** Most per bag slot (Item.stackNum); 1 = does not stack. */
  stackNum = 1;

  // Battle data (Item.fromBytesAtts1/2, 1.2.0): what Item.get / getPowerValue read.
  durability = 1;
  status = 0;
  autoBinding = 0;
  attachPower = 0;
  attachValue = 0;
  itemSet = 0;
  hitrate = 0;
  def_str = 0;
  def_agi = 0;
  def_mag = 0;
  atkType = 0;
  atk_time = 0;
  atkMin = 0;
  atkMax = 0;
  area = 0;
  round = 0;
  vipLevelReq = 0;
  power1 = 0;
  powerValue1 = 0;
  power2 = 0;
  powerValue2 = 0;
  power3 = 0;
  powerValue3 = 0;
  bindPower1 = 0;
  bindPowerValue1 = 0;
  bindPower2 = 0;
  bindPowerValue2 = 0;
  enchantPower1 = 0;
  enchantPowerValue1 = 0;
  enchantPower2 = 0;
  enchantPowerValue2 = 0;
  /** power4..7 and values of upgrade items, used when Item.isUpgradeItemOpen. */
  upgradePowers: number[] = [];
  upgradeAscensionStar = 0;
  upgradeStar = 0;
  /** Item.isUpgradeItemOpen (server switch; off unless the server says so). */
  static isUpgradeItemOpen = false;

  isEquited(): boolean {
    return this.slotPos >= 0 && this.slotPos < BAG_START;
  }

  isPetType(): boolean {
    return this.type === ITEM_TYPE_PET;
  }

  isPetEquip(): boolean {
    return this.slotPos === SLOT_PET;
  }

  /** Item.getItemClass: 1/2 equipment, 3 pet, 4 consumable, 5 / 6 other. */
  getItemClass(): number {
    const t = this.type;
    if (t === 32) return 3;
    if (t === 30) return 6;
    if (t === 25 || t === 29 || t === 33) return 5;
    if (t >= 13 && t <= 24) return 1;
    if (t >= 34 && t <= 39) return 1;
    return (t >= 26 && t <= 28) || t === 31 ? 4 : 2;
  }

  /** Item.getNameInfo: the icon and the name in its grade colour (+ "(Tiến bậc)"). */
  getNameInfo(withIcon = true): string {
    const name = PowerString.makeColorString(this.name, getGradeColor(this.grade));
    const up = this.isUpgradeItem ? PowerString.makeColorString('(Tiến bậc)', 16776960) : '';
    return (withIcon ? PowerString.makeItemIconString(this.bagIcon, this.grade, 0) : '') + name + up;
  }

  /** Item.getPowerDesc: the attribute text built from server data; the demo text here. */
  getPowerDesc(): string {
    return this.description;
  }

  getInfo(): string {
    return this.info === '0' ? '' : this.info;
  }

  isCanUse(kind: number): boolean {
    if (kind === 1) return this.type === 27 || this.type === 28 || this.type === 31;
    if (kind === 2) return this.type === 27 || this.type === 26;
    return kind === 3;
  }

  /** Item.getOneKeyQuickHP: the "use potions until full" entry at the top of the item list. */
  static getOneKeyQuickHP(): Item {
    const it = new Item();
    it.name = 'Hồi phục hết'; // GameText.STR_ITEM_ONE_KEY_RECOVERY
    it.id = ITEM_ID_QUICK_FILL_HP;
    it.bagIcon = 17;
    it.grade = 1;
    it.info = 'Tự dùng thuốc hồi phục hồi HP.'; // STR_ITEM_ONE_KEY_RECOVERY_INFO
    return it;
  }

  getItemSetID(): number {
    return this.itemSetID;
  }

  isTimeItem(): boolean {
    return (this.status & 1) > 0;
  }
  isTimeItemTimeOut(): boolean {
    return (this.status & 8) > 0;
  }
  isVipItem(): boolean {
    return this.vipLevelReq > 0;
  }
  isVipItemTimeOut(): boolean {
    return (this.status & 64) > 0;
  }
  /** Item.isBinded: auto-binding or status bit 2. */
  isBinded(): boolean {
    return this.autoBinding !== 0 || (this.status & 2) > 0;
  }
  isCanEquip(): boolean {
    const t = this.type;
    return (t >= 0 && t <= 24) || t === 32 || (t >= 34 && t <= 39);
  }
  isRebornItem(): boolean {
    return this.power1 === 80 || this.power1 === 97 || this.power2 === 80 || this.power2 === 97;
  }
  getItemHitRate(): number {
    return this.hitrate & 0xff;
  }

  /** Item.get (1.2.0): the attribute an equipped item gives (0 when broken or expired). */
  getAttr(n: number): number {
    if (n === 9) return this.durability > 0 ? this.type : -400;
    if (this.durability <= 0) return 0;
    if (this.isTimeItem() && this.isTimeItemTimeOut()) return 0;
    if (this.isVipItem() && this.isVipItemTimeOut()) return 0;
    switch (n) {
      case 1: return this.def_str;
      case 2: return this.def_agi;
      case 3: return this.def_mag;
      case 4: return this.getItemHitRate();
      case 5: return this.atkMin;
      case 6: return this.atkMax;
      case 7: return this.type === 24 ? -1 : this.atk_time;
      case 8: return this.type === 24 ? -1 : this.atkType;
      case 10: return this.getItemSetID();
      default: return 0;
    }
  }

  /** Item.getPower1AndPower2: power 1–3 with the ascension bonus. */
  getPower1AndPower2(power: number): number {
    let v = 0;
    const b = this.isBinded();
    if (this.power1 === power) v += getpowerValueAdd(this.powerValue1, this.ascensionStar, this.star, b, isAscension(this.power1));
    if (this.power2 === power) v += getpowerValueAdd(this.powerValue2, this.ascensionStar, this.star, b, isAscension(this.power2));
    if (this.power3 === power) v += getpowerValueAdd(this.powerValue3, this.ascensionStar, this.star, b, isAscension(this.power3));
    return v;
  }

  /** Item.getPowerValue: every source of `power` on the item (bound, gem, enchant, upgrade). */
  getPowerValue(power: number): number {
    if (this.durability <= 0) return 0;
    if (this.isTimeItem() && this.isTimeItemTimeOut()) return 0;
    if (this.isVipItem() && this.isVipItemTimeOut()) return 0;
    let v = this.getPower1AndPower2(power);
    const b = this.isBinded();
    if (b) {
      if (this.bindPower1 === power) v += getpowerValueAdd(this.bindPowerValue1, this.ascensionStar, this.star, b, isAscension(this.bindPower1));
      if (this.bindPower2 === power) v += getpowerValueAdd(this.bindPowerValue2, this.ascensionStar, this.star, b, isAscension(this.bindPower2));
    }
    if (this.attachPower === power) v += this.attachValue;
    if (this.enchantPower1 === power) v += this.enchantPowerValue1;
    if (this.enchantPower2 === power) v += this.enchantPowerValue2;
    if (b && Item.isUpgradeItemOpen) {
      for (let i = 0; i + 1 < this.upgradePowers.length; i += 2) {
        if (this.upgradePowers[i] === power) {
          v += getpowerValueAdd(this.upgradePowers[i + 1], this.upgradeAscensionStar, this.upgradeStar, b, isAscension(power));
        }
      }
    }
    return v;
  }

  /** Item.getPrice: the selling price (ShopItem overrides it with the buying price). */
  getPrice(): number {
    return this.price;
  }

  /** Item.getMoneyIconIndex: frame of the money icon set; items sell for "Bạc" (2). */
  getMoneyIconIndex(): number {
    return 2;
  }

  /** Item.getDesc: the shop / info box text (the attribute text, demo text here). */
  getDesc(): string {
    const info = this.getInfo();
    return this.getPowerDesc() + (info ? `\n${info}` : '');
  }
}

/** Item.isAscension: powers the ascension stars do not raise return false. */
export function isAscension(p: number): boolean {
  if (p === 121 || p === 131 || p === 176 || p === 177) return false;
  if ((p >= 80 && p <= 82) || (p >= 84 && p <= 97) || (p >= 99 && p <= 119)) return false;
  if ((p >= 145 && p <= 166) || (p >= 179 && p <= 186)) return false;
  return true;
}

/** Item.getpowerValueAdd: a bound item's power grows by |value| × ascension × star / 100 (rounded). */
export function getpowerValueAdd(value: number, ascension: number, star: number, binded: boolean, ascend: boolean): number {
  if (!binded || !ascend || ascension <= 0 || star <= 0) return value;
  const v = Math.trunc((Math.abs(value) * ascension * star + 50) / 100) + value;
  return Math.min(v, 32767);
}

/** One of an item kind, as a plain Item (ShopItem.m325clone keeps only the Item part). */
export function copyAsItem(src: Item): Item {
  const it = Object.assign(new Item(), src);
  it.slotPos = -1;
  return it;
}

/** Equipment slots 0..17, then 30-slot bag pages from slot 30. */
export const BAG_START = 30;
export const BAG_PAGE_SIZE = 30;
/** End of the bag: the equipment screen shows two pages ("Túi1", "Túi2"); the server sends the size. */
export const BAG_END = BAG_START + 2 * BAG_PAGE_SIZE;

export class PlayerBag {
  private readonly items = new Map<number, Item>();

  getItem(slot: number): Item | null {
    return this.items.get(slot) ?? null;
  }

  setItem(slot: number, item: Item | null): void {
    if (item == null) {
      this.items.delete(slot);
      return;
    }
    item.slotPos = slot;
    this.items.set(slot, item);
  }

  /** All items, equipment slots first (PlayerBag.store up to bagEnd). */
  allItems(): Item[] {
    return [...this.items.entries()].sort((a, b) => a[0] - b[0]).map(([, it]) => it);
  }

  /** Player.getItemNumByIdInBag: the stack total of item `id` in the bag. */
  getItemNumByIdInBag(id: number): number {
    return this.bagItems().reduce((n, [, it]) => (it.id === id ? n + it.quantity : n), 0);
  }

  /** PlayerBag.getEquipPosByType: the equipment slots an item type goes into. */
  static getEquipPosByType(type: number): number[] | null {
    if (type === 32) return [1];
    const table: Record<number, number[]> = { 0: [7], 1: [5], 2: [12], 3: [13], 4: [11], 5: [4], 6: [9], 7: [6], 8: [0], 9: [2, 16], 10: [14], 11: [15], 12: [3] };
    if (table[type]) return table[type];
    if ((type >= 13 && type <= 24) || (type >= 34 && type <= 39)) return [8, 10];
    return null;
  }

  /** PlayerBag.getCompareEquip: the equipped item an item of this type would replace. */
  static getCompareEquip(bag: PlayerBag | null, type: number): Item | null {
    const pos = PlayerBag.getEquipPosByType(type);
    if (bag == null || pos == null) return null;
    for (const p of pos) {
      const it = p >= 0 && p < BAG_START ? bag.getItem(p) : null;
      if (it != null && (type !== 24 || it.type === type)) return it;
    }
    return null;
  }

  /** How many equipped items (slots 0..17) belong to a suit. */
  getEquipItemSetNum(setId: number): number {
    if (setId <= 0) return 0;
    let n = 0;
    for (let i = 0; i <= 17; i++) if (this.items.get(i)?.itemSetID === setId) n++;
    return n;
  }

  /** Bag items in slot order (for sorting or listing). */
  bagItems(): [number, Item][] {
    return [...this.items.entries()].filter(([s]) => s >= BAG_START).sort((a, b) => a[0] - b[0]);
  }

  /**
   * PlayerBag.getCanUseItemList(kind): bag items usable from the world. The VIP, pet-item,
   * colour-box and special-power exclusions need server item data and are not checked.
   */
  getCanUseItemList(kind: number): Item[] {
    return this.bagItems().map(([, it]) => it).filter((it) => it.isCanUse(kind));
  }

  /**
   * PlayerBag.addItem: `n` of `item`, topping up stacks of the same id first, then free slots.
   * Returns false (adding nothing) when the bag cannot hold them all.
   */
  addItem(item: Item, n: number): boolean {
    const stack = Math.max(1, item.stackNum);
    const same = this.bagItems().filter(([, it]) => it.id === item.id && stack > 1);
    let room = same.reduce((r, [, it]) => r + Math.max(0, stack - it.quantity), 0);
    const free: number[] = [];
    for (let s = BAG_START; s < BAG_END && room < n; s++) {
      if (this.items.has(s)) continue;
      free.push(s);
      room += stack;
    }
    if (room < n) return false;
    for (const [, it] of same) {
      const add = Math.min(n, stack - it.quantity);
      if (add <= 0) continue;
      it.quantity += add;
      n -= add;
    }
    for (const s of free) {
      if (n <= 0) break;
      const it = copyAsItem(item);
      it.quantity = Math.min(n, stack);
      n -= it.quantity;
      this.setItem(s, it);
    }
    return true;
  }

  /** Takes `n` of item `id` out of the bag, emptying stacks in slot order. */
  removeItemsById(id: number, n: number): void {
    for (const [slot, it] of this.bagItems()) {
      if (n <= 0) return;
      if (it.id !== id) continue;
      const take = Math.min(n, it.quantity);
      it.quantity -= take;
      n -= take;
      if (it.quantity <= 0) this.items.delete(slot);
    }
  }

  /** PlayerBag.getBagItemBySlotPos: an item of the bag part (not equipment). */
  getBagItemBySlotPos(slot: number): Item | null {
    return slot >= BAG_START && slot < BAG_END ? this.getItem(slot) : null;
  }

  /** PlayerBag.removeBagItemByPos: takes `n` from the stack in `slot` (emptying it at 0). */
  removeBagItemByPos(slot: number, n: number): void {
    const it = this.getItem(slot);
    if (it == null) return;
    it.quantity -= n;
    if (it.quantity <= 0) this.items.delete(slot);
  }

  clearBag(): void {
    for (const s of [...this.items.keys()]) if (s >= BAG_START) this.items.delete(s);
  }
}
