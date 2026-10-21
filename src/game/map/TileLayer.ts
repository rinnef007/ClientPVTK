// Port of com.hz.map.TileLayer: a rows×columns grid of tile indices (255 = empty).
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import { drawGameRegion } from '../common/Utilities';
import type { GameMap } from './GameMap';
import { LAYER_TILE, MapLayer } from './MapLayer';

export const TILE = 24;
export const TILES_NONE = 255;

export class TileLayer extends MapLayer {
  mapData: Uint8Array[] | null = null;

  constructor(map: GameMap) {
    super(LAYER_TILE, map);
  }

  draw(): void {}

  drawTileLayer(g: Graphics, ox: number, oy: number, top: number): void {
    const m = this.map;
    const imgs = m.mapImages;
    if (this.mapData == null || imgs == null) return;
    const x0 = ox < 0 ? ox % TILE : ox;
    let y = (oy < 0 ? oy % TILE : oy) + top;
    for (let gy = m.mapStartGy; gy <= m.mapEndGy; gy++, y += TILE) {
      let x = x0;
      for (let gx = m.mapStartGx; gx <= m.mapEndGx; gx++, x += TILE) {
        const t = this.mapData[gy][gx];
        if (t === TILES_NONE) continue;
        const image = imgs[m.tileMapImgIndexs![t]]?.getImage();
        if (image) drawGameRegion(g, image, m.tileCoordXs![t], m.tileCoordYs![t], TILE, TILE, m.tileTransforms![t], x, y, 20);
      }
    }
  }

  /** Draws tile (gx, gy) at (x, y); false if empty or not loaded. */
  drawTiteObject(g: Graphics, gx: number, gy: number, x: number, y: number): boolean {
    const m = this.map;
    if (gx < 0 || gx >= m.mapColumns || gy < 0 || gy >= m.mapRows) return false;
    const t = this.mapData![gy][gx];
    if (t === TILES_NONE) return false;
    const image = m.mapImages![m.tileMapImgIndexs![t]]?.getImage();
    if (!image) return false;
    drawGameRegion(g, image, m.tileCoordXs![t], m.tileCoordYs![t], TILE, TILE, m.tileTransforms![t], x, y, 20);
    return true;
  }

  fromBytes(dis: DataInputStream): void {
    const m = this.map;
    this.mapData = [];
    for (let r = 0; r < m.mapRows; r++) {
      const row = new Uint8Array(m.mapColumns);
      for (let c = 0; c < m.mapColumns; c++) row[c] = dis.readByte() & 0xff;
      this.mapData.push(row);
    }
  }
}
