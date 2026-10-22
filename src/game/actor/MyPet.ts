// The parts of com.hz.actor.MyPet the pet screens read (CFR decompile): a pet is a Player built
// from a pet item (type 32) — name, level (item.reqLv), appearance (item.icon), grade — plus the
// pet-only values the info screen shows. Real values come from the server (MyPet.fromBytesDetail).
import { getBufferBitValue } from '../core/DefineBattle';
import { GameSprite } from '../sprite/GameSprite';
import { createPetSpriteByIcon } from '../sprite/SpriteIcon';
import { ITEM_TYPE_PET, SLOT_PET, type Item } from './Item';
import { TYPE_PET } from './Model';
import { Player } from './Player';
import { idiv, sumValue } from './PlayerStats';

const MAX_ATK = 99999999;

/** Define.getBufferType(bits, true): harmful statuses 1–10, 30, 31 as bits. */
function isHarmfulBits(bits: bigint): boolean {
  return (bits >= getBufferBitValue(1) && bits <= getBufferBitValue(10)) || bits === getBufferBitValue(30) || bits === getBufferBitValue(31);
}

/** Pet value ids for Model.get: growth level and grade. */
export const ATTR_PET_GROW_LEVEL = 83;
export const ATTR_PET_GRADE = 82;

export class MyPet extends Player {
  owner: Player | null;
  petItem: Item | null = null;
  grade = 0;
  /** Combat points (0..10 bar), growth and comprehension (0..100 bars). */
  cp = 0;
  grow = 0;
  compre = 0;
  growLevel = 0;
  petAge = 0;
  petmaxage = 0;
  /** Portrait id for common/PetIcon/tx_<n>.png (Model.getPetIcon). */
  petHeadIcon = 0;
  icon1 = 0n;
  /** Battle values sent with the pet (MyPet.fromBytesDetail). */
  petHitrate = 0;
  atkType = 0;
  atkMin = 0;
  atkMax = 0;
  petAtkTime = 0;
  bornStatus = 0n;
  /** When the pet's life ends (ms); 0 = unknown (treated as alive). */
  ageTime = 0;
  color = 0;

  constructor(owner: Player | null) {
    super(TYPE_PET);
    this.owner = owner;
  }

  /**
   * MyPet.get: HP / MP / base stats / hit and damage by the pet's own formulas, with the owner's
   * equipment and passive skills that boost pets (powers 89–96); the rest as Player.get.
   */
  get(id: number): number {
    if (!this.formulas) return super.get(id);
    switch (id) {
      case 29: return this.petPowerValue(idiv(this.get(7) * 65, 10) + this.get(6) * 3 + 100 + (this.get(106) - 1) * 20, this.hpMax, 11, 12, 1, 9999999, 90);
      case 30: return this.petPowerValue(this.get(9) * 5 + this.get(10) * 2 + 40 + (this.get(106) - 1) * 5, this.mpMax, 13, 14, 1, 9999999, 91);
      case 32: return this.atkType;
      case 35:
      case 77: return sumValue(this.petAtkTime + 1, this.atk_time, 1, 99) + this.getSkillPowerValue(1, 130);
      case 43: return this.petPowerValue(this.petHitrate, this.hitrate, 54, 24, 0, 32767, 0);
      case 44: return this.petPowerValue(this.petHitrate, this.hitMagic, 56, 26, 20, 32767, 0);
      case 6: return this.petBaseValue(this.str, 1, 2, 92);
      case 7: return this.petBaseValue(this.con, 3, 4, 93);
      case 8: return this.petBaseValue(this.agi, 5, 6, 94);
      case 9: return this.petBaseValue(this.ilt, 7, 8, 95);
      case 10: return this.petBaseValue(this.wis, 9, 10, 96);
      case 73: return sumValue(this.petPowerValue(this.atkMin, 0, 0, 0, 0, 1000000, 89), 0, 0, MAX_ATK);
      case 74: return sumValue(this.petPowerValue(this.atkMax, 0, 0, 0, 0, 1000000, 89), 0, 0, MAX_ATK);
      case 75:
      case 76:
      case 78: return 0;
      case 81: return this.color;
      case 82: return this.grade;
      case 83: return this.growLevel;
      default:
        if (this.owner != null) this.formationSkill = this.owner.formationSkill;
        return super.get(id);
    }
  }

  /** MyPet.getBaseValue: the owner's pet-boosting powers add percent. */
  private petBaseValue(base: number, abs: number, pct: number, ownerPower: number): number {
    let a = base + this.getSkillPowerValue(1, abs);
    let b = this.getSkillPowerValue(1, pct);
    const o = this.owner;
    if (o != null) b += o.getBagEquipPowerValue(ownerPower) + o.getSkillPowerValue(1, ownerPower);
    if (o?.formationSkill != null) {
      a += o.formationSkill.getPowerValue(abs);
      b += o.formationSkill.getPowerValue(pct);
    }
    if (b > 0) a += idiv(b * a, 100);
    return sumValue(a, 0, 0, 32767);
  }

  /** MyPet.getPowerValue (8 arguments). */
  private petPowerValue(base: number, extra: number, abs: number, pct: number, min: number, max: number, ownerPower: number): number {
    let a = base + this.getSkillPowerValue(1, abs);
    let b = this.getSkillPowerValue(1, pct);
    const o = this.owner;
    if (o != null && ownerPower > 0) b += o.getBagEquipPowerValue(ownerPower) + o.getSkillPowerValue(1, ownerPower);
    if (o?.formationSkill != null) {
      a += o.formationSkill.getPowerValue(abs);
      b += o.formationSkill.getPowerValue(pct);
    }
    if (b > 0) a += idiv(b * a, 100);
    return sumValue(a, extra, min, max);
  }

  addValue(id: number, d: number): void {
    if (id === 83) this.growLevel = sumValue(this.growLevel, d, 0, 120);
    else super.addValue(id, d);
  }

  getAttakAnimePos(): number {
    return this.atkType === 0 || this.atkType === 2 ? 1 : 0;
  }

  getAttackRangeAnime(): number {
    return 0;
  }

  /** MyPet.isAlive: life time left (the VIP-pet expiry check is not ported). */
  isAlive(): boolean {
    return this.ageTime === 0 || this.ageTime > Date.now();
  }

  isBornStatus(bits: bigint): boolean {
    return (bits & this.bornStatus) !== 0n;
  }

  isBattleStatus(bits: bigint): boolean {
    if (bits !== 1n && this.isBornStatus(bits) && (!isHarmfulBits(bits) || bits === getBufferBitValue(30))) return true;
    return super.isBattleStatus(bits);
  }

  setBattleStatus(bits: bigint): boolean {
    if (bits !== 1n && this.isBornStatus(bits) && isHarmfulBits(bits)) return false;
    return super.setBattleStatus(bits);
  }

  isHaveCanNotReliveBuffer(): boolean {
    return this.isBornStatus(getBufferBitValue(30)) ? true : super.isHaveCanNotReliveBuffer();
  }

  createSprite(): GameSprite | null {
    return createPetSpriteByIcon(this.icon1, false);
  }

  /** MyPet.createItemPet: a pet with the item's name, level, look and grade. */
  static createItemPet(item: Item, owner: Player): MyPet {
    const pet = new MyPet(owner);
    pet.name = item.name;
    pet.level = item.reqLv;
    pet.set(106, item.reqLv);
    pet.icon1 = item.icon;
    pet.grade = item.grade;
    pet.setPlayerSprite(pet.createSprite());
    return pet;
  }

  /** MyPet.itemChangePet: the item in the pet slot is the player's own pet object. */
  static itemChangePet(item: Item, owner: Player, myPlayer: Player | null): MyPet {
    const pet = item.slotPos === SLOT_PET && owner === myPlayer && owner.getPet() instanceof MyPet
      ? (owner.getPet() as MyPet)
      : MyPet.createItemPet(item, owner);
    pet.petItem = item;
    return pet;
  }

  /** MyPet.doGetBagPetItem: every pet item (equipment and bag) as a pet. */
  static doGetBagPetItem(owner: Player | null, myPlayer: Player | null): MyPet[] | null {
    const bag = owner?.bag;
    if (owner == null || bag == null) return null;
    return bag.allItems().filter((it) => it.type === ITEM_TYPE_PET).map((it) => MyPet.itemChangePet(it, owner, myPlayer));
  }
}
