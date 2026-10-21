import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DataInputStream, DataOutputStream } from '../src/game/common/DataStream';
import { setAssetFS } from '../src/game/common/Utilities';
import { AssetFS } from '../src/game/main/AssetFS';
import * as ResourceHandler from '../src/game/main/ResourceHandler';
import { GameMap } from '../src/game/map/GameMap';
import { TEST_MAP_COLS, TEST_MAP_ROWS, buildTestMap } from '../src/game/map/TestMap';
import { getTranslate, getTransfromAfterMirror } from '../src/game/common/Utilities';

describe('DataStream', () => {
  it('round-trips Java modified UTF-8', () => {
    const o = new DataOutputStream();
    o.writeUTF('Bản đồ thử');
    o.writeShort(-2);
    o.writeInt(-123456);
    const i = new DataInputStream(o.toByteArray());
    expect(i.readUTF()).toBe('Bản đồ thử');
    expect(i.readShort()).toBe(-2);
    expect(i.readInt()).toBe(-123456);
    expect(() => i.readByte()).toThrow();
  });
});

describe('transform tables', () => {
  it('mirroring twice is the identity for every MIDP transform', () => {
    for (let t = 0; t < 8; t++) expect(getTransfromAfterMirror(getTransfromAfterMirror(t))).toBe(t);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(getTranslate)).toEqual([0, 2, 1, 5, 3, 6, 4, 7]);
  });
});

describe('GameMap.loadMap on the generated test map', () => {
  const map = GameMap.loadMap(buildTestMap())!;

  it('parses header, tileset and layers', () => {
    expect(map).not.toBeNull();
    expect(map.name).toBe('Bản đồ thử (offline)');
    expect(map.mapColumns).toBe(TEST_MAP_COLS);
    expect(map.mapRows).toBe(TEST_MAP_ROWS);
    expect(map.tileMapImgIndexs!.length).toBe(22);
    // Grass sheet 3×3: tile 4 is the centre cell.
    expect([map.tileCoordXs![4], map.tileCoordYs![4]]).toEqual([24, 24]);
    expect(map.getPlayerLayer()).not.toBeNull();
    expect(map.playerLayerIndex).toBe(2);
  });

  it('honours the collision bitmap', () => {
    expect(map.isCanPass(20, 17)).toBe(true); // spawn on the road
    expect(map.isCanPass(-1, 0)).toBe(false);
    let blocked = 0;
    for (let y = 0; y < map.mapRows; y++) for (let x = 0; x < map.mapColumns; x++) if (!map.isCanPass(x, y)) blocked++;
    expect(blocked).toBeGreaterThan(20);
  });

  it('clamps the camera to the map edges', () => {
    map.initGameMapData(320, 480, 20, 0);
    map.setCameraToPlayer({ getPx: () => 0, getPy: () => 0 });
    expect([map.offsetX, map.offsetY]).toEqual([0, 0]);
    map.setCameraToPlayer({ getPx: () => 10_000, getPy: () => 10_000 });
    expect(map.offsetX).toBe(320 - TEST_MAP_COLS * 24);
    expect(map.offsetY).toBe(460 - TEST_MAP_ROWS * 24);
    expect(map.mapEndGx).toBe(TEST_MAP_COLS - 1);
  });
});

const ROOT = new URL('../public/assets/', import.meta.url);
describe.skipIf(!existsSync(new URL('manifest.json', ROOT)))('map images from the local pack', () => {
  beforeAll(async () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
    const fs = new AssetFS(manifest, async (p) => new Uint8Array(readFileSync(new URL(p, ROOT))));
    setAssetFS(fs);
    await fs.preload(['ani/3.pd', 'ani/3.pn', 'map/1.pd', 'map/1.pn']);
    ResourceHandler.loadAllIDList();
    ResourceHandler.loadMapPackData();
  });

  it('resolves every image the test map references', () => {
    const map = GameMap.loadMap(buildTestMap())!;
    map.loadMapPalette();
    const sizes = map.mapImages!.map((gi) => gi.getImage() && [gi.getNameID(), gi.getImage()!.width, gi.getImage()!.height]);
    expect(sizes.every(Boolean)).toBe(true);
    expect(sizes[0]).toEqual([369, 72, 72]);
  });
});
