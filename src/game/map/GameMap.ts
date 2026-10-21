// Port of com.hz.map.GameMap: map data, collision bits, camera and the wrap-around back buffer
// that only repaints the tile columns/rows scrolled into view.
// Not ported yet: path finding, small map, escort UI, arrow guides.
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { byte2short, getOffsetValue } from '../common/Tool';
import { setPlKey } from '../common/Utilities';
import { GameImage } from '../image/GameImage';
import { Image } from '../image/Image';
import * as ResourceHandler from '../main/ResourceHandler';
import type { MapLayer } from './MapLayer';
import { PixelLayer } from './PixelLayer';
import { PlayerLayer, type MapModel } from './PlayerLayer';
import { TILE, TileLayer } from './TileLayer';

export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 24;
export const TAG_IS_INIT = 1;
export const TAG_FORCE_PAINT = 2;
export const TAG_MAP_IMG_OFF = 4;
export const TAG_MAP_STAGE_INIT = 8;
const DRAW_MAP_CLOSE = 1;
const DRAW_NORMAL_MAP = 2;
const DRAW_BATTLE_BUFFER = 3;

export interface CameraTarget {
  getPx(): number;
  getPy(): number;
}

export class GameMap {
  // Java keeps these as statics shared by the single active map.
  offsetLeftX = 0;
  offsetTopY = 0;
  offsetX = 0;
  offsetY = 0;
  oldOffsetX = 0;
  oldOffsetY = 0;
  screenWidth = 0;
  screenHeight = 0;
  screenWidthC = 0;
  screenHeightC = 0;
  /** GameView.topImgHeight (height of the HUD bar drawn over the map top). */
  topImgHeight = 0;
  screenFullWidth = 0;
  screenFullHeight = 0;

  private crossData: Int32Array | null = null;
  private layers: (MapLayer | null)[] | null = null;
  m_bbx = 0;
  m_bby = 0;
  m_mov_x = 0;
  m_mov_y = 0;
  m_x = 0;
  m_y = 0;
  mapColumns = 0;
  mapEndGx = 0;
  mapEndGy = 0;
  mapHeight = 0;
  mapID = 0;
  mapImages: GameImage[] | null = null;
  mapRows = 0;
  mapStartGx = 0;
  mapStartGy = 0;
  mapWidth = 0;
  playerLayerIndex = 0;
  private tagValue = 0;
  tileCoordXs: Int16Array | null = null;
  tileCoordYs: Int16Array | null = null;
  tileMapImgIndexs: Int16Array | null = null;
  tileTransforms: Int8Array | null = null;
  name = '';
  m_bbImage: Image | null = null;
  m_bbGraphics: Graphics | null = null;
  m_bbColRepaint: boolean[] = [];
  m_bbRowRepaint: boolean[] = [];
  m_bbNumCols = 0;
  m_bbNumRows = 0;
  m_bbWidth = 0;
  m_bbHeight = 0;
  m_bbScreenWidth = 0;
  m_bbScreenHeight = 0;
  /** Characters to draw on the player layer (GameWorld.otherModels + NPCs + myPlayer in Java). */
  models: MapModel[] = [];
  camera: CameraTarget | null = null;

  private isRotateRowColumn(t: number): boolean {
    return t === 7 || t === 4 || t === 5 || t === 6;
  }

  setTag(b: number, on: boolean): void {
    this.tagValue = on ? this.tagValue | b : this.tagValue & ~b;
  }

  isTag(b: number): boolean {
    return (b & this.tagValue) !== 0;
  }

  setMapID(id: number): void {
    this.mapID = id;
  }

  getMapID(): number {
    return this.mapID;
  }

  /** Collision bitmap: one bit per grid cell, set = blocked. */
  isCanPass(gx: number, gy: number): boolean {
    const cd = this.crossData;
    if (cd == null) return true;
    if (gx < 0 || gy < 0 || gx >= this.mapColumns || gy >= this.mapRows) return false;
    const bit = this.mapColumns * gy + gx;
    const word = bit >> 5;
    return word < 0 || word >= cd.length || (cd[word] & (1 << (bit & 31))) === 0;
  }

  getPlayerLayer(): PlayerLayer | null {
    const l = this.layers?.[this.playerLayerIndex];
    return l instanceof PlayerLayer ? l : null;
  }

  /** GameMap.initGameMapData(): viewport size minus the HUD bars. */
  initGameMapData(screenW: number, screenH: number, topH: number, bottomH: number): void {
    this.screenFullWidth = screenW;
    this.screenFullHeight = screenH;
    this.topImgHeight = topH;
    this.screenWidth = screenW;
    this.screenHeight = screenH - topH - bottomH;
    this.screenWidthC = this.screenWidth >> 1;
    this.screenHeightC = this.screenHeight >> 1;
  }

  setCameraToPlayer(p: CameraTarget | null): void {
    if (p != null) {
      this.setPos(
        getOffsetValue(p.getPx(), this.mapWidth, this.screenWidth, this.screenWidthC),
        getOffsetValue(p.getPy(), this.mapHeight, this.screenHeight, this.screenHeightC),
      );
    }
    this.updateRectange(this.offsetX, this.offsetY);
  }

  private updateRectange(ox: number, oy: number): void {
    this.mapStartGx = Math.max(0, (-ox / TILE) | 0);
    this.mapEndGx = Math.min(this.mapColumns - 1, ((this.screenWidth - ox - 1) / TILE) | 0);
    this.mapStartGy = Math.max(0, (-oy / TILE) | 0);
    this.mapEndGy = Math.min(this.mapRows - 1, ((this.screenHeight - oy - 1) / TILE) | 0);
  }

  setPos(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
    this.offsetLeftX = x;
    this.offsetTopY = y + this.topImgHeight;
  }

  private fromTileSetBytes(dis: DataInputStream): void {
    try {
      const total = byte2short(dis.readByte());
      const groups = dis.readByte();
      const cols = new Int8Array(groups);
      const rows = new Int8Array(groups);
      const img = new Int16Array(groups);
      const trans = new Int8Array(groups);
      for (let i = 0; i < groups; i++) {
        img[i] = byte2short(dis.readByte());
        trans[i] = dis.readByte();
        cols[i] = dis.readByte();
        rows[i] = dis.readByte();
      }
      this.tileMapImgIndexs = new Int16Array(total);
      this.tileCoordXs = new Int16Array(total);
      this.tileCoordYs = new Int16Array(total);
      this.tileTransforms = new Int8Array(total);
      let k = 0;
      for (let i = 0; i < groups; i++) {
        const c = cols[i];
        const r = rows[i];
        const t = trans[i];
        for (let j = 0; j < c * r; j++) {
          this.tileMapImgIndexs[k] = img[i];
          // Rotated sheets are stored transposed, so cut them with the other dimension.
          const per = this.isRotateRowColumn(t) ? r : c;
          this.tileCoordXs[k] = (j % per) * TILE;
          this.tileCoordYs[k] = ((j / per) | 0) * TILE;
          this.tileTransforms[k] = t;
          k++;
        }
      }
    } catch {
      // Java ignores tileset errors too.
    }
  }

  static loadMap(data: Uint8Array): GameMap | null {
    const m = new GameMap();
    try {
      m.fromBytes(new DataInputStream(data));
      return m;
    } catch {
      return null;
    }
  }

  private fromBytes(dis: DataInputStream): void {
    this.name = dis.readUTF();
    this.mapColumns = byte2short(dis.readByte());
    this.mapRows = byte2short(dis.readByte());
    this.mapWidth = this.mapColumns * TILE;
    this.mapHeight = this.mapRows * TILE;
    const nImg = byte2short(dis.readByte());
    this.mapImages = [];
    for (let i = 0; i < nImg; i++) {
      const id = dis.readShort();
      const pal = dis.readByte();
      this.mapImages.push(new GameImage(id, pal));
    }
    this.fromTileSetBytes(dis);
    const nCross = dis.readByte();
    this.crossData = new Int32Array(Math.max(0, nCross));
    for (let i = 0; i < nCross; i++) this.crossData[i] = dis.readInt();
    const nLayers = dis.readByte();
    this.layers = [];
    let layer: MapLayer | null = null;
    for (let i = 0; i < nLayers; i++) {
      const type = dis.readByte();
      if (type === 2) layer = new TileLayer(this);
      else if (type === 3) layer = new PixelLayer(this);
      else if (type === 4) {
        layer = new PlayerLayer(this);
        this.playerLayerIndex = i;
      }
      // As in Java, an unknown type re-reads into the previous layer object.
      layer!.fromBytes(dis);
      this.layers.push(layer);
    }
  }

  init(): void {
    this.loadMapPalette();
    this.initMapBuffer();
    this.setTag(TAG_MAP_STAGE_INIT, true);
  }

  /** Map images come from server-sent data (mapImage) or the local map/1 pack. */
  loadMapPalette(): void {
    if (this.mapImages == null) return;
    for (const gi of this.mapImages) {
      if (gi == null || gi.getImage() != null) continue;
      const id = gi.getNameID();
      let png = ResourceHandler.mapImage.get(id) ?? null;
      const pal = gi.getPalID();
      const plt = pal > 0 ? ResourceHandler.mapImage.get(setPlKey(id, pal) + 10000) ?? null : null;
      if (png == null) png = ResourceHandler.getPackImageData(ResourceHandler.packImgData, ResourceHandler.packImgIDList, id);
      gi.loadImage(png, plt);
    }
  }

  /** Web-only: resolves when every map image has decoded (Java decodes synchronously). */
  async whenImagesReady(): Promise<void> {
    await Promise.all((this.mapImages ?? []).map((gi) => gi.getImage()?.ready));
  }

  drawLayers(g: Graphics, from: number, to: number, withTop: boolean, mode: number): void {
    let ox = mode === DRAW_BATTLE_BUFFER ? this.offsetX : this.offsetLeftX;
    let oy = mode === DRAW_BATTLE_BUFFER ? this.offsetY : this.offsetTopY;
    for (let i = from; i < to; i++) {
      const l = this.layers![i];
      if (l == null) continue;
      if (l instanceof TileLayer) {
        let top = 0;
        if (mode === DRAW_NORMAL_MAP) {
          ox = this.offsetX;
          oy = this.offsetY;
          top = this.topImgHeight;
        }
        l.drawTileLayer(g, ox, oy, top);
      } else {
        l.draw(g, ox, oy, this.screenWidth, this.screenHeight, withTop);
      }
    }
  }

  draw(g: Graphics, withTop: boolean): void {
    if (this.layers == null || this.mapImages == null || !this.isTag(TAG_IS_INIT)) return;
    if (this.isTag(TAG_MAP_IMG_OFF)) {
      this.drawOFFMap(g);
      this.drawLayers(g, this.playerLayerIndex, this.playerLayerIndex + 1, withTop, DRAW_MAP_CLOSE);
      return;
    }
    if (this.isTag(TAG_FORCE_PAINT)) {
      this.initMapBuffer();
      this.setTag(TAG_FORCE_PAINT, false);
    }
    if (this.oldOffsetX !== this.offsetX || this.oldOffsetY !== this.offsetY) this.updateMapBuffer(this.offsetX, this.offsetY);
    this.oldOffsetX = this.offsetX;
    this.oldOffsetY = this.offsetY;
    this.drawMapBuffer(g, this.topImgHeight);
    this.drawLayers(g, this.playerLayerIndex, this.layers.length, withTop, DRAW_NORMAL_MAP);
  }

  /** "Map images off" mode: flat colours, blocked cells darker. */
  drawOFFMap(g: Graphics): void {
    g.setColor(9997161);
    g.fillRect(0, 0, this.screenFullWidth, this.screenFullHeight);
    for (let gy = this.mapStartGy; gy <= this.mapEndGy; gy++) {
      for (let gx = this.mapStartGx; gx <= this.mapEndGx; gx++) {
        if (!this.isCanPass(gx, gy)) {
          g.setColor(6508872);
          g.fillRect(gx * TILE + this.offsetLeftX, gy * TILE + this.offsetTopY, TILE, TILE);
        }
      }
    }
  }

  // --- wrap-around back buffer ---

  initMapBuffer(): void {
    this.setTag(TAG_IS_INIT, false);
    this.setCameraToPlayer(this.camera);
    this.m_x = (-this.offsetX / TILE) | 0;
    this.m_y = (-this.offsetY / TILE) | 0;
    this.m_bbx = 0;
    this.m_bby = 0;
    this.m_bbScreenWidth = this.screenFullWidth;
    this.m_bbScreenHeight = this.screenHeight;
    this.m_bbNumCols = (((this.screenFullWidth + 23) / TILE) | 0) + 1;
    this.m_bbNumRows = (((this.screenHeight + 23) / TILE) | 0) + 1;
    this.m_bbWidth = this.m_bbNumCols * TILE;
    this.m_bbHeight = this.m_bbNumRows * TILE;
    if (this.mapHeight <= this.screenHeight) {
      this.m_y = 0;
      this.m_bbNumRows = this.mapRows;
      this.m_bbHeight = this.mapHeight;
      this.m_bbScreenHeight = this.mapHeight;
    }
    const img = this.m_bbImage;
    if (img == null || this.m_bbWidth !== img.getWidth() || this.m_bbHeight !== img.getHeight()) {
      this.m_bbColRepaint = new Array(this.m_bbNumCols).fill(false);
      this.m_bbRowRepaint = new Array(this.m_bbNumRows).fill(false);
      this.m_bbImage = null;
      this.m_bbGraphics = null;
      if (this.m_bbWidth === 0 || this.m_bbHeight === 0) return;
      this.m_bbImage = Image.createImage(this.m_bbWidth, this.m_bbHeight);
      this.m_bbGraphics = this.m_bbImage.getGraphics();
      this.m_bbGraphics.setColor(0);
      this.m_bbGraphics.fillRect(0, 0, this.m_bbWidth, this.m_bbHeight);
    }
    this.initDrawBuffer();
    this.oldOffsetX = this.offsetX;
    this.oldOffsetY = this.offsetY;
    this.setTag(TAG_IS_INIT, true);
  }

  private initDrawBuffer(): void {
    for (let i = this.m_bbNumCols - 1; i >= 0; i--) this.fillCol(this.m_x + i, this.m_y, i, 0);
    for (let i = this.m_bbNumRows - 1; i >= 0; i--) this.m_bbRowRepaint[i] = false;
  }

  /** Repaints buffer column `bufCol` with world column `gx`, rows from `gy`, buffer row origin `bufRow0`. */
  private fillCol(gx: number, gy: number, bufCol: number, bufRow0: number): void {
    const g = this.m_bbGraphics!;
    const bx = bufCol * TILE;
    g.setClip(bx, 0, TILE, this.m_bbHeight);
    // Clear first: Java relied on opaque ground tiles; transparent edges would smear otherwise.
    g.setColor(0);
    g.fillRect(bx, 0, TILE, this.m_bbHeight);
    this.m_bbColRepaint[bufCol] = false;
    for (let li = 0; li < this.playerLayerIndex; li++) {
      const l = this.layers![li];
      if (l instanceof PixelLayer) {
        l.drawColObject(g, bx, bufRow0 * TILE, this.m_bbHeight, gx * TILE, gy * TILE);
      } else if (l instanceof TileLayer) {
        let wy = gy;
        let br = bufRow0;
        for (let n = this.m_bbNumRows - 1; n >= 0; n--) {
          if (br >= this.m_bbNumRows) br = 0;
          l.drawTiteObject(g, gx, wy, bx, br * TILE);
          wy++;
          br++;
        }
      }
    }
  }

  private fillRow(gx: number, gy: number, bufCol0: number, bufRow: number): void {
    const g = this.m_bbGraphics!;
    const by = bufRow * TILE;
    g.setClip(0, by, this.m_bbWidth, TILE);
    g.setColor(0);
    g.fillRect(0, by, this.m_bbWidth, TILE);
    this.m_bbRowRepaint[bufRow] = false;
    for (let li = 0; li < this.playerLayerIndex; li++) {
      const l = this.layers![li];
      if (l instanceof PixelLayer) {
        l.drawRowObject(g, bufCol0 * TILE, by, this.m_bbWidth, gx * TILE, gy * TILE);
      } else if (l instanceof TileLayer) {
        let wx = gx;
        let bc = bufCol0;
        for (let n = this.m_bbNumCols - 1; n >= 0; n--) {
          if (bc >= this.m_bbNumCols) bc = 0;
          l.drawTiteObject(g, wx, gy, bc * TILE, by);
          wx++;
          bc++;
        }
      }
    }
  }

  /** Blits the buffer as 4 quadrants so the wrap seam lands at the right screen position. */
  drawMapBuffer(g: Graphics, top: number): void {
    if (this.m_bbImage == null) return;
    const sx = this.m_bbx * TILE + ((-this.offsetX) % TILE);
    let sy = this.m_bby * TILE + ((-this.offsetY) % TILE);
    if (this.mapHeight <= this.screenHeight) {
      sy = -this.offsetY;
      g.setClip(0, -sy + top, this.m_bbScreenWidth, this.m_bbScreenHeight);
    } else {
      g.setClip(0, top, this.m_bbScreenWidth, this.m_bbScreenHeight);
    }
    const x1 = -sx;
    const x2 = this.m_bbWidth - sx;
    const y1 = -sy + top;
    const y2 = this.m_bbHeight - sy + top;
    g.drawImage(this.m_bbImage, x1, y1, 0);
    g.drawImage(this.m_bbImage, x1, y2, 0);
    g.drawImage(this.m_bbImage, x2, y1, 0);
    g.drawImage(this.m_bbImage, x2, y2, 0);
    g.setClip(0, 0, this.screenFullWidth, this.screenFullHeight);
  }

  private updateMapBuffer(ox: number, oy: number): void {
    let dx = -ox - this.m_x * TILE;
    let dy = -oy - this.m_y * TILE;
    if (this.mapHeight <= this.screenHeight) dy = 0;
    this.m_mov_x = 0;
    this.m_mov_y = 0;
    while (dx < 0) {
      this.m_x--;
      this.m_bbx--;
      this.m_mov_x--;
      if (this.m_bbx < 0) this.m_bbx = this.m_bbNumCols - 1;
      this.m_bbColRepaint[this.m_bbx] = true;
      dx += TILE;
    }
    while (dx >= TILE) {
      this.m_x++;
      this.m_bbx++;
      this.m_mov_x++;
      if (this.m_bbx >= this.m_bbNumCols) {
        this.m_bbx = 0;
        this.m_bbColRepaint[this.m_bbNumCols - 1] = true;
      } else {
        this.m_bbColRepaint[this.m_bbx - 1] = true;
      }
      dx -= TILE;
    }
    for (let i = 0, c = this.m_bbx; i < this.m_bbNumCols; i++, c++) {
      if (c >= this.m_bbNumCols) c -= this.m_bbNumCols;
      if (this.m_bbColRepaint[c]) this.fillCol(this.m_x + i, this.m_y, c, this.m_bby);
    }
    while (dy < 0) {
      this.m_y--;
      this.m_bby--;
      this.m_mov_y--;
      if (this.m_bby < 0) this.m_bby = this.m_bbNumRows - 1;
      this.m_bbRowRepaint[this.m_bby] = true;
      dy += TILE;
    }
    while (dy >= TILE) {
      this.m_y++;
      this.m_bby++;
      this.m_mov_y++;
      if (this.m_bby >= this.m_bbNumRows) {
        this.m_bby = 0;
        this.m_bbRowRepaint[this.m_bbNumRows - 1] = true;
      } else {
        this.m_bbRowRepaint[this.m_bby - 1] = true;
      }
      dy -= TILE;
    }
    for (let i = 0, r = this.m_bby; i < this.m_bbNumRows; i++, r++) {
      if (r >= this.m_bbNumRows) r -= this.m_bbNumRows;
      if (this.m_bbRowRepaint[r]) this.fillRow(this.m_x, this.m_y + i, this.m_bbx, r);
    }
  }
}

