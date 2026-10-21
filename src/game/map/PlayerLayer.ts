// Port of com.hz.map.PlayerLayer: per-row objects and animated map sprites, drawn interleaved
// with the characters standing on each row so that depth sorting works.
import type { Graphics } from '../../midp/Graphics';
import type { DataInputStream } from '../common/DataStream';
import { byte2short } from '../common/Tool';
import { drawGameRegion } from '../common/Utilities';
import { GameSprite } from '../sprite/GameSprite';
import type { GameMap } from './GameMap';
import { LAYER_PLAYER, MapLayer } from './MapLayer';
import { TILE } from './TileLayer';

export const MAP_SPRITE_ROTATE_NO = -2;
export const MAP_SPRITE_ROTATE_YES = -1;
const DRAW_GRID_Y_OFFSET = 5;

/**
 * What PlayerLayer needs from a character. Java walks GameWorld.otherModels, the NPC list and
 * myPlayer directly; those classes are not ported yet.
 */
export interface MapModel {
  getGx(): number;
  getGy(): number;
  /** ox/oy are the map's screen offsets, as passed to PlayerLayer.drawModel. */
  drawOnMap(g: Graphics, ox: number, oy: number): void;
}

export class PlayerLayer extends MapLayer {
  bottomYs: Int16Array[] = [];
  centerXs: Int16Array[] = [];
  imagesIndex: Int16Array[] = [];
  transforms: Int8Array[] = [];
  mapSpriteIDList: Int16Array = new Int16Array(0);
  mapSprites: (GameSprite | null)[] = [];

  constructor(map: GameMap) {
    super(LAYER_PLAYER, map);
  }

  draw(g: Graphics, ox: number, oy: number, w: number, h: number, withTop: boolean): void {
    const m = this.map;
    let endRow = m.mapEndGy + DRAW_GRID_Y_OFFSET;
    if (endRow >= m.mapRows) endRow = m.mapRows - 1;
    const top = withTop ? m.topImgHeight : 0;
    for (let row = m.mapStartGy; row <= endRow; row++) {
      this.drawRowObjecct(g, row, ox, oy, w, h, top);
      if (withTop && row < m.mapEndGy + 1) {
        for (const model of m.models) {
          const gx = model.getGx();
          if (gx >= m.mapStartGx && gx <= m.mapEndGx && model.getGy() === row) model.drawOnMap(g, ox, oy);
        }
      }
    }
  }

  /** (sic) name kept from Java. Image entries are anchored bottom-centre (33). */
  private drawRowObjecct(g: Graphics, row: number, ox: number, oy: number, w: number, h: number, top: number): void {
    if (this.map.isTag(4)) return;
    const bottom = top + h;
    const idx = this.imagesIndex[row];
    const trs = this.transforms[row];
    for (let i = 0; i < idx.length; i++) {
      const s = idx[i];
      const t = trs[i];
      const x = this.centerXs[row][i] + ox;
      const y = this.bottomYs[row][i] + oy;
      if (t < 0) {
        const sp = this.mapSprites[s];
        if (sp != null) {
          if (t === MAP_SPRITE_ROTATE_YES) sp.setRotate(true);
          sp.action();
          sp.draw(g, x, y);
        }
      } else {
        const image = this.map.mapImages![s]?.getImage();
        if (!image) continue;
        const hw = image.getWidth() >> 1;
        const ih = image.getHeight();
        if (x + hw > 0 && x - hw < w && y > top && y - ih < bottom) {
          drawGameRegion(g, image, 0, 0, image.getWidth(), ih, t, x, y, 33);
        }
      }
    }
  }

  /**
   * Offline replacement for Worker.doCreateMapSprites(), which builds these from server-sent
   * sprite data; here the ids are loaded from local assets instead.
   */
  createMapSprites(): void {
    for (let i = 0; i < this.mapSpriteIDList.length; i++) {
      const id = this.mapSpriteIDList[i];
      if (id > 0 && this.mapSprites[i] == null) this.mapSprites[i] = GameSprite.createSprite(id);
    }
  }

  fromBytes(dis: DataInputStream): void {
    const ns = dis.readByte();
    this.mapSprites = new Array(Math.max(0, ns)).fill(null);
    this.mapSpriteIDList = new Int16Array(Math.max(0, ns));
    for (let i = 0; i < ns; i++) this.mapSpriteIDList[i] = dis.readShort();
    const n = dis.readShort();
    const cx = new Int16Array(n);
    const by = new Int16Array(n);
    const im = new Int16Array(n);
    const tr = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      cx[i] = dis.readShort();
      by[i] = dis.readShort();
      im[i] = byte2short(dis.readByte());
      tr[i] = dis.readByte();
    }
    // Bucket entries by the grid row of their bottom edge.
    const rows = this.map.mapRows;
    for (let r = 0; r < rows; r++) {
      const pick: number[] = [];
      for (let i = 0; i < n; i++) if (((by[i] / TILE) | 0) === r) pick.push(i);
      this.centerXs[r] = Int16Array.from(pick, (i) => cx[i]);
      this.bottomYs[r] = Int16Array.from(pick, (i) => by[i]);
      this.imagesIndex[r] = Int16Array.from(pick, (i) => im[i]);
      this.transforms[r] = Int8Array.from(pick, (i) => tr[i]);
    }
  }
}
