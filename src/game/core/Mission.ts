// The parts of com.hz.core.Mission and com.hz.core.Condition (Vineflower decompile; Condition's
// getConditionDesc only as bytecode) that the mission list and details read. In the game the
// server sends missions as bytes (Mission.fromBytes) and each condition keeps its raw data; here
// a condition holds its already-decoded fields. Only the "kill monsters" (2) and "have item" (7)
// conditions are ported — the others (level, money, map, buffs, city / country…) are not.
import type { Player } from '../actor/Player';
import { PowerString } from '../string/PowerString';
import { isNullText } from '../common/Tool';

export const CONDITION_KILL_MONSTER = 2;
export const CONDITION_HAVE_ITEM = 7;

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
    return true;
  }
}

export class Mission {
  name = '';
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

  constructor(private readonly id: number) {}

  getId(): number {
    return this.id;
  }

  isRandomMission(): boolean {
    return (this.setting & MISSION_IS_RANDOM) > 0;
  }

  isComplete(p: Player | null): boolean {
    return this.submitCondition == null || this.submitCondition.every((c) => c.isConditionOfSatisfy(p));
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
