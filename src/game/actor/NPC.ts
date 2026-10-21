// Port of the wandering part of com.hz.actor.NPC (Vineflower decompile of classes2.dex).
// Not ported: dialogs, quests, battles, welcome frames, jump-map NPCs.
import type { Graphics } from '../../midp/Graphics';
import { getXKey, getYKey, isColliding, rand } from '../common/Tool';
import { Control } from '../main/Control';
import * as GameWorld from '../main/GameWorld';
import { getFaceXY } from '../main/WorldPanel';
import { Model, TYPE_NPC } from './Model';

export const NPC_TYPE_MONSTER = 1;
export const NPC_TYPE_JUMP = 8;

export class NPC extends Model {
  npcType = 0;
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
