// The parts of com.hz.item.Item and com.hz.actor.PlayerBag the UI screens read: icon frame in
// image set 1 (bagIcon), grade (back plate), count, stars, suit id and expiry. Real items come
// from the server; the test map builds a few by hand.
export class Item {
  id = 0;
  name = '';
  /** Frame in /common/1 (the item icon sheet); -1 = none. */
  bagIcon = -1;
  /** Quality 0..5: picks the slot back plate /common/ic<grade>.png. */
  grade = 0;
  quantity = 1;
  star = 0;
  ascensionStar = 0;
  attachDone = 0;
  itemSetID = 0;
  /** 0 = never; otherwise an absolute time in ms (the fashion slot greys out once expired). */
  expireTime = 0;
  isUpgradeItem = false;
  /** Free text the item info box shows (stats in the real game). */
  description = '';

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
    if (item == null) this.items.delete(slot);
    else this.items.set(slot, item);
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

  clearBag(): void {
    for (const s of [...this.items.keys()]) if (s >= BAG_START) this.items.delete(s);
  }
}
