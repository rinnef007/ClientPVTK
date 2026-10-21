// Port of the world-movement part of com.hz.main.Control (Vineflower decompile of classes2.dex).
// Battle controls (skills, effects, escape) and their serialisation are not ported yet.
import type { Model } from '../actor/Model';
import * as GameWorld from './GameWorld';
import { getDirByMovePixels } from './WorldPanel';

export const DEFAULT_MOVE_SPEED = 6;
export const FLAG_FINISH = 2;
export const FLAG_INIT = 4;
export const TYPE_JUMP_MAP = 1;
export const TYPE_MOVE_TO = 14;
export const TYPE_MOVE = 15;
export const TYPE_PIXEL_MOVE = 80;
export const TYPE_CHANGE_STAGE = 81;

const toByte = (v: number) => (v << 24) >> 24;

export class Control {
  byte0 = 0;
  byte1 = 0;
  byte2 = 0;
  controlStage = 0;
  counter = 0;
  int0 = 0;
  int1 = 0;
  maxCounter = 0;
  model: Model | null = null;
  private statusFlag = 0;
  subControlIndex = 0;
  subControls: (Control | null)[] | null = null;

  constructor(public type: number) {}

  /** One grid step: `speed` px per tick in direction `dir` until 24 px are covered. */
  static createMove(modelId: number, dir: number, speed: number, modelType: number): Control {
    const c = new Control(TYPE_MOVE);
    c.byte1 = toByte(speed);
    c.byte0 = toByte(dir);
    c.byte2 = toByte(modelType);
    c.int0 = modelId;
    return c;
  }

  /** Walk to grid (gx, gy) along GameWorld.searchPath (server-driven moves of other players). */
  static createMoveTo(modelId: number, gx: number, gy: number): Control {
    const c = new Control(TYPE_MOVE_TO);
    c.byte0 = toByte(gx);
    c.byte1 = toByte(gy);
    c.int0 = modelId;
    return c;
  }

  /** A single tick of free pixel movement (the local player's moves). */
  static createPixelMove(modelId: number, dx: number, dy: number, modelType: number, subId = 0): Control {
    const c = new Control(TYPE_PIXEL_MOVE);
    c.byte0 = toByte(dx);
    c.byte1 = toByte(dy);
    c.byte2 = toByte(modelType);
    c.int0 = modelId;
    c.int1 = subId;
    return c;
  }

  static createJumpMap(mapId: number, gx: number, gy: number): Control {
    const c = new Control(TYPE_JUMP_MAP);
    c.int0 = mapId;
    c.byte0 = toByte(gx);
    c.byte1 = toByte(gy);
    return c;
  }

  execute(): void {
    switch (this.type) {
      case TYPE_JUMP_MAP:
        this.executeJumpMap();
        break;
      case TYPE_MOVE_TO:
        this.executeMoveTo();
        break;
      case TYPE_MOVE:
        this.executeMove();
        break;
      case TYPE_PIXEL_MOVE:
        this.executePixelMove();
        break;
      case TYPE_CHANGE_STAGE:
        this.setStatus(FLAG_FINISH, true);
        this.controlStage = this.int0;
        break;
    }
  }

  private executeJumpMap(): void {
    this.setStatus(FLAG_FINISH, true);
    GameWorld.doJumpMap(this.int0, this.byte0, this.byte1);
  }

  private executeMove(): void {
    const dir = this.byte0;
    const speed = this.byte1;
    if (!this.isStatus(FLAG_INIT)) {
      this.model = this.getMoveModel(this.int0, 0, this.byte2);
      if (this.model == null) {
        this.setStatus(FLAG_FINISH, true);
        return;
      }
      this.maxCounter = (24 / speed) | 0;
      if (this.model.getDir() !== dir) this.model.setDir(dir);
      this.model.setAnimationByDir(true);
      this.setStatus(FLAG_INIT, true);
    }
    this.model!.moveDir(dir, speed);
    if (++this.counter >= this.maxCounter) {
      this.model!.setTabStatus(true, 1);
      this.setStatus(FLAG_FINISH, true);
    }
  }

  private executeMoveTo(): void {
    const gx = this.byte0;
    const gy = this.byte1;
    const id = this.int0;
    if (this.counter === 0) {
      this.model = this.getMoveModel(id, 0, 3);
      if (this.model == null) return;
      // (Java: team members are moved by their leader; in-battle stage teleports. Not ported.)
      const path = GameWorld.searchPath(this.model.getGx(), this.model.getGy(), gx, gy, false);
      let n = path.length;
      if (this.isAutoMoveEndStep()) n--;
      if (n <= 0) {
        this.model.setTabStatus(true, 1);
        if (this.isAutoMoveEndStep()) {
          const npc = GameWorld.getNPC(gx, gy);
          if (npc != null) GameWorld.doNpc(npc);
        } else {
          this.model.setPosition(gx, gy);
        }
        this.setStatus(FLAG_FINISH, true);
        return;
      }
      this.subControls = [];
      for (let i = 0; i < n; i++) this.subControls.push(Control.createMove(id, path[i], DEFAULT_MOVE_SPEED, this.model.getType()));
      this.counter = 1;
    }
    if (this.executeSubControls()) {
      this.setStatus(FLAG_FINISH, true);
      if (this.isAutoMoveEndStep()) {
        const npc = GameWorld.getNPC(gx, gy);
        if (npc != null) GameWorld.doNpc(npc);
      }
    }
  }

  private executePixelMove(): void {
    const dx = this.byte0;
    const dy = this.byte1;
    this.setStatus(FLAG_FINISH, true);
    this.model = this.getMoveModel(this.int0, this.int1, this.byte2);
    if (this.model == null) return;
    const dir = getDirByMovePixels(dx, dy, false);
    if (this.model.getDir() !== dir) this.model.setDir(dir);
    this.model.setAnimationByDir(true);
    this.model.move(dx, dy);
    this.model.setTabStatus(true, 1);
  }

  /** Runs sub-controls one at a time; true once all are done. */
  executeSubControls(): boolean {
    const subs = this.subControls;
    if (subs != null && this.subControlIndex >= 0 && this.subControlIndex < subs.length) {
      const c = subs[this.subControlIndex];
      if (c == null) this.subControlIndex++;
      else {
        c.execute();
        if (c.isStatus(FLAG_FINISH)) this.subControlIndex++;
      }
      return false;
    }
    return true;
  }

  /** Type 1 = NPC, 3 = player model; pets (4) and mercenaries (5) are not ported. */
  private getMoveModel(id: number, _subId: number, modelType: number): Model | null {
    if (modelType === 1) return GameWorld.getNpcByID(id);
    if (modelType === 3) return GameWorld.getModel(id);
    return null;
  }

  isAutoMoveEndStep(): boolean {
    return this.int1 === 1;
  }

  setAutoMoveEndStep(): void {
    this.int1 = 1;
  }

  isStatus(bit: number): boolean {
    return (bit & this.statusFlag) !== 0;
  }

  setStatus(bit: number, on: boolean): void {
    this.statusFlag = (this.statusFlag & ~bit) | (on ? bit : 0);
  }
}
