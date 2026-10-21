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
}

/** Equipment slots 0..17, then 30-slot bag pages from slot 30. */
export const BAG_START = 30;
export const BAG_PAGE_SIZE = 30;

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

  clearBag(): void {
    for (const s of [...this.items.keys()]) if (s >= BAG_START) this.items.delete(s);
  }
}
