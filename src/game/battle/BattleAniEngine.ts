// com.hz.battle.BattleAniEngine (1.2.0, Vineflower decompile): the battle screen. It places the
// fighters (two columns a side, rows by battle size), draws them over the darkened map with the
// round counter and plan timer, plays the animation of each round (BattlePanel.getSequenceList →
// AnimationControl) and, when the fight is over, shows win / lose and reports the local battle
// result (12502). Remote, arena, team-boss and watched battles are not ported.
import { Monster } from '../actor/Monster';
import type { Player } from '../actor/Player';
import { drawGameImage, readPNGFile } from '../common/Utilities';
import type { Image } from '../image/Image';
import type { ImageSet } from '../image/ImageSet';
import { TYPE_BATTLE_ESCAPE, TYPE_BATTLE_SKILL, TYPE_BATTLE_TARGET_EFFECT, type Control } from '../main/Control';
import { drawBorderString, fillAlphaRect, getImageSet } from '../main/GameView';
import { GameSprite } from '../sprite/GameSprite';
import type { Graphics } from '../../midp/Graphics';
import { AnimationControl, SCREEN_H, SCREEN_W, type AniEngine } from './AnimationControl';
import {
  RESULT_LEFT_WIN, RESULT_RIGHT_WIN, RESULT_ROUND_OVER, getPositionColumn, getPositionSide, isLeftSide, type Battle,
} from './Battle';
import { BattlePanel } from './BattlePanel';

export const BUFF_IMAGE_SET = 10;
export const SPRITE_BASE_CURSOR = 1207;
export const SPRITE_EFF_HIT = 1303;
export const SPRITE_EFF_MAGIC_FIELD = 1225;
export const SPRITE_UNKNOWN_FIGHTER = 1232;
const TOP_HEIGHT = 40;
const BOTTOM_HEIGHT = 30;
const END_COUNT = 23;

/** BattleAniEngine tags. */
export const TAG_ALL_END = 1;
export const TAG_PLAYER_PLAN_END = 2;
export const TAG_MAP_INIT = 4;
export const TAG_HAVE_MY_PET = 16;
export const TAG_PET_ORDER = 32;
export const TAG_IS_AUTO_FIGHT = 4096;

/** BattleAniEngine.getBufferImageIndex: the status icon (image set 10) of a status. */
export function getBufferImageIndex(status: number): number {
  switch (status) {
    case 1: return 5;
    case 2: return 6;
    case 3: return 3;
    case 4: return 1;
    case 5: return 13;
    case 6: return 14;
    case 7: return 15;
    case 8: return 16;
    case 9: return 17;
    case 10: return 18;
    case 14: return 2;
    case 15: return 10;
    case 16: return 11;
    case 21: return 7;
    case 30: return 19;
    case 31: return 9;
    case 17: case 18: case 19: case 20: case 22: case 23: case 24: case 32: return 8;
    default: return 0;
  }
}

/** What the engine needs from the screen that runs it. */
export interface BattleHost {
  /** The battle sprite of a fighter (images already loaded). */
  createFighterSprite(p: Player): GameSprite | null;
  /** The local battle result (12502): start / end HP and MP, seed, group and plans. */
  sendLocalBattleReward(e: BattleAniEngine): void;
  /** Back to the world (stage 20). */
  exit(e: BattleAniEngine): void;
  /** Auto-fight setting kept between battles (GameWorld.TAG_IS_AUTO_FIGHT_FLAG). */
  autoFight: boolean;
}

export class BattleAniEngine implements AniEngine {
  animationControlList: AnimationControl[] = [];
  readonly baseCurSprite: GameSprite | null;
  readonly battlePanel: BattlePanel;
  private readonly battlePosition: number[][] = [new Array(34).fill(0), new Array(34).fill(0)];
  readonly battleWidth = SCREEN_W;
  readonly battleHeight = SCREEN_H;
  private readonly battleX = 0;
  private readonly battleY = 0;
  readonly buffSet: ImageSet | null;
  readonly criticalImage: Image | null;
  readonly blockImage: Image | null;
  readonly missImage: Image | null;
  readonly offsetImage: Image | null;
  readonly effHitSprite: GameSprite | null;
  readonly effMagicFieldSprite: GameSprite | null;
  endCounter = -1;
  private frontPlayerVector: Player[] = [];
  private readonly lostImage: Image | null;
  private readonly winImage: Image | null;
  private readonly okImage: Image | null;
  private planSequenceList: Control[][] | null = null;
  private readonly columns: (Player | null)[][] = [new Array(10).fill(null), new Array(10).fill(null), new Array(7).fill(null), new Array(7).fill(null)];
  private readonly posData = [0, 0, 0, 0];
  startHP = 0;
  startMP = 0;
  private tagValue = 0;
  private exited = false;

  constructor(
    private readonly battle: Battle,
    readonly me: Player,
    private readonly host: BattleHost,
    private readonly background: Image | null,
  ) {
    this.criticalImage = readPNGFile('/common/bo.png');
    this.winImage = readPNGFile('/common/bwin.png');
    this.lostImage = readPNGFile('/common/blost.png');
    this.okImage = readPNGFile('/common/ok.png');
    this.blockImage = readPNGFile('/common/block.png');
    this.missImage = readPNGFile('/common/miss.png');
    this.offsetImage = readPNGFile('/common/offset.png');
    this.buffSet = getImageSet(BUFF_IMAGE_SET);
    this.baseCurSprite = GameSprite.createSprite(SPRITE_BASE_CURSOR, true);
    this.effHitSprite = GameSprite.createSprite(SPRITE_EFF_HIT, true);
    this.effMagicFieldSprite = GameSprite.createSprite(SPRITE_EFF_MAGIC_FIELD, true);
    const rowL = battle.getRowLeft();
    const rowR = battle.getRowRight();
    const y = this.battleY + TOP_HEIGHT;
    const h = this.battleHeight - TOP_HEIGHT - BOTTOM_HEIGHT;
    this.initBattlePosition(this.battleX, y, this.battleWidth, h, this.getOffsetY(h, rowL), rowL, false);
    this.initBattlePosition(this.battleX, y, this.battleWidth, h, this.getOffsetY(h, rowR), rowR, true);
    this.battlePanel = new BattlePanel(this);
    if (host.autoFight) this.setTag(TAG_IS_AUTO_FIGHT, true);
    for (let i = 0; i < 34; i++) this.addBattlePlayer(this.getPlayerByPos(i), i);
    this.checkMyPetInBattle();
    this.updateBattlePlayerInfo(0);
  }

  getBattle(): Battle {
    return this.battle;
  }

  getPlayerByPos(pos: number): Player | null {
    return this.battle.getPlayerByPos(pos);
  }

  getPosition(pos: number, coord: number): number {
    return pos >= 0 && pos < 34 ? this.battlePosition[coord][pos] : 0;
  }

  private setPosition(pos: number, coord: number, v: number): void {
    if (pos >= 0 && pos < 34) this.battlePosition[coord][pos] = v;
  }

  getPosData(i: number): number {
    return i >= 0 && i < this.posData.length ? this.posData[i] : 0;
  }

  isTag(t: number): boolean {
    return (this.tagValue & t) !== 0;
  }

  setTag(t: number, on: boolean): void {
    this.tagValue = on ? this.tagValue | t : this.tagValue & ~t;
  }

  addAnimationControl(c: AnimationControl | null): void {
    if (c != null) this.animationControlList.push(c);
  }

  private addPlayerPlanControl(pos: number, c: AnimationControl | null): void {
    if (c != null) this.getPlayerByPos(pos)?.battlePlanControlList.push(c);
  }

  updateBattlePlayerInfo(kind: number): void {
    this.battlePanel.updateBattlePlayerInfo(kind, this.isTag(TAG_HAVE_MY_PET));
  }

  setAutoFight(on: boolean): void {
    this.host.autoFight = on;
  }

  // ---- layout ----

  /** BattleAniEngine.getOffsetY: the extra row spacing when few rows are used (≤ 12). */
  private getOffsetY(h: number, rows: number): number {
    if (rows === 0 || rows >= 10 || h <= rows * 40) return 0;
    return Math.min(12, Math.max(0, Math.trunc((h - rows * 40) / rows)));
  }

  /** BattleAniEngine.initBattlePosition: the foot point of every position of a side. */
  private initBattlePosition(x0: number, y0: number, w: number, h: number, offsetY: number, rows: number, right: boolean): void {
    const rowH = Math.trunc((h - offsetY) / rows);
    let space = Math.trunc(w / 2) - 60;
    const margin = Math.max(5, Math.trunc(space / 10));
    space = Math.max(0, space - margin);
    const colGap = Math.trunc((space * 3) / 10);
    if (right) {
      this.posData[1] = rowH;
      this.posData[3] = colGap;
    } else {
      this.posData[0] = rowH;
      this.posData[2] = colGap;
    }
    const edge = right ? x0 + w - margin : x0 + margin;
    const base = right ? 20 : 0;
    for (let pos = base; pos < rows * 2 + base; pos++) {
      const col = getPositionColumn(pos);
      const row = Math.trunc((pos - base) / 2) + 1;
      let y = y0 + rowH * row;
      if (col === 2 || col === 3) y += offsetY;
      let x: number;
      if (right) {
        x = edge - 15;
        if (col === 3) x -= colGap + 30;
      } else {
        x = edge + 15;
        if (col === 2) x += colGap + 30;
      }
      if (rows >= 10 && (row & 1) === 0) x += right ? -Math.trunc((colGap * 2) / 3) : Math.trunc((colGap * 2) / 3);
      this.setPosition(pos, 0, x);
      this.setPosition(pos, 1, y);
    }
  }

  private setColumnPlayer(p: Player, pos: number): void {
    const col = getPositionColumn(pos);
    const idx = col === 1 ? pos >> 1 : col === 2 ? (pos - 1) >> 1 : col === 3 ? (pos - 20) >> 1 : (pos - 21) >> 1;
    const list = this.columns[col - 1];
    if (idx >= 0 && idx < list.length) list[idx] = p;
  }

  private addBattlePlayer(p: Player | null, pos: number): void {
    if (p == null) return;
    p.battlePlanControlList = [];
    p.battleEffectSpriteList = [];
    p.position = pos;
    this.setColumnPlayer(p, pos);
    p.battleSprite = this.host.createFighterSprite(p) ?? GameSprite.createSprite(SPRITE_UNKNOWN_FIGHTER, true);
    if (!(p instanceof Monster)) p.checkHPMP();
    if (p === this.me) {
      this.startHP = p.get(2);
      this.startMP = p.get(3);
    }
    p.set(91, p.get(2));
    p.set(92, p.get(3));
    p.dieSprite = GameSprite.cloneSprite(this.baseCurSprite);
    p.dieSprite?.setCurAnimation(2, -1);
    if (isLeftSide(pos)) p.battleSprite?.setRotate(true);
    else p.dieSprite?.setRotate(true);
    p.battleSprite?.setCurAnimation(4, -1);
    p.battleSprite?.setSpritePosition(this.getPosition(pos, 0), this.getPosition(pos, 1));
    p.dieSprite?.setSpritePosition(this.getPosition(pos, 0), this.getPosition(pos, 1));
    if ((p.isBattleStatus(1n) || p.isDead()) && p.battleSprite != null) p.battleSprite.setSpriteVisible(false);
  }

  /** BattleAniEngine.checkMyPetInBattle: the player's pet next to them takes orders too. */
  private checkMyPetInBattle(): void {
    this.setTag(TAG_HAVE_MY_PET, false);
    const pos = this.me.position;
    if (this.getPlayerByPos(pos) !== this.me) return;
    const pet = this.getPlayerByPos(isLeftSide(pos) ? pos + 1 : pos - 1);
    if (pet == null || pet.getType() !== 4) return;
    this.setTag(TAG_HAVE_MY_PET, true);
    this.battlePanel.setOrderPet(pet);
  }

  // ---- animation ----

  /** Builds this round's steps from the battle's controls (BattleAniEngine.makeBattleAni). */
  makeBattleAni(): void {
    const list = this.battlePanel.getSequenceList();
    if (list != null && list.length > 0) this.planSequenceList = list;
    this.battle.cleanAniControlList();
  }

  /** BattleAniEngine.makeBattleAnim: the next group of controls once the last one finished. */
  private makeBattleAnim(): void {
    const seq = this.planSequenceList;
    if (seq == null || seq.length <= 0 || !this.isTag(TAG_PLAYER_PLAN_END)) return;
    const group = seq.shift()!;
    if (group.length <= 0) return;
    const counts = new Uint8Array(34);
    let delay = 0;
    for (const c of group) {
      if (c == null) continue;
      const pos = c.byte0;
      if (c.type === TYPE_BATTLE_SKILL) {
        const a = AnimationControl.createBattleSkill(this, c);
        this.addPlayerPlanControl(pos, a);
        a.setDelay(delay);
        delay += 8;
      } else if (c.type === TYPE_BATTLE_ESCAPE) {
        this.addPlayerPlanControl(pos, AnimationControl.createBattlePlayerEscape(this, c));
      } else if (c.type === TYPE_BATTLE_TARGET_EFFECT) {
        const out: AnimationControl[] = [];
        AnimationControl.getAniEffectByControl(this, c, counts, out);
        for (const a of out) this.addAnimationControl(a);
      }
    }
    this.setTag(TAG_ALL_END, false);
  }

  /** BattleAniEngine.doBattleAnimations: one tick of every fighter's and effect's animation. */
  private doBattleAnimations(): void {
    this.setTag(TAG_ALL_END, true);
    this.setTag(TAG_PLAYER_PLAN_END, true);
    this.frontPlayerVector = [];
    for (const p of this.battle.playerList) {
      const s = p?.battleSprite;
      if (p == null || s == null) continue;
      s.action();
      if (p.battleMessageCount > 0 && --p.battleMessageCount === 0) p.battleMessage = null;
      if (p.battlePlanControlList.length > 0) {
        const a = p.battlePlanControlList[0];
        this.setTag(TAG_ALL_END, false);
        this.setTag(TAG_PLAYER_PLAN_END, false);
        a.action();
        if (a.isDone()) p.battlePlanControlList.shift();
      }
      if (s.isFront()) this.frontPlayerVector.push(p);
      for (let i = p.battleEffectSpriteList.length - 1; i >= 0; i--) {
        const fx = p.battleEffectSpriteList[i];
        this.setTag(TAG_ALL_END, false);
        fx.action();
        if (!fx.isMotionAlive()) {
          p.battleEffectSpriteList.splice(i, 1);
          if (fx === p.dieSprite) {
            fx.setMotionAlive(true);
            fx.setSpritePosition(s.spriteX, s.spriteY);
          }
        }
      }
    }
    for (let i = this.animationControlList.length - 1; i >= 0; i--) {
      const a = this.animationControlList[i];
      if (a.type === 5) this.setTag(TAG_PLAYER_PLAN_END, false);
      this.setTag(TAG_ALL_END, false);
      a.action();
      if (a.isDone()) this.animationControlList.splice(i, 1);
    }
    this.makeBattleAnim();
  }

  /** BattleAniEngine.closePlayerAnimation: skips to the round's end state. */
  closePlayerAnimation(): void {
    this.frontPlayerVector = [];
    for (const p of this.battle.playerList) {
      if (p == null) continue;
      p.set(91, p.get(2));
      p.set(92, p.get(3));
      p.battleEffectSpriteList = [];
      p.battlePlanControlList = [];
      p.battleMessage = null;
      const s = p.battleSprite;
      if (s == null) continue;
      s.setFront(false);
      s.setCurAnimation(4, -1);
      s.setSpritePosition(this.getPosition(p.position, 0), this.getPosition(p.position, 1));
      s.setSpriteVisible(!(p.isBattleStatus(1n) || p.isDead()));
      if (p.dieSprite != null) {
        p.dieSprite.setMotionAlive(true);
        p.dieSprite.setSpritePosition(s.spriteX, s.spriteY);
      }
    }
    this.animationControlList = [];
    this.planSequenceList = [];
    this.setTag(TAG_ALL_END, true);
    this.updateBattlePlayerInfo(2);
  }

  isWin(): boolean {
    return getPositionSide(this.me.position) === 1 ? this.battle.result === RESULT_LEFT_WIN : this.battle.result === RESULT_RIGHT_WIN;
  }

  setEndCounter(): void {
    this.endCounter = END_COUNT;
  }

  /** One tick (BattleAniEngine.logic): animation, then orders or the end of the fight. */
  logic(key: number): void {
    this.doBattleAnimations();
    if (!this.isTag(TAG_ALL_END)) {
      this.battlePanel.logicAnimePlaying(key);
      return;
    }
    if (this.endCounter <= 0) {
      if (this.battle.isBattleFinish()) {
        this.battlePanel.closeAllUI();
        this.setEndCounter();
        this.host.sendLocalBattleReward(this);
        return;
      }
      this.battlePanel.logic(key);
      return;
    }
    if (this.endCounter > 1) {
      this.endCounter--;
    } else if (!this.exited) {
      this.exited = true;
      this.host.exit(this);
    }
  }

  // ---- drawing ----

  private drawPlayer(g: Graphics, p: Player): void {
    const s = p.battleSprite;
    if (s == null) return;
    s.draw(g, this.battleX, this.battleY);
    if (!s.isSpriteVisible() && p.isDead()) p.dieSprite?.draw(g, this.battleX, this.battleY);
    for (let i = p.battleEffectSpriteList.length - 1; i >= 0; i--) p.battleEffectSpriteList[i].draw(g, this.battleX, this.battleY);
    if (p.battleMessage) {
      const dx = p.getType() === 4 ? (isLeftSide(p.position) ? 30 : -30) : 0;
      drawBorderString(g, 0, 0xffffff, p.battleMessage, this.battleX + s.spriteX + dx, this.battleY + s.spriteY - 60, 33);
    }
    if (this.battle.isWaitStatus(p.position)) drawGameImage(g, this.okImage, this.battleX + s.spriteX, this.battleY + s.spriteY - 10, 33);
  }

  private drawBattlePlayer(g: Graphics): void {
    this.frontPlayerVector.sort((a, b) => a.battleSprite!.spriteY - b.battleSprite!.spriteY);
    for (const col of [this.columns[0], this.columns[1], this.columns[3], this.columns[2]]) {
      for (const p of col) if (p?.battleSprite != null && !p.battleSprite.isFront()) this.drawPlayer(g, p);
    }
    for (const p of this.frontPlayerVector) this.drawPlayer(g, p);
  }

  private drawBattleWinOrLostText(g: Graphics): void {
    const r = this.battle.result;
    const img = this.isWin() ? this.winImage : this.lostImage;
    let y = (SCREEN_H >> 1) - 20;
    if (img == null) {
      drawBorderString(g, 0, 0xffffff, this.isWin() ? 'Thắng' : 'Thua', SCREEN_W >> 1, y, 33);
      return;
    }
    g.drawImage(img, SCREEN_W >> 1, y, 3);
    y += (img.getHeight() / 2) | 0;
    if (r === RESULT_ROUND_OVER) drawBorderString(g, 0, 0xffffff, 'Vượt số hiệp tối đa', SCREEN_W >> 1, y, 17);
  }

  paint(g: Graphics): void {
    g.setColor(0);
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (this.background != null) {
      g.drawImage(this.background, 0, 0, 20);
      // GameMap.initBattleBuffer: the map under a dark veil.
      fillAlphaRect(g, 0x9c000000 | 0, 0, 0, SCREEN_W, SCREEN_H);
    }
    this.battlePanel.drawHLights(g);
    this.drawBattlePlayer(g);
    this.battlePanel.paint(g);
    for (const a of this.animationControlList) a.draw(g);
    g.setColor(0xffffff);
    g.drawString(`Hiệp ${this.battle.round}/30`, SCREEN_W - 13, 6, 24);
    if (this.isTag(TAG_PLAYER_PLAN_END) && this.isTag(TAG_ALL_END) && !this.battle.isBattleFinish()) {
      const t = this.battle.getPlanTime();
      if (t > 0) drawBorderString(g, 0, 0xffffff, String(Math.ceil(t / 1000)), SCREEN_W - 45, 33, 17);
    }
    if (this.endCounter >= 0) this.drawBattleWinOrLostText(g);
  }
}
