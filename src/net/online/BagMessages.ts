// Bag messages of client 1.2.0 (jadx decompile): 12001 operates on a bag item
// (MsgHandler.createPlayerBagMessage: equip, unequip, use, with a "mode" telling which reply the
// client waits for), 12003 replaces the whole bag (processBagRefreshMsg) and 11004 changes player
// values (processAttributeUpdateMsg).
import type { Item } from '../../game/actor/Item';
import type { Player } from '../../game/actor/Player';
import { Message } from '../Message';
import { BLOCK_ITEMS, readDataBlocks } from './EnterGame';

export const MSG_BAG_OPERATE = 12001;
export const MSG_BAG_REFRESH = 12003;
export const MSG_ATTRIBUTE_UPDATE = 11004;

/** createPlayerBagMessage's operation byte. */
export const BAG_OP_EQUIP = 1;
export const BAG_OP_UNEQUIP = 2;
export const BAG_OP_USE = 3;

/** Modes (and reply kinds) the web client handles. 0 has no reply. */
export const BAG_MODE_NONE = 0;
export const BAG_MODE_PET_EGG = 1;
export const BAG_MODE_PET_EQUIP = 2;
export const BAG_MODE_PET_UNEQUIP = 3;
export const BAG_MODE_CHEST = 4;
export const BAG_MODE_SKILL_EQUIP = 9;
export const BAG_MODE_TITLE_CARD = 16;
export const BAG_MODE_SKILL_UNEQUIP = 17;
export const BAG_MODE_TIMED = 20;

/** MsgHandler.createPlayerBagMessage(mode, op, item, s, z, n). */
export function createPlayerBagMessage(mode: number, op: number, item: Item, s: number, z = false, n = 1): Message {
  const m = new Message(MSG_BAG_OPERATE);
  m.putByte(mode);
  m.putByte(op);
  m.putShort(item.slotPos);
  if (op === BAG_OP_EQUIP) m.putByte(s);
  else if (op === 4) m.putInt(item.id);
  else if (op === 6 || item.isPetCanUseItem()) m.putShort(s);
  m.putBoolean(z);
  if (op === 8) m.putInt(n);
  return m;
}

/** MsgHandler.createAttributeUpdate (sent after a battle; the server answers with 11004). */
export function createAttributeUpdateMsg(): Message {
  return new Message(MSG_ATTRIBUTE_UPDATE);
}

/** processPlayerBagMsg: a negative status is an error with its text. Returns the reply kind. */
export function readBagReplyKind(m: Message): number {
  const b = m.getByte();
  if (b < 0) throw new Error(m.remaining > 2 ? m.getString() : `Lỗi ${b}`);
  return b;
}

/** processAttributeUpdateMsg: n (id, value) pairs, then one more, added to the player. */
export function readAttributeUpdate(m: Message, p: Player): void {
  const n = m.getByte();
  for (let i = 0; i <= n; i++) p.addValue(m.getShort(), m.getInt());
}

/** processBagRefreshMsg: the data blocks with the bag (block 16) replace the player's items. */
export function readBagRefresh(m: Message, p: Player): void {
  const st = m.getByte();
  if (st !== 0) throw new Error(m.getString());
  const d = readDataBlocks(m);
  if ((d.flags & BLOCK_ITEMS) === 0 || p.bag == null) return;
  for (const [slot] of [...p.bag.allItems().map((it) => [it.slotPos] as const)]) p.bag.setItem(slot, null);
  for (const it of d.items) p.bag.setItem(it.slotPos, it);
}
