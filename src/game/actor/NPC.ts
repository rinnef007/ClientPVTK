// Port of the wandering part of com.hz.actor.NPC (Vineflower decompile of classes2.dex).
// The quest data (missions offered, talk text, sign) is here; the dialog flow is in
// ui/screens/mission.ts. Not ported: welcome frames.
import type { Graphics } from '../../midp/Graphics';
import { getXKey, getYKey, isColliding, rand } from '../common/Tool';
import { Control } from '../main/Control';
import * as GameWorld from '../main/GameWorld';
import { getFaceXY } from '../main/WorldPanel';
import type { Mission } from '../core/Mission';
import { Model, TYPE_NPC } from './Model';

export const NPC_TYPE_MONSTER = 1;
/** npcType 2: a shop keeper (NPC.doSpecialNpc offers its topic, which opens shopID[0]). */
export const NPC_TYPE_SHOP = 2;
/** npcType 3: a gate (its topic jumps to jumpMap[0]); 5: a "power" NPC with menus; 8: a jump area. */
export const NPC_TYPE_GATE = 3;
export const NPC_TYPE_POWER = 5;
export const NPC_TYPE_JUMP = 8;

/**
 * One entry of a gate / power NPC (NPC.menuJumpMap + jumpMapID / Gx / Gy, menuBattle + battleID,
 * menuShop + shopID, menuTeacher + teacherId, each with the mission state it needs).
 */
export interface NpcMenu {
  text: string;
  id: number;
  gx?: number;
  gy?: number;
  reqMissionID: number;
  reqMissionState: number;
}

export class NPC extends Model {
  npcType = 0;
  /**
   * Quest sign over the NPC (set 11, frame sign-1: 1 orange ?, 2 grey ?, 3 orange !, 4 grey !) and on
   * the mini map; the server sets it (processMissionNPCStatus → setSign).
   */
  icon2 = 0;
  /** Missions this NPC offers (NPC.missions, loaded from the server by doGetMissionData). */
  missions: Mission[] = [];
  /** NPC tab status 4: its missions were fetched from the server (doGetMissionData). */
  missionsLoaded = false;
  /** Greeting shown above the mission list (NPC.talkDetail). */
  talkDetail: string | null = null;
  /** The special NPC's menu entry (NPC.topic), e.g. the shop's name. */
  topic = '';
  /** Shops this NPC opens (NPC.shopID). */
  shopID: number[] = [];
  /** A battle NPC's monster groups (NPC.battleID) and seconds before it comes back after a fight. */
  battleID: number[] = [];
  comeOutTime = 0;
  /** Gate (type 3) and power NPC (type 5) menus. */
  jumpMap: NpcMenu[] = [];
  menuBattle: NpcMenu[] = [];
  menuShop: NpcMenu[] = [];
  menuTeacher: NpcMenu[] = [];
  teacherId: number[] = [];
  private comeOutCounter = 0;
  status = 0;
  rangeX = 0;
  rangeY = 0;
  sourceGx = 0;
  sourceGy = 0;
  private visible = true;
  private enable = true;
  private nextMoveTime = 0;

  constructor() {
    super(TYPE_NPC);
  }

  getSign(): number {
    return this.icon2;
  }
  setSign(v: number): void {
    this.icon2 = v;
  }
  /** NPC.getMissonById: one of the missions this NPC offers. */
  getMissonById(id: number): Mission | null {
    return this.missions.find((m) => m.getId() === id) ?? null;
  }
  /** Status bit 32: drawn on the mini map with the jump marker. */
  isJumpIcon(): boolean {
    return (this.status & 32) !== 0;
  }

  isVisible(): boolean {
    return this.visible;
  }
  setVisible(v: boolean): void {
    this.visible = v;
  }
  setEnable(v: boolean): void {
    this.enable = v;
  }
  isEnable(): boolean {
    return this.enable;
  }

  /** NPC.isInJumpMapArea: (gx, gy) inside the spawn cell ± range (jump areas, type 8). */
  isInJumpMapArea(gx: number, gy: number): boolean {
    return gx >= this.sourceGx - this.rangeX && gx <= this.sourceGx + this.rangeX
      && gy >= this.sourceGy - this.rangeY && gy <= this.sourceGy + this.rangeY;
  }

  /** Remembers the spawn cell that bounds wandering. */
  setSource(gx: number, gy: number, rangeX: number, rangeY: number): void {
    this.setPosition(gx, gy);
    this.sourceGx = gx;
    this.sourceGy = gy;
    this.rangeX = rangeX;
    this.rangeY = rangeY;
  }

  /** NPC.hide: gone for comeOutTime seconds (`afterBattle`) or 150 ticks. */
  hide(afterBattle: boolean): void {
    if (!this.isVisible()) return;
    this.setVisible(false);
    this.setEnable(false);
    this.comeOutCounter = afterBattle ? this.comeOutTime * 10 : 150;
  }

  logic(): void {
    if (this.comeOutCounter > 0) {
      if (--this.comeOutCounter <= 0) {
        this.setVisible(true);
        this.setEnable(true);
      }
      return;
    }
    super.logic();
    if (this.controlList.length === 0 && Date.now() > this.nextMoveTime && this.isNPCInScreen()) this.createMoveControl();
  }

  private isNPCInScreen(): boolean {
    const m = GameWorld.gameMap;
    if (!m) return false;
    return isColliding(this.getPx() + m.offsetX - 6, this.getPy() + m.offsetY - 26, 36, 50, 0, 0, m.screenWidth, m.screenHeight);
  }

  private updateNextMoveTime(): void {
    this.nextMoveTime = Date.now() + rand(2, 5) * 1000;
  }

  /** Every 2–5 s: one grid step (2 px/tick) in the first free direction, within the range box. */
  private createMoveControl(): void {
    if (!this.visible || !this.enable || this.npcType === NPC_TYPE_JUMP) return;
    if (this.rangeX <= 0 || this.rangeY <= 0) return;
    const map = GameWorld.gameMap;
    if (!map) return;
    this.updateNextMoveTime();
    let d = rand(0, 7);
    const gx = this.getGx();
    const gy = this.getGy();
    for (let i = 0; i < 7; i++) {
      d = (d + 1) % 8;
      const k = getFaceXY(gx, gy, d);
      const nx = getXKey(k);
      const ny = getYKey(k);
      if (
        nx >= 0 && nx < map.mapColumns && ny >= 0 && ny < map.mapRows &&
        map.isCanPass(nx, ny) &&
        Math.abs(nx - this.sourceGx) <= this.rangeX &&
        Math.abs(ny - this.sourceGy) <= this.rangeY
      ) {
        this.controlList.push(Control.createMove(this.id, d, 2, this.getType()));
        return;
      }
    }
  }

  /** PlayerLayer.drawModel (NPC branch) without the name/sign decorations. */
  drawOnMap(g: Graphics, ox: number, oy: number): void {
    if (this.visible) super.drawOnMap(g, ox, oy);
  }
}
