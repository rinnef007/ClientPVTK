// com.hz.actor.Player: world movement plus the data the UI screens read (bag, money, stats).
import type { Mission } from '../core/Mission';
import type { Skill } from '../core/Skill';
import type { Talent } from '../core/Talent';
import type { PlayerBag } from './Item';
import { Model, TYPE_PLAYER } from './Model';

const MISSION_SLOTS = 10;

/** Model.get(index) attribute ids used by the screens (Model.getValue in Java). */
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

  constructor(type = TYPE_PLAYER) {
    super(type);
  }

  get(id: number): number {
    return this.values.get(id) ?? 0;
  }

  set(id: number, v: number): void {
    this.values.set(id, v);
  }

  addValue(id: number, d: number): void {
    this.set(id, this.get(id) + d);
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
