// com.hz.actor.Player: world movement plus the data the UI screens read (bag, money, stats).
import type { Mission } from '../core/Mission';
import type { Talent } from '../core/Talent';
import type { PlayerBag } from './Item';
import type { AnimationControl } from '../battle/AnimationControl';
import type { Buffer } from '../core/Buffer';
import type { GameSprite } from '../sprite/GameSprite';
import { getBufferBitValue, getBufferType } from '../core/DefineBattle';
import { Skill } from '../core/Skill';
import type { Control } from '../main/Control';
import { Model, TYPE_PLAYER } from './Model';
import { bagAttr, bagAttrAt, bagEquipPowerValue, getItemSetID, getItemSetNum, idiv, sumValue } from './PlayerStats';

const MISSION_SLOTS = 10;

/** Player.addWeaponSkillAtkTime: weapon type → mastery power. */
const WEAPON_ATK_TIME_POWER: Record<number, number> = {
  13: 122, 14: 122, 15: 123, 16: 123, 17: 124, 18: 124, 19: 126, 20: 125, 21: 128, 22: 128, 23: 128, 24: 129,
  34: 174, 35: 190, 36: 190, 37: 192, 38: 192, 39: 194,
};
/** Player.addWeaponSkillDamageOrDur: weapon type → (mastery power, general power). */
const WEAPON_DAMAGE_POWER: Record<number, [number, number]> = {
  13: [133, 197], 14: [133, 197], 15: [134, 197], 16: [134, 197], 17: [135, 197], 18: [135, 197], 19: [137, 196],
  20: [136, 197], 21: [139, 197], 22: [139, 197], 23: [139, 197], 24: [140, 196], 34: [175, 196], 35: [191, 197],
  36: [191, 197], 37: [193, 196], 38: [193, 196], 39: [195, 196],
};

/** Model.get(index) attribute ids used by the screens (Model.getValue in Java). */
type ModField =
  | 'speed' | 'atk_time' | 'atk_str' | 'atk_agi' | 'atk_magic' | 'def_str' | 'def_agi' | 'def_magic' | 'dodge'
  | 'hitrate' | 'hitMagic' | 'critical' | 'forceHit' | 'wil' | 'tough' | 'block' | 'brkArmor' | 'insight'
  | 'def_field' | 'back' | 'magic_back' | 'life_absorption' | 'mana_absorption' | 'magic_penetration'
  | 'heal_recovery' | 'mana_recovery' | 'keepout_atk_time';

/** Player.addValue: the battle modifier field of an attribute id, with its range. */
const BATTLE_MODIFIERS: Record<number, [ModField, number, number]> = {
  31: ['speed', 0, 1000000], 35: ['atk_time', 0, 99], 36: ['atk_str', 0, 1000000], 37: ['atk_agi', 0, 1000000],
  38: ['atk_magic', 0, 1000000], 39: ['def_str', 0, 1000000], 40: ['def_agi', 0, 1000000], 41: ['def_magic', 0, 1000000],
  42: ['dodge', 0, 1000000], 43: ['hitrate', 0, 1000000], 44: ['hitMagic', 0, 1000000], 45: ['critical', 0, 1000000],
  46: ['forceHit', 0, 1000000], 48: ['wil', 0, 1000000], 49: ['tough', 0, 1000000], 51: ['block', 0, 1000000],
  52: ['brkArmor', 0, 1000000], 53: ['insight', 0, 1000000], 54: ['def_field', -999999, 1000000], 55: ['back', 0, 1000000],
  56: ['magic_back', 0, 1000000], 57: ['life_absorption', 0, 1000000], 58: ['mana_absorption', 0, 1000000],
  59: ['magic_penetration', 0, 1000000], 60: ['heal_recovery', -999999, 1000000], 61: ['mana_recovery', -999999, 1000000],
  250: ['keepout_atk_time', 0, 100],
};

/** Model tab bits used in battle: revived at 1 HP (status 27), revived (28), delayed death done (29). */
export const TAB_REBORN_1HP_DONE = 134217728;
export const TAB_REBORN_DONE = 268435456;
export const TAB_DIE_DELAY_DONE = 536870912;
/** Set while a keep-out charge blocks the current hit. */
export const TAB_KEEPOUT_HIT = 1073741824;

export const ATTR_EXP = 0;
export const ATTR_EXP_MAX = 1;
export const ATTR_HP = 2;
export const ATTR_MP = 3;
export const ATTR_MONEY1 = 11;
export const ATTR_MONEY2 = 12;
export const ATTR_MONEY3 = 13;
export const ATTR_HP_MAX = 29;
export const ATTR_MP_MAX = 30;
export const ATTR_LEVEL = 106;
/** Unassigned attribute points. */
export const ATTR_POINTS = 4;
/** Totals of strength, constitution, agility, intellect, wisdom (base + equipment). */
export const ATTR_STR = 6;
export const ATTR_CON = 7;
export const ATTR_AGI = 8;
export const ATTR_ILT = 9;
export const ATTR_WIS = 10;

export class Player extends Model {
  bag: PlayerBag | null = null;
  /** Base attributes (Player.str/con/agi/ilt/wis); the totals are get(6..10). */
  str = 0;
  con = 0;
  agi = 0;
  ilt = 0;
  wis = 0;
  job = 0;
  race = 0;
  level2 = 0;
  countryName = '';
  countryRank = '';
  /** The active pet (Player.getPet), built from the item in equipment slot 1. */
  pet: Player | null = null;
  /** Learnt skills and formations (Player.skillList / formationList, sent by the server). */
  skillList: Skill[] = [];
  formationList: Skill[] = [];
  /** Learnt talents (Player.talentList). */
  talentList: Talent[] = [];
  /** Auto-battle skill slots (skill ids, 0 = empty) and the auto-cast active skill. */
  autoSkillID: number[] = [];
  autoSkillID_Initiative = 0;
  /** Model.setting: option bits (team requests, display…), see screens/setting.ts. */
  setting = 0;
  /** Society tab values (server data): arena / sky-arena points, combat power, enchant points, god EXP. */
  arenaPoint = 0;
  skyarenaPoint = 0;
  combatPoint = 0;
  enchantValue = 0;
  exp2 = 0;
  expMax2 = 0;
  vipLevel = 0;
  vipLevel2 = 0;
  partnerName = '';
  /** 1 master, 2 apprentice. */
  masterFlag = 0;
  title = '';
  helpCountry = '';
  lovePlayer = '';
  Pkwincount = 0;
  Pklosecount = 0;
  /** Missions in progress (Player.missionList; null entries are empty slots). */
  missionList: (Mission | null)[] = [];
  /** Player.missionStatus: a bit per finished mission id (sent by the server at login). */
  missionStatus: Uint8Array = new Uint8Array(1250);

  getMissionById(id: number): Mission | null {
    return this.missionList.find((m) => m != null && m.getId() === id) ?? null;
  }

  /** Player.addMission: the first free of 10 slots; false when taken or full. */
  addMission(m: Mission): boolean {
    if (this.getMissionById(m.getId()) != null) return false;
    for (let i = 0; i < MISSION_SLOTS; i++) {
      if (this.missionList[i] == null) {
        this.missionList[i] = m;
        return true;
      }
    }
    return false;
  }

  /** Player.updateAllKillMission: monster kills of a battle count for the missions in progress. */
  updateAllKillMission(ids: number[], counts: number[], out: string[] | null): void {
    ids.forEach((id, i) => {
      for (const m of this.missionList) m?.updateKillMission(id, counts[i], out);
    });
  }

  deleteMission(m: Mission): void {
    const i = this.missionList.indexOf(m);
    if (i >= 0) this.missionList[i] = null;
  }

  submitMission(m: Mission): void {
    this.deleteMission(m);
  }

  /** Player.getPKWin: duel win rate. */
  getPKWin(): string {
    const n = this.Pkwincount + this.Pklosecount;
    return n <= 0 ? '0%' : `${Math.trunc((this.Pkwincount * 100) / n)}%`;
  }

  /** Player.isAutoSkill: the skill's auto slot index, or -1. */
  isAutoSkill(id: number): number {
    return this.autoSkillID.indexOf(id);
  }

  /** Player.getTalentListByType. */
  static getTalentListByType(list: Talent[] | null, type: number): Talent[] | null {
    if (list == null || list.length === 0) return null;
    return list.filter((t) => t != null && t.type === type);
  }

  /** Player.getSkillListByType. */
  static getSkillListByType(list: Skill[] | null, type: number): Skill[] | null {
    if (list == null || list.length === 0) return null;
    return list.filter((s) => s != null && s.type === type);
  }

  getPet(): Player | null {
    return this.pet;
  }

  /** Model.setPet: the pet follows this player. (Riding pets, tab 256, are not ported.) */
  setPet(pet: Player | null): void {
    if (this.pet != null && this.pet.follower === this) this.pet.follower = null;
    this.pet = pet;
    if (pet != null) pet.follower = this;
  }
  /** Attribute values by id (sent by the server in the real game). */
  readonly values = new Map<number, number>();

  /**
   * true: the totals (6–10, 29–78, 200–205, 250) follow Player.get's formulas from the base stats,
   * equipment and skills, as in the game. false (the offline demo): they are read from `values`.
   */
  formulas = false;
  // Base modifiers Player.get adds to its formulas (the server sends them for monsters; 0 here).
  hpMax = 0;
  mpMax = 0;
  speed = 0;
  atk_str = 0;
  atk_agi = 0;
  atk_magic = 0;
  def_str = 0;
  def_agi = 0;
  def_magic = 0;
  dodge = 0;
  hitrate = 0;
  hitMagic = 0;
  critical = 0;
  forceHit = 0;
  exp_up = 0;
  wil = 0;
  tough = 0;
  block = 0;
  brkArmor = 0;
  insight = 0;
  def_field = 0;
  back = 0;
  magic_back = 0;
  life_absorption = 0;
  mana_absorption = 0;
  magic_penetration = 0;
  heal_recovery = 0;
  mana_recovery = 0;
  recovery = 0;
  argo = 0;
  atk_time = 0;
  keepout_atk_time = 0;
  integral = 0;
  /** Medicine buffer (Player.power / powerValue), title powers and battle buffer powers. */
  power = 0;
  powerValue = 0;
  titleInfos: [number, number][] = [];
  fightPowerList: [number, number][] = [];
  countrypowerValue = 0;
  formationSkill: Skill | null = null;
  /** Item-set bonuses: (set id/num, power, value) triples. */
  itemSetData: number[] = [];

  constructor(type = TYPE_PLAYER) {
    super(type);
  }

  get(id: number): number {
    if (this.formulas) {
      const v = this.getFormula(id);
      if (v !== undefined) return v;
    }
    return this.values.get(id) ?? 0;
  }

  /** Player.getSkillPowerValue: `power` summed over the skills of `type` (1 passive). */
  getSkillPowerValue(type: number, power: number): number {
    if (power <= 0) return 0;
    let v = 0;
    for (const s of this.skillList) if (s != null && s.type === type) v += s.getPowerValue(power);
    return v;
  }

  getSkillByID(id: number): Skill | null {
    return this.skillList.find((s) => s != null && s.id === id) ?? null;
  }

  /** Player.getCountryBuffer. */
  getCountryBuffer(power: number): number {
    return power === 2 || power === 4 || power === 6 || power === 8 || power === 10 ? this.countrypowerValue : 0;
  }

  /** Player.getPowerValueByBuffer: medicine, titles, battle buffers and the country bonus. */
  getPowerValueByBuffer(power: number): number {
    let v = this.power === power ? this.powerValue : 0;
    for (const [p, val] of this.titleInfos) if (p === power) v += val;
    for (const [p, val] of this.fightPowerList) if (p === power) v += val;
    return v + this.getCountryBuffer(power);
  }

  /** Player.getBagEquipPowerValue: equipment plus completed item sets (and buffers when asked). */
  getBagEquipPowerValue(power: number, withBuffer = false): number {
    if (this.bag == null) return 0;
    let v = bagEquipPowerValue(this.bag, power);
    for (let i = 0; i + 2 < this.itemSetData.length; i += 3) {
      const [set, p, val] = [this.itemSetData[i], this.itemSetData[i + 1], this.itemSetData[i + 2]];
      if (p === power && this.bag.getEquipItemSetNum(getItemSetID(set)) >= getItemSetNum(set)) v += val;
    }
    if (withBuffer) v += this.getPowerValueByBuffer(power);
    return v;
  }

  /** Player.getEquipWeaponType: the type of the first usable weapon in slot 8 then 10, or -401. */
  getEquipWeaponType(): number {
    if (this.bag == null) return -401;
    for (const slot of [8, 10]) {
      const it = this.bag.getItem(slot);
      if (it != null && it.durability > 0 && it.type !== 24) return it.type;
    }
    return -401;
  }

  /** Player.getBaseValue: a base stat with its absolute and percent powers. */
  protected getBaseValue(base: number, abs: number, pct: number, type: number, min: number, max: number): number {
    let a = base + this.getSkillPowerValue(type, abs) + this.getPowerValueByBuffer(abs);
    let b = this.getSkillPowerValue(type, pct) + this.getBagEquipPowerValue(pct) + this.getPowerValueByBuffer(pct);
    if (this.formationSkill != null) {
      a += this.formationSkill.getPowerValue(abs);
      b += this.formationSkill.getPowerValue(pct);
    }
    return sumValue(a + idiv(b * a, 100) + this.getBagEquipPowerValue(abs), 0, min, max);
  }

  /** Player.getPowerValue: a derived value plus its absolute / percent powers and `extra`. */
  protected getPowerValue(base: number, extra: number, abs: number, pct: number, type: number, min: number, max: number, unarmed = false): number {
    let a = base + this.getSkillPowerValue(type, abs) + this.getPowerValueByBuffer(abs);
    let b = this.getSkillPowerValue(type, pct) + this.getPowerValueByBuffer(pct);
    if (this.bag != null) {
      a += this.getBagEquipPowerValue(abs);
      b += this.getBagEquipPowerValue(pct);
    }
    if (this.formationSkill != null) {
      a += this.formationSkill.getPowerValue(abs);
      b += this.formationSkill.getPowerValue(pct);
    }
    if (unarmed && this.getEquipWeaponType() === -401) {
      if (this.bag != null) b += this.getBagEquipPowerValue(138);
      b += this.getSkillPowerValue(1, 138);
    }
    return sumValue(a + idiv(b * a, 100), extra, min, max);
  }

  /** Player.addWeaponSkillAtkTime: weapon mastery attack-time bonuses. */
  addWeaponSkillAtkTime(v: number, weaponType: number): number {
    const p = WEAPON_ATK_TIME_POWER[weaponType];
    const add = p ? this.getSkillPowerValue(1, p) + this.getBagEquipPowerValue(p, true) : 0;
    return v + add + this.getSkillPowerValue(1, 130) + this.getBagEquipPowerValue(130, true);
  }

  /** Player.addWeaponSkillDamageOrDur: weapon mastery percent bonuses for the weapon in `slot`. */
  addWeaponSkillDamageOrDur(v: number, slot: number): number {
    if (v === 0) return 0;
    const it = this.bag?.getItem(slot) ?? null;
    if (it == null) return v;
    const pair = WEAPON_DAMAGE_POWER[it.type];
    let add = pair
      ? this.getSkillPowerValue(1, pair[0]) + this.getBagEquipPowerValue(pair[0]) + this.getSkillPowerValue(1, pair[1]) + this.getBagEquipPowerValue(pair[1])
      : 0;
    add += this.getSkillPowerValue(1, 141) + this.getBagEquipPowerValue(141);
    return add === 0 ? v : v + idiv(add * v, 100);
  }

  /** The formula part of Player.get (1.2.0); undefined for values read as stored. */
  protected getFormula(id: number): number | undefined {
    const bag = this.bag;
    const lv = () => this.get(106) + this.get(118);
    switch (id) {
      case 6: return this.getBaseValue(this.str, 1, 2, 1, 0, 32767);
      case 7: return this.getBaseValue(this.con, 3, 4, 1, 0, 32767);
      case 8: return this.getBaseValue(this.agi, 5, 6, 1, 0, 32767);
      case 9: return this.getBaseValue(this.ilt, 7, 8, 1, 0, 32767);
      case 10: return this.getBaseValue(this.wis, 9, 10, 1, 0, 32767);
      case 29: return this.getPowerValue(idiv(this.get(7) * 65, 10) + this.get(6) * 3 + 100 + (lv() - 1) * 40, this.hpMax, 11, 12, 1, 1, 9999999);
      case 30: return this.getPowerValue(idiv(this.get(9) * 75, 10) + idiv(this.get(10) * 35, 10) + 50 + (lv() - 1) * 10, this.mpMax, 13, 14, 1, 1, 9999999);
      case 31: return this.getPowerValue(this.get(8) * 3 + idiv(this.get(10) * 15, 10), this.speed, 53, 23, 1, 0, 1000000);
      case 32: return bag == null ? 0 : bagAttr(bag, 8);
      case 33: return Math.max(this.get(73), this.get(75));
      case 34: return Math.max(this.get(74), this.get(76));
      case 35: {
        const wt = this.getEquipWeaponType();
        const t = wt === -401 ? this.getSkillPowerValue(1, 127) + 1 + this.getBagEquipPowerValue(127, true) : this.get(77) + this.get(78);
        return sumValue(this.addWeaponSkillAtkTime(t, wt), this.atk_time, 1, 99);
      }
      case 36: return this.getPowerValue(this.get(8) * 3 + this.get(6) * 5, this.atk_str, 58, 28, 1, 0, 1000000, true);
      case 37: return this.getPowerValue(this.get(6) * 5 + this.get(8) * 5, this.atk_agi, 59, 29, 1, 0, 1000000, true);
      case 38: return this.getPowerValue(idiv((this.get(9) * 3 + this.get(10) * 2) * (this.get(44) + 900), 1000), this.atk_magic, 60, 30, 1, 0, 1000000);
      case 39: return this.getPowerValue(this.get(7) * 8 + (bag ? bagAttr(bag, 1) : 0), this.def_str, 61, 31, 1, 0, 65535);
      case 40: return this.getPowerValue(this.get(7) * 8 + (bag ? bagAttr(bag, 2) : 0), this.def_agi, 62, 32, 1, 0, 65535);
      case 41: return this.getPowerValue((this.get(10) * 2 + this.get(9)) * 2 + (bag ? bagAttr(bag, 3) : 0), this.def_magic, 63, 33, 1, 0, 65535);
      case 42: return this.getPowerValue(idiv((this.get(8) + this.get(10)) * 10, 25), this.dodge, 55, 25, 1, 0, 32767);
      case 43: {
        let v = 0;
        if (bag != null) {
          let a = bagAttrAt(bag, 4, 8);
          if (a < 0) a = 0;
          const b = bagAttrAt(bag, 4, 10);
          if (b > 0 && (a <= 0 || b < a)) a = b;
          v = a + idiv(this.get(8), 5);
        }
        return this.getPowerValue(v, this.hitrate, 54, 24, 1, 0, 32767);
      }
      case 44: return this.getPowerValue(100, this.hitMagic, 56, 26, 1, 20, 32767);
      case 45: return this.getPowerValue(0, this.critical, 57, 27, 1, 0, 32767);
      case 46: return this.getPowerValue(30, this.forceHit, 76, 46, 1, 0, 70);
      case 47: return this.exp_up;
      case 48: return this.getPowerValue(idiv(this.get(10) * 3 + this.get(9), 10), this.wil, 64, 34, 1, 0, 1000000);
      case 49: return this.getPowerValue(idiv(this.get(7) * 2 + this.get(6), 10), this.tough, 65, 35, 1, 0, 1000000);
      case 51: return this.getPowerValue(idiv(this.get(8), 5), this.block, 67, 37, 1, 0, 32767);
      case 52: return this.getPowerValue(this.get(8) + this.get(6) * 3, this.brkArmor, 69, 39, 1, 0, 32767);
      case 53: return this.getPowerValue(idiv(this.get(10) * 2 + this.get(9), 10), this.insight, 68, 38, 1, 0, 32767);
      case 54: return this.getPowerValue(this.get(9) * 2 + this.get(10) * 3, this.def_field, 70, 40, 1, 0, 32767);
      case 55: return this.getPowerValue(0, this.back, 71, 41, 1, 0, 32767);
      case 56: return this.getPowerValue(0, this.magic_back, 72, 42, 1, 0, 32767);
      case 57: return this.getPowerValue(0, this.life_absorption, 73, 43, 1, 0, 1000);
      case 58: return this.getPowerValue(0, this.mana_absorption, 74, 44, 1, 0, 1000);
      case 59: return this.getPowerValue(this.get(10) + this.get(9) * 2, this.magic_penetration, 75, 45, 1, 0, 32767);
      case 60: return this.getPowerValue(0, this.heal_recovery, 77, 47, 1, 0, 32767);
      case 61: return this.getPowerValue(0, this.mana_recovery, 78, 48, 1, 0, 32767);
      case 62: return this.recovery;
      case 63: return this.argo;
      case 64: return 70;
      case 68: return this.integral;
      case 71: return bag == null ? -1 : bagAttrAt(bag, 9, 8);
      case 72: return bag == null ? -1 : bagAttrAt(bag, 9, 10);
      case 73:
      case 74:
      case 75:
      case 76: {
        // Weapon damage min / max of the main (8) and off (10) hand.
        if (bag == null) return 0;
        const slot = id <= 74 ? 8 : 10;
        const v = Math.max(0, bagAttrAt(bag, id === 73 || id === 75 ? 5 : 6, slot));
        return sumValue(this.addWeaponSkillDamageOrDur(v, slot), 0, 0, 99999999);
      }
      case 77:
      case 78: {
        if (bag == null) return sumValue(1, 0, 1, 99);
        const v = bagAttrAt(bag, 7, id === 77 ? 8 : 10);
        return v < 0 ? 0 : sumValue(v + 1, 0, 1, 99);
      }
      case 200: case 201: case 202: case 203: case 204: case 205:
        return this.getPowerValue(0, 0, 168 + (id - 200), 0, 1, 0, 32767);
      case 250: return this.getPowerValue(0, this.keepout_atk_time, 178, 0, 1, 0, 100);
      case 118: return this.level2;
      default: return undefined;
    }
  }

  set(id: number, v: number): void {
    this.values.set(id, v);
  }

  /**
   * Player.addValue: HP / MP stay within their maxima; the battle modifiers (ids 31, 35–61, 63,
   * 250) change their field within its range and readAddValue keeps the change really made, which
   * a Buffer takes back when it ends. Other ids add to the stored value.
   */
  addValue(id: number, d: number): void {
    this.readAddValue = d;
    switch (id) {
      case 2:
      case 3:
        this.set(id, sumValue(this.get(id), d, 0, this.get(id === 2 ? 29 : 30)));
        return;
      case 63:
        this.argo = sumValue(this.argo, d, -100000, 100000);
        return;
      case 91:
      case 92:
        this.set(id, sumValue(this.get(id), d, 0, this.get(id === 91 ? 29 : 30)));
        return;
      case 118:
        if (d > 0) this.level2 = sumValue(this.level2, d, 0, 120);
        return;
    }
    const mod = BATTLE_MODIFIERS[id];
    if (mod) {
      const [field, min, max] = mod;
      const old = this[field];
      this[field] = sumValue(old, d, min, max);
      this.readAddValue = this[field] - old;
      return;
    }
    this.set(id, this.get(id) + d);
  }

  // ---- Battle state (Player.bStatus, battleBufferList, position…) ----

  /** Battle position 0–33 (Battle.playerList index). */
  position = 0;
  /** Bit per battle status (Define.getBufferBitValue); bit 0 (1) = escaped. */
  bStatus = 0n;
  battleBufferList: Buffer[] | null = null;
  /** The change the last addValue really made. */
  readAddValue = 0;
  newReflection = 0;
  /** A monster's attack dialogue shown over it (Player.dialogAIFrame text). */
  battleMessage: string | null = null;
  /** Ticks left to show battleMessage (MessageFrame.setDrawCount). */
  battleMessageCount = 0;
  /** Battle view: the fighter's sprite, its death mark, effect sprites and queued animations. */
  battleSprite: GameSprite | null = null;
  dieSprite: GameSprite | null = null;
  battleEffectSpriteList: GameSprite[] = [];
  battlePlanControlList: AnimationControl[] = [];

  /** Player.checkBattleMsg: a player's or pet's skill name said over it. */
  checkBattleMsg(text: string | null): void {
    if (text != null && text.trim().length > 0) {
      this.battleMessage = text;
      this.battleMessageCount = 20;
    }
  }

  /** Player.getAutoSkillCount: the filled auto-battle slots. */
  getAutoSkillCount(): number {
    return this.autoSkillID.filter((id) => id > 0).length;
  }

  isBattleStatus(bits: bigint): boolean {
    return (bits & this.bStatus) !== 0n;
  }

  setBattleStatus(bits: bigint): boolean {
    this.bStatus |= bits;
    return true;
  }

  clearBattleStatus(bits: bigint): void {
    this.bStatus &= ~bits;
  }

  isDead(): boolean {
    return this.get(2) <= 0;
  }

  /** Dead but held up by the delayed-death status (29) that has not fired yet. */
  isDeadDelay(): boolean {
    return this.isBattleStatus(getBufferBitValue(29)) && !this.isTabStatus(TAB_DIE_DELAY_DONE);
  }

  isDeadNoWithDelay(): boolean {
    return this.isDead() && !this.isDeadDelay();
  }

  isHaveCanNotReliveBuffer(): boolean {
    return this.battleBufferList?.some((b) => b.isCannotReliveStatus()) ?? false;
  }

  /** Player.getbuffer: the last buffer with status `status`. */
  getbuffer(status: number): Buffer | null {
    const list = this.battleBufferList;
    if (list == null) return null;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].getStatus() !== 0 && list[i].getStatus() === status) return list[i];
    return null;
  }

  /** Player.checkBufferSize: at most 3 statuses of one kind; a new death status replaces the old. */
  private checkBufferSize(b: Buffer): void {
    if (b.getStatus() === 0) return;
    const list = this.battleBufferList!;
    let dropped = 0;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (o == null || o.getStatus() === 0) continue;
      if (b.isDieStatus() && o.isDieStatus()) {
        this.clearBattleStatus(getBufferBitValue(o.getStatus()));
        o.destroy(this);
        list.splice(i, 1);
      } else if (getBufferType(o.getStatus()) === getBufferType(b.getStatus()) && ++n >= 3) {
        dropped = o.getStatus();
        o.destroy(this);
        list.splice(i, 1);
        break;
      }
    }
    if (dropped !== 0 && !list.some((o) => o.getStatus() === dropped)) this.clearBattleStatus(getBufferBitValue(dropped));
  }

  /** Player.addBuffer: a status-clearing buffer goes first; others set their status bit. */
  addBuffer(b: Buffer | null): void {
    if (b == null) return;
    this.battleBufferList ??= [];
    if (b.isClearStatusBitBuffer()) {
      this.battleBufferList.unshift(b);
      return;
    }
    const ok = this.setBattleStatus(getBufferBitValue(b.getStatus()));
    if (!ok) b.clearStatus();
    else this.checkBufferSize(b);
    this.battleBufferList.push(b);
    if (ok) this.setBattleStatus(getBufferBitValue(b.getStatus()));
  }

  /** Player.clearBufferList: ends the buffers (the no-revive one only when `all`). */
  clearBufferList(all: boolean): void {
    const list = this.battleBufferList;
    if (list == null) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b != null && (all || !b.isCannotReliveStatus())) {
        b.destroy(this);
        list.splice(i, 1);
        this.clearBattleStatus(getBufferBitValue(b.getStatus()));
      }
    }
    if (list.length <= 0) this.battleBufferList = null;
  }

  /** Player.removeBufferByStatus: ends the buffers of a status (25 / 26: of a kind). */
  removeBufferByStatus(status: number): void {
    const list = this.battleBufferList;
    if (list == null) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b != null && b.isSameStatusType(status)) {
        b.destroy(this);
        list.splice(i, 1);
        this.clearBattleStatus(getBufferBitValue(b.getStatus()));
      }
    }
  }

  /**
   * Player.runBufferList: `tick` runs each buffer for a round (HP / MP over time; a clearing
   * buffer finishes the statuses it clears), otherwise the finished ones are removed. Returns the
   * effect controls of the round.
   */
  runBufferList(tick: boolean): Control[] | null {
    if (this.battleBufferList == null) return null;
    const out: Control[] = [];
    const done: Buffer[] = [];
    for (let i = 0; i < this.battleBufferList.length; i++) {
      const b = this.battleBufferList[i];
      if (b == null) continue;
      if (tick) {
        b.run(this, out);
        if (this.battleBufferList == null) return out;
        if (b.isClearStatusBitBuffer()) {
          for (let j = i + 1; j < this.battleBufferList.length; j++) {
            const o = this.battleBufferList[j];
            if (o != null && o.isSameStatusType(b.getAddValue())) {
              o.finish();
              done.push(o);
            }
          }
        }
      } else if (b.getLastTime() <= 0) {
        done.push(b);
      }
    }
    if (done.length <= 0) return out;
    for (const b of done) {
      b.destroy(this);
      const k = this.battleBufferList.indexOf(b);
      if (k >= 0) this.battleBufferList.splice(k, 1);
      this.clearBattleStatus(getBufferBitValue(b.getStatus()));
    }
    for (const b of this.battleBufferList) if (b != null) this.setBattleStatus(getBufferBitValue(b.getStatus()));
    return out;
  }

  /** Player.doKeepAtkTime: one blocked hit uses up a keep-out charge. */
  doKeepAtkTime(): void {
    this.addValue(250, -1);
    const list = this.battleBufferList;
    if (list == null) return;
    for (let i = list.length - 1; i >= 0; i--) if (list[i]?.useKeeAtkTime()) return;
  }

  /** Player.resetBattleBuffer: clears statuses, buffers and battle modifiers. */
  resetBattleBuffer(): void {
    this.bStatus = 0n;
    this.battleBufferList = null;
    this.argo = 0;
    this.hpMax = 0;
    this.mpMax = 0;
    for (const [field] of Object.values(BATTLE_MODIFIERS)) this[field] = 0;
    this.recovery = 0;
    this.setTabStatus(false, TAB_REBORN_1HP_DONE);
    this.setTabStatus(false, TAB_REBORN_DONE);
    this.setTabStatus(false, TAB_DIE_DELAY_DONE);
  }

  /** Player.resumeHPMP: full HP and MP. */
  resumeHPMP(): void {
    this.set(2, this.get(29));
    this.set(3, this.get(30));
  }

  /** Player.checkHPMP: HP / MP no higher than their maxima. */
  checkHPMP(): void {
    if (this.get(2) > this.get(29)) this.set(2, this.get(29));
    if (this.get(3) > this.get(30)) this.set(3, this.get(30));
  }

  /** Player.getAttackType: the skill's attack type, else the weapon's (get(32)). */
  getAttackType(s: Skill | null): number {
    return s != null && s !== Skill.DUMMY ? s.get(1) : this.get(32);
  }

  /** Player.getAttackRangeAnime: crossbows shoot (anime 1301). */
  getAttackRangeAnime(): number {
    const t = this.getEquipWeaponType();
    return t !== 21 && t !== 22 ? 0 : 1301;
  }

  /** Player.getAttakAnimePos: 1 = runs up to the target, 0 = attacks from its place. */
  getAttakAnimePos(): number {
    const t = this.getEquipWeaponType();
    return t !== 21 && t !== 22 && t !== 23 && t !== 19 && t !== 34 && t !== 35 && t !== 36 && t !== 39 ? 1 : 0;
  }

  /** Player.addFightPower / clearFightPower: powers of the fight (formation, team…). */
  addFightPower(power: number, value: number): void {
    this.fightPowerList.push([power, value]);
  }
  clearFightPower(): void {
    this.fightPowerList = [];
  }

  getLevel(): number {
    return this.get(ATTR_LEVEL);
  }

  /** Model.getClientUid(false): the area-coded id shown to players (Define.getAreaID, simplified). */
  getClientUid(): string {
    return `${this.getId()}`;
  }

  /** "base(+bonus)" as in Player.getAttDesc. */
  static getAttDesc(base: number, total: number): string {
    const d = total - base;
    return d > 0 ? `${base}(+${d})` : d < 0 ? `${base}(${d})` : `${base}`;
  }

  /** Auto-walk to a quest target (Player.autoMoveControlList) is not ported yet. */
  isAutoMove(): boolean {
    return false;
  }
}
