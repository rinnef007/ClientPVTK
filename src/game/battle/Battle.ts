// com.hz.battle.Battle (1.2.0, Vineflower decompile): the local battle rules. 34 positions — left
// 0–19 (monsters), right 20–33 (player 25, pet 24); each round every fighter acts by speed:
// players by their plan (attack, skill, item, escape), pets and monsters by AI. The results are
// Controls for the battle animation. The random numbers come from a seeded java.util.Random.
// Remote / PK battles and mercenaries are not ported.
import { Monster } from '../actor/Monster';
import { MyPet } from '../actor/MyPet';
import { TAB_DIE_DELAY_DONE, TAB_KEEPOUT_HIT, TAB_REBORN_1HP_DONE, TAB_REBORN_DONE, type Player } from '../actor/Player';
import { idiv, sumValue } from '../actor/PlayerStats';
import { JavaRandom } from '../common/JavaRandom';
import { getXKey, getYKey, setKeyXY } from '../common/Tool';
import { getBufferBitValue, getBufferType, getSearchTypeByArea, getSkillAreaPlayerNum, isPhysicalAtkType } from '../core/DefineBattle';
import type { MonsterGroup } from '../core/MonsterGroup';
import { Skill } from '../core/Skill';
import { Control } from '../main/Control';
import { addSystemChat } from '../main/WorldMessage';
import { processBattleHpMpPower, processBattlePower, processBattleReborn } from './BattlePower';
import { MonsterAI } from './MonsterAI';

export const MAX_POS = 34;
export const LEFT_MAX_POS = 20;
export const LOCAL_BATTLE_MY_POS = 25;
export const MAX_ROUND = 30;

export const PLAN_NONE = 0;
export const PLAN_ATTACK = 1;
export const PLAN_USE_SKILL = 2;
export const PLAN_USE_ITEM = 3;
export const PLAN_ESCAPE = 4;

export const RESULT_NONE = 0;
export const RESULT_LEFT_WIN = 1;
export const RESULT_RIGHT_WIN = 2;
export const RESULT_ROUND_OVER = 3;
export const RESULT_BOTH_LOSE = 4;

export const TYPE_LOCAL = 0;

/** Effect bits of a target-effect control (Control.counter). */
export const EFFECT_BLOCK = 1;
export const EFFECT_HIT = 2;
export const EFFECT_CRITICAL = 4;
export const EFFECT_DIE = 8;
export const EFFECT_REBORN = 16;
export const EFFECT_STUN = 32;
export const EFFECT_MP_CHANGE = 64;
export const EFFECT_DEF_FIELD = 128;
export const EFFECT_TOUCH = 256;
export const EFFECT_DIE_DELAY = 512;
export const EFFECT_HAS_ANIME = 1024;
export const EFFECT_KEEPOUT = 16384;

const FIRST_ROUND_PLAN_TIME = 60000;
const NORMAL_ROUND_PLAN_TIME = 40000;
/** Status bit 0: the fighter escaped. */
const ESCAPED = 1n;
const bit = getBufferBitValue;
const isEffectStatus = (v: number, f: number) => (v & f) !== 0;

export function getPositionSide(pos: number): number {
  return pos < 20 ? 1 : 2;
}
export function isLeftSide(pos: number): boolean {
  return getPositionSide(pos) === 1;
}
export function isSameSide(a: number, b: number): boolean {
  return getPositionSide(a) === getPositionSide(b);
}
/** Battle.getPositionColumn: 1 / 2 left back / front, 3 / 4 right front / back. */
export function getPositionColumn(pos: number): number {
  if (isLeftSide(pos)) return (pos & 1) === 0 ? 1 : 2;
  return (pos & 1) === 0 ? 3 : 4;
}
/** Battle.getPetOwnerPos: a pet's owner (else the fighter itself). */
export function getPetOwnerPos(p: Player | null): number {
  if (p == null) return -1;
  if (p instanceof MyPet && p.owner != null) return p.owner.position;
  return p.position;
}

/** Battle.getLeftRightTypeTarget: a position and the one beside it in its row. */
function getLeftRightTypeTarget(out: number[], pos: number): void {
  out.push(pos);
  out.push(pos % 2 === 0 ? pos + 1 : pos - 1);
}

/**
 * Battle.mergeControlList: joins numbers on the same target and anime into one (sums the value,
 * ors the effects) so a many-hit attack does not show every hit.
 */
function mergeControlList(list: Control[] | null, keepReborn: boolean): Control[] | null {
  if (list == null) return null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a == null) continue;
    const ea = a.counter;
    for (let j = list.length - 1; j > i; j--) {
      const b = list[j];
      if (b == null) continue;
      const eb = b.counter;
      if (
        a.int1 === b.int1 && (!keepReborn || !isEffectStatus(eb, EFFECT_REBORN))
        && isEffectStatus(ea, EFFECT_MP_CHANGE) === isEffectStatus(eb, EFFECT_MP_CHANGE)
        && (a.int0 >= 0 || b.int0 < 0) && (a.int0 < 0 || b.int0 >= 0)
      ) {
        const hit = isEffectStatus(ea, EFFECT_HIT);
        if (hit === isEffectStatus(eb, EFFECT_HIT) && (hit || isEffectStatus(ea, EFFECT_BLOCK) === isEffectStatus(eb, EFFECT_BLOCK))) {
          a.counter |= eb;
          a.int0 += b.int0;
          list.splice(j, 1);
        }
      }
    }
  }
  return list;
}

export class Battle {
  /** The attack type of the action being worked out (0–3 physical, 4 magic, 5 curse, 6 blessing). */
  atkType = 0;
  private block = 0;
  private guardHash = new Map<number, number>();
  private isLeftHand = true;
  isLeftHavePlayer = false;
  isRightHavePlayer = false;
  private monsterGroup: MonsterGroup | null = null;
  playerList: (Player | null)[] = new Array(MAX_POS).fill(null);
  private playerPlanData: (Uint8Array | null)[] = new Array(MAX_POS).fill(null);
  random = new JavaRandom();
  result = RESULT_NONE;
  resultControlList: Control[] = [];
  round = 0;
  roundEndTime = 0;
  private rowLeft = 5;
  private rowRight = 5;
  seed = 0;
  private totalHitTime = 1;
  private type = TYPE_LOCAL;
  waitStatus = 0;

  /** Battle.createLocalBattle: the fighters by position, the seed and the monster group. */
  static createLocalBattle(seed: number, list: (Player | null)[], group: MonsterGroup | null): Battle {
    const b = new Battle();
    b.type = TYPE_LOCAL;
    b.seed = seed;
    b.random.setSeed(seed);
    b.playerList = list;
    b.monsterGroup = group;
    b.initBattleRowNum();
    b.isLeftHavePlayer = b.isHavePlayer(0, 20);
    b.isRightHavePlayer = b.isHavePlayer(20, 34);
    b.round = 0;
    b.updateRoundEndTime();
    for (const p of list) if (p != null) p.keepout_atk_time = p.get(250);
    return b;
  }

  getType(): number {
    return this.type;
  }
  getMonsterGroup(): MonsterGroup | null {
    return this.monsterGroup;
  }

  // ---- random numbers ----

  /** Battle.randInt: Math.abs(nextInt()) % n (Java keeps MIN_VALUE negative). */
  randInt(n: number): number {
    const v = this.random.nextInt();
    return (v === -2147483648 ? v : Math.abs(v)) % n;
  }

  randRange(a: number, b: number): number {
    return a === b ? a : a + this.randInt(b - a + 1);
  }

  // ---- positions ----

  isValidPos(pos: number): boolean {
    return pos >= 0 && pos < MAX_POS;
  }

  /** Battle.isValidPos(side of `ref`, pos): pos lies on the used part of ref's side. */
  isValidPosOnSide(ref: number, pos: number): boolean {
    const [from, to] = isLeftSide(ref) ? [0, this.rowLeft * 2] : [20, 34];
    return pos >= from && pos < to;
  }

  getPlayerByPos(pos: number): Player | null {
    return this.isValidPos(pos) ? this.playerList[pos] ?? null : null;
  }

  /** Battle.getPlayerPet: the pet beside a player (towards the middle). */
  getPlayerPet(pos: number): Player | null {
    const p = this.getPlayerByPos(pos);
    if (p == null || p.getType() !== 3) return null;
    const pet = this.getPlayerByPos(isLeftSide(pos) ? pos + 1 : pos - 1);
    return pet != null && pet.getType() === 4 ? pet : null;
  }

  getRowLeft(): number {
    return this.rowLeft;
  }
  getRowRight(): number {
    return this.rowRight;
  }
  getLeftPosNum(): number {
    return this.rowLeft * 2;
  }
  getRightPosNum(): number {
    return this.rowRight * 2;
  }

  /** Rows used on each side: 5 to 10, from the furthest fighter. */
  private initBattleRowNum(): void {
    this.rowLeft = 5;
    this.rowRight = 5;
    for (let i = 0; i < MAX_POS; i++) {
      if (this.getPlayerByPos(i) == null) continue;
      if (isLeftSide(i)) this.rowLeft = Math.max(this.rowLeft, idiv(i, 2) + 1);
      else this.rowRight = Math.max(this.rowRight, idiv(i - 20, 2) + 1);
    }
    this.rowLeft = Math.min(this.rowLeft, 10);
    this.rowRight = Math.min(this.rowRight, 10);
  }

  isHavePlayer(from: number, to: number): boolean {
    for (let i = from; i < to; i++) if (this.getPlayerByPos(i)?.getType() === 3) return true;
    return false;
  }

  isValidBattlePlayer(p: Player | null): boolean {
    return p != null && !p.isDeadNoWithDelay() && !p.isBattleStatus(ESCAPED);
  }

  /** Living fighters in [from, to) (only players when `playersOnly`). */
  getActivePlayerNum(from: number, to: number, playersOnly: boolean): number {
    let n = 0;
    for (let i = from; i < to; i++) {
      const p = this.getPlayerByPos(i);
      if (p == null || (playersOnly && p.getType() !== 3)) continue;
      if (this.isValidBattlePlayer(p)) n++;
    }
    return n;
  }

  countNotNullPlayerPos(list: number[] | null): number {
    if (list == null) return 0;
    return list.filter((pos) => this.isValidBattlePlayer(this.getPlayerByPos(pos))).length;
  }

  getLevelIncludeLevel2(p: Player): number {
    return p.get(106) + p.get(118);
  }

  // ---- plans and rounds ----

  getPlanData(pos: number): Uint8Array | null {
    return pos >= 0 && pos < this.playerPlanData.length ? this.playerPlanData[pos] : null;
  }

  setPlan(pos: number, plan: Uint8Array | null): void {
    if (plan != null && pos >= 0 && pos < this.playerPlanData.length) this.playerPlanData[pos] = plan;
  }

  clearPlan(pos: number): void {
    if (pos >= 0 && pos < this.playerPlanData.length) this.playerPlanData[pos] = null;
  }

  setWaitStatus(pos: number): void {
    this.waitStatus |= 1 << pos;
  }
  clearWaitStatus(pos: number): void {
    this.waitStatus &= ~(1 << pos);
  }
  isWaitStatus(pos: number): boolean {
    return (this.waitStatus & (1 << pos)) !== 0;
  }

  updateRoundEndTime(): void {
    this.roundEndTime = Date.now() + (this.round === 0 ? FIRST_ROUND_PLAN_TIME : NORMAL_ROUND_PLAN_TIME);
  }

  /** Utilities.getPlanTime: ms left to choose. */
  getPlanTime(): number {
    return this.roundEndTime - Date.now();
  }

  isBattleFinish(): boolean {
    return this.result !== RESULT_NONE;
  }

  setBattleResult(r: number): void {
    this.result = r;
  }

  /** Battle.updateBattleResult: a side with nobody standing loses; 30 rounds end the fight. */
  updateBattleResult(): void {
    const left = this.getActivePlayerNum(0, this.getLeftPosNum(), this.isLeftHavePlayer);
    const right = this.getActivePlayerNum(20, 34, this.isRightHavePlayer);
    if (left <= 0 && right <= 0) this.result = RESULT_BOTH_LOSE;
    else if (left <= 0) this.result = RESULT_RIGHT_WIN;
    else if (right <= 0) this.result = RESULT_LEFT_WIN;
    else if (this.round >= MAX_ROUND) this.result = RESULT_ROUND_OVER;
  }

  addAniControl(c: Control | null): void {
    if (c != null) this.resultControlList.push(c);
  }

  cleanAniControlList(): void {
    this.resultControlList = [];
  }

  /** Fighters, fastest first (a stable insertion by get(31)). */
  private sortModelListBySpeed(): Player[] {
    const out: Player[] = [];
    for (const p of this.playerList) {
      if (p == null) continue;
      let i = 0;
      while (i < out.length && !(p.get(31) > out[i].get(31))) i++;
      out.splice(i, 0, p);
    }
    return out;
  }

  /**
   * Battle.logicRound: buffers tick, HP / MP recover, auto skills, then every fighter acts by
   * speed (its plan, else pet / monster AI); buffers end, the round counter and result update.
   */
  logicRound(): void {
    this.guardHash.clear();
    this.cleanAniControlList();
    this.doRoundBuffer();
    let list = this.sortModelListBySpeed();
    for (const p of list) this.doRoundHpMp(p);
    for (const p of list) this.doAutoSkill(p);
    list = this.sortModelListBySpeed();
    for (const p of list) {
      const plan = this.getPlanData(p.position);
      const done = plan != null && this.doPlayerPlan(p, plan);
      if (!done && p.getType() !== 3) {
        if (p.getType() === 4) this.doPetAI(p);
        else if (p instanceof Monster) this.doMonsterAI(p);
      }
    }
    this.doEndRoundCheckBuffer();
    this.round++;
    this.updateRoundEndTime();
    this.waitStatus = 0;
    this.updateBattleResult();
  }

  /** Battle.doPlayerPlan: plan bytes = kind, then target (and skill id / item slot). */
  private doPlayerPlan(p: Player, plan: Uint8Array): boolean {
    const dv = new DataView(plan.buffer, plan.byteOffset, plan.byteLength);
    try {
      const kind = dv.getInt8(0);
      switch (kind) {
        case PLAN_NONE:
          return false;
        case PLAN_ATTACK:
          this.doAttak(p, dv.getInt8(1));
          break;
        case PLAN_USE_SKILL:
          this.doUseSkillById(p, dv.getUint16(2), dv.getInt8(1));
          break;
        case PLAN_USE_ITEM:
          this.doUseItem(p, dv.getInt8(2), dv.getInt8(1));
          break;
        case PLAN_ESCAPE:
          this.doEscape(p);
          break;
      }
      return true;
    } catch {
      return false;
    }
  }

  private doRoundBuffer(): void {
    for (const p of this.playerList) {
      if (p == null) continue;
      if (p.isDeadNoWithDelay()) {
        if (p.isHaveCanNotReliveBuffer()) p.runBufferList(true);
      } else if (!p.isBattleStatus(ESCAPED)) {
        const list = mergeControlList(p.runBufferList(true), true);
        if (list != null) for (const c of list) this.addAniControl(c);
      }
    }
  }

  /** Battle.doRoundHpMp: HP / MP regeneration (none while burning / bleeding / poisoned). */
  private doRoundHpMp(p: Player): void {
    const hp = p.get(60);
    const mp = p.get(61);
    const out: Control[] = [];
    if (hp > 0 && !p.isBattleStatus(bit(2)) && !p.isBattleStatus(bit(3))) processBattleHpMpPower(p, 2, hp, 0, out);
    if (mp > 0 && !p.isBattleStatus(bit(1))) processBattleHpMpPower(p, 3, mp, 0, out);
    for (const c of out) this.addAniControl(c);
  }

  private doAutoSkill(p: Player): void {
    if (p instanceof Monster) {
      const s = p.getSkillByAI(this, true);
      if (s != null) this.doUseSkill(p, s, this.searchAICursor(p, s.area));
      return;
    }
    const id = this.getAutoSkillIDByRound(p);
    if (id >= 0) {
      const s = p.getSkillByID(id);
      if (s != null) this.doUseSkillById(p, id, this.searchAICursor(p, s.area));
    }
  }

  /** The auto-battle slot used this round (they take turns). */
  private getAutoSkillIDByRound(p: Player): number {
    if (p.autoSkillID == null) return -2;
    const n = p.getAutoSkillCount();
    if (n <= 0) return -3;
    const i = this.round % n;
    return i >= 0 && i < p.autoSkillID.length ? p.autoSkillID[i] : -1;
  }

  /**
   * Battle.doEndRoundCheckBuffer: deaths trigger revive (28) and delayed death (29); finished
   * buffers end and will may shake off a harmful status.
   */
  private doEndRoundCheckBuffer(): void {
    const out: Control[] = [];
    for (const p of this.playerList) {
      if (p == null) continue;
      const noRelive = p.isHaveCanNotReliveBuffer();
      if (p.isDead()) {
        if (!p.isTabStatus(TAB_REBORN_DONE) && p.isBattleStatus(bit(28))) {
          if (!noRelive) {
            p.setTabStatus(true, TAB_REBORN_DONE);
            processBattleReborn(p, p.get(29), 0, 1215, out);
            continue;
          }
        } else if (p.isDeadDelay()) {
          p.setTabStatus(true, TAB_DIE_DELAY_DONE);
          out.push(Control.createBattleTargetEffect(p.position, 0, EFFECT_DIE_DELAY, 0));
          p.clearBufferList(false);
          if (noRelive) p.runBufferList(false);
          continue;
        }
      }
      if (!p.isDead() && !p.isBattleStatus(ESCAPED)) {
        p.runBufferList(false);
        this.doCheckWilBufferRemove(p);
      } else {
        p.clearBufferList(false);
        if (noRelive) p.runBufferList(false);
      }
    }
    for (const c of out) this.addAniControl(c);
  }

  /** Battle.doCheckWilBufferRemove: will may end one random harmful status. */
  doCheckWilBufferRemove(p: Player): void {
    const list = p.battleBufferList;
    if (list == null || list.length <= 0) return;
    const bad = list.filter((b) => b != null && b.getStatus() !== 0 && getBufferType(b.getStatus()) === 26);
    if (bad.length <= 0 || !this.isWilSuccess(p, null, null)) return;
    const k = this.randRange(0, bad.length - 1);
    const b = bad[k];
    if (b == null) return;
    b.destroy(p);
    list.splice(list.indexOf(b), 1);
    bad.splice(k, 1);
    if (bad.some((o) => o.getStatus() === b.getStatus())) return;
    p.clearBattleStatus(bit(b.getStatus()));
  }

  // ---- actions ----

  private doEscape(p: Player): void {
    if (p.isDead() || p.isBattleStatus(bit(8))) return;
    p.setBattleStatus(ESCAPED);
    this.addAniControl(Control.createBattleEscape(p.position, 1));
  }

  /** Battle.isEscapeSuccess: 40 / 75 / 95 % by the level gap to the strongest enemy. */
  isEscapeSuccess(p: Player): boolean {
    const [from, to] = isLeftSide(p.position) ? [20, 34] : [0, 20];
    let top = -1;
    for (let i = from; i < to; i++) {
      const o = this.getPlayerByPos(i);
      if (o != null) top = Math.max(top, o.get(106));
    }
    const d = p.get(106) - top;
    const rate = d <= -7 ? 40 : d >= 7 ? 95 : 75;
    return this.randInt(100) < rate;
  }

  private doMonsterAI(m: Monster): void {
    if (!this.isValidBattlePlayer(m)) return;
    const s = m.getSkillByAI(this, false);
    if (m.getAITargetPos() === 100) {
      this.doEscape(m);
      return;
    }
    const target = m.getAttackTarget(this);
    if (!this.isValidPos(target)) return;
    if (s == null) this.doAttak(m, target);
    else this.doUseSkill(m, s, target);
  }

  private doPetAI(p: Player): void {
    if (this.isValidBattlePlayer(p)) this.doAttak(p, MonsterAI.selectValueTarget(this, p, 2, true));
  }

  /** Battle.doAttak: a normal attack (confusion picks anyone; taunt forces the taunter). */
  private doAttak(p: Player, targetPos: number): void {
    if (p.isDeadNoWithDelay() || p.isBattleStatus(ESCAPED) || p.isBattleStatus(bit(8))) return;
    if (p.isBattleStatus(bit(9))) targetPos = MonsterAI.selectRandActivePlayer(this, p);
    if (!this.isValidPos(targetPos)) return;
    let t = this.getPlayerByPos(targetPos);
    if (p.isBattleStatus(bit(31))) t = p.getbuffer(31)?.getTarget() ?? t;
    if (t == null) return;
    if (t.isDeadNoWithDelay() || t.isBattleStatus(ESCAPED)) {
      targetPos = MonsterAI.selectRandTarget(this, p, true);
      t = this.getPlayerByPos(targetPos);
      if (t == null) return;
    }
    this.atkType = p.getAttackType(null);
    const pet = this.getGrardPet(t, this.atkType, true);
    if (pet != null) {
      t = pet;
    } else {
      let g = this.getGuardPos(t.position, this.atkType);
      if (t.keepout_atk_time > 0) g = -1;
      if (g >= 0) {
        const o = this.getPlayerByPos(g);
        if (this.isValidBattlePlayer(o)) t = o!;
      }
    }
    const c = Control.createBattleUseSkillControl(p.position, targetPos, -1, p.getAttakAnimePos(), 0, p.getAttackRangeAnime(), 0, null);
    this.addAniControl(c);
    const out: Control[] = [];
    if (t.isBattleStatus(ESCAPED) || t.isDeadNoWithDelay()) return;
    t.setTabStatus(false, TAB_KEEPOUT_HIT);
    this.calDamage(p, t, null, out, 1);
    if (t.isTabStatus(TAB_KEEPOUT_HIT)) {
      t.doKeepAtkTime();
      t.setTabStatus(false, TAB_KEEPOUT_HIT);
    }
    c.setSubControlList(out);
  }

  /** Battle.doUseItem: a medicine (item type 26 / 27) from bag slot `slot` on `targetPos`. */
  private doUseItem(p: Player, slot: number, targetPos: number): void {
    if (p.isDeadNoWithDelay() || p.isBattleStatus(ESCAPED)) return;
    const bag = p.bag;
    const it = bag?.getBagItemBySlotPos(slot) ?? null;
    if (bag == null || it == null) return;
    if (p.get(106) < it.reqLv || !it.isCanUse(2) || p.isBattleStatus(bit(8))) return;
    if (p.isBattleStatus(bit(9))) targetPos = MonsterAI.selectRandActivePlayer(this, p);
    const area = this.getSelectArea(p.position, targetPos, it.area);
    if (area == null) return;
    const c = Control.createBattleUseSkillControl(p.position, targetPos, it.area, 0, 2, 1215, 0, p.getType() === 3 ? it.name : null);
    this.addAniControl(c);
    const out: Control[] = [];
    for (const pos of area) {
      if (pos < 0 || pos >= MAX_POS) continue;
      const t = this.getPlayerByPos(pos);
      if (t == null || t.isBattleStatus(ESCAPED) || (t.isDead() && (t.isDeadDelay() || !it.isRebornItem()))) continue;
      t.setTabStatus(false, TAB_KEEPOUT_HIT);
      this.processItemPower(t, it, out);
    }
    c.setSubControlList(out);
    bag.removeBagItemByPos(slot, 1);
  }

  private doUseSkillById(p: Player, id: number, targetPos: number): void {
    const s = p.getSkillByID(id);
    if (s != null) this.doUseSkill(p, s, targetPos);
  }

  /**
   * Battle.doUseSkill: costs, guard skills, then the damage and powers on each target in the area
   * (statuses may turn it into a normal attack or stop it), and the caster's HP / MP drain powers.
   */
  private doUseSkill(p: Player, s: Skill, targetPos: number): void {
    if (!this.isValidPos(targetPos) || p.isDeadNoWithDelay() || p.isBattleStatus(ESCAPED) || s.type === 1) return;
    if (!Skill.isCanUse(p, s) || p.isBattleStatus(bit(8))) return;
    if (p.isBattleStatus(bit(31))) {
      const taunter = p.getbuffer(31)?.getTarget() ?? null;
      if (s.type !== 2 && taunter != null && !isSameSide(p.position, taunter.position)) this.doAttak(p, taunter.position);
      return;
    }
    let pos = targetPos;
    if (p.isBattleStatus(bit(9))) {
      if (s.type === 2) return;
      pos = MonsterAI.selectRandActivePlayer(this, p);
    } else {
      // Sealed magic (7), sealed physical skills (6) or silence (5): a normal attack instead.
      const sealed = p.isBattleStatus(bit(7)) || (isPhysicalAtkType(s.skillAtkType) ? p.isBattleStatus(bit(6)) : p.isBattleStatus(bit(5)));
      if (sealed) {
        if (s.type !== 2 && !isSameSide(p.position, targetPos)) this.doAttak(p, targetPos);
        return;
      }
    }
    const area = this.getSelectArea(p.position, pos, s.area);
    if (area == null) return;
    this.atkType = p.getAttackType(s);
    const name = p.getType() === 3 || p.getType() === 4 ? s.name : null;
    const c = Control.createBattleUseSkillControl(p.position, pos, s.area, s.position, s.anime1, s.anime2, s.anime3, name);
    this.addAniControl(c);
    const out: Control[] = [];
    if (s.useMP > 0) processBattleHpMpPower(p, 3, -s.useMP, 0, out, true);
    if (s.useHP > 0) processBattleHpMpPower(p, 2, -s.useHP, 0, out, true);
    this.setSkillGuardData(s, p.position, area);
    if (s.type === 3) {
      if (s.power1 === 88) p.removeBufferByStatus(s.powerValue1);
      if (s.power2 === 88) p.removeBufferByStatus(s.powerValue2);
      if (s.power3 === 88) p.removeBufferByStatus(s.powerValue3);
    }
    const targets: Player[] = [];
    for (const tp of area) {
      if (!this.isValidPos(tp)) continue;
      const t = this.getPlayerByPos(tp);
      if (t != null && !t.isBattleStatus(ESCAPED) && (!t.isDead() || (!t.isDeadDelay() && s.isRebornSkill()))) targets.push(t);
    }
    const expendHp = this.isExpendHp(s, this.atkType);
    let hitAny = false;
    for (let t of targets) {
      const pet = this.getGrardPet(t, this.atkType, expendHp);
      if (pet != null) {
        t = pet;
      } else {
        let g = this.getGuardPos(t.position, this.atkType);
        if (t.keepout_atk_time > 0 && expendHp) g = -1;
        if (g >= 0) {
          const o = this.getPlayerByPos(g);
          if (this.isValidBattlePlayer(o)) t = o!;
        }
      }
      t.setTabStatus(false, TAB_KEEPOUT_HIT);
      if (this.calDamage(p, t, s, out, targets.length)) {
        this.processSkillPower(t, p, s, out);
        if (t.isTabStatus(TAB_KEEPOUT_HIT)) {
          t.doKeepAtkTime();
          t.setTabStatus(false, TAB_KEEPOUT_HIT);
        }
        hitAny = true;
      }
    }
    if (hitAny) {
      let hp = Math.max(0, s.getPowerValue(145));
      const hpPct = s.getPowerValue(146);
      if (hpPct > 0) hp += idiv(hpPct * p.get(29), 100);
      if (hp > 0) processBattleHpMpPower(p, 2, hp, 0, out);
      let mp = Math.max(0, s.getPowerValue(147));
      const mpPct = s.getPowerValue(148);
      if (mpPct > 0) mp += idiv(mpPct * p.get(30), 100);
      if (mp > 0) processBattleHpMpPower(p, 3, mp, 0, out);
    }
    c.setSubControlList(out);
  }

  private processItemPower(t: Player, it: { power1: number; powerValue1: number; power2: number; powerValue2: number; round: number }, out: Control[]): void {
    if (it.power1 > 0) processBattlePower(this, t, null, null, it.power1, it.powerValue1, 0, it.round, 0, out);
    if (it.power2 > 0) processBattlePower(this, t, null, null, it.power2, it.powerValue2, 0, it.round, 0, out);
  }

  private processSkillPower(t: Player, caster: Player, s: Skill, out: Control[]): void {
    if (s.power1 > 0) processBattlePower(this, t, caster, s, s.power1, s.powerValue1, s.statusBit1, s.round, s.anime3, out);
    if (s.power2 > 0) processBattlePower(this, t, caster, s, s.power2, s.powerValue2, s.statusBit2, s.round, s.anime3, out);
    if (s.power3 > 0) processBattlePower(this, t, caster, s, s.power3, s.powerValue3, s.statusBit3, s.round, s.anime3, out);
  }

  /** Curses and blessings only cost HP when they deal damage (powers 49 / 50 below 0). */
  private isExpendHp(s: Skill | null, atkType: number): boolean {
    if (s == null || (atkType !== 5 && atkType !== 6)) return true;
    return s.getPowerValue(49) < 0 || s.getPowerValue(50) < 0;
  }

  // ---- guards (pets and guard skills take hits for others) ----

  private addGuardData(pos: number, power: number, guard: number, rate: number): void {
    if (pos >= 0 && pos < MAX_POS) this.guardHash.set(setKeyXY(pos, power), setKeyXY(guard, rate));
  }

  /** Battle.setSkillGuardData: powers 113–117 guard the area's fighters this round. */
  private setSkillGuardData(s: Skill, casterPos: number, area: number[]): void {
    const power = s.power1;
    if (area.length <= 0 || power < 113 || power > 117 || s.powerValue1 <= 0) return;
    for (const pos of area) this.addGuardData(pos, power, casterPos, s.powerValue1);
  }

  /** Battle.getGuardPos: who guards `pos` against `atkType` this round (by chance), else -1. */
  private getGuardPos(pos: number, atkType: number): number {
    if (this.guardHash.size <= 0 || pos < 0 || pos >= MAX_POS || atkType === 6) return -1;
    const all = this.guardHash.get(setKeyXY(pos, 117));
    const powerByType = atkType === 0 || atkType === 1 ? 113 : atkType === 2 || atkType === 3 ? 114 : atkType === 4 ? 115 : atkType === 5 ? 116 : -1;
    const typed = powerByType > 0 ? this.guardHash.get(setKeyXY(pos, powerByType)) : undefined;
    if (all === undefined && typed === undefined) return -1;
    const a = all ?? 0;
    const b = typed ?? 0;
    let guard: number;
    let rate: number;
    if (getYKey(a) > getYKey(b)) {
      guard = getXKey(a);
      rate = getYKey(a);
    } else {
      guard = getXKey(b);
      rate = getYKey(b);
    }
    return rate > 0 && this.randInt(100) < rate ? guard : -1;
  }

  /** Battle.getGrardPet: a player's pet may take the hit (pet guard powers 157–166). */
  private getGrardPet(t: Player, atkType: number, expendHp: boolean): Player | null {
    if (t.getType() !== 3 || atkType === 6 || !this.isValidBattlePlayer(t)) return null;
    if (t.keepout_atk_time > 0 && expendHp) return null;
    const pet = this.getPlayerPet(t.position);
    if (pet == null || !this.isValidBattlePlayer(pet)) return null;
    if (pet.isBattleStatus(bit(8)) || pet.isBattleStatus(bit(9)) || pet.isBattleStatus(bit(31))) return null;
    let ok = false;
    if (atkType === 0 || atkType === 1) ok = this.isPetSucessGrard(t, pet, 162, 157);
    else if (atkType === 2 || atkType === 3) ok = this.isPetSucessGrard(t, pet, 163, 158);
    else if (atkType === 4) ok = this.isPetSucessGrard(t, pet, 164, 159);
    else if (atkType === 5) ok = this.isPetSucessGrard(t, pet, 165, 160);
    return ok ? pet : null;
  }

  private isPetSucessGrard(owner: Player, pet: Player, ownerPower: number, petPower: number): boolean {
    const a = Math.max(owner.getSkillPowerValue(1, 166), owner.getSkillPowerValue(1, ownerPower));
    if (a > 0 && this.randInt(100) < a) return true;
    const b = Math.max(pet.getSkillPowerValue(1, 161), pet.getSkillPowerValue(1, petPower));
    return b > 0 && this.randInt(100) < b;
  }

  // ---- damage ----

  /** Battle.calTouch: damage reduction (toughness, halved by bleeding and weakness). */
  static calTouch(p: Player | null): number {
    if (p == null) return 0;
    let v = p.get(49);
    if (p.isBattleStatus(bit(3))) v = idiv(v, 2);
    if (p.isBattleStatus(bit(10))) v = idiv(v, 2);
    return v <= 0 ? 0 : v;
  }

  calTouchOf(p: Player | null): number {
    return Battle.calTouch(p);
  }

  /** Battle.calBackValue: counter-attack (physical) or magic reflection damage. */
  private calBackValue(attacker: Player, target: Player, s: Skill | null, dmg: number): number {
    if (target.isBattleStatus(bit(8)) || attacker.isBattleStatus(bit(21))) return 0;
    let rate = 0;
    if (this.atkType === 4) {
      if (attacker.isBattleStatus(bit(15))) return 0;
      rate = this.calc(24, target, attacker, s);
    } else if (isPhysicalAtkType(this.atkType)) {
      if (attacker.isBattleStatus(bit(16))) return 0;
      rate = this.calc(23, target, attacker, s);
    }
    if (rate <= 0) return 0;
    return this.randInt(100) < rate ? idiv(dmg * rate, 100) : 0;
  }

  /**
   * Battle.calDamage: all hits of one attack on one target (immunities, insight dodge, block,
   * two weapons taking turns); false when nothing landed.
   */
  calDamage(p: Player, t: Player, s: Skill | null, out: Control[], targetNum: number): boolean {
    if (s != null && getSkillAreaPlayerNum(s.area) !== 1) {
      if (this.atkType !== 4 && this.atkType !== 5 && t.isBattleStatus(bit(14))) {
        addSystemChat(`(${t.getName()}) ảo ảnh, vô hiệu`);
        return false;
      }
    }
    if (this.atkType === 6) {
      const d = [0, EFFECT_HIT, 0, 0, 0];
      this.delDamageEffect(d, p, t, s, out, out);
      return true;
    }
    if (t.isBattleStatus(bit(21))) {
      addSystemChat(`(${t.getName()}) vô địch, không bị sát thương `);
      return false;
    }
    if (t.isBattleStatus(bit(15)) && !isPhysicalAtkType(this.atkType)) {
      addSystemChat(`(${t.getName()}) ma công vô hiệu!`);
      return false;
    }
    if (t.isBattleStatus(bit(16)) && isPhysicalAtkType(this.atkType)) {
      addSystemChat(`(${t.getName()}) vật công vô hiệu!`);
      return false;
    }
    if (this.calInsight(p, t, s, out)) return false;
    this.isLeftHand = true;
    this.block = 0;
    this.totalHitTime = p.get(35) + (s != null ? s.atk_time : 0);
    this.totalHitTime = sumValue(this.totalHitTime, 0, 1, 99);
    if (isPhysicalAtkType(this.atkType)) this.block = this.calc(21, t, p, s);
    const main = p.get(77);
    const off = p.get(78);
    const twoWeapons = main > 0 && off > 0;
    if (main <= 0 && off > 0) this.isLeftHand = false;
    const hits: Control[] = [];
    const back: Control[] = [];
    let hitAny = false;
    for (let i = 0; i < this.totalHitTime; i++) {
      const d = this.calcDirectDamage(p, t, s, targetNum);
      if (twoWeapons) this.isLeftHand = !this.isLeftHand;
      if (isEffectStatus(d[1], EFFECT_HIT)) hitAny = true;
      if (hitAny) this.block -= 10;
      this.delDamageEffect(d, p, t, s, hits, back);
      if (t.isDead()) {
        this.checkDie1Hp(t, null);
        break;
      }
    }
    const maxShow = s != null && getSkillAreaPlayerNum(s.area) > 2 ? 5 : 10;
    const shown = hits.length >= maxShow ? mergeControlList(hits, false)! : hits;
    out.push(...shown, ...mergeControlList(back, false)!);
    return hitAny;
  }

  /** Battle.calDefFieldDmg: a magic shield (54) soaks damage with MP. */
  private calDefFieldDmg(p: Player, dmg: number): number {
    if (dmg === 0) return dmg;
    const field = p.get(54);
    if (field <= 0) return dmg;
    const mp = p.get(3);
    if (mp <= 0) return dmg;
    const soak = Math.min(dmg, Math.min(mp, field));
    p.addValue(3, -soak);
    p.addValue(54, -soak);
    return dmg - soak;
  }

  /** Battle.calHPMPGetValue: life (`hp`) or mana drain of a hit, shared over the targets. */
  private calHPMPGetValue(p: Player, s: Skill | null, dmg: number, hp: boolean, targetNum: number): number {
    if (p.isDead()) return 0;
    if (targetNum <= 0) targetNum = 1;
    let rate: number;
    if (hp) {
      if (p.isBattleStatus(bit(2))) return 0;
      rate = p.get(57) + (s != null ? s.getPowerValue(149) : 0);
    } else {
      if (p.isBattleStatus(bit(1))) return 0;
      rate = p.get(58) + (s != null ? s.getPowerValue(150) : 0);
    }
    rate = idiv(rate, targetNum);
    if (rate <= 0) return 0;
    return idiv(dmg * Math.min(rate, 1000), 1000);
  }

  /** Battle.calInsight: the target sees through a magic / curse attack (and pays its MP cost). */
  private calInsight(p: Player, t: Player, s: Skill | null, out: Control[]): boolean {
    if (this.atkType !== 4 && this.atkType !== 5) return false;
    const cost = s != null && s.useMP > 0 ? s.useMP : 0;
    if (t.get(3) < cost) return false;
    const rate = this.calc(22, t, p, s);
    if (rate <= 0) return false;
    const ok = this.randInt(100) < rate;
    if (ok) {
      t.addValue(3, -cost);
      this.delDamageEffect([0, 0, 0, 0, 0], p, t, s, out, out);
    }
    return ok;
  }

  /** Battle.calTouchDmg: damage after the target's reduction (per mille, at most 70 %). */
  private calTouchDmg(t: Player, attacker: Player, s: Skill | null, dmg: number): number {
    let v = Battle.calTouch(t);
    if (s != null) v -= s.getPowerValue(156);
    if (attacker != null && t !== attacker) v -= attacker.get(205);
    if (v > 700) v = 700;
    if (v <= 0) return dmg;
    return Math.max(0, dmg - idiv(v * dmg, 1000));
  }

  /** Battle.calc: the battle formulas by id (hit chance, damage, block, crit…). */
  calc(id: number, a: Player, b: Player, s: Skill | null): number {
    const sk = s ?? Skill.DUMMY;
    const lv = () => Math.max(1, this.getLevelIncludeLevel2(b));
    switch (id) {
      case 1:
      case 2: {
        // Physical hit chance: accuracy − dodge, at least the forced hit chance (≤ 70).
        const v = a.get(43) + sk.getPowerValue(82) - b.get(42);
        let force = a.get(46);
        if (force > 70) force = 70;
        return Math.max(v, force + sk.getPowerValue(85));
      }
      case 3:
        return idiv((a.get(44) + sk.getPowerValue(82)) * 10, lv());
      case 5:
      case 6:
      case 7: {
        // Damage: attack × (100 − defence %) × 95–105 %.
        const def = this.calc(id + 3, b, a, sk);
        const atk = this.calc(id + 6, a, b, sk);
        const r = this.randRange(95, 105);
        const k = 100 - def;
        let v = Math.imul(Math.imul(k, atk), r);
        if (atk > 0 && r > 0 && k > 0 && v < 0) v = 2147483647;
        v = idiv(v, 10000);
        return v <= 0 ? 1 : v;
      }
      case 8:
      case 9:
      case 10: {
        // Defence % (≤ 75): defence − armour break / magic penetration, over the attacker's level.
        const def = id === 8 ? a.get(39) : id === 9 ? a.get(40) : a.get(41);
        const brk = id === 10 ? b.get(59) + sk.getPowerValue(86) : b.get(52) + sk.getPowerValue(87);
        const v = idiv(idiv((def - brk) * 80, 100), Math.max(1, this.getLevelIncludeLevel2(b) + 12));
        return v > 75 ? 75 : Math.max(0, v);
      }
      case 11:
      case 12: {
        const r = this.calc(20, a, b, sk);
        return idiv(a.get(id === 11 ? 36 : 37), this.totalHitTime) + r + idiv(sk.getPowerValue(81), this.totalHitTime);
      }
      case 13: {
        // Magic: the weapon damage only counts for magic weapons (staff, ball, hammers, fan).
        let r = this.calc(20, a, b, sk);
        if (a.bag != null) {
          const w = a.getEquipWeaponType();
          if (w !== 19 && w !== 34 && w !== 37 && w !== 38 && w !== 39) r = 0;
        }
        return idiv(a.get(38), this.totalHitTime) + r + idiv(sk.getPowerValue(81), this.totalHitTime);
      }
      case 14:
        return idiv((a.get(45) + sk.getPowerValue(84)) * 15, lv());
      case 20:
        return this.randRange(a.get(33), a.get(34));
      case 21: {
        const v = Math.max(0, idiv((a.get(51) - sk.getPowerValue(153) - b.get(202)) * 7, lv()));
        return v <= 70 ? v : 70;
      }
      case 22: {
        const v = Math.max(0, idiv((a.get(53) - sk.getPowerValue(154) - b.get(203)) * 7, lv()));
        return v > 100 ? 100 : v;
      }
      case 23:
      case 24: {
        const v = id === 23
          ? Math.max(0, idiv((a.get(55) - sk.getPowerValue(151) - b.get(200)) * 7, lv()))
          : Math.max(0, idiv((a.get(56) - sk.getPowerValue(152) - b.get(201)) * 7, lv()));
        return Math.min(v, a.get(64));
      }
      case 30:
        return this.calcWithType(30, a.getAttackType(sk), a, b, sk);
      case 31:
        return this.calcWithType(31, a.getAttackType(sk), a, b, sk);
      default:
        return 0;
    }
  }

  private calcWithType(id: number, atkType: number, a: Player, b: Player, s: Skill | null): number {
    if (id === 31) {
      if (atkType === 0 || atkType === 1) return this.calc(1, a, b, s);
      if (atkType === 2 || atkType === 3) return this.calc(2, a, b, s);
      if (atkType === 4 || atkType === 5) return this.calc(3, a, b, s);
      return atkType === 6 ? 100 : 0;
    }
    if (atkType === 0 || atkType === 1) return this.calc(5, a, b, s);
    if (atkType === 2 || atkType === 3) return this.calc(6, a, b, s);
    return atkType === 4 ? this.calc(7, a, b, s) : 0;
  }

  /**
   * Battle.calcDirectDamage: one hit → [damage, effect bits, counter damage, HP drain, MP drain].
   * Weakness / bleeding raise the damage taken; a keep-out charge stops it.
   */
  private calcDirectDamage(p: Player, t: Player, s: Skill | null, targetNum: number): number[] {
    const d = [0, 0, 0, 0, 0];
    let hit = this.randInt(100) < this.calc(31, p, t, s);
    const base = this.calc(30, p, t, s);
    let up = t.isBattleStatus(bit(10)) ? 20 : 0;
    if (t.isBattleStatus(bit(3))) up += 10;
    let dmg = up > 0 ? base + idiv(up * base, 100) : base;
    if (this.randInt(100) < this.calc(14, p, t, s)) {
      dmg = idiv(dmg * 15, 10);
      d[1] |= EFFECT_CRITICAL;
    }
    if (hit && this.block > 0) {
      if (this.randInt(100) < this.block) hit = false;
      d[1] |= EFFECT_BLOCK;
    }
    if (hit) {
      let v = dmg;
      if (dmg > 0 && t.keepout_atk_time > 0) {
        if (!t.isTabStatus(TAB_KEEPOUT_HIT)) d[1] |= EFFECT_KEEPOUT;
        t.setTabStatus(true, TAB_KEEPOUT_HIT);
        // Only a monster's triple-50 skill goes through a keep-out charge.
        if (!(t.getType() === 2 && s != null && s.power1 === 50 && s.power2 === 50 && s.power3 === 50)) v = 0;
      }
      d[2] = this.calBackValue(p, t, s, v);
      const touched = this.calTouchDmg(t, p, s, v);
      if (v !== touched) d[1] |= EFFECT_TOUCH;
      dmg = this.calDefFieldDmg(t, touched);
      if (touched !== dmg) d[1] |= EFFECT_DEF_FIELD;
    }
    d[0] = dmg;
    if (hit) {
      d[1] |= EFFECT_HIT;
      d[3] = this.calHPMPGetValue(p, s, dmg, true, targetNum);
      d[4] = this.calHPMPGetValue(p, s, dmg, false, targetNum);
    }
    return d;
  }

  /** Battle.checkDie1Hp: the 1-HP revive status (27) fires once when its holder dies. */
  checkDie1Hp(p: Player | null, out: Control[] | null): void {
    if (p == null || !p.isDead()) return;
    const tmp: Control[] = [];
    if (!p.isTabStatus(TAB_REBORN_1HP_DONE) && p.isBattleStatus(bit(27)) && !p.isHaveCanNotReliveBuffer()) {
      p.setTabStatus(true, TAB_REBORN_1HP_DONE);
      processBattleReborn(p, 1, 0, 1215, out ?? tmp);
    }
    if (out == null) for (const c of tmp) this.addAniControl(c);
  }

  /**
   * Battle.delDamageEffect: applies a hit — HP loss and hate, the number on the target, the
   * attacker's drains and the counter damage it takes.
   */
  private delDamageEffect(d: number[], p: Player, t: Player, _s: Skill | null, hits: Control[], back: Control[]): void {
    const hit = isEffectStatus(d[1], EFFECT_HIT);
    const v = -d[0];
    if (hit) {
      t.addValue(2, v);
      p.addValue(63, -v);
    }
    if (t.isDeadNoWithDelay()) d[1] |= EFFECT_DIE;
    hits.push(Control.createBattleTargetEffect(t.position, v, d[1], 0));
    if (!hit) return;
    if (d[3] > 0) {
      p.addValue(2, d[3]);
      back.push(Control.createBattleTargetEffect(p.position, d[3], EFFECT_HIT, 0));
    }
    if (d[4] > 0) {
      p.addValue(3, d[4]);
      back.push(Control.createBattleTargetEffect(p.position, d[4], EFFECT_HIT | EFFECT_MP_CHANGE, 0));
    }
    const c = -d[2];
    if (c !== 0) {
      p.addValue(2, c);
      t.addValue(63, -c);
      let effect = EFFECT_HIT;
      if (p.isDeadNoWithDelay()) {
        this.checkDie1Hp(p, null);
        effect = EFFECT_HIT | EFFECT_DIE;
      }
      back.push(Control.createBattleTargetEffect(p.position, c, effect, 0));
    }
  }

  /** Battle.isWilSuccess: will (‰, at most 70 %) resists a harmful status. */
  isWilSuccess(p: Player, caster: Player | null, s: Skill | null): boolean {
    let v = p.get(48);
    if (s != null) v -= s.getPowerValue(155);
    if (caster != null && p !== caster) v -= caster.get(204);
    if (v <= 0) return false;
    return this.randInt(1000) < Math.min(v, 700);
  }

  // ---- areas and targets ----

  /** Battle.getAllTypeTarget: every position of a side (-1 both), maybe not the caster. */
  private getAllTypeTarget(side: number, caster: number, area: number): number[] | null {
    let from = 0;
    let to = 34;
    if (side === 1) to = this.getLeftPosNum();
    else if (side === 2) {
      from = 20;
      to = 20 + this.getRightPosNum();
    }
    if (to - from <= 0) return null;
    const notSelf = caster >= 0 && (area === 36 || area === 37);
    const out: number[] = [];
    for (let i = from; i < to; i++) if (!notSelf || i !== caster) out.push(i);
    return out;
  }

  /** Battle.getColumnTypeTarget: `n` positions up / down the column from `pos` (a cross first). */
  private getColumnTypeTarget(pos: number, n: number, cross: boolean): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      let p: number;
      if (i % 2 === 0) {
        if (cross && i === 0) {
          getLeftRightTypeTarget(out, pos);
          continue;
        }
        p = pos - idiv(i, 2) * 2;
      } else {
        p = (idiv(i, 2) + 1) * 2 + pos;
      }
      if (this.isValidPosOnSide(pos, p)) out.push(p);
    }
    return out;
  }

  /** Battle.getRowTypeTarget: `n` rows (both columns) around `pos`. */
  private getRowTypeTarget(pos: number, n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = i % 2 === 0 ? pos - idiv(i, 2) * 2 : (idiv(i, 2) + 1) * 2 + pos;
      if (this.isValidPosOnSide(pos, p)) getLeftRightTypeTarget(out, p);
    }
    return out;
  }

  /**
   * Battle.getSelectArea: the positions a skill area hits when aimed at `target` by `caster`, or
   * null when the target is not allowed (an enemy skill on an ally…).
   */
  getSelectArea(caster: number, target: number, area: number): number[] | null {
    const st = getSearchTypeByArea(area);
    if (st === 1 && isSameSide(caster, target)) return null;
    if (st === 2 && !isSameSide(caster, target)) return null;
    if (st === 3) return caster !== target ? null : [target];
    if (st === 4) return [target];
    let list: number[] | null = [];
    switch (area) {
      case 0: case 10: case 20: list = this.getColumnTypeTarget(target, 1, false); break;
      case 1: case 11: case 21: case 38: list = this.getRowTypeTarget(target, 1); break;
      case 2: case 12: case 22: list = this.getColumnTypeTarget(target, 2, false); break;
      case 3: case 13: case 23: list = this.getColumnTypeTarget(target, 3, false); break;
      case 4: case 14: case 24: list = this.getColumnTypeTarget(target, 4, false); break;
      case 5: case 15: case 25: list = this.getColumnTypeTarget(target, 5, false); break;
      case 6: case 16: case 26: list = this.getColumnTypeTarget(target, 3, true); break;
      case 7: case 17: case 27: list = this.getRowTypeTarget(target, 2); break;
      case 8: case 18: case 28: list = this.getRowTypeTarget(target, 3); break;
      case 9: case 19: case 29: case 36: case 37:
        return this.getAllTypeTarget(area === 9 || area === 37 ? -1 : getPositionSide(target), caster, area);
      case 30: case 35: return null;
      case 31: case 32: case 33: case 34: return [target];
    }
    if (list.length <= 0) return null;
    // 38 (pet and owner) must include the caster.
    if (area === 38 && !list.includes(caster)) return null;
    return list;
  }

  /**
   * Battle.searchAICursor: where to aim a skill automatically — the spot hitting the most
   * fighters (`random`: one of the best at random), or the HP / self / owner picks.
   */
  searchAICursor(p: Player, area: number, random = false): number {
    if (area === 38) return p.position;
    switch (area) {
      case 31: return MonsterAI.selectValueTarget(this, p, 3, true);
      case 32: return MonsterAI.selectValueTarget(this, p, 4, true);
      case 33: return MonsterAI.selectValueTarget(this, p, 7, false);
      case 34: return MonsterAI.selectValueTarget(this, p, 8, false);
    }
    const st = getSearchTypeByArea(area);
    if (st === 3) return p.position;
    if (st === 4) return getPetOwnerPos(p);
    const left = isLeftSide(p.position);
    let from = 0;
    let to = 34;
    if (st === 1 || (st === 0 && area === 0)) [from, to] = left ? [20, 34] : [0, 20];
    else if (st === 2) [from, to] = left ? [0, 20] : [20, 34];
    const num = getSkillAreaPlayerNum(area);
    const byCount = new Map<number, number[]>();
    let bestCount = 0;
    let best = from;
    for (let i = from; i < to; i++) {
      if (num === -1) {
        if ((area === 36 || area === 37) && i === p.position) continue;
        if (this.isValidBattlePlayer(this.getPlayerByPos(i))) return i;
        continue;
      }
      const n = this.countNotNullPlayerPos(this.getSelectArea(p.position, i, area));
      if (random) {
        if (n <= 0) continue;
        if (!byCount.has(n)) byCount.set(n, []);
        byCount.get(n)!.push(i);
        if (n > bestCount) bestCount = n;
      } else {
        if (n === num) return i;
        if (n > bestCount) {
          best = i;
          bestCount = n;
        }
      }
    }
    if (random && byCount.size > 0) {
      const l = byCount.get(bestCount);
      if (l != null && l.length > 0) return l[Math.floor(Math.random() * l.length)];
    }
    return best;
  }
}
