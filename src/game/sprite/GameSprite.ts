// Port of com.hz.sprite.GameSprite (loading, animation and drawing).
// Not ported yet: equipment/appearance composition (createSpriteByIcon, doChangeSpriteIcon),
// VIP/QQ badges, house two-people sprites and server-sent sprite data (FragmentData).
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { byte2short, getXKey, getYKey, setKeyXY, toShort } from '../common/Tool';
import {
  NAME_SUFFIX_FRAGMENT,
  NAME_SUFFIX_PL,
  NAME_SUFFIX_PNG,
  NAME_SUFFIX_SPRITE,
  PATH_ANI,
  PATH_ANI_2,
  drawGameImage,
  getAssetFS,
  getFileByte,
} from '../common/Utilities';
import type { Image } from '../image/Image';
import * as ResourceHandler from '../main/ResourceHandler';
import { Animation } from './Animation';
import { FragmentFile } from './FragmentFile';
import { Frame } from './Frame';

export const ANIMATION_STAND = 0;
export const ANIMATION_STAND_BACK = 1;
export const ANIMATION_MOVE = 2;
export const ANIMATION_MOVE_BACK = 3;
export const SPR_INDEX_MAN_WORLD_START = 100;
export const SPR_INDEX_WOMAN_WORLD_START = 300;
export const SPR_INDEX_PET_WORLD_START = 500;
export const SPRITE_HEIGHT = 60;

const FLAG_HASH_DATA = 1;
const FLAG_MOTION_TURN_OFF = 2;
const FLAG_MOTION_ALIVE = 4;
const FLAG_SPRITE_VISIBLE = 8;
const FLAG_ROTATE = 16;
const FLAG_LOAD_PNG = 32;
const FLAG_FRONT = 64;
const FLAG_SIMPLE_SPRITE = 128;
const FLAG_HIGH_TRANSPORT = 256;

// com.lori.common.Tool constants used as fallback sprite ids.
const SELECT_PICTURE_FROM_CAMERA = 600;
const QQ_PAY_QB = 701;

/**
 * Java finds already-loaded sprites/fragments by scanning the live model, NPC and battle lists
 * (getSpriteByName/getFragmentByName). The web port keeps one registry instead; the effect —
 * reuse instead of reloading — is the same.
 */
const spriteRegistry = new Map<number, GameSprite>();
const fragmentRegistry = new Map<number, FragmentFile>();

export function clearSpriteCache(): void {
  spriteRegistry.clear();
  fragmentRegistry.clear();
}

export class GameSprite {
  cloakSprite: GameSprite | null = null;
  innerSprite: GameSprite | null = null;
  private curAnimation: Animation | null = null;
  nameID = -1;
  simplePng: Image | null = null;
  private spriteStatusFlag = 0;
  spriteX = 0;
  spriteY = 0;
  private widthAndHeight = 0;
  aniCallback: (() => void) | null = null;
  fragmentFiles: (FragmentFile | null)[] | null = null;
  frames: Frame[] | null = null;
  animations: Animation[] | null = null;

  private constructor(nameId: number) {
    this.nameID = nameId;
    this.setSpriteVisible(true);
    this.setMotionAlive(true);
  }

  getCurAnimation(): Animation | null {
    return this.curAnimation;
  }

  getCurAniID(): number {
    return this.curAnimation ? this.curAnimation.getAnimationID() : -1;
  }

  setCurAnimationObj(a: Animation | null): boolean {
    if (a == null) {
      if (this.simplePng == null) return false;
      this.initWidthAndHeight(this.simplePng.getWidth(), this.simplePng.getHeight());
      return false;
    }
    if (this.curAnimation === a) return true;
    this.curAnimation = a;
    this.initWidthAndHeight(a.getWidth(), a.getHeight());
    a.loopTime = -1;
    a.init();
    return true;
  }

  /** Size is fixed by the first animation set (Java keeps an existing non-zero size). */
  private initWidthAndHeight(w: number, h: number): void {
    const cw = this.getWidth();
    if (cw !== 0) w = cw;
    const ch = this.getHeight();
    if (ch !== 0) h = ch;
    else if (this.nameID === 1338) h = 40;
    this.widthAndHeight = setKeyXY(w, h);
  }

  setFirstAnimation(): void {
    if (this.animations && this.animations.length > 0) this.setCurAnimationObj(this.animations[0]);
  }

  setCurAnimation(id: number, loopTime?: number): boolean {
    const ok = this.setCurAnimationObj(this.getAnimation(id));
    if (loopTime !== undefined) this.setCurAnimationLoopTime(loopTime);
    return ok;
  }

  setCurAnimationLoopTime(n: number): void {
    this.curAnimation?.setLoopTime(n);
  }

  getCurAnimationLoopTime(): number {
    return this.curAnimation ? this.curAnimation.getLoopTime() : -1;
  }

  private getAnimation(id: number): Animation | null {
    if (this.animations == null) return null;
    for (const a of this.animations) if (a != null && a.animationID === id) return a;
    return null;
  }

  /** Animation ids present in this sprite (web helper for the viewer). */
  getAnimationIds(): number[] {
    return (this.animations ?? []).map((a) => a.animationID);
  }

  getWidth(): number {
    return getXKey(this.widthAndHeight);
  }

  getHeight(): number {
    return getYKey(this.widthAndHeight);
  }

  getnameID(): number {
    return this.nameID;
  }

  static createSimplePngSprite(image: Image): GameSprite {
    const s = new GameSprite(0);
    s.setSimpleSprite(true);
    s.simplePng = image;
    return s;
  }

  static createSprite(id: number, battle = false): GameSprite | null {
    return GameSprite.createSpriteFull(id, true, false, battle, -1);
  }

  private static createSpriteFull(id: number, loadPng: boolean, hashData: boolean, battle: boolean, house: number): GameSprite | null {
    if (id <= 0) return null;
    try {
      const cached = spriteRegistry.get(id);
      if (cached) {
        const c = GameSprite.cloneSprite(cached)!;
        c.setLoadPngFromByte(loadPng);
        c.setHashData(hashData);
        return c;
      }
      const sp = new GameSprite(id);
      sp.setLoadPngFromByte(loadPng);
      sp.setHashData(hashData);
      let data = getFileByte(PATH_ANI_2 + 'sprite_' + id + NAME_SUFFIX_SPRITE);
      if (data == null) data = ResourceHandler.getAniSprDataInPack(id);
      if (data == null) {
        if (id >= 500 && id < 700) {
          data = ResourceHandler.getAniSprDataInPack(battle ? SELECT_PICTURE_FROM_CAMERA : 500);
        }
        if ((id >= 700 && id <= 999) || (id >= 2000 && id < 4000) || (id >= 30000 && id <= 39999)) {
          data = ResourceHandler.getAniSprDataInPack(house === 0 ? QQ_PAY_QB : 901);
        }
      }
      if (data == null) return null;
      sp.fromBytes(new DataInputStream(data), battle);
      spriteRegistry.set(id, sp);
      return GameSprite.cloneSprite(sp);
    } catch {
      return null;
    }
  }

  static cloneSprite(src: GameSprite | null, withCloak = true): GameSprite | null {
    if (src == null) return null;
    const c = new GameSprite(src.nameID);
    c.simplePng = src.simplePng;
    c.setSimpleSprite(src.isSimpleSprite());
    c.setHighTransport(src.isHighTransport());
    c.frames = src.frames;
    if (src.fragmentFiles != null) c.fragmentFiles = src.fragmentFiles.map((f) => FragmentFile.cloneFragmentFile(f));
    if (src.animations != null) {
      c.animations = src.animations.map((a) => Animation.cloneAnimation(a, c)!);
      c.setFirstAnimation();
    }
    if (withCloak && src.cloakSprite != null) c.cloakSprite = GameSprite.cloneSprite(src.cloakSprite, false);
    return c;
  }

  private fromBytes(dis: DataInputStream, battle: boolean): void {
    this.fromFrameBytes(dis, this.fromFragmentFileBytes(dis, battle, this.isLoadPngFromByte()));
    this.fromAnimationBytes(dis);
    this.setFirstAnimation();
  }

  /** Returns the per-file ids that frames use to refer to fragment files. */
  private fromFragmentFileBytes(dis: DataInputStream, _battle: boolean, loadPng: boolean): Int8Array | null {
    const n = byte2short(dis.readByte());
    if (n <= 0) return null;
    this.fragmentFiles = new Array<FragmentFile | null>(n).fill(null);
    const fileIds = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      fileIds[i] = dis.readByte();
      const s = dis.readShort();
      const known = fragmentRegistry.get(s) ?? null;
      if (known != null) {
        if (known.isNullImage() && loadPng) known.loadImage(PATH_ANI, s, null);
        this.fragmentFiles[i] = known;
      } else {
        const f = FragmentFile.createFragmentFile(PATH_ANI, s, loadPng, null, null);
        if (f) fragmentRegistry.set(s, f);
        this.fragmentFiles[i] = f;
      }
    }
    return fileIds;
  }

  private fromFrameBytes(dis: DataInputStream, fileIds: Int8Array | null): void {
    const n = byte2short(dis.readByte());
    if (n <= 0) return;
    this.frames = [];
    for (let i = 0; i < n; i++) {
      const f = new Frame();
      f.fromBytes(dis, fileIds, this);
      this.frames.push(f);
    }
  }

  private fromAnimationBytes(dis: DataInputStream): void {
    const n = byte2short(dis.readByte());
    if (n <= 0) return;
    this.animations = [];
    for (let i = 0; i < n; i++) {
      const a = new Animation();
      a.fromBytes(dis, this);
      this.animations.push(a);
    }
  }

  getFragmentFileByNameID(s: number): FragmentFile | null {
    for (const f of this.fragmentFiles ?? []) {
      if (f != null && f.gameImage != null && f.getNameID() === s) return f;
    }
    return null;
  }

  /** Static in Java; an instance method here so Frame needs no runtime import of this module. */
  getFragmentFileIndex(fileIds: Int8Array | null, id: number): number {
    if (fileIds == null) return -1;
    for (let i = 0; i < fileIds.length; i++) if (fileIds[i] === id) return i;
    return -1;
  }

  getFragmentIndexById(fileIndex: number, id: number): number {
    const files = this.fragmentFiles;
    if (files != null && fileIndex >= 0 && fileIndex < files.length) {
      const f = files[fileIndex];
      if (f != null) return f.getIndexById(id);
    }
    return -1;
  }

  // --- status flags ---

  private setFlag(flag: number, on: boolean): void {
    this.spriteStatusFlag = (this.spriteStatusFlag & ~flag) | (on ? flag : 0);
  }

  private hasFlag(flag: number): boolean {
    return (this.spriteStatusFlag & flag) !== 0;
  }

  setSimpleSprite(v: boolean): void {
    this.setFlag(FLAG_SIMPLE_SPRITE, v);
  }
  isSimpleSprite(): boolean {
    return this.hasFlag(FLAG_SIMPLE_SPRITE);
  }
  setHashData(v: boolean): void {
    this.setFlag(FLAG_HASH_DATA, v);
  }
  isHashData(): boolean {
    return this.hasFlag(FLAG_HASH_DATA);
  }
  setMotionTurnOff(v: boolean): void {
    this.setFlag(FLAG_MOTION_TURN_OFF, v);
  }
  isMotionTurnOff(): boolean {
    return this.hasFlag(FLAG_MOTION_TURN_OFF);
  }
  setMotionAlive(v: boolean): void {
    this.setFlag(FLAG_MOTION_ALIVE, v);
  }
  isMotionAlive(): boolean {
    return this.hasFlag(FLAG_MOTION_ALIVE);
  }
  setSpriteVisible(v: boolean): void {
    this.setFlag(FLAG_SPRITE_VISIBLE, v);
  }
  isSpriteVisible(): boolean {
    return this.hasFlag(FLAG_SPRITE_VISIBLE);
  }
  /** Rotate = face left (mirrored). */
  setRotate(v: boolean): void {
    this.setFlag(FLAG_ROTATE, v);
  }
  getRotate(): boolean {
    return this.hasFlag(FLAG_ROTATE);
  }
  setFront(v: boolean): void {
    this.setFlag(FLAG_FRONT, v);
  }
  isFront(): boolean {
    return this.hasFlag(FLAG_FRONT);
  }
  setLoadPngFromByte(v: boolean): void {
    this.setFlag(FLAG_LOAD_PNG, v);
  }
  isLoadPngFromByte(): boolean {
    return this.hasFlag(FLAG_LOAD_PNG);
  }
  setHighTransport(v: boolean): void {
    this.setFlag(FLAG_HIGH_TRANSPORT, v);
  }
  isHighTransport(): boolean {
    return this.hasFlag(FLAG_HIGH_TRANSPORT);
  }

  setSpritePosition(x: number, y: number): void {
    this.spriteX = toShort(x);
    this.spriteY = toShort(y);
  }

  action(): void {
    if (!this.isMotionAlive()) return;
    const a = this.curAnimation;
    if (a == null) return;
    a.action();
    this.cloakSprite?.action();
  }

  private drawSimple(g: Graphics, x: number, y: number): void {
    if (this.simplePng == null) return;
    drawGameImage(g, this.simplePng, x + this.spriteX, y + this.spriteY, 33, this.getRotate() ? 1 : 0);
  }

  /** (x, y) is the sprite's foot point. */
  draw(g: Graphics, x: number, y: number): void {
    if (!this.isSpriteVisible() || !this.isMotionAlive()) return;
    const a = this.curAnimation;
    if (a == null) {
      if (this.isSimpleSprite()) this.drawSimple(g, x, y);
      return;
    }
    const rotate = this.getRotate();
    const px = x + this.spriteX;
    const py = y + this.spriteY;
    const cloakAni = this.cloakSprite?.getCurAnimation();
    if (this.cloakSprite && cloakAni) {
      a.draw(g, px, py, rotate, true);
      cloakAni.draw(g, this.cloakSprite.spriteX, this.cloakSprite.spriteY, rotate, false);
    }
    const innerAni = this.innerSprite?.getCurAnimation();
    if (this.innerSprite && innerAni) {
      a.draw(g, px, py, rotate, true);
      innerAni.draw(g, this.innerSprite.spriteX, this.innerSprite.spriteY, rotate, false);
    }
    a.draw(g, px, py, rotate, false);
  }
}

// ---------------------------------------------------------------------------------------------
// Web-only: the Java loaders read assets synchronously, so everything a sprite needs is fetched
// up front. This mirrors the lookup order of createSprite/createFragmentFile/loadImage.

function fragmentFilesFor(s: number): string[] {
  const variant = (s - 1) & 3;
  const base = variant > 0 && ResourceHandler.isNeedChangeColorId(s) ? s - variant : s;
  return [
    PATH_ANI_2 + base + NAME_SUFFIX_FRAGMENT,
    PATH_ANI_2 + s + NAME_SUFFIX_FRAGMENT,
    PATH_ANI_2 + base + NAME_SUFFIX_PNG,
    PATH_ANI_2 + s + NAME_SUFFIX_PNG,
    PATH_ANI_2 + s + NAME_SUFFIX_PL,
    ...ResourceHandler.aniPakFiles(base),
    ...ResourceHandler.aniPakFiles(s),
  ];
}

/** Reads the fragment-file ids from the head of a .spr blob. */
export function sprFragmentIds(data: Uint8Array): number[] {
  const dis = new DataInputStream(data);
  const n = byte2short(dis.readByte());
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    dis.readByte();
    out.push(dis.readShort());
  }
  return out;
}

export async function preloadSprite(id: number): Promise<void> {
  const fs = getAssetFS();
  const direct = PATH_ANI_2 + 'sprite_' + id + NAME_SUFFIX_SPRITE;
  const pak = ResourceHandler.sprPakFile(id);
  await fs.preload(pak ? [direct, pak] : [direct]);
  const data = fs.get(direct) ?? ResourceHandler.getAniSprDataInPack(id);
  if (!data) return;
  await fs.preload(sprFragmentIds(data).flatMap(fragmentFilesFor));
}

