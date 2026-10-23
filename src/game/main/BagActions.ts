// The online bag actions of com.hz.main.GameWorld (1.2.0, jadx decompile): doEquipAction,
// doUnEquipAction and doWorldUseItemAction with the user's backend. The bag changes locally as in
// Java (PlayerBag.equipItem / unequipItem / removeBagItemByPos); requests with mode 0 get no reply,
// the others wait for the server's answer (pet, gear with skills, pet eggs, chests, title cards).
// Not ported: safe lock, change job / name / sex items, pet items (reset, age, exp, skills), repair,
// country books, warehouses, the item-count use (op 8) and the "use from the pet screen" path.
import type { Item } from '../actor/Item';
import { MyPet } from '../actor/MyPet';
import type { Player } from '../actor/Player';
import { idiv } from '../actor/PlayerStats';
import { resolveSprite } from '../sprite/GameSprite';
import { alertMessage } from '../ui/UIHandler';
import { readSkill, readPetDetail } from '../../net/online/EnterGame';
import { readAddItems } from '../../net/online/MissionMessages';
import {
  BAG_MODE_CHEST, BAG_MODE_NONE, BAG_MODE_PET_EGG, BAG_MODE_PET_EQUIP, BAG_MODE_PET_UNEQUIP, BAG_MODE_SKILL_EQUIP,
  BAG_MODE_SKILL_UNEQUIP, BAG_MODE_TIMED, BAG_MODE_TITLE_CARD, BAG_OP_EQUIP, BAG_OP_UNEQUIP, BAG_OP_USE,
  createPlayerBagMessage, readBagReplyKind,
} from '../../net/online/BagMessages';
import type { Message } from '../../net/Message';
import { online } from '../../net/online/Online';
import { buildOnlinePet } from './OnlineWorld';

const STR_CANNOT_EQUIP_THIS = 'Không thể trang bị vật phẩm này!';
const STR_CANNOT_USE_IN_WORLD = 'Vật phẩm này không thể dùng ngoài chiến đấu!';

/** Called after a bag change so open screens and the HUD redraw. */
let onBagChanged: (p: Player) => void = () => {};
export function setOnBagChanged(fn: (p: Player) => void): void {
  onBagChanged = fn;
}

async function request(m: Message): Promise<Message | null> {
  const s = online.session;
  if (s == null) return null;
  try {
    return await s.request(m);
  } catch (e) {
    alertMessage(e instanceof Error ? e.message : String(e), 'Lỗi');
    return null;
  }
}

function send(m: Message): void {
  online.session?.net.send(m);
}

/** Item.isValidEquipRequire (the level, and the stats for gear). */
function isValidEquipRequire(p: Player, it: Item, why: string[]): boolean {
  let ok = true;
  if (p.get(106) < it.reqLv) {
    why.push(`Cấp không đủ, còn thiếu ${it.reqLv - p.get(106)} cấp`);
    ok = false;
  }
  return ok;
}

/** GameWorld.doEquipAction. */
export async function doEquipAction(p: Player, it: Item, wanted = -1): Promise<boolean> {
  const bag = p.bag;
  if (bag == null) return false;
  const why: string[] = [];
  if (!isValidEquipRequire(p, it, why)) {
    alertMessage(why.join('\n'));
    return false;
  }
  let mode = BAG_MODE_NONE;
  if (it.isPetType()) mode = BAG_MODE_PET_EQUIP;
  else if (it.getItemSetID() !== 0 || it.isNeedWaitForSkill(bag)) mode = BAG_MODE_SKILL_EQUIP;
  else if (it.isTimeItem() || it.isVipItem()) mode = BAG_MODE_TIMED;
  const msg = createPlayerBagMessage(mode, BAG_OP_EQUIP, it, wanted);
  if (mode === BAG_MODE_NONE) {
    send(msg);
  } else {
    const r = await request(msg);
    if (r == null) return false;
    let kind: number;
    try {
      kind = readBagReplyKind(r);
    } catch (e) {
      alertMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
    if (kind === BAG_MODE_SKILL_EQUIP) {
      p.fromItemSetData(r);
      p.fromSkillData(r, () => readSkill(r));
    } else if (kind === BAG_MODE_PET_EQUIP) {
      const pet = buildOnlinePet(p, readPetDetail(r));
      if (pet instanceof MyPet) pet.setPlayerSprite(await resolveSprite(() => pet.createSprite()));
      p.setPet(pet);
      p.getPet()?.setAnimationByDir(false);
      p.initFollowPos();
    }
  }
  const done = wanted !== -1 ? bag.equipItem(it.slotPos, [wanted]) : bag.equipItem(it.slotPos);
  if (done < 0) {
    alertMessage(
      it.type !== 24 ? STR_CANNOT_EQUIP_THIS : 'Không thể trang bị vật phẩm này!\n(Hãy trang bị 1 vũ khí đơn thủ, rồi trang bị tay phụ)',
      'Gợi ý',
    );
    return false;
  }
  p.checkHPMP();
  onBagChanged(p);
  return true;
}

/** GameWorld.doUnEquipAction. */
export async function doUnEquipAction(p: Player, it: Item): Promise<boolean> {
  const bag = p.bag;
  if (bag == null) return false;
  let mode = BAG_MODE_NONE;
  if (it.isPetType()) mode = BAG_MODE_PET_UNEQUIP;
  else if (it.isNeedWaitForSkill(bag)) mode = BAG_MODE_SKILL_UNEQUIP;
  const msg = createPlayerBagMessage(mode, BAG_OP_UNEQUIP, it, -1);
  if (mode === BAG_MODE_NONE) {
    send(msg);
  } else {
    const r = await request(msg);
    if (r == null) return false;
    let kind: number;
    try {
      kind = readBagReplyKind(r);
    } catch (e) {
      alertMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
    if (kind === BAG_MODE_PET_UNEQUIP) {
      // The server names the bag slot the pet item goes to.
      const slot = r.getShort();
      const pet = p.getPet();
      if (pet != null) it.reqLv = pet.get(106);
      p.setPet(null);
      bag.swapItem(it.slotPos, slot);
      p.checkHPMP();
      onBagChanged(p);
      return true;
    }
    if (kind === BAG_MODE_SKILL_UNEQUIP) p.fromSkillData(r, () => readSkill(r));
  }
  if (bag.unequipItem(it) < 0) {
    alertMessage('Túi đã đầy, không tháo được.');
    return false;
  }
  p.checkHPMP();
  onBagChanged(p);
  return true;
}

/** Define.processWorldPower / addValuePlayer: HP / MP medicine on the player and their pet. */
function processWorldPower(p: Player, power: number, value: number): void {
  const add = (id: number, pctOf: number) => {
    for (const q of [p, p.getPet()]) {
      if (q == null) continue;
      q.addValue(id, pctOf > 0 ? idiv(q.get(pctOf) * value, 100) : value);
    }
  };
  if (power === 49) add(2, -1);
  else if (power === 50) add(2, 29);
  else if (power === 51) add(3, -1);
  else if (power === 52) add(3, 30);
}

/** Item.usePower: a timed medicine becomes the player's buffer, else its HP / MP powers apply. */
function usePower(it: Item, p: Player): void {
  if (it.power2 === 106 && it.powerValue2 > 0) {
    if (it.power1 !== 120 && it.power1 !== 167) {
      p.power = it.power1;
      p.powerValue = it.powerValue1;
    }
    return;
  }
  processWorldPower(p, it.power1, it.powerValue1);
  processWorldPower(p, it.power2, it.powerValue2);
}

/** GameWorld.doQuickEquipPet: the only pet item in the bag goes into the pet slot. */
async function doQuickEquipPet(p: Player): Promise<void> {
  const bag = p.bag;
  if (bag == null || bag.getItem(1) != null) return;
  const pets = bag.bagItems().filter(([, it]) => it.type === 32);
  if (pets.length === 1) await doEquipAction(p, pets[0][1]);
}

/** GameWorld.doWorldUseItemAction (one item). */
export async function doWorldUseItemAction(p: Player, it: Item): Promise<boolean> {
  const bag = p.bag;
  if (bag == null) return false;
  const slot = it.slotPos;
  const held = bag.getBagItemBySlotPos(slot);
  if (held == null) return false;
  const why: string[] = [];
  if (!isValidEquipRequire(p, held, why)) {
    alertMessage(why.join('\n'), 'Thất bại');
    return false;
  }
  if (!held.isCanUse(1)) {
    alertMessage(STR_CANNOT_USE_IN_WORLD, 'Thất bại');
    return false;
  }
  let mode = BAG_MODE_NONE;
  if (it.isPetEgg()) mode = BAG_MODE_PET_EGG;
  else if (it.isChestItem()) mode = BAG_MODE_CHEST;
  else if (it.isTitleItem()) mode = BAG_MODE_TITLE_CARD;
  else if (it.isTimeItem() || it.isVipItem()) mode = BAG_MODE_TIMED;
  if (it.isPetCanUseItem() || it.isPetResetItem() || it.isPlayerExpItem() || it.id === 40002 || it.id === 40008 || it.power1 === 99) {
    alertMessage('Vật phẩm này chưa dùng được trên bản web.');
    return false;
  }
  const msg = createPlayerBagMessage(mode, BAG_OP_USE, it, -1);
  let text = '';
  if (mode === BAG_MODE_NONE) {
    send(msg);
    bag.removeBagItemByPos(slot, 1);
  } else {
    const r = await request(msg);
    if (r == null) return false;
    let kind: number;
    try {
      kind = readBagReplyKind(r);
    } catch (e) {
      alertMessage(e instanceof Error ? e.message : String(e));
      return false;
    }
    bag.removeBagItemByPos(slot, 1);
    if (kind === BAG_MODE_PET_EGG || kind === BAG_MODE_CHEST) {
      const removed = r.getByte();
      if (removed !== 0) {
        const s = r.getShort();
        r.getInt();
        bag.removeBagItemByPos(s, removed);
      }
      text = readAddItems(r, bag);
      if (kind === BAG_MODE_PET_EGG) text += 'Chúc mừng mi nhận được trân thú mới\n';
    } else if (kind === BAG_MODE_TITLE_CARD) {
      text = r.getString();
    }
  }
  usePower(held, p);
  onBagChanged(p);
  if (it.isPetEgg()) {
    alertMessage(text || 'Ấp trứng xong.', 'Trứng trân thú');
    await doQuickEquipPet(p);
  } else if (it.isChestItem()) {
    alertMessage(text || 'Hộp trống', 'Mở hộp nhận được');
  } else if (text) {
    alertMessage(text);
  }
  return true;
}

