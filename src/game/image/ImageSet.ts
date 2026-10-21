// Port of com.hz.image.ImageSet: a /common/ sheet (N.png + N.fr with 16-bit rectangles).
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { NAME_SUFFIX_FRAGMENT, getFileByte, getTranslate } from '../common/Utilities';
import { FragmentFile } from '../sprite/FragmentFile';
import type { Image } from './Image';

export class ImageSet extends FragmentFile {
  static createImageSet(dir: string, id: number): ImageSet | null {
    const data = getFileByte(dir + id + NAME_SUFFIX_FRAGMENT);
    if (data == null) return null;
    try {
      const s = new ImageSet(id);
      s.loadImage(dir, id);
      s.fromBytes(new DataInputStream(data), true);
      return s;
    } catch {
      return null;
    }
  }

  getImage(): Image | null {
    return this.gameImage?.getImage() ?? null;
  }

  getFrameWidth(i: number): number {
    const w = this.widthCoords;
    return w != null && i >= 0 && i < w.length ? w[i] : 0;
  }

  getFrameHeight(i: number): number {
    const h = this.heightCoords;
    return h != null && i >= 0 && i < h.length ? h[i] : 0;
  }

  getFrameCount(): number {
    return this.xCoords?.length ?? 0;
  }

  /** trans is a tool-side transform id (mapped with Utilities.getTranslate). */
  drawFrame(g: Graphics, i: number, x: number, y: number, trans: number, anchor: number): void {
    this.draw(g, i, x, y, false, getTranslate(trans), anchor);
  }

  drawTopLeftFrame(g: Graphics, i: number, x: number, y: number): void {
    this.drawFrame(g, i, x, y, 0, 20);
  }

  drawHVFrame(g: Graphics, i: number, x: number, y: number): void {
    this.drawFrame(g, i, x, y, 0, 3);
  }
}
