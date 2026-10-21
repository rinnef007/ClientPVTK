// Port of com.hz.map.PixelLayer: free-positioned images (ground decals, objects under players).
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import { byte2short } from '../common/Tool';
import { drawGameRegion } from '../common/Utilities';
import type { GameMap } from './GameMap';
import { LAYER_PIXEL, MapLayer } from './MapLayer';
import { TILE } from './TileLayer';

export class PixelLayer extends MapLayer {
  xs: Int16Array = new Int16Array(0);
  ys: Int16Array = new Int16Array(0);
  imagesIndex: Int16Array = new Int16Array(0);
  transforms: Int8Array = new Int8Array(0);

  constructor(map: GameMap) {
    super(LAYER_PIXEL, map);
  }

  draw(g: Graphics, ox: number, oy: number, w: number, h: number, withTop: boolean): void {
    const top = withTop ? this.map.topImgHeight : 0;
    const bottom = top + h;
    for (let i = 0; i < this.imagesIndex.length; i++) {
      const s = this.imagesIndex[i];
      const image = s >= 0 ? this.map.mapImages![s]?.getImage() : null;
      if (!image) continue;
      const x = this.xs[i] + ox;
      const y = this.ys[i] + oy;
      const iw = image.getWidth();
      const ih = image.getHeight();
      if (x + iw > 0 && x < w && y + ih > top && y < bottom) {
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, y, 20);
      }
    }
  }

  /**
   * Draws objects overlapping one 24px column of the wrap-around map buffer.
   * bufX: column x in the buffer; bufY0: buffer row where world row `worldY` starts;
   * bufH: buffer height; worldX/worldY: world pixel origin of that column/row.
   * The decompiled body is register-shuffled; this is a straight reading of it: draw the part
   * below bufY0 normally, and the part that overflows the buffer bottom again at the top.
   */
  drawColObject(g: Graphics, bufX: number, bufY0: number, bufH: number, worldX: number, worldY: number): void {
    const clipX = g.getClipX();
    const clipY = g.getClipY();
    const clipW = g.getClipWidth();
    const clipH = g.getClipHeight();
    const lowerH = bufH - bufY0;
    for (let i = 0; i < this.imagesIndex.length; i++) {
      const s = this.imagesIndex[i];
      const image = s >= 0 ? this.map.mapImages![s]?.getImage() : null;
      if (!image) continue;
      const iw = image.getWidth();
      const ih = image.getHeight();
      const x = bufX + (this.xs[i] - worldX);
      const y = bufY0 + (this.ys[i] - worldY);
      if (!(x + iw > bufX && x < bufX + TILE && y + ih > bufY0 && y < bufY0 + bufH)) continue;
      if (y < bufY0) {
        g.clipRect(clipX, bufY0, clipW, lowerH);
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, y, 20);
        g.setClip(clipX, clipY, clipW, clipH);
      } else if (y < bufH) {
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, y, 20);
      }
      if (y + ih > bufH && bufY0 > 0) {
        const wy = y - bufH;
        g.clipRect(clipX, wy, clipW, bufY0 - wy);
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, wy, 20);
        g.setClip(clipX, clipY, clipW, clipH);
      }
    }
  }

  /** Row counterpart of drawColObject (x/y swapped). */
  drawRowObject(g: Graphics, bufX0: number, bufY: number, bufW: number, worldX: number, worldY: number): void {
    const clipX = g.getClipX();
    const clipY = g.getClipY();
    const clipW = g.getClipWidth();
    const clipH = g.getClipHeight();
    const rightW = bufW - bufX0;
    for (let i = 0; i < this.imagesIndex.length; i++) {
      const s = this.imagesIndex[i];
      const image = s >= 0 ? this.map.mapImages![s]?.getImage() : null;
      if (!image) continue;
      const iw = image.getWidth();
      const ih = image.getHeight();
      const x = bufX0 + (this.xs[i] - worldX);
      const y = bufY + (this.ys[i] - worldY);
      if (!(y + ih > bufY && y < bufY + TILE && x + iw > bufX0 && x < bufX0 + bufW)) continue;
      if (x < bufX0) {
        g.clipRect(bufX0, clipY, rightW, clipH);
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, y, 20);
        g.setClip(clipX, clipY, clipW, clipH);
      } else if (x < bufW) {
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], x, y, 20);
      }
      if (x + iw > bufW && bufX0 > 0) {
        const wx = x - bufW;
        g.clipRect(wx, clipY, bufX0 - wx, clipH);
        drawGameRegion(g, image, 0, 0, iw, ih, this.transforms[i], wx, y, 20);
        g.setClip(clipX, clipY, clipW, clipH);
      }
    }
  }

  fromBytes(dis: DataInputStream): void {
    const n = dis.readShort();
    this.xs = new Int16Array(n);
    this.ys = new Int16Array(n);
    this.imagesIndex = new Int16Array(n);
    this.transforms = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      this.xs[i] = dis.readShort();
      this.ys[i] = dis.readShort();
      this.imagesIndex[i] = byte2short(dis.readByte());
      this.transforms[i] = dis.readByte();
    }
  }
}
