// The attribute formulas of com.hz.actor.Player.get (1.2.0, Vineflower decompile): totals built from
// the base stats, the equipment (PlayerBag / Item.getPowerValue), passive skills, buffers, titles,
// the formation and item sets. Used for the battle and for players whose values come from the
// server (Player.formulas). PlayerTurnMonster (transformation cards) is not ported.
import type { Item, PlayerBag } from './Item';

/** Tool.sumValue: a + b clamped to [min, max]. */
export function sumValue(a: number, b: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, a + b));
}

/** Player.getItemSetID / getItemSetNum: an item-set entry packs set id and pieces needed. */
export const getItemSetID = (v: number) => (v >> 4) & 4095;
export const getItemSetNum = (v: number) => v & 15;

/** Java int arithmetic for the formulas (division truncates). */
const idiv = (a: number, b: number) => Math.trunc(a / b);

/** PlayerBag.get(n, slot): the item's Item.get(n), or -1 without an item. */
export function bagAttrAt(bag: PlayerBag | null, n: number, slot: number): number {
  const it: Item | null = bag?.getItem(slot) ?? null;
  return it == null ? -1 : it.getAttr(n);
}

/** PlayerBag.get(n): 1–3 summed over the equipment, 4–7 over both hands, 8 the weapon's attack type. */
export function bagAttr(bag: PlayerBag | null, n: number): number {
  if (bag == null) return 0;
  if (n >= 1 && n <= 3) {
    let v = 0;
    for (let s = 0; s < 30; s++) v += bag.getItem(s)?.getAttr(n) ?? 0;
    return v;
  }
  if (n >= 4 && n <= 7) return (bag.getItem(8)?.getAttr(n) ?? 0) + (bag.getItem(10)?.getAttr(n) ?? 0);
  if (n === 8) {
    // PlayerBag.getItemAtkType
    const a = bagAttrAt(bag, 8, 8);
    if (a !== -1) return a;
    const b = bagAttrAt(bag, 8, 10);
    return b !== -1 ? b : 0;
  }
  return 0;
}

/** PlayerBag.getEquipPowerValue: `power` summed over the 30 equipment slots. */
export function bagEquipPowerValue(bag: PlayerBag | null, power: number): number {
  if (bag == null || power <= 0) return 0;
  let v = 0;
  for (let s = 0; s < 30; s++) v += bag.getItem(s)?.getPowerValue(power) ?? 0;
  return v;
}

export { idiv };
