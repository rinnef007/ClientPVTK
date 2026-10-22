// com.hz.actor.Monster (1.2.0, Vineflower decompile): a battle opponent with fixed values sent by
// the server (Monster.fromBytes in the 10503 world data, block 4096), its AI (MonsterAI) and the
// statuses it is born with (bornStatus: immune to those harmful statuses, always has the good ones).
import type { Battle } from '../battle/Battle';
import { MonsterAI } from '../battle/MonsterAI';
import { getBufferBitValue } from '../core/DefineBattle';
import type { Skill } from '../core/Skill';
import type { Message } from '../../net/Message';
import { Player } from './Player';
import { sumValue } from './PlayerStats';

export const TYPE_MONSTER = 2;

/** Define.getBufferType(bits, true): harmful statuses 1–10, 30 and 31 as bits. */
function isHarmfulBits(bits: bigint): boolean {
  return (bits >= getBufferBitValue(1) && bits <= getBufferBitValue(10)) || bits === getBufferBitValue(30) || bits === getBufferBitValue(31);
}

export class Monster extends Player {
  atkType = 0;
  atkMin = 0;
  atkMax = 0;
  monstertype = 0;
  bornStatus = 0n;
  /** The battle sprite (Monster.icon1). */
  icon1 = 0n;
  monsterAI: MonsterAI | null = null;
  /** The AI line to say this round (MonsterAI.msg). */
  message: string | null = null;

  constructor() {
    super(TYPE_MONSTER);
    this.formulas = true;
  }

  /** Monster.fromBytes: id < 0 ends the list (null). */
  static fromBytes(m: Message): Monster | null {
    const id = m.getInt();
    if (id < 0) return null;
    const o = new Monster();
    o.id = id;
    o.name = m.getString();
    o.icon1 = m.getLong();
    o.level = m.getByte();
    o.set(106, o.level);
    o.monstertype = m.getByte();
    o.hpMax = m.getInt();
    o.mpMax = m.getInt();
    o.speed = m.getInt();
    o.atkType = m.getByte();
    o.atkMin = m.getInt();
    o.atkMax = m.getInt();
    o.atk_time = m.getByte();
    o.dodge = m.getInt();
    o.atk_str = m.getInt();
    o.atk_agi = m.getInt();
    o.atk_magic = m.getInt();
    o.def_str = m.getInt();
    o.def_agi = m.getInt();
    o.def_magic = m.getInt();
    o.hitrate = m.getInt();
    o.hitMagic = m.getInt();
    o.critical = m.getShort();
    o.wil = m.getInt();
    o.tough = m.getInt();
    o.block = m.getInt();
    o.brkArmor = m.getInt();
    o.insight = m.getInt();
    o.def_field = m.getInt();
    o.back = m.getInt();
    o.magic_back = m.getInt();
    o.life_absorption = m.getInt();
    o.mana_absorption = m.getInt();
    o.magic_penetration = m.getInt();
    o.bornStatus = m.getLong();
    o.newReflection = m.getInt();
    return o;
  }

  /** Monster.get: the fixed values; hit rates and recovery still take buffers. */
  get(id: number): number {
    switch (id) {
      case 29: return this.hpMax;
      case 30: return this.mpMax;
      case 31: return this.speed;
      case 32: return this.atkType;
      case 35:
      case 77: return sumValue(this.atk_time + 1, 0, 1, 99);
      case 36: return this.atk_str;
      case 37: return this.atk_agi;
      case 38: return this.atk_magic;
      case 39: return this.def_str;
      case 40: return this.def_agi;
      case 41: return this.def_magic;
      case 42: return this.dodge;
      case 43: return this.getPowerValue(0, this.hitrate, 54, 24, 1, 0, 2147483647);
      case 44: return this.getPowerValue(100, this.hitMagic, 56, 26, 1, 20, 2147483647);
      case 46: return 30;
      case 48: return this.wil;
      case 49: return this.tough;
      case 51: return this.block;
      case 52: return this.brkArmor;
      case 53: return this.insight;
      case 54: return this.def_field;
      case 55: return this.back;
      case 56: return this.magic_back;
      case 57: return this.life_absorption;
      case 58: return this.mana_absorption;
      case 59: return this.magic_penetration;
      case 60: {
        const v = this.getPowerValue(0, this.heal_recovery, 77, 47, 1, 0, 32767);
        return this.isBattleStatus(getBufferBitValue(13)) ? Math.trunc(v + this.get(2) * 0.005) : v;
      }
      case 61: {
        const v = this.getPowerValue(0, this.mana_recovery, 78, 48, 1, 0, 32767);
        return this.isBattleStatus(getBufferBitValue(12)) ? Math.trunc(v + this.get(3) * 0.005) : v;
      }
      case 64: return 100;
      case 73: return sumValue(this.atkMin, 0, 0, 99999999);
      case 74: return sumValue(this.atkMax, 0, 0, 99999999);
      case 75:
      case 76:
      case 78: return 0;
      case 251: return this.newReflection;
      default: return super.get(id);
    }
  }

  getAITargetPos(): number {
    return this.monsterAI == null ? -1 : this.monsterAI.targetPos;
  }

  /** Monster.getAttackTarget: the AI's target, else the enemy with the most hate (argo). */
  getAttackTarget(b: Battle): number {
    const ai = this.monsterAI;
    return ai != null && b.isValidPos(ai.targetPos) ? ai.targetPos : MonsterAI.selectValueTarget(b, this, 2, true);
  }

  getAttakAnimePos(): number {
    return this.atkType !== 0 && this.atkType !== 2 ? 0 : 1;
  }

  getAttackRangeAnime(): number {
    return 0;
  }

  getEquipWeaponType(): number {
    return -401;
  }

  /** Monster.getSkillByAI: `auto` = the support skill of the round start, else the attack skill. */
  getSkillByAI(b: Battle, auto: boolean): Skill | null {
    const ai = this.monsterAI;
    if (ai == null) return null;
    if (auto) return ai.getAutoSkill(b, this);
    const s = ai.getBattleSkill(b, this);
    if (s == null || s.useMP > this.get(3)) return null;
    return s.isEnoughHP(this) ? s : null;
  }

  isBornStatus(bits: bigint): boolean {
    return (bits & this.bornStatus) !== 0n;
  }

  /** Born good statuses (and no-revive) are always on. */
  isBattleStatus(bits: bigint): boolean {
    if (bits === 1n || !this.isBornStatus(bits) || (isHarmfulBits(bits) && bits !== getBufferBitValue(30))) return super.isBattleStatus(bits);
    return true;
  }

  isHaveCanNotReliveBuffer(): boolean {
    return this.isBornStatus(getBufferBitValue(30)) ? true : super.isHaveCanNotReliveBuffer();
  }

  /** Born harmful statuses cannot be set (the immunity). */
  setBattleStatus(bits: bigint): boolean {
    if (bits !== 1n && this.isBornStatus(bits) && isHarmfulBits(bits)) return false;
    return super.setBattleStatus(bits);
  }

  /** Monster.checkBattleMsg: the AI line becomes the battle message. */
  checkBattleMsg(): void {
    if (this.monsterAI != null && this.message && this.message !== '0') {
      this.battleMessage = this.message;
      this.message = null;
    }
  }

  /** Monster.getClone: a fresh copy for one battle. */
  getClone(): Monster {
    const o = new Monster();
    Object.assign(o, {
      id: this.id, name: this.name, icon1: this.icon1, level: this.level, monstertype: this.monstertype,
      hpMax: this.hpMax, mpMax: this.mpMax, speed: this.speed, atkType: this.atkType, atkMin: this.atkMin,
      atkMax: this.atkMax, dodge: this.dodge, atk_time: this.atk_time, atk_str: this.atk_str, atk_agi: this.atk_agi,
      atk_magic: this.atk_magic, def_str: this.def_str, def_agi: this.def_agi, def_magic: this.def_magic,
      hitrate: this.hitrate, hitMagic: this.hitMagic, critical: this.critical, wil: this.wil, tough: this.tough,
      block: this.block, brkArmor: this.brkArmor, insight: this.insight, def_field: this.def_field, back: this.back,
      magic_back: this.magic_back, life_absorption: this.life_absorption, mana_absorption: this.mana_absorption,
      magic_penetration: this.magic_penetration, bornStatus: this.bornStatus, newReflection: this.newReflection,
      monsterAI: this.monsterAI,
    });
    o.set(106, this.level);
    return o;
  }
}
