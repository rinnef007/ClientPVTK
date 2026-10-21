// Port of com.hz.sprite.Animation: a timed sequence of frames, with optional per-frame drift.
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import { byte2short, toByte, toShort } from '../common/Tool';
import type { GameSprite } from './GameSprite';

export const MOVING = 16;
export const NOT_MOVING = 4;

export class Animation {
  curFrameDurationCounter = 0;
  frameDuration: Int8Array | null = null;
  frameIndex = 0;
  sprite: GameSprite | null = null;
  animationID = -1;
  CheckID = -1;
  frameIds: Int8Array | null = null;
  xSpeed: Int8Array | null = null;
  ySpeed: Int8Array | null = null;
  x = 0;
  y = 0;
  /** -1 loops forever, 0 is stopped, n > 0 plays n more times. */
  loopTime = -1;

  setLoopTime(n: number): void {
    this.loopTime = toByte(n);
    this.init();
  }

  getLoopTime(): number {
    return this.loopTime;
  }

  init(): void {
    this.frameIndex = 0;
    this.curFrameDurationCounter = 0;
    this.x = 0;
    this.y = 0;
  }

  fromBytes(dis: DataInputStream, sprite: GameSprite): void {
    try {
      this.sprite = sprite;
      const n = byte2short(dis.readByte());
      const type = dis.readByte();
      this.animationID = dis.readByte();
      this.CheckID = dis.readByte();
      this.frameIds = new Int8Array(n);
      this.frameDuration = new Int8Array(n);
      this.xSpeed = new Int8Array(n);
      this.ySpeed = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        this.frameIds[i] = dis.readByte();
        this.frameDuration[i] = dis.readByte();
        if (type === MOVING) {
          this.xSpeed[i] = dis.readByte();
          this.ySpeed[i] = dis.readByte();
        }
      }
    } catch {
      // Java swallows read errors here too.
    }
  }

  getAnimationID(): number {
    return this.animationID;
  }

  getCheckID(): number {
    return this.CheckID;
  }

  getWidth(): number {
    const s = this.sprite;
    if (s == null || this.frameIds == null || s.frames == null) return 0;
    let w = 0;
    for (let i = 0; i < this.frameIds.length; i++) {
      const fw = s.frames[this.frameIds[i]]?.getFrameWidth(s) ?? 0;
      if (fw > w) w = fw;
    }
    return w;
  }

  getHeight(): number {
    const s = this.sprite;
    if (s == null || s.frames == null || this.frameIds == null) return 0;
    let h = 0;
    for (let i = 0; i < this.frameIds.length; i++) {
      const fh = s.frames[this.frameIds[i]]?.getFrameHeight(s) ?? 0;
      if (fh > h) h = fh;
    }
    return h;
  }

  getCurFrame(): number {
    return this.frameIndex;
  }

  /** One logic tick. */
  action(): void {
    const ids = this.frameIds;
    const s = this.frameIndex;
    const loop = this.loopTime;
    if (ids == null || s < 0 || s >= ids.length || loop === 0) return;
    this.x += this.xSpeed![s];
    this.y += this.ySpeed![s];
    this.curFrameDurationCounter = toShort(this.curFrameDurationCounter + 1);
    if (this.curFrameDurationCounter >= this.frameDuration![s]) {
      this.curFrameDurationCounter = 0;
      this.frameIndex = toShort(s + 1);
    }
    if (this.frameIndex >= ids.length) {
      if (loop === -1) {
        this.frameIndex = 0;
        return;
      }
      if (loop > 0) {
        const left = toByte(loop - 1);
        this.loopTime = left;
        this.frameIndex = 0;
        if (left <= 0) {
          this.frameIndex = ids.length - 1;
          const sp = this.sprite;
          if (sp == null || !sp.isMotionTurnOff()) return;
          sp.setMotionAlive(false);
          sp.aniCallback?.();
        }
        return;
      }
      this.frameIndex = ids.length - 1;
    }
  }

  draw(g: Graphics, x: number, y: number, mirror: boolean, cloakPass: boolean): void {
    const sp = this.sprite;
    const ids = this.frameIds;
    const s = this.frameIndex;
    if (sp == null || sp.frames == null || ids == null || s < 0 || s >= ids.length) return;
    const frame = sp.frames[byte2short(ids[s])];
    if (frame == null) return;
    const dx = mirror ? x - this.x : x + this.x;
    const dy = y + this.y;
    if (cloakPass) frame.updateCloakCoord(dx, dy, mirror, sp);
    else frame.draw(g, dx, dy, mirror, sp);
  }

  static cloneAnimation(a: Animation | null, sprite: GameSprite | null): Animation | null {
    if (a == null || sprite == null) return null;
    const c = new Animation();
    c.sprite = sprite;
    c.animationID = a.animationID;
    c.CheckID = a.CheckID;
    c.frameIds = a.frameIds;
    c.frameDuration = a.frameDuration;
    c.xSpeed = a.xSpeed;
    c.ySpeed = a.ySpeed;
    return c;
  }
}
