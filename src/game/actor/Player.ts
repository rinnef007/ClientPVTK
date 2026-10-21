// com.hz.actor.Player: world movement plus the data the UI screens read (bag, money, stats).
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
  /** Attribute values by id (sent by the server in the real game). */
  readonly values = new Map<number, number>();

  constructor() {
    super(TYPE_PLAYER);
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
