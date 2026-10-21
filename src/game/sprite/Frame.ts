// Port of com.hz.sprite.Frame: one pose = a list of fragments placed around the sprite origin.
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import { byte2short } from '../common/Tool';
import { getTranslate } from '../common/Utilities';
import type { GameSprite } from './GameSprite';

export class Frame {
  fragmentFileIndexs: Int8Array | null = null;
  fragmentIndexs: Int8Array | null = null;
  centerXs: Int8Array | null = null;
  centerYs: Int8Array | null = null;
  transformTypes: Int8Array | null = null;

  fromBytes(dis: DataInputStream, fileIds: Int8Array | null, sprite: GameSprite): void {
    try {
      const n = byte2short(dis.readByte());
      if (n <= 0) return;
      this.fragmentFileIndexs = new Int8Array(n);
      this.fragmentIndexs = new Int8Array(n);
      this.centerXs = new Int8Array(n);
      this.centerYs = new Int8Array(n);
      this.transformTypes = new Int8Array(n);
      for (let i = 0; i < n; i++) {
        const fileIndex = sprite.getFragmentFileIndex(fileIds, dis.readByte());
        const fragIndex = sprite.getFragmentIndexById(fileIndex, dis.readByte());
        this.fragmentFileIndexs[i] = fileIndex;
        this.fragmentIndexs[i] = fragIndex;
        this.centerXs[i] = dis.readByte();
        this.centerYs[i] = dis.readByte();
        this.transformTypes[i] = getTranslate(dis.readByte());
      }
    } catch {
      // Java swallows read errors here too.
    }
  }

  getFrameWidth(sprite: GameSprite): number {
    const files = sprite.fragmentFiles;
    if (this.fragmentFileIndexs == null || files == null) return 0;
    let min = 0;
    let max = 0;
    for (let i = 0; i < this.fragmentFileIndexs.length; i++) {
      const f = files[this.fragmentFileIndexs[i]];
      if (f != null) {
        const half = (f.getWidthByIndex(this.fragmentIndexs![i], this.transformTypes![i]) / 2) | 0;
        min = Math.min(this.centerXs![i] - half, min);
        max = Math.max(this.centerXs![i] + half, max);
      }
    }
    return Math.abs(min - max);
  }

  getFrameHeight(sprite: GameSprite): number {
    const files = sprite.fragmentFiles;
    if (this.fragmentFileIndexs == null || files == null) return 0;
    let min = 0;
    let max = 0;
    for (let i = 0; i < this.fragmentFileIndexs.length; i++) {
      const f = files[this.fragmentFileIndexs[i]];
      if (f != null) {
        const half = (f.getHeightByIndex(this.fragmentIndexs![i], this.transformTypes![i]) / 2) | 0;
        min = Math.min(min, this.centerYs![i] - half);
        max = Math.max(max, this.centerYs![i] + half);
      }
    }
    const h = Math.abs(min - max);
    return h > 120 ? 120 : h;
  }

  draw(g: Graphics, x: number, y: number, mirror: boolean, sprite: GameSprite): void {
    const files = sprite.fragmentFiles;
    if (files == null || this.fragmentFileIndexs == null) return;
    for (let i = 0; i < this.fragmentFileIndexs.length; i++) {
      const f = files[this.fragmentFileIndexs[i]];
      if (f == null) continue;
      const cx = mirror ? x - this.centerXs![i] : this.centerXs![i] + x;
      f.draw(g, this.fragmentIndexs![i], cx, y + this.centerYs![i], mirror, this.transformTypes![i], 3);
    }
  }

  updateCloakCoord(x: number, y: number, mirror: boolean, sprite: GameSprite): void {
    const files = sprite.fragmentFiles;
    if (files == null || this.fragmentFileIndexs == null) return;
    let cx = -9999;
    let cy = -9999;
    for (let i = 0; i < this.fragmentFileIndexs.length; i++) {
      const f = files[this.fragmentFileIndexs[i]];
      if (f != null && ((f.getNameID() / 1000) | 0) === 6) {
        cx = mirror ? x - this.centerXs![i] : x + this.centerXs![i];
        cy = this.centerYs![i] + y;
        break;
      }
    }
    sprite.cloakSprite?.setSpritePosition(cx, cy);
    sprite.innerSprite?.setSpritePosition(cx, cy);
  }
}
