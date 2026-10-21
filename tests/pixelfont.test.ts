import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setAssetFS } from '../src/game/common/Utilities';
import { AssetFS } from '../src/game/main/AssetFS';
import { PIXEL_FONT_SIZES, PixelFont, PixelString } from '../src/game/string/PixelFont';

const ROOT = new URL('../public/assets/', import.meta.url);
describe.skipIf(!existsSync(new URL('manifest.json', ROOT)))('PixelFont (.t bitmap fonts)', () => {
  beforeAll(async () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
    const fs = new AssetFS(manifest, async (p) => new Uint8Array(readFileSync(new URL(p, ROOT))));
    setAssetFS(fs);
    await fs.preload(PIXEL_FONT_SIZES.map((n) => `common/${n}.t`));
  });

  it('loads every size with ASCII and Chinese glyphs', () => {
    for (const n of PIXEL_FONT_SIZES) {
      const f = PixelFont.getFont(n)!;
      expect(f).not.toBeNull();
      expect(f.getChar('V'.charCodeAt(0))?.length).toBe(f.enLength());
      expect(f.getChar('宝'.charCodeAt(0))?.length).toBe(f.charLength());
    }
  });

  it('measures ASCII as half width and keeps width for missing glyphs', () => {
    const f = PixelFont.getFont(16)!;
    expect(new PixelString('VIP', f).getWidth()).toBe(24);
    expect(new PixelString('宝石', f).getWidth()).toBe(32);
    expect(f.getChar('ạ'.charCodeAt(0))).toBeNull();
    expect(new PixelString('ạ', f).getWidth()).toBe(16);
  });
});
