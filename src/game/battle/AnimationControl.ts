// The battle animation of com.hz.battle (1.2.0, jadx / Vineflower decompiles): AnimationControl
// turns Battle's Controls into steps — a fighter's skill (run up, attack anime, effect sprites on
// the targets, numbers), escape, shake, numbers flying off, HP / MP bars catching up — with
// PlayerAnimation, NumEffect, DoAttack and AnimeTrace.
import { Monster } from '../actor/Monster';
import type { Player } from '../actor/Player';
import { rand } from '../common/Tool';
import { drawGameImage } from '../common/Utilities';
import type { Image } from '../image/Image';
import type { ImageSet } from '../image/ImageSet';
import { BCONTROL_HAS_ANIME2, BCONTROL_HAS_AREA_LIST, BCONTROL_HAS_NAME, TYPE_BATTLE_SELF_EFFECT, type Control } from '../main/Control';
import { drawImageNumber, getImageSet } from '../main/GameView';
import { GameSprite } from '../sprite/GameSprite';
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import {
  EFFECT_BLOCK, EFFECT_CRITICAL, EFFECT_DEF_FIELD, EFFECT_DIE, EFFECT_DIE_DELAY, EFFECT_HIT, EFFECT_KEEPOUT, EFFECT_MP_CHANGE,
  EFFECT_REBORN, EFFECT_STUN, EFFECT_TOUCH, isLeftSide, type Battle,
} from './Battle';

export const SCREEN_W = 320;
export const SCREEN_H = 480;

/** What the animation needs from BattleAniEngine. */
export interface AniEngine {
  getBattle(): Battle;
  getPlayerByPos(pos: number): Player | null;
  getPosition(pos: number, coord: number): number;
  addAnimationControl(c: AnimationControl | null): void;
  closePlayerAnimation(): void;
  updateBattlePlayerInfo(kind: number): void;
  readonly me: Player;
  readonly criticalImage: Image | null;
  readonly blockImage: Image | null;
  readonly missImage: Image | null;
  readonly offsetImage: Image | null;
  readonly effHitSprite: GameSprite | null;
  readonly effMagicFieldSprite: GameSprite | null;
  readonly battleWidth: number;
  readonly battleHeight: number;
}

export const BATTLE_CONTROL_SKILL = 1;
export const BATTLE_CONTROL_ESCAPE = 2;
export const BATTLE_CONTROL_NUM_EFFECT = 3;
export const BATTLE_CONTROL_PLAYER_SHAKE = 4;
export const BATTLE_CONTROL_PLAYER_ANIMATION = 5;
export const BATTLE_CONTROL_VISIBLE = 6;
export const BATTLE_CONTROL_MOVE = 7;
export const BATTLE_CONTROL_DO_ATTACK = 8;
export const BATTLE_CONTROL_HPMP_UPDATE = 10;

/** Battle sprite animation ids. */
export const ANI_STAND = 4;
export const ANI_ATTACK = 7;
export const ANI_HURT = 12;

/** Tool.entropy(a, b, true): ease by 2/5 of the gap; snap within 30 px. */
export function entropy(cur: number, target: number): number {
  if (cur === target) return cur;
  if (Math.abs(cur - target) < 30) return target;
  const v = Math.trunc((cur * 3 + target * 2) / 5);
  return v === cur ? target : v;
}

/** Define.getAnimeStartType / getAnimeTraceType: a skill's anime1 packs both. */
const getAnimeStartType = (v: number) => v & 7;
const getAnimeTraceType = (v: number) => (v >> 3) & 7;

/** DoAttack.isAnimationIDCheck: the sprite reached its check frame (or finished). */
export function isAnimationIDCheck(s: GameSprite | null): boolean {
  const a = s?.getCurAnimation() ?? null;
  if (a == null) return true;
  const check = a.getCheckID();
  if (check >= 0) return a.getCurFrame() === check || a.getLoopTime() <= 0;
  return a.getLoopTime() <= 0;
}

/** PlayerAnimation: plays one animation of a fighter (then another), maybe shifted sideways. */
export class PlayerAnimation {
  private initAnimationID = -1;
  private isInit = true;
  isMagicField = false;

  constructor(
    private readonly engine: AniEngine,
    readonly player: Player,
    private readonly fromAniID: number,
    private readonly toAniID: number,
    private loopTime: number,
    private readonly offsetX: number,
    readonly isDie: boolean,
  ) {}

  action(): boolean {
    const s = this.player.battleSprite;
    if (s == null) return true;
    if (this.isInit) {
      if (!s.setCurAnimation(this.fromAniID) && this.loopTime > 0) this.loopTime = 1;
      s.setCurAnimationLoopTime(this.loopTime);
      if (this.loopTime <= 0) return true;
      this.initAnimationID = s.getCurAniID();
      s.setSpritePosition(s.spriteX + this.offsetX, s.spriteY);
      if (this.fromAniID === ANI_HURT) {
        const fx = GameSprite.cloneSprite(this.isMagicField ? this.engine.effMagicFieldSprite : this.engine.effHitSprite);
        if (fx != null) {
          addBattleSprite(fx, 1, this.player);
          fx.setSpritePosition(s.spriteX, s.spriteY - ((s.getHeight() / 2) | 0) + ((fx.getHeight() / 2) | 0) + 5);
        }
      }
      this.isInit = false;
    }
    const cur = s.getCurAniID();
    if (cur < 0 || this.initAnimationID < 0 || cur !== this.initAnimationID) {
      s.setSpritePosition(s.spriteX - this.offsetX, s.spriteY);
      return true;
    }
    if (s.getCurAnimationLoopTime() > 0) return false;
    if (this.toAniID !== -99) s.setCurAnimation(this.toAniID, -1);
    s.setSpritePosition(s.spriteX - this.offsetX, s.spriteY);
    return true;
  }
}

/** NumEffect: a damage / heal number (image digits 2000–2003) or a word image bouncing up. */
export class NumEffect {
  drawX = 0;
  drawY = 0;
  private endCount = 0;
  image: Image | null = null;
  private numPlayer: Player | null;
  numSet: ImageSet | null = null;
  setIndex: number;
  private startIndex: number;
  vSpeed: number;
  private hSpeed: number;
  private xMove = 0;
  private yMove = 0;

  constructor(p: Player | null, setIndex: number, startIndex: number, private readonly numString: string | null, h: number, v: number) {
    this.numPlayer = p;
    this.setIndex = setIndex;
    this.startIndex = startIndex;
    if (setIndex >= 0) this.numSet = getImageSet(setIndex);
    this.hSpeed = h;
    this.vSpeed = v;
  }

  private setDrawPosition(p: Player): void {
    const s = p.battleSprite;
    if (s == null) return;
    this.drawX = s.spriteX;
    this.drawY = this.setIndex === 2001 || this.setIndex === 2002 ? s.spriteY - 60 : s.spriteY - 24;
  }

  action(): boolean {
    if (this.numPlayer != null) {
      this.setDrawPosition(this.numPlayer);
      this.numPlayer = null;
    }
    this.xMove += this.hSpeed;
    if (this.numSet != null && this.numString != null && this.hSpeed !== 0) {
      const half = (this.numSet.getFrameWidth(this.startIndex) * this.numString.length) >> 1;
      if (this.hSpeed > 0) {
        if (this.drawX + this.xMove + half >= SCREEN_W) this.hSpeed = -(this.hSpeed * 2);
      } else if (this.drawX + this.xMove - half <= 0) {
        this.hSpeed = -(this.hSpeed * 2);
      }
    }
    this.yMove += this.vSpeed;
    if (this.endCount > 0) {
      this.vSpeed++;
      if (--this.endCount === 0) return true;
    } else if (this.yMove >= (this.hSpeed === 0 ? 0 : 12)) {
      this.vSpeed = Math.trunc(-this.vSpeed / 2);
      this.endCount = 4;
    } else {
      this.vSpeed++;
    }
    return false;
  }

  draw(g: Graphics, dx: number, dy: number): void {
    const x = dx + this.drawX + this.xMove;
    const y = dy + this.drawY + this.yMove;
    if (this.numString == null) {
      drawGameImage(g, this.image, x, y, 33);
      return;
    }
    const set = this.numSet;
    if (set == null) {
      g.setColor(0xffff00);
      g.drawString(this.numString, x, y, 33);
      return;
    }
    const h = set.getFrameHeight(this.startIndex);
    if (this.image != null) {
      drawGameImage(g, this.image, x - ((set.getFrameWidth(this.startIndex) * this.numString.length) >> 1) + 3, y - ((h / 2) | 0), 3);
    }
    drawImageNumber(g, set, this.startIndex, this.numString, x, y, 0, 33);
  }
}

/** AnimationControl.addBattleSprite: an effect sprite playing once on a fighter. */
export function addBattleSprite(s: GameSprite | null, loop: number, p: Player | null): void {
  if (p == null || p.battleSprite == null || s == null) return;
  s.setMotionAlive(true);
  s.setMotionTurnOff(true);
  s.setCurAnimationLoopTime(loop);
  s.setSpritePosition(p.battleSprite.spriteX, p.battleSprite.spriteY);
  if (!isLeftSide(p.position)) s.setRotate(true);
  p.battleEffectSpriteList.push(s);
}

/** AnimationControl.getEffectCloneSprite: a copy of a loaded effect sprite. */
function getEffectCloneSprite(e: AniEngine, id: number): GameSprite | null {
  if (id === 1303) return GameSprite.cloneSprite(e.effHitSprite);
  if (id === 1225) return GameSprite.cloneSprite(e.effMagicFieldSprite);
  for (let i = 0; i < 34; i++) {
    for (const s of e.getPlayerByPos(i)?.battleEffectSpriteList ?? []) if (s != null && s.getnameID() === id) return GameSprite.cloneSprite(s);
  }
  return null;
}

function effectSprite(e: AniEngine, id: number): GameSprite | null {
  return getEffectCloneSprite(e, id) ?? GameSprite.createSprite(id, true);
}

export class AnimationControl {
  actorPlayer: Player | null = null;
  aniControl: Control | null = null;
  baseX = 0;
  baseY = 0;
  counter = 0;
  delayTime = -1;
  private effectControlList: AnimationControl[] | null = null;
  protected isDoneFlag = false;
  obj: PlayerAnimation | NumEffect | DoAttack | [number, number] | null = null;
  private selfControlList: AnimationControl[] | null = null;
  subControlIndex = 0;
  subControls: (AnimationControl | null)[] | null = null;

  constructor(readonly engine: AniEngine, readonly type: number) {}

  static createBattleDoAttack(e: AniEngine, actor: Player, targets: (Player | null)[], movePos: number, anime1: number, anime2: number, anime3: number, effects: AnimationControl[] | null): AnimationControl {
    const c = new AnimationControl(e, BATTLE_CONTROL_DO_ATTACK);
    c.obj = new DoAttack(e, actor, targets, movePos, anime1, anime2, anime3, effects);
    return c;
  }

  static createBattlePlayerAnimation(e: AniEngine, pos: number, from: number, to: number, loop: number, offsetX: number, die: boolean, magicField = false): AnimationControl | null {
    const p = e.getPlayerByPos(pos);
    if (p == null) return null;
    const c = new AnimationControl(e, BATTLE_CONTROL_PLAYER_ANIMATION);
    const a = new PlayerAnimation(e, p, from, to, loop, offsetX, die);
    a.isMagicField = magicField;
    c.obj = a;
    return c;
  }

  static createBattlePlayerEscape(e: AniEngine, ctl: Control): AnimationControl {
    const c = new AnimationControl(e, BATTLE_CONTROL_ESCAPE);
    c.aniControl = ctl;
    return c;
  }

  static createBattlePlayerMove(e: AniEngine, pos: number, x: number, y: number): AnimationControl | null {
    const p = e.getPlayerByPos(pos);
    if (p == null) return null;
    const c = new AnimationControl(e, BATTLE_CONTROL_MOVE);
    c.actorPlayer = p;
    c.baseX = x;
    c.baseY = y;
    return c;
  }

  static createBattlePlayerShake(e: AniEngine, pos: number, n: number): AnimationControl | null {
    const p = e.getPlayerByPos(pos);
    if (p == null || p.battleSprite == null) return null;
    const c = new AnimationControl(e, BATTLE_CONTROL_PLAYER_SHAKE);
    c.actorPlayer = p;
    c.counter = n;
    c.baseX = p.battleSprite.spriteX;
    c.baseY = p.battleSprite.spriteY;
    return c;
  }

  static createBattlePlayerVisible(e: AniEngine, pos: number): AnimationControl | null {
    const p = e.getPlayerByPos(pos);
    if (p == null) return null;
    const c = new AnimationControl(e, BATTLE_CONTROL_VISIBLE);
    c.actorPlayer = p;
    return c;
  }

  static createBattleSkill(e: AniEngine, ctl: Control): AnimationControl {
    const c = new AnimationControl(e, BATTLE_CONTROL_SKILL);
    c.aniControl = ctl;
    c.getAniEffectList(e, ctl.subControls);
    return c;
  }

  private static createHPMPUpdate(e: AniEngine, pos: number, id: number, value: number): AnimationControl {
    const c = new AnimationControl(e, BATTLE_CONTROL_HPMP_UPDATE);
    c.actorPlayer = e.getPlayerByPos(pos);
    c.obj = [id, value];
    return c;
  }

  /** A number on the fighter at `pos`: damage flies sideways (2000), healing up (2001), MP 2002, crit 2003. */
  static createNumEffect(e: AniEngine, value: number, pos: number, critical: boolean, mp: boolean): AnimationControl | null {
    const p = e.getPlayerByPos(pos);
    if (p == null || p.battleSprite == null) return null;
    let set: number;
    let h: number;
    let v: number;
    if (value >= 0) {
      set = 2001;
      h = 0;
      v = -3;
    } else {
      set = 2000;
      h = isLeftSide(pos) ? -1 : 1;
      v = -4;
    }
    if (mp) set = 2002;
    let img: Image | null = null;
    if (critical) {
      img = e.criticalImage;
      set = 2003;
    }
    return AnimationControl.createNumEffectRaw(e, String(Math.abs(value)), p, set, 0, h, v, img);
  }

  private static createNumEffectRaw(e: AniEngine, s: string | null, p: Player | null, set: number, start: number, h: number, v: number, img: Image | null): AnimationControl {
    const c = new AnimationControl(e, BATTLE_CONTROL_NUM_EFFECT);
    const n = new NumEffect(p, set, start, s, h, v);
    n.image = img;
    c.obj = n;
    return c;
  }

  addVSpeed(d: number): void {
    if (this.obj instanceof NumEffect) this.obj.vSpeed += d;
  }

  setDelay(n: number): void {
    this.delayTime = n;
  }

  isDone(): boolean {
    return this.isDoneFlag;
  }

  done(): void {
    this.isDoneFlag = true;
  }

  setSubControlList(list: (AnimationControl | null)[]): void {
    this.subControls = list;
  }

  /** Runs sub-steps one after another; the next one starts in the same tick. */
  executeSubControls(): boolean {
    const subs = this.subControls;
    if (subs == null || this.subControlIndex < 0 || this.subControlIndex >= subs.length) return true;
    const c = subs[this.subControlIndex];
    if (c == null) {
      this.subControlIndex++;
      return false;
    }
    c.action();
    if (!c.isDone()) return false;
    this.subControlIndex++;
    if (this.subControlIndex < subs.length) subs[this.subControlIndex]?.action();
    return false;
  }

  resetPosition(p: Player | null): void {
    if (p == null || p.battleSprite == null) return;
    p.battleSprite.setSpritePosition(this.engine.getPosition(p.position, 0), this.engine.getPosition(p.position, 1));
    p.battleSprite.setFront(false);
  }

  action(): void {
    if (this.delayTime > 0) this.delayTime--;
    switch (this.type) {
      case BATTLE_CONTROL_SKILL: this.executeSkill(); break;
      case BATTLE_CONTROL_ESCAPE: this.executePlayerEscape(); break;
      case BATTLE_CONTROL_NUM_EFFECT: this.executeNumEffect(); break;
      case BATTLE_CONTROL_PLAYER_SHAKE: this.executePlayerShake(); break;
      case BATTLE_CONTROL_PLAYER_ANIMATION: this.executePlayerAnimation(); break;
      case BATTLE_CONTROL_VISIBLE:
        this.actorPlayer?.battleSprite?.setSpriteVisible(true);
        this.done();
        break;
      case BATTLE_CONTROL_MOVE: this.executePlayerMove(); break;
      case BATTLE_CONTROL_DO_ATTACK:
        if (!(this.obj instanceof DoAttack) || this.obj.action()) this.done();
        break;
      case BATTLE_CONTROL_HPMP_UPDATE: this.executeHPMPUpdate(); break;
    }
  }

  draw(g: Graphics): void {
    if (this.type === BATTLE_CONTROL_NUM_EFFECT && this.obj instanceof NumEffect && this.delayTime <= 0) this.obj.draw(g, 0, 0);
  }

  /** The caster's step list: (run up), attack with its effects, (run back), stand. */
  private executeSkill(): void {
    const ctl = this.aniControl;
    if (ctl == null || ctl.datas == null) {
      this.done();
      return;
    }
    if (this.counter !== 0) {
      if (this.executeSubControls()) {
        this.resetPosition(this.actorPlayer);
        this.done();
      }
      return;
    }
    this.counter++;
    const e = this.engine;
    const dis = new DataInputStream(ctl.datas);
    const pos = ctl.byte0;
    const target = dis.readByte();
    const flags = dis.readByte();
    const area = flags & BCONTROL_HAS_AREA_LIST ? dis.readByte() : -1;
    let targets: (Player | null)[] | null = null;
    const sel = area >= 0 ? e.getBattle().getSelectArea(pos, target, area) : null;
    if (sel != null) targets = sel.map((p) => e.getPlayerByPos(p));
    const movePos = dis.readByte();
    const anime1 = dis.readByte();
    const anime2 = dis.readShort() & 0xffff;
    const anime3 = flags & BCONTROL_HAS_ANIME2 ? dis.readShort() & 0xffff : 0;
    const name = flags & BCONTROL_HAS_NAME ? dis.readUTF() : null;
    const actor = e.getPlayerByPos(pos);
    this.actorPlayer = actor;
    if (actor == null || actor.battleSprite == null) {
      this.done();
      return;
    }
    if (movePos === 2) actor.battleSprite.setSpritePosition(SCREEN_W >> 1, SCREEN_H >> 1);
    if (actor instanceof Monster) actor.checkMonsterBattleMsg();
    else actor.checkBattleMsg(name);
    for (const c of this.selfControlList ?? []) e.addAnimationControl(c);
    actor.battleSprite.setFront(true);
    if (targets == null || targets.length <= 0) targets = [e.getPlayerByPos(target)];
    const steps: (AnimationControl | null)[] = [];
    if (movePos === 1) {
      steps.push(AnimationControl.createBattlePlayerAnimation(e, pos, 5, 6, 1, 0, false));
      let x = e.getPosition(target, 0);
      const y = e.getPosition(target, 1);
      const own = e.getPosition(actor.position, 0);
      if (own > x) x += 50;
      else if (own < x) x -= 50;
      steps.push(AnimationControl.createBattlePlayerMove(e, pos, x, y));
    } else if (getAnimeStartType(anime1) === 0) {
      steps.push(AnimationControl.createBattlePlayerAnimation(e, pos, 5, -99, 1, 0, false));
    }
    steps.push(AnimationControl.createBattleDoAttack(e, actor, targets, movePos, anime1, anime2, anime3, this.effectControlList));
    if (movePos === 1) {
      steps.push(AnimationControl.createBattlePlayerAnimation(e, pos, 8, -99, 1, 0, false));
      steps.push(AnimationControl.createBattlePlayerMove(e, pos, e.getPosition(pos, 0), e.getPosition(pos, 1)));
    }
    steps.push(AnimationControl.createBattlePlayerAnimation(e, pos, ANI_STAND, -99, -1, 0, false));
    this.setSubControlList(steps);
  }

  /** Runs off the screen (or stumbles when the escape failed), then hides. */
  private executePlayerEscape(): void {
    const ctl = this.aniControl;
    if (ctl == null) {
      this.done();
      return;
    }
    const e = this.engine;
    if (this.counter === 0) {
      this.counter++;
      const pos = ctl.byte0;
      const ok = ctl.byte1;
      this.actorPlayer = e.getPlayerByPos(pos);
      if (this.actorPlayer == null) {
        this.done();
        return;
      }
      if (ok === 0) {
        e.addAnimationControl(AnimationControl.createBattlePlayerAnimation(e, pos, 8, 4, 20, 0, false));
        this.done();
        return;
      }
      const y = e.getPosition(pos, 1);
      const x = isLeftSide(pos) ? -50 : SCREEN_W + 50;
      this.setSubControlList([
        AnimationControl.createBattlePlayerVisible(e, pos),
        AnimationControl.createBattlePlayerAnimation(e, pos, 8, -99, 1, 0, false),
        AnimationControl.createBattlePlayerMove(e, pos, x, y),
        AnimationControl.createBattlePlayerAnimation(e, pos, ANI_STAND, -99, -1, 0, false),
      ]);
      return;
    }
    if (!this.executeSubControls()) return;
    const p = this.actorPlayer;
    if (p?.battleSprite != null) {
      this.resetPosition(p);
      p.battleSprite.setSpriteVisible(false);
    }
    this.done();
    if (p != null && p === e.me) e.closePlayerAnimation();
  }

  private executePlayerMove(): void {
    const s = this.actorPlayer?.battleSprite;
    if (s == null) {
      this.done();
      return;
    }
    s.spriteX = entropy(s.spriteX, this.baseX);
    s.spriteY = entropy(s.spriteY, this.baseY);
    if (++this.counter > 15) s.setSpritePosition(this.baseX, this.baseY);
    if (s.spriteX === this.baseX && s.spriteY === this.baseY) this.done();
  }

  private executePlayerShake(): void {
    const s = this.actorPlayer?.battleSprite;
    if (s == null) {
      this.done();
      return;
    }
    this.counter--;
    const dx = this.counter > 0 ? ((this.counter & 1) === 0 ? -2 : 2) : 0;
    const dy = this.counter > 0 ? rand(-1, 1) : 0;
    s.setSpritePosition(this.baseX + dx, this.baseY + dy);
    if (this.counter <= 0) {
      s.setSpritePosition(this.baseX, this.baseY);
      this.done();
    }
  }

  private executePlayerAnimation(): void {
    if (!(this.obj instanceof PlayerAnimation)) {
      this.done();
      return;
    }
    if (this.obj.action()) {
      this.playerDie(this.obj);
      this.done();
    }
  }

  /** AnimationControl.playerDie: the sprite hides and the death mark plays. */
  private playerDie(a: PlayerAnimation): void {
    const p = a.player;
    const s = p.battleSprite;
    if (s == null || !s.isSpriteVisible() || !a.isDie) return;
    s.setSpriteVisible(false);
    const d = p.dieSprite;
    if (d == null) return;
    d.setCurAnimation(1, 1);
    d.setMotionTurnOff(true);
    d.setSpritePosition(s.spriteX, s.spriteY);
    p.battleEffectSpriteList.push(d);
  }

  private executeNumEffect(): void {
    if (!(this.obj instanceof NumEffect) || this.obj.action()) this.done();
  }

  /** The HP / MP bar values (91 / 92) catch up with the number shown. */
  private executeHPMPUpdate(): void {
    const p = this.actorPlayer;
    if (Array.isArray(this.obj) && p != null) {
      p.addValue(this.obj[0], this.obj[1]);
      if (p === this.engine.me || p === this.engine.me.getPet()) this.engine.updateBattlePlayerInfo(2);
    }
    this.done();
  }

  /**
   * AnimationControl.getAniEffectByControl: one target-effect Control → its animation steps (the
   * number, hurt / miss / block, shake, revive, bar update).
   */
  static getAniEffectByControl(e: AniEngine, ctl: Control, counts: Uint8Array | null, out: AnimationControl[]): void {
    const pos = ctl.byte0;
    const f = ctl.counter;
    const value = ctl.int0;
    const anime = ctl.int1;
    const has = (b: number) => (f & b) !== 0;
    const crit = has(EFFECT_CRITICAL);
    const die = has(EFFECT_DIE);
    const hit = has(EFFECT_HIT);
    const mp = has(EFFECT_MP_CHANGE);
    const push = (c: AnimationControl | null) => {
      if (c != null) out.push(c);
    };
    const pushFirst = (c: AnimationControl | null) => {
      if (c != null) out.unshift(c);
    };
    if (anime > 0) addBattleSprite(effectSprite(e, anime), 1, e.getPlayerByPos(pos));
    if (has(EFFECT_STUN)) push(AnimationControl.createBattlePlayerShake(e, pos, 6));
    if (has(EFFECT_REBORN)) push(AnimationControl.createBattlePlayerVisible(e, pos));
    if (!hit) {
      if (has(EFFECT_DIE_DELAY)) {
        push(AnimationControl.createBattlePlayerAnimation(e, pos, ANI_HURT, ANI_STAND, 1, 0, true, false));
        return;
      }
      let img: Image | null;
      if (has(EFFECT_BLOCK)) {
        img = e.blockImage;
      } else {
        push(AnimationControl.createBattlePlayerAnimation(e, pos, 8, ANI_STAND, 10, isLeftSide(pos) ? -3 : 3, false));
        img = e.missImage;
      }
      const n = AnimationControl.createNumEffectRaw(e, null, e.getPlayerByPos(pos), -1, 0, 0, -1, img);
      updateAffectCount(n, counts, pos);
      push(n);
      return;
    }
    if (has(EFFECT_KEEPOUT)) {
      const n = AnimationControl.createNumEffectRaw(e, null, e.getPlayerByPos(pos), -1, 0, 0, -1, e.offsetImage);
      updateAffectCount(n, counts, pos);
      push(n);
      return;
    }
    if (value !== 0) {
      if (!mp || value >= 0) {
        const n = AnimationControl.createNumEffect(e, value, pos, crit, mp);
        updateAffectCount(n, counts, pos);
        pushFirst(n);
      }
      push(AnimationControl.createHPMPUpdate(e, pos, mp ? 92 : 91, value));
    } else if (has(EFFECT_TOUCH)) {
      const n = AnimationControl.createNumEffect(e, value, pos, crit, mp);
      if (n != null && n.obj instanceof NumEffect) {
        n.obj.setIndex = 2000;
        n.obj.numSet = getImageSet(2000);
      }
      updateAffectCount(n, counts, pos);
      pushFirst(n);
    }
    if (mp) return;
    if (value < 0 || has(EFFECT_DEF_FIELD) || has(EFFECT_TOUCH)) {
      push(AnimationControl.createBattlePlayerAnimation(e, pos, ANI_HURT, ANI_STAND, 1, 0, die, has(EFFECT_DEF_FIELD)));
    }
  }

  /** Splits a skill's sub-controls: effects on the caster run at once, the rest after the hit. */
  private getAniEffectList(e: AniEngine, list: (Control | null)[] | null): void {
    if (list == null || list.length <= 0) return;
    const counts = new Uint8Array(34);
    this.effectControlList ??= [];
    this.selfControlList ??= [];
    for (const c of list) {
      if (c == null) continue;
      if (c.type === TYPE_BATTLE_SELF_EFFECT) AnimationControl.getAniEffectByControl(e, c, null, this.selfControlList);
      else AnimationControl.getAniEffectByControl(e, c, counts, this.effectControlList);
    }
  }
}

/** Several numbers on one fighter come one after another, each a bit higher. */
function updateAffectCount(c: AnimationControl | null, counts: Uint8Array | null, pos: number): void {
  if (c == null || counts == null || pos < 0 || pos >= counts.length) return;
  const n = counts[pos];
  c.setDelay(n * 2);
  c.addVSpeed(-n);
  counts[pos] = n + 1;
}

/**
 * DoAttack: the attack anime (start type: 7 hit, 13 cast, 9 other), then the skill effect on the
 * targets — directly or flying there (AnimeTrace) — and at its check frame the effect steps.
 */
export class DoAttack {
  private step = 0;
  private effectSprite: GameSprite | null = null;
  private lastEffectSprite: GameSprite | null = null;
  private skillCheckSprite: GameSprite | null = null;
  private animeTrace: AnimeTrace | null = null;

  constructor(
    private readonly engine: AniEngine,
    private readonly actor: Player,
    private readonly targets: (Player | null)[] | null,
    private readonly animePos: number,
    private readonly animeStartType: number,
    anime2: number,
    anime3: number,
    private effects: AnimationControl[] | null,
  ) {
    if (anime2 > 0) this.effectSprite = effectSprite(engine, anime2);
    if (anime3 > 0) this.lastEffectSprite = effectSprite(engine, anime3);
  }

  private doInit(): void {
    const t = getAnimeStartType(this.animeStartType);
    const s = this.actor.battleSprite!;
    if (t === 0) s.setCurAnimation(ANI_ATTACK, 1);
    else if (t === 1) s.setCurAnimation(13, 1);
    else if (t === 2) s.setCurAnimation(9, 1);
  }

  private addTargetSkillEffect(): void {
    for (const p of this.targets ?? []) {
      if (p == null) continue;
      const a = GameSprite.cloneSprite(this.effectSprite);
      const b = GameSprite.cloneSprite(this.lastEffectSprite);
      this.skillCheckSprite ??= a ?? b;
      addBattleSprite(a, 1, p);
      addBattleSprite(b, 1, p);
    }
  }

  private setEffectListToBattle(): void {
    for (const c of this.effects ?? []) this.engine.addAnimationControl(c);
    this.effects = null;
  }

  action(): boolean {
    const s = this.actor.battleSprite;
    if (s == null) return true;
    if (this.animePos === 0 && s.getCurAnimationLoopTime() === 0) s.setCurAnimation(ANI_STAND, -1);
    switch (this.step) {
      case 0:
        this.doInit();
        this.step = 1;
        return false;
      case 1: {
        if (!isAnimationIDCheck(s)) return false;
        const trace = getAnimeTraceType(this.animeStartType);
        if (trace !== 0 && this.targets != null && this.effectSprite != null) {
          this.animeTrace = new AnimeTrace(this.engine, trace, this.actor, this.targets, this.effectSprite);
          this.engine.addAnimationControl(this.animeTrace);
          this.step = 3;
          return false;
        }
        this.addTargetSkillEffect();
        if (this.skillCheckSprite == null || getAnimeStartType(this.animeStartType) === 2) this.setEffectListToBattle();
        this.step = 2;
        return false;
      }
      case 2:
        if (!isAnimationIDCheck(this.skillCheckSprite)) return false;
        this.setEffectListToBattle();
        this.step = 4;
        return false;
      case 3:
        if (this.animeTrace == null || this.animeTrace.isEffectCheck()) this.setEffectListToBattle();
        if (this.animeTrace != null && !this.animeTrace.isDone()) return false;
        this.setEffectListToBattle();
        this.step = 4;
        return false;
      default:
        return s.getCurAnimationLoopTime() <= 0;
    }
  }
}

/** AnimeTrace: effect sprites flying to the targets (2 from the caster, 3 from the screen edge) or raining (1). */
export class AnimeTrace extends AnimationControl {
  private checkSprite: GameSprite | null = null;
  private tracePlayerList: Player[] = [];
  private traceSpriteList: GameSprite[] = [];

  constructor(engine: AniEngine, traceType: number, actor: Player, targets: (Player | null)[], private readonly baseSprite: GameSprite) {
    super(engine, traceType);
    this.actorPlayer = actor;
    if (traceType === 1 || actor.battleSprite == null) return;
    const left = isLeftSide(actor.position);
    for (const p of targets) {
      if (p == null || p.battleSprite == null) continue;
      const s = GameSprite.cloneSprite(baseSprite);
      if (s == null) continue;
      s.setCurAnimationLoopTime(1);
      s.setMotionTurnOff(true);
      this.checkSprite ??= s;
      s.setRotate(left);
      if (traceType === 2) s.setSpritePosition(actor.battleSprite.spriteX, actor.battleSprite.spriteY);
      else s.setSpritePosition(left ? 0 : SCREEN_W, p.battleSprite.spriteY);
      this.traceSpriteList.push(s);
      this.tracePlayerList.push(p);
    }
  }

  private actionAnimeTarget(): void {
    for (let i = this.traceSpriteList.length - 1; i >= 0; i--) {
      const s = this.traceSpriteList[i];
      const t = this.tracePlayerList[i]?.battleSprite;
      if (s == null || t == null) continue;
      s.spriteX = entropy(s.spriteX, t.spriteX);
      s.spriteY = entropy(s.spriteY, t.spriteY);
    }
  }

  private actionAnimeAll(): void {
    if (this.actorPlayer == null || this.counter >= 5) return;
    for (let i = 0; i < 3; i++) {
      const s = GameSprite.cloneSprite(this.baseSprite);
      if (s == null) continue;
      s.setCurAnimationLoopTime(1);
      s.setMotionTurnOff(true);
      if (isLeftSide(this.actorPlayer.position)) s.setRotate(true);
      s.setSpritePosition(rand(30, this.engine.battleWidth - 60), rand(this.engine.getPosition(0, 1), this.engine.battleHeight - 40));
      this.traceSpriteList.push(s);
      if (this.counter === 4) this.checkSprite ??= s;
    }
  }

  action(): void {
    if (++this.counter >= 20) {
      this.done();
      return;
    }
    if (this.type === 1) this.actionAnimeAll();
    else if (this.type === 2 || this.type === 3) this.actionAnimeTarget();
    for (let i = this.traceSpriteList.length - 1; i >= 0; i--) {
      const s = this.traceSpriteList[i];
      s.action();
      if (!s.isMotionAlive()) {
        this.traceSpriteList.splice(i, 1);
        if (i < this.tracePlayerList.length) this.tracePlayerList.splice(i, 1);
      }
    }
    if (this.traceSpriteList.length <= 0) this.done();
  }

  isEffectCheck(): boolean {
    if (this.checkSprite == null || !isAnimationIDCheck(this.checkSprite)) return false;
    this.checkSprite = null;
    return true;
  }

  draw(g: Graphics): void {
    for (let i = this.traceSpriteList.length - 1; i >= 0; i--) this.traceSpriteList[i].draw(g, 0, 0);
  }
}
