// The parts of com.hz.core.Mission and com.hz.core.Condition (Vineflower decompile; Condition's
// getConditionDesc only as bytecode) that the mission list and details read. In the game the
// server sends missions as bytes (Mission.fromBytes) and each condition keeps its raw data; here
// a condition holds its already-decoded fields. Only the "kill monsters" (2) and "have item" (7)
// conditions are ported — the others (level, money, map, buffs, city / country…) are not.
// The NPC side (status per NPC, visibility, the finished-mission bitset) follows Mission.java for
// ordinary maps only: city / country / mirror maps, escort and guide missions are not ported.
import { Item } from '../actor/Item';
import type { Player } from '../actor/Player';
import { PowerString } from '../string/PowerString';
import { isNullText } from '../common/Tool';
import { DataInputStream } from '../common/DataStream';

export const CONDITION_KILL_MONSTER = 2;
export const CONDITION_HAVE_ITEM = 7;
/** "Mission `itemId` finished" (Condition.isConditionOfSatisfy case 9 → Mission.isMissionFinish). */
export const CONDITION_MISSION_FINISHED = 9;
/** "Be on map `itemId`" (case 12 → GameWorld.getCurMapID). */
export const CONDITION_MAP = 12;

/** Mission.setting bit for random ("challenge") missions. */
export const MISSION_IS_RANDOM = 2097152;

export class Condition {
  constructor(
    readonly type: number,
    /** Monster / item name. */
    readonly name: string,
    /** How many are needed. */
    readonly need: number,
    /** Kill count so far (type 2; the server updates it). */
    public done = 0,
    /** Item id (type 7). */
    readonly itemId = 0,
  ) {}

  /** GameWorld.getCurMapID for the map condition (Mission does not import the world). */
  static curMapId: () => number = () => 0;

  /**
   * Condition.fromBytes (1.2.0): type, "not" flag, then the raw data, decoded here for the types the
   * web client checks — 2 (monster id, name, need, done), 7 (item id, name, need), 9 / 12 (mission or
   * map id, name). Other types keep only their type and are treated as met.
   */
  static fromBytes(dis: DataInputStream): Condition {
    const type = dis.readByte();
    dis.readByte(); // not
    const raw = new Uint8Array(dis.readByte() & 0xff);
    for (let i = 0; i < raw.length; i++) raw[i] = dis.readByte() & 0xff;
    const d = new DataInputStream(raw);
    try {
      if (type === CONDITION_KILL_MONSTER) {
        const monster = d.readShort();
        const name = d.readUTF();
        const need = d.readByte();
        return new Condition(type, name, need, d.readByte(), monster);
      }
      if (type === CONDITION_HAVE_ITEM) {
        const id = d.readInt();
        const name = d.readUTF();
        return new Condition(type, name, d.readByte(), 0, id);
      }
      if (type === CONDITION_MISSION_FINISHED || type === CONDITION_MAP) {
        const id = d.readShort();
        return new Condition(type, d.readUTF(), 1, 0, id);
      }
    } catch {
      // Short data: keep the type only, like an unknown condition.
    }
    return new Condition(type, '', 0);
  }

  /** Condition.updateKilledMonsterNum: kills of this condition's monster (at most 127), with a line for the reward text. */
  updateKilledMonsterNum(monsterId: number, n: number, out: string[] | null): void {
    if (this.type !== CONDITION_KILL_MONSTER || this.itemId !== monsterId) return;
    this.done = Math.min(127, this.done + n);
    out?.push(`${PowerString.makeColorString('Nhiệm vụ: ', 16776960)}${this.name} ${PowerString.makeColorString(String(this.done), this.done >= this.need ? 65280 : 16711680)}/${this.need}\n`);
  }

  private progress(p: Player | null): number {
    if (this.type === CONDITION_HAVE_ITEM) return p?.bag?.getItemNumByIdInBag(this.itemId) ?? 0;
    return this.done;
  }

  /** "Hủy diệt <name> n/need" or "Nhận được <name> n/need" (count capped at need, in red). */
  getConditionDesc(p: Player | null): string {
    const n = Math.min(this.progress(p), this.need);
    const head = this.type === CONDITION_KILL_MONSTER ? 'Hủy diệt' : this.type === CONDITION_HAVE_ITEM ? 'Nhận được' : '';
    if (head === '') return '';
    return `${head}${PowerString.makeColorString(this.name, 16776960)}${PowerString.makeColorString(`${n}/${this.need}`, 16711680)}`;
  }

  isConditionOfSatisfy(p: Player | null): boolean {
    if (p == null) return false;
    if (this.type === CONDITION_KILL_MONSTER || this.type === CONDITION_HAVE_ITEM) return this.progress(p) >= this.need;
    if (this.type === CONDITION_MISSION_FINISHED) return Mission.isMissionFinish(p, this.itemId);
    if (this.type === CONDITION_MAP) return Condition.curMapId() === this.itemId;
    return true;
  }
}

/** getMissionStatus: goals met (submit), in progress, can accept, cannot accept yet. */
export const STATUS_SUBMIT = 0;
export const STATUS_DOING = 1;
export const STATUS_ACCEPT = 2;
export const STATUS_NOT_READY = 3;

/** What Mission reads of an NPC (kept structural so Mission does not import the actor). */
export interface MissionNpc {
  getId(): number;
}

export class Mission {
  name = '';
  /** Lowest level to accept. */
  level = 0;
  /** The map and NPC that give and take the mission (Mission.mapId / npcId). */
  mapId = 0;
  npcId = 0;
  dialogNotStartNotReady = '';
  desc = '';
  simpleDesc = '';
  dialogStartNotFinish = '';
  dialogStartFinish = '';
  setting = 0;
  exp = 0;
  money2 = 0;
  money3 = 0;
  honor = 0;
  submitCondition: Condition[] | null = null;

  /** Mission.updateKillMission. */
  updateKillMission(monsterId: number, n: number, out: string[] | null): void {
    for (const c of this.submitCondition ?? []) c?.updateKilledMonsterNum(monsterId, n, out);
  }
  acceptCondition: Condition[] | null = null;
  /** Offered right after this one is handed in (doSubmitEndCheck). */
  submitNextMissionID = 0;
  /** Where the mission radar points (Mission.radarMapID / radarGx / radarGy). */
  radarMapID = 0;
  radarGx = 0;
  radarGy = 0;
  /** Items given on hand-in (Item.fromMissionBytes: id, count, name, icon, grade). */
  rewardItems: Item[] = [];

  constructor(private readonly id: number) {}

  /**
   * Mission.fromBytes (1.2.0, jadx decompile). The city / country rewards, jump and battle ids and
   * the escort deposit are read past; reward items to choose are read like the fixed ones.
   */
  static fromBytes(data: Uint8Array): Mission {
    const dis = new DataInputStream(data);
    const m = new Mission(dis.readShort());
    m.name = dis.readUTF();
    m.level = dis.readByte();
    m.simpleDesc = dis.readUTF();
    m.desc = dis.readUTF();
    m.setting = dis.readShort() & 0xffff;
    m.mapId = dis.readShort();
    m.npcId = dis.readByte();
    m.radarMapID = dis.readShort();
    if (m.radarMapID > 0) {
      m.radarGx = dis.readByte();
      m.radarGy = dis.readByte();
    }
    m.dialogNotStartNotReady = dis.readUTF();
    m.dialogStartNotFinish = dis.readUTF();
    m.dialogStartFinish = dis.readUTF();
    m.exp = dis.readInt();
    m.money2 = dis.readShort();
    m.money3 = dis.readShort();
    if (m.setting & 512) {
      // isHaveSpecailReward: honour, then the country / city rewards.
      m.honor = dis.readShort();
      for (let i = 0; i < 9; i++) dis.readShort();
    }
    if (m.setting & 32768) dis.readShort(); // isHaveSpecailReward2: countryArmy
    if (m.setting & 1024) {
      // isHaveSpecailExecute: accept / submit jumps, battles, next mission.
      if (dis.readShort() > 0) (dis.readByte(), dis.readByte());
      if (dis.readShort() > 0) (dis.readByte(), dis.readByte());
      dis.readShort();
      dis.readShort();
      m.submitNextMissionID = dis.readShort();
    }
    if (m.setting & 64) {
      // isEscort: deposit in three moneys, then two bytes.
      for (let i = 0; i < 3; i++) dis.readInt();
      dis.readByte();
      dis.readByte();
    }
    const readItems = () => {
      const out: Item[] = [];
      for (let n = dis.readByte(); n > 0; n--) {
        const it = new Item();
        it.id = dis.readShort() & 0xffff;
        it.quantity = dis.readByte();
        it.name = dis.readUTF();
        it.bagIcon = dis.readByte() & 0xff;
        it.grade = dis.readByte();
        out.push(it);
      }
      return out;
    };
    m.rewardItems = readItems();
    readItems(); // selectItems: choosing a reward is not ported
    const readConditions = () => {
      const out: Condition[] = [];
      for (let n = dis.readByte(); n > 0; n--) out.push(Condition.fromBytes(dis));
      return out.length > 0 ? out : null;
    };
    m.acceptCondition = readConditions();
    m.submitCondition = readConditions();
    return m;
  }

  getId(): number {
    return this.id;
  }

  isRandomMission(): boolean {
    return (this.setting & MISSION_IS_RANDOM) > 0;
  }

  isComplete(p: Player | null): boolean {
    return this.submitCondition == null || this.submitCondition.every((c) => c.isConditionOfSatisfy(p));
  }

  /** Level and accept conditions. */
  isCanAccept(p: Player | null): boolean {
    if (p == null || this.level > p.getLevel()) return false;
    return this.acceptCondition == null || this.acceptCondition.every((c) => c.isConditionOfSatisfy(p));
  }

  getMissionStatus(p: Player): number {
    if (p.getMissionById(this.id) != null) return this.isComplete(p) ? STATUS_SUBMIT : STATUS_DOING;
    return this.isCanAccept(p) ? STATUS_ACCEPT : STATUS_NOT_READY;
  }

  /** isVisibleAndSubmit on an ordinary map: the mission belongs to this map and this NPC. */
  isVisibleAndSubmit(npc: MissionNpc | null, curMap: number): boolean {
    return npc != null && this.mapId === curMap && this.npcId === npc.getId();
  }

  /** The "finished" dialog, the met goals ("Xong：") and the rewards. */
  getSubmitDetails(p: Player | null): string {
    let s = `${this.dialogStartFinish}\n`;
    const cond = this.getConditionDesc(this.submitCondition, p);
    if (!isNullText(cond)) s += `${PowerString.makeColorString('Xong：', 16776960)}${cond}\n`;
    return s + this.getMissionRewardString();
  }

  /** Player.missionStatus: one bit per finished mission id. */
  static isMissionFinish(p: Player | null, id: number): boolean {
    const bits = p?.missionStatus;
    if (bits == null || id < 0) return false;
    const i = id >> 3;
    return i < bits.length && (bits[i] & (1 << (id % 8))) !== 0;
  }

  /**
   * Mission.checkPlayerMissionStatus: a menu entry's requirement. No mission (id ≤ 0) passes; bit 1
   * accepts it finished, 2 in progress, 4 complete but not handed in, 8 not taken (and not finished).
   */
  static checkPlayerMissionStatus(p: Player | null, id: number, state: number): boolean {
    if (id <= 0 || p == null) return true;
    if ((state & 1) !== 0 && Mission.isMissionFinish(p, id)) return true;
    const m = p.getMissionById(id);
    if (m != null) return m.isComplete(p) ? (state & 4) !== 0 : (state & 2) !== 0;
    return (state & 8) !== 0 && !Mission.isMissionFinish(p, id);
  }

  static setMissionStatus(p: Player | null, id: number, finished: boolean): void {
    const bits = p?.missionStatus;
    if (bits == null || id < 0 || id >> 3 >= bits.length) return;
    if (finished) bits[id >> 3] |= 1 << (id % 8);
    else bits[id >> 3] &= ~(1 << (id % 8));
  }

  /** A mission of the player's whose goals are met and that this NPC takes. */
  static isHaveSubmitMission(p: Player, npc: MissionNpc, curMap: number): boolean {
    return p.missionList.some((m) => m != null && m.isVisibleAndSubmit(npc, curMap) && m.isComplete(p));
  }

  getConditionDesc(conds: Condition[] | null, p: Player | null): string | null {
    if (conds == null) return null;
    const out: string[] = [];
    conds.forEach((c, i) => {
      const d = c.getConditionDesc(p);
      if (!isNullText(d)) out.push(i > 0 ? `\n${d}` : d);
    });
    return out.join('');
  }

  /** Name plus a green "[Xong]" when the goals are met. */
  getNameInfo(p: Player | null): string {
    return this.name + (this.isComplete(p) ? PowerString.makeColorString('[Xong]', 65280) : '');
  }

  /** The goal line, then the short description (or the "not finished" dialog). */
  getDoingDesc(simple: boolean, p: Player | null): string {
    let s = '';
    const cond = this.getConditionDesc(this.submitCondition, p);
    if (!isNullText(cond)) s += `${PowerString.makeColorString('Mục tiêu: ', 16776960)}${cond}\n`;
    s += `${simple ? this.simpleDesc : this.dialogStartNotFinish}\n`;
    return s;
  }

  /** Description, short description, goal and rewards (the "Chi tiết" text). */
  getDetails(withSimple: boolean, p: Player | null): string {
    let s = `${this.desc}\n`;
    if (withSimple && !isNullText(this.simpleDesc)) s += `(${PowerString.makeColorString(this.simpleDesc, 16776960)})\n`;
    s += '\n';
    const cond = this.getConditionDesc(this.submitCondition, p);
    if (!isNullText(cond)) s += `${PowerString.makeColorString('Mục tiêu: ', 16776960)}${cond}\n`;
    return s + this.getMissionRewardString();
  }

  /**
   * Exp, "Lá" (money2), "Bạc" (money3) and "Cống hiến" (honor). Not ported: the KNB argument, the
   * escort "(Chưa biết)" amount, the city / country rewards and the reward item lists.
   */
  getMissionRewardString(): string {
    let r = '';
    if (this.exp > 0) r += `Exp ${this.exp}  `;
    if (this.money2 > 0) r += `Lá${this.money2}  `;
    if (this.money3 > 0) r += `Bạc${this.money3}  `;
    if (this.honor > 0) r += `Cống hiến ${this.honor}  `;
    if (!isNullText(r)) r += '\n';
    return isNullText(r) ? '' : `${PowerString.makeColorString('Phần thưởng：', 16776960)}${r}`;
  }
}
