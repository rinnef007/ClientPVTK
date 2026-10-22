// Port of the wandering part of com.hz.actor.NPC (Vineflower decompile of classes2.dex).
// The quest data (missions offered, talk text, sign) is here; the dialog flow is in
// ui/screens/mission.ts. Not ported: shops, battles, welcome frames, jump-map NPCs.
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
export const NPC_TYPE_JUMP = 8;

export class NPC extends Model {
  npcType = 0;
  /**
   * Quest sign over the NPC (set 11, frame sign-1: 1 orange ?, 2 grey ?, 3 orange !, 4 grey !) and on
   * the mini map; the server sets it (processMissionNPCStatus → setSign).
   */
  icon2 = 0;
  /** Missions this NPC offers (NPC.missions, loaded from the server by doGetMissionData). */
  missions: Mission[] = [];
  /** Greeting shown above the mission list (NPC.talkDetail). */
  talkDetail: string | null = null;
  /** The special NPC's menu entry (NPC.topic), e.g. the shop's name. */
  topic = '';
  /** Shops this NPC opens (NPC.shopID). */
  shopID: number[] = [];
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
  isEnable(): boolean {
    return this.enable;
  }

  /** Remembers the spawn cell that bounds wandering. */
  setSource(gx: number, gy: number, rangeX: number, rangeY: number): void {
    this.setPosition(gx, gy);
    this.sourceGx = gx;
    this.sourceGy = gy;
    this.rangeX = rangeX;
    this.rangeY = rangeY;
  }

  logic(): void {
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
