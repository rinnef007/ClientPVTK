import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setAssetFS } from '../src/game/common/Utilities';
import { AssetFS } from '../src/game/main/AssetFS';
import * as ResourceHandler from '../src/game/main/ResourceHandler';
import type { GameSprite } from '../src/game/sprite/GameSprite';
import { resolveSprite } from '../src/game/sprite/GameSprite';
import {
  DEFAULT_APPEARANCE,
  createSpriteByIcon,
  encodeIcons,
  getHorseSpriteNameIDByWeapon,
  getSpriteNameIDByWeapon,
  getWeaponIcon,
  type Appearance,
} from '../src/game/sprite/SpriteIcon';

describe('sprite id helpers (values traced from bytecode)', () => {
  it('picks weapon-class sprites', () => {
    expect(getSpriteNameIDByWeapon(100, 0, 0, false, false)).toBe(100);
    expect(getSpriteNameIDByWeapon(100, 1, 0, false, false)).toBe(113); // class 13
    expect(getSpriteNameIDByWeapon(100, 1, 1, true, false)).toBe(163); // dual
    expect(getSpriteNameIDByWeapon(100, 33, 0, false, false)).toBe(115); // class 15
    expect(getSpriteNameIDByWeapon(100, 65, 0, false, false)).toBe(100); // class 17 keeps the base sprite
    expect(getSpriteNameIDByWeapon(100, 177, 0, false, false)).toBe(100); // class 24 → none
  });

  it('falls back to the plain mount sprite for weapon classes 17 and 24', () => {
    expect(getHorseSpriteNameIDByWeapon(0, 3, 65, 0, false)).toBe(703); // jadx said base+15
    expect(getHorseSpriteNameIDByWeapon(1, 3, 0, 0, false)).toBe(903);
    expect(getHorseSpriteNameIDByWeapon(0, 3, 1, 0, false)).toBe(2213);
    expect(getHorseSpriteNameIDByWeapon(1, 21, 1, 0, false)).toBe(30063);
  });

  it('computes weapon fragment ids', () => {
    expect(getWeaponIcon(1, 0)).toBe(8001);
    expect(getWeaponIcon(501, 2)).toBe(30003);
  });
});

const ROOT = new URL('../public/assets/', import.meta.url);
describe.skipIf(!existsSync(new URL('manifest.json', ROOT)))('createSpriteByIcon with real assets', () => {
  beforeAll(async () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
    const fs = new AssetFS(manifest, async (p) => new Uint8Array(readFileSync(new URL(p, ROOT))));
    setAssetFS(fs);
    await fs.preload(['ani/3.pd', 'ani/3.pn']);
    ResourceHandler.loadAllIDList();
  });

  const build = (a: Partial<Appearance>) => {
    const [i1, i2, i3] = encodeIcons({ ...DEFAULT_APPEARANCE, ...a });
    return resolveSprite(() => createSpriteByIcon(i1, i2, i3, false));
  };
  const parts = (s: GameSprite) =>
    new Map(
      (s.fragmentFiles ?? [])
        .filter((f) => f && f.gameImage?.getImage())
        .map((f) => [Math.floor(f!.getNameID() / 1000), f!.getNameID()]),
    );

  it('dresses the default male character', async () => {
    const s = (await build({}))!;
    expect(s.nameID).toBe(100);
    const p = parts(s);
    expect(p.get(0)).toBe(1); // hair style 1, male, colour 0
    expect(p.get(1)).toBe(1001); // face 1
    expect(p.get(6)).toBe(6001); // top 1
    expect(p.get(7)).toBe(7001); // bottom 1
    expect(p.has(10)).toBe(false); // no helmet
  });

  it('switches hair style and colour (palette variant)', async () => {
    const s = (await build({ hair: 2, hairColor: 2 }))!;
    expect(parts(s).get(0)).toBe((2 << 3) - 7 + 2);
  });

  it('uses the female base sprite and female slots', async () => {
    const s = (await build({ sex: 1 }))!;
    expect(s.nameID).toBe(300);
    expect(parts(s).get(0)).toBe(5);
  });

  it('equips a weapon: weapon sprite + weapon fragment', async () => {
    const s = (await build({ weaponL: 1 }))!;
    expect(s.nameID).toBe(113);
    expect(parts(s).get(8)).toBe(8001);
  });

  it('hides a part when its style is 0', async () => {
    const s = (await build({ hair: 0 }))!;
    expect(parts(s).has(0)).toBe(false);
  });
});
