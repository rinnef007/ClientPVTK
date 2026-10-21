// com.hz.actor.Player: world movement plus the data the UI screens read (bag, money, stats).
import type { Mission } from '../core/Mission';
import type { Skill } from '../core/Skill';
import type { PlayerBag } from './Item';
import { Model, TYPE_PLAYER } from './Model';

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
  /** Auto-battle skill slots (skill ids, 0 = empty) and the auto-cast active skill. */
  autoSkillID: number[] = [];
  autoSkillID_Initiative = 0;
  /** Missions in progress (Player.missionList; null entries are empty slots). */
  missionList: (Mission | null)[] = [];

  /** Player.isAutoSkill: the skill's auto slot index, or -1. */
  isAutoSkill(id: number): number {
    return this.autoSkillID.indexOf(id);
  }

  /** Player.getSkillListByType. */
  static getSkillListByType(list: Skill[] | null, type: number): Skill[] | null {
    if (list == null || list.length === 0) return null;
    return list.filter((s) => s != null && s.type === type);
  }

  getPet(): Player | null {
    return this.pet;
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
