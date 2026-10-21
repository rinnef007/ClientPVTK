import { Graphics } from '../../midp/Graphics';

/**
 * javax.microedition.lcdui.Image. Width/height come from the PNG header right away, so layout
 * code that asks for sizes works synchronously; pixels decode asynchronously and `source`
 * stays null until then (draw calls skip null sources, like Utilities.drawGameRegion does
 * for null images).
 */
export class Image {
  source: CanvasImageSource | null = null;
  /** Resolves once pixels are decoded (or decoding failed). Web-only. */
  ready: Promise<void> = Promise.resolve();
  private graphics: Graphics | null = null;

  private constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /** Image.createImage(byte[], off, len). Returns null if the bytes are not a PNG. */
  static createImageFromBytes(bytes: Uint8Array): Image | null {
    const size = pngSize(bytes);
    if (!size) return null;
    const img = new Image(size[0], size[1]);
    if (typeof createImageBitmap === 'function') {
      img.ready = createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }))
        .then((bmp) => {
          img.source = bmp;
        })
        .catch(() => {
          // Corrupt image: stays undrawn, as a failed createImage() would in Java.
        });
    }
    return img;
  }

  /** Mutable Image.createImage(w, h), initially white like MIDP. */
  static createImage(w: number, h: number): Image {
    const img = new Image(w, h);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      img.source = canvas;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        img.graphics = new Graphics(ctx, w, h);
        img.graphics.setColor(0xffffff);
        img.graphics.fillRect(0, 0, w, h);
        img.graphics.setColor(0);
      }
    }
    return img;
  }

  getGraphics(): Graphics {
    if (!this.graphics) throw new Error('Immutable image');
    return this.graphics;
  }
}

/** Reads width/height from the IHDR chunk. */
export function pngSize(b: Uint8Array): [number, number] | null {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getUint32(16), v.getUint32(20)];
}
