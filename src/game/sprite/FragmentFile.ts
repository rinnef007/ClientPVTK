// Port of com.hz.sprite.FragmentFile: a sprite sheet image plus the rectangles cut from it (.fr).
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { byte2short } from '../common/Tool';
import {
  NAME_SUFFIX_FRAGMENT,
  NAME_SUFFIX_PL,
  NAME_SUFFIX_PNG,
  PATH_ANI_2,
  PATH_COMMON,
  drawGameRegion,
  getFileByte,
  getTransfromAfterMirror,
  loadColorImage,
  readPNGFile,
} from '../common/Utilities';
import { GameImage } from '../image/GameImage';
import type { Image } from '../image/Image';
import * as ResourceHandler from '../main/ResourceHandler';

export class FragmentFile {
  private readonly fragmentNameID: number;
  gameImage: GameImage | null;
  heightCoords: Int16Array | null = null;
  ids: Int8Array | null = null;
  widthCoords: Int16Array | null = null;
  xCoords: Int16Array | null = null;
  yCoords: Int16Array | null = null;

  private isRotate(t: number): boolean {
    return t === 5 || t === 6;
  }

  protected constructor(nameId: number) {
    this.fragmentNameID = nameId;
    this.gameImage = new GameImage(nameId, -1);
  }

  getNameID(): number {
    return this.fragmentNameID;
  }

  getPalID(): number {
    return this.gameImage ? this.gameImage.getPalID() : -1;
  }

  clearImage(): void {
    this.gameImage = null;
  }

  isNullImage(): boolean {
    return this.gameImage == null || this.gameImage.getImage() == null;
  }

  /**
   * Picks the sheet image. Colour variants: ids whose (id-1)&3 is non-zero reuse the PNG of the
   * base id (id - variant) with their own palette file id.pl.
   * (AniResourceSave — downloaded resource cache — is not ported: offline it is always empty.)
   */
  loadImage(dir: string, s: number, png: Uint8Array | null = null): void {
    let img: Image | null;
    if (png != null) {
      img = loadColorImage(png, null);
    } else if (dir === PATH_COMMON) {
      img = readPNGFile(dir + s + NAME_SUFFIX_PNG);
    } else {
      const variant = (s - 1) & 3;
      if (variant > 0 && ResourceHandler.isNeedChangeColorId(s)) {
        let pal = getFileByte(PATH_ANI_2 + s + NAME_SUFFIX_PL);
        if (pal == null) pal = ResourceHandler.getAniPlDataInPack(s);
        const base = s - variant;
        let data = getFileByte(PATH_ANI_2 + base + NAME_SUFFIX_PNG);
        if (data == null) data = ResourceHandler.getAniPngDataInPack(base);
        img = loadColorImage(data, pal);
      } else {
        let data = getFileByte(PATH_ANI_2 + s + NAME_SUFFIX_PNG);
        if (data == null) data = ResourceHandler.getAniPngDataInPack(s);
        img = loadColorImage(data, null);
      }
    }
    if (this.gameImage == null) this.gameImage = new GameImage(this.fragmentNameID, -1);
    this.gameImage.setImage(img);
  }

  /**
   * The decompiled body is garbled; this follows its evident intent: colour variants share the
   * base id's .fr, looked up as a loose file first and then in the ani/3 fragment pack.
   */
  static createFragmentFile(
    dir: string,
    s: number,
    loadPng: boolean,
    frData: Uint8Array | null,
    pngData: Uint8Array | null,
  ): FragmentFile | null {
    let data = frData;
    if (data == null) {
      const variant = (s - 1) & 3;
      const id = variant > 0 && ResourceHandler.isNeedChangeColorId(s) ? s - variant : s;
      data = getFileByte(PATH_ANI_2 + id + NAME_SUFFIX_FRAGMENT);
      if (data == null) data = ResourceHandler.getPackImageData(ResourceHandler.packFrData, ResourceHandler.packFrIDList, id);
    }
    if (data == null) data = getFileByte(PATH_ANI_2 + s + NAME_SUFFIX_FRAGMENT);
    if (data == null) return null;
    try {
      const f = new FragmentFile(s);
      if (loadPng) f.loadImage(dir, s, pngData);
      f.fromBytes(new DataInputStream(data), false);
      return f;
    } catch {
      return null;
    }
  }

  /** wide=true: shorts per field (ImageSet in /common/); false: unsigned bytes (sprites). */
  fromBytes(dis: DataInputStream, wide: boolean): void {
    const n = byte2short(dis.readByte());
    if (n <= 0) return;
    this.ids = new Int8Array(n);
    this.xCoords = new Int16Array(n);
    this.yCoords = new Int16Array(n);
    this.widthCoords = new Int16Array(n);
    this.heightCoords = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      this.ids[i] = dis.readByte();
      if (wide) {
        this.xCoords[i] = dis.readShort();
        this.yCoords[i] = dis.readShort();
        this.widthCoords[i] = dis.readShort();
        this.heightCoords[i] = dis.readShort();
      } else {
        this.xCoords[i] = byte2short(dis.readByte());
        this.yCoords[i] = byte2short(dis.readByte());
        this.widthCoords[i] = byte2short(dis.readByte());
        this.heightCoords[i] = byte2short(dis.readByte());
      }
    }
  }

  static cloneFragmentFile(f: FragmentFile | null): FragmentFile | null {
    if (f == null) return null;
    const c = new FragmentFile(f.fragmentNameID);
    c.gameImage = f.gameImage;
    c.ids = f.ids;
    c.xCoords = f.xCoords;
    c.yCoords = f.yCoords;
    c.widthCoords = f.widthCoords;
    c.heightCoords = f.heightCoords;
    return c;
  }

  getIndexById(id: number): number {
    const ids = this.ids;
    if (ids == null) return -1;
    if (ids.length === 1) return 0;
    for (let i = 0; i < ids.length; i++) if (ids[i] === id) return i;
    return -1;
  }

  getWidthByIndex(i: number, trans: number): number {
    const w = this.widthCoords;
    if (w == null || i < 0 || i >= w.length) return 0;
    return this.isRotate(trans) ? this.heightCoords![i] : w[i];
  }

  getHeightByIndex(i: number, trans: number): number {
    const s = this.fragmentNameID;
    if (s >= 8000 && s <= 10000) return 0;
    if (s >= 30000 && s <= 32000) return 0;
    const h = this.heightCoords;
    if ((s >= 15000 && s < 16000) || h == null || i < 0 || i >= h.length) return 0;
    return this.isRotate(trans) ? this.widthCoords![i] : h[i];
  }

  draw(g: Graphics, i: number, x: number, y: number, mirror: boolean, trans: number, anchor: number): void {
    const xs = this.xCoords;
    if (this.gameImage == null || xs == null || i < 0 || i >= xs.length) return;
    const w = this.widthCoords![i];
    let dx = x;
    let t = trans;
    if (mirror) {
      dx = x - (w & 1);
      t = getTransfromAfterMirror(trans);
    }
    drawGameRegion(g, this.gameImage.getImage(), xs[i], this.yCoords![i], w, this.heightCoords![i], t, dx, y, anchor);
  }
}
