// Port of com.hz.image.GameImage: an image slot keyed by (nameID, palID).
import { getXKey, getYKey, setKeyXY } from '../common/Tool';
import { loadColorImage } from '../common/Utilities';
import type { Image } from './Image';

export class GameImage {
  image: Image | null = null;
  readonly key: number;

  constructor(nameId: number, palId: number) {
    this.key = setKeyXY(nameId, palId);
  }

  getNameID(): number {
    return getXKey(this.key);
  }

  /** 0xffff when created with -1, like the Java (key & 65535) round trip. */
  getPalID(): number {
    return getYKey(this.key);
  }

  getImage(): Image | null {
    return this.image;
  }

  setImage(img: Image | null): void {
    this.image = img;
  }

  isEquals(o: GameImage | null): boolean {
    return o != null && o.key === this.key;
  }

  loadImage(png: Uint8Array | null, pal: Uint8Array | null): void {
    this.image = loadColorImage(png, pal);
  }
}
