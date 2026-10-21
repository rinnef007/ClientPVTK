// Port of the movement/animation core of com.hz.actor.Model (Vineflower decompile of classes2.dex).
// Not ported: team/pet/mercenary following, stats, money, VIP, serialisation.
import type { Graphics } from '../../midp/Graphics';
import type { Control } from '../main/Control';
import { TILE } from '../map/TileLayer';
import type { MapModel } from '../map/PlayerLayer';
import type { GameSprite } from '../sprite/GameSprite';

export const DIR_RIGHT = 0;
export const DIR_LEFT = 1;
export const DIR_DOWN = 2;
export const DIR_UP = 3;
export const DIR_LEFT_UP = 4;
export const DIR_LEFT_DOWN = 5;
export const DIR_RIGHT_UP = 6;
export const DIR_RIGHT_DOWN = 7;
export const DIR_NONE = 8;

export const TYPE_NPC = 1;
export const TYPE_PLAYER = 3;

/** Tab status bit set when a move finished; the next idle tick switches back to standing. */
export const TAB_MOVE_END = 1;

export class Model implements MapModel {
  id = 0;
  name = '';
  px = 0;
  py = 0;
  private dir = DIR_DOWN;
  private intValue1 = 0;
  controlList: Control[] = [];
  playerSprite: GameSprite | null = null;
  /** Shown in player lists (server data in the real game). */
  level = 0;
  job = 0;
  remark = '';
  /** 0 none, 1 team leader, 2 team member. */
  teamRole = 0;
  /** Model.getMode: 1 = shop (stall) mode, 50/51 fighting, 52 duel, 53 watched battle. */
  mode = 0;
  shopType = 0;
  shopName = '';
  hasPhoto = false;

  constructor(protected readonly type: number) {}

  getType(): number {
    return this.type;
  }
  isPlayerTeam(): boolean {
    return this.teamRole !== 0;
  }
  isLeader(): boolean {
    return this.teamRole === 1;
  }
  isMember(): boolean {
    return this.teamRole === 2;
  }
  isShopMode(): boolean {
    return this.mode === 1;
  }
  isBattleMode(): boolean {
    return this.mode === 50 || this.mode === 51;
  }
  getRemark(): string {
    return this.remark;
  }
  getLevel(): number {
    return this.level;
  }
  getJob(): number {
    return this.job;
  }

  /** Model.getModelString: team role, then what the model is doing ("Nghỉ" when idle). */
  getModelString(): string {
    let s = '';
    if (this.isPlayerTeam()) s += this.isLeader() ? '(Đội trưởng )' : '(Đội viên)';
    if (this.mode === 1) s += this.shopType === 1 ? 'Phụ Ma' : this.shopType === 0 ? 'B.Bán' : '';
    else if (this.mode === 53) s += 'Xem chiến';
    else if (this.mode === 52) s += 'Quyết đấu';
    else if (this.mode === 50 || this.mode === 51) s += 'Chiến đấu';
    return s.trim() ? s : 'Nghỉ';
  }
  getId(): number {
    return this.id;
  }
  getName(): string {
    return this.name;
  }
  getPx(): number {
    return this.px;
  }
  getPy(): number {
    return this.py;
  }
  getGx(): number {
    return (this.px / TILE) | 0;
  }
  getGy(): number {
    return (this.py / TILE) | 0;
  }
  getDir(): number {
    return this.dir;
  }

  /** Diagonals collapse to the horizontal facing (sprites only face left/right). */
  setDir(d: number): void {
    switch (d) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 8:
        this.dir = d;
        break;
      case 4:
      case 5:
        this.dir = DIR_LEFT;
        break;
      case 6:
      case 7:
        this.dir = DIR_RIGHT;
    }
  }

  setPosition(gx: number, gy: number): void {
    this.px = gx * TILE;
    this.py = gy * TILE;
  }

  setTabStatus(on: boolean, bit: number): void {
    this.intValue1 = on ? this.intValue1 | bit : this.intValue1 & ~bit;
  }
  isTabStatus(bit: number): boolean {
    return (bit & this.intValue1) !== 0;
  }

  getPlayerSprite(): GameSprite | null {
    return this.playerSprite;
  }
  setPlayerSprite(s: GameSprite | null): void {
    this.playerSprite = s;
  }

  /** Shop mode, team membership and escort are not ported, so a model can always move. */
  isCanMove(): boolean {
    return true;
  }

  logic(): void {
    this.playerSprite?.action();
    this.excuteControlList(this.controlList);
  }

  /** Model.logicPlayer also ticks the pet and mercenaries, which are not ported. */
  logicPlayer(): void {
    this.logic();
  }

  /** Runs the head control; when idle after a move, returns to the standing animation. */
  excuteControlList(list: Control[]): void {
    if (list.length === 0) {
      if (this.isTabStatus(TAB_MOVE_END)) {
        this.setAnimationByDir(false);
        this.setTabStatus(false, TAB_MOVE_END);
      }
      return;
    }
    const c = list[0];
    c.execute();
    if (c.isStatus(2)) list.splice(list.indexOf(c), 1);
  }

  addControl(c: Control | null): void {
    if (c != null) this.controlList.push(c);
  }

  isControlListEmpty(): boolean {
    return this.controlList.length === 0;
  }

  /** Steps `speed` px in direction `d` (8 directions). */
  moveDir(d: number, speed: number): void {
    switch (d) {
      case 0:
        this.move(speed, 0);
        break;
      case 1:
        this.move(-speed, 0);
        break;
      case 2:
        this.move(0, speed);
        break;
      case 3:
        this.move(0, -speed);
        break;
      case 4:
        this.move(-speed, -speed);
        break;
      case 5:
        this.move(-speed, speed);
        break;
      case 6:
        this.move(speed, -speed);
        break;
      case 7:
        this.move(speed, speed);
    }
  }

  move(dx: number, dy: number): void {
    this.px += dx;
    this.py += dy;
  }

  /** Grid cells the model would overlap after moving by (dx, dy) (used to bump into NPCs). */
  getNextMovePos(dx: number, dy: number): number[][] {
    const x = this.px + dx;
    const y = this.py + dy;
    const gx = (x / TILE) | 0;
    const gy = (y / TILE) | 0;
    if (x % TILE !== 0 && y % TILE !== 0) return [[gx, gy + 1], [gx, gy], [gx + 1, gy + 1], [gx + 1, gy]];
    if (y % TILE !== 0) return [[gx, gy + 1], [gx, gy]];
    if (x % TILE !== 0) return [[gx, gy], [gx + 1, gy]];
    return [[gx, gy]];
  }

  /** Walking uses animation 2; standing 0 (or 4, the battle stand, when a sprite lacks 0). */
  setAnimationByDir(walking: boolean): void {
    const s = this.playerSprite;
    if (s == null) return;
    if (walking) s.setCurAnimation(2);
    else if (!s.setCurAnimation(0)) s.setCurAnimation(4);
    this.setSpriteRotateByDir();
  }

  /** Sprites face right when rotated; up/down keep the previous facing. */
  setSpriteRotateByDir(): void {
    const s = this.playerSprite;
    if (s == null) return;
    let rot = s.getRotate();
    if (this.dir === DIR_RIGHT) rot = true;
    else if (this.dir === DIR_LEFT) rot = false;
    if (rot !== s.getRotate()) s.setRotate(rot);
  }

  /** PlayerLayer.drawModel: the sprite foot sits at the bottom centre of the model's cell. */
  drawOnMap(g: Graphics, ox: number, oy: number): void {
    this.playerSprite?.draw(g, this.px + ox + 12, this.py + oy + 24);
  }
}
