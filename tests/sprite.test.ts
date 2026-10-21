import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setAssetFS } from '../src/game/common/Utilities';
import { AssetFS } from '../src/game/main/AssetFS';
import * as ResourceHandler from '../src/game/main/ResourceHandler';
import { GameSprite, preloadSprite } from '../src/game/sprite/GameSprite';

// Runs against the locally imported game assets (public/assets is gitignored, never committed).
const ROOT = new URL('../public/assets/', import.meta.url);
const HAS_ASSETS = existsSync(new URL('manifest.json', ROOT));

describe.skipIf(!HAS_ASSETS)('GameSprite with real assets', () => {
  let manifest: { dirs: Record<string, string[]> };

  beforeAll(async () => {
    manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
    const fs = new AssetFS(manifest, async (p) => {
      const u = new URL(p, ROOT);
      return existsSync(u) ? new Uint8Array(readFileSync(u)) : null;
    });
    setAssetFS(fs);
    await fs.preload(['ani/3.pd', 'ani/3.pn', 'map/1.pd', 'map/1.pn']);
    ResourceHandler.loadAllIDList();
    ResourceHandler.loadMapPackData();
  });

  it('loads the default male world sprite (100) with stand and move animations', async () => {
    await preloadSprite(100);
    const s = GameSprite.createSprite(100)!;
    expect(s).not.toBeNull();
    expect(s.getAnimationIds()).toEqual([0, 2]);
    expect(s.frames!.length).toBe(10);
    expect(s.fragmentFiles!.every((f) => f && f.gameImage?.getImage())).toBe(true);
    expect(s.getWidth()).toBeGreaterThan(0);
    expect(s.getHeight()).toBeGreaterThan(0);
  });

  it('resolves fragments and images for every shipped sprite', async () => {
    const ids = manifest.dirs['ani/ani2']
      .filter((n) => n.startsWith('sprite_'))
      .map((n) => Number(n.slice(7, -4)));
    let complete = 0;
    const broken: number[] = [];
    for (const id of ids) {
      await preloadSprite(id);
      const s = GameSprite.createSprite(id);
      const ok = !!s && (s.fragmentFiles ?? []).every((f) => f && f.gameImage?.getImage());
      if (ok) complete++;
      else broken.push(id);
    }
    // Some ids legitimately reference parts that are only delivered by the server.
    console.log(`sprites complete: ${complete}/${ids.length}; first broken: ${broken.slice(0, 15).join(',')}`);
    expect(complete / ids.length).toBeGreaterThan(0.9);
  }, 120_000);

  it('advances animation frames by duration and loops', async () => {
    await preloadSprite(100);
    const s = GameSprite.createSprite(100)!;
    const a = s.getCurAnimation()!;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      s.action();
      seen.add(a.getCurFrame());
    }
    expect(seen.size).toBe(a.frameIds!.length);
  });
});
