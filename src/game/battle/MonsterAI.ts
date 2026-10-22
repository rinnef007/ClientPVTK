// com.hz.battle.MonsterAI (1.2.0, Vineflower decompile): a monster's conditions (HP %, chance,
// round, players left), the skills it uses when one holds, the line it says and its target, plus
// the shared target pickers Battle uses for pets, confusion and auto skills.
import type { Monster } from '../actor/Monster';
import type { Player } from '../actor/Player';
import { idiv } from '../actor/PlayerStats';
import type { Skill } from '../core/Skill';
import type { Message } from '../../net/Message';
import type { Battle } from './Battle';

export const TARGET_ESCAPE = 100;

/** GameWorld.getSkillById: the skill of that id and level in the list. */
function getSkillById(list: Skill[], id: number, level: number): Skill | null {
  return list.find((s) => s.id === id && s.level === level) ?? null;
}

export class MonsterAI {
  id = 0;
  conType: number[] = [];
  conValue: number[] = [];
  msg: string[] = [];
  skill1: (Skill | null)[] = [];
  skill2: (Skill | null)[] = [];
  targetType: number[] = [];
  targetPos = 0;

  /** MonsterAI.fromBytes, its skills looked up in the AI skill list sent before. */
  static fromBytes(m: Message, skills: Skill[]): MonsterAI {
    const ai = new MonsterAI();
    ai.id = m.getShort();
    for (let i = 0, n = m.getByte(); i < n; i++) {
      ai.conType.push(m.getByte());
      ai.conValue.push(m.getInt());
      ai.msg.push(m.getString());
      ai.skill1.push(getSkillById(skills, m.getShort() & 0xffff, m.getByte()));
      ai.skill2.push(getSkillById(skills, m.getShort() & 0xffff, m.getByte()));
      ai.targetType.push(m.getByte());
    }
    return ai;
  }

  /** One of the condition's two skills (a coin toss when both are set). */
  private getConSkill(b: Battle, i: number): Skill | null {
    const a = this.skill1[i] ?? null;
    const c = this.skill2[i] ?? null;
    if (a != null && c != null) return (b.random.nextInt() & 1) === 0 ? a : c;
    return a ?? c;
  }

  private isValidConAI(b: Battle, m: Monster, i: number): boolean {
    const v = this.conValue[i];
    switch (this.conType[i]) {
      case 0: return true;
      case 1: return idiv(m.get(2) * 100, m.get(29)) < v;
      case 2: return idiv(m.get(2) * 100, m.get(29)) > v;
      case 3: return b.randInt(100) < v;
      case 4: return v <= b.round;
      case 5: // enemies left
      case 6: { // allies left
        const enemy = this.conType[i] === 5;
        const left = isLeftSide(m.position);
        const [from, to] = left === enemy ? [20, 34] : [0, b.getLeftPosNum()];
        return v <= b.getActivePlayerNum(from, to, false);
      }
      default: return false;
    }
  }

  private selectAttackTarget(b: Battle, m: Monster, i: number): number {
    if (i < 0 || i >= this.targetType.length) return -1;
    const t = this.targetType[i];
    if (t >= 1 && t <= 6) return MonsterAI.selectValueTarget(b, m, t, true);
    if (t >= 7 && t <= 10) return MonsterAI.selectValueTarget(b, m, t, false);
    switch (t) {
      case 11: return MonsterAI.selectRandTarget(b, m, true);
      case 12: return MonsterAI.selectRandTarget(b, m, false);
      case 13: return m.position;
      case 14: return MonsterAI.selectRandDeadFriend(b, m);
      case 15: return MonsterAI.selectRandActivePlayer(b, m);
      case 16: return TARGET_ESCAPE;
      default: return -1;
    }
  }

  /** MonsterAI.getAutoSkill: the first support skill (type 2) whose condition holds and is affordable. */
  getAutoSkill(b: Battle, m: Monster): Skill | null {
    m.message = null;
    for (let i = 0; i < this.conType.length; i++) {
      if (!this.isValidConAI(b, m, i)) continue;
      const s = this.getConSkill(b, i);
      if (s != null && s.type === 2 && s.useMP <= m.get(3) && s.isEnoughHP(m)) {
        m.message = this.msg[i];
        return s;
      }
    }
    return null;
  }

  /** MonsterAI.getBattleSkill: the first holding condition's attack skill (or none) and target. */
  getBattleSkill(b: Battle, m: Monster): Skill | null {
    this.targetPos = -1;
    m.message = null;
    for (let i = 0; i < this.conType.length; i++) {
      if (!this.isValidConAI(b, m, i)) continue;
      const s = this.getConSkill(b, i);
      if (s == null || s.type !== 2) {
        this.targetPos = this.selectAttackTarget(b, m, i);
        m.message = this.msg[i];
        return s;
      }
    }
    return null;
  }

  /** A random living fighter other than `p` (confusion). */
  static selectRandActivePlayer(b: Battle, p: Player): number {
    const list: number[] = [];
    for (let i = 0; i < 34; i++) {
      const o = b.getPlayerByPos(i);
      if (b.isValidBattlePlayer(o) && o!.position !== p.position) list.push(o!.position);
    }
    if (list.length <= 0) return 0;
    if (list.length === 1) return list[0];
    return list[b.randRange(0, list.length - 1)];
  }

  /** A random dead ally (to revive). */
  static selectRandDeadFriend(b: Battle, p: Player): number {
    const [from, to] = isLeftSide(p.position) ? [0, b.getLeftPosNum()] : [20, 34];
    const list: number[] = [];
    for (let i = from; i < to; i++) {
      const o = b.getPlayerByPos(i);
      if (o != null && !o.isBattleStatus(1n) && o.isDead()) list.push(o.position);
    }
    if (list.length <= 0) return from;
    if (list.length === 1) return list[0];
    return list[b.randRange(0, list.length - 1)];
  }

  /** A random living enemy (`enemy`) or ally. */
  static selectRandTarget(b: Battle, p: Player, enemy: boolean): number {
    const [from, to] = enemy !== isLeftSide(p.position) ? [0, b.getLeftPosNum()] : [20, 34];
    const list: number[] = [];
    for (let i = from; i < to; i++) {
      const o = b.getPlayerByPos(i);
      if (b.isValidBattlePlayer(o)) list.push(o!.position);
    }
    if (list.length <= 0) return from;
    if (list.length === 1) return list[0];
    return list[b.randRange(0, list.length - 1)];
  }

  /**
   * MonsterAI.selectValueTarget: the enemy (`enemy`) or ally with the lowest (odd kinds) or highest
   * (even kinds) hate (1, 2), HP (3, 4, 7, 8) or speed (5, 6, 9, 10).
   */
  static selectValueTarget(b: Battle, p: Player, kind: number, enemy: boolean): number {
    const [from, to] = enemy !== isLeftSide(p.position) ? [0, b.getLeftPosNum()] : [20, 34];
    let best = -1;
    let bestValue = -1;
    for (let i = from; i < to; i++) {
      const o = b.getPlayerByPos(i);
      if (!b.isValidBattlePlayer(o)) continue;
      let v = 0;
      if (kind === 1 || kind === 2) v = o!.get(63);
      else if (kind === 3 || kind === 4 || kind === 7 || kind === 8) v = o!.get(2);
      else if (kind === 5 || kind === 6 || kind === 9 || kind === 10) v = o!.get(31);
      if (bestValue === -1) {
        best = i;
        bestValue = v;
      }
      const low = kind === 1 || kind === 3 || kind === 5 || kind === 7 || kind === 9;
      if (low ? v < bestValue : v > bestValue) {
        best = i;
        bestValue = v;
      }
    }
    return best;
  }
}

/** Battle.isLeftSide: positions 0–19. */
function isLeftSide(pos: number): boolean {
  return pos < 20;
}
