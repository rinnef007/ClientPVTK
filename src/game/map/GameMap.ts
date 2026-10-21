// Port of com.hz.map.GameMap: map data, collision bits, camera and the wrap-around back buffer
// that only repaints the tile columns/rows scrolled into view.
// Not ported yet: path finding, small map, escort UI, arrow guides.
import type { Graphics } from '../../midp/Graphics';
import { DataInputStream } from '../common/DataStream';
import { byte2short, getCost, getOffsetValue, getXKey, getYKey, setKeyXY } from '../common/Tool';
import { setPlKey } from '../common/Utilities';
import { GameImage } from '../image/GameImage';
import { Image } from '../image/Image';
import * as ResourceHandler from '../main/ResourceHandler';
import { drawBorderString, drawImageNumber, getImageSet } from '../main/GameView';
import { rectIn } from '../common/Tool';
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

/** One open/closed-list entry of findPath: [x px, y px, cost, dir back to the parent]. */
type PathNode = [number, number, number, number];

// WorldPanel.getMoveXByDir/getMoveYByDir/getReverseDir, inlined to avoid a module cycle.
const moveX = (d: number, n: number) => (d === 0 ? n : d === 1 ? -n : 0);
const moveY = (d: number, n: number) => (d === 2 ? n : d === 3 ? -n : 0);
const reverseDir = (d: number) => (d === 0 ? 1 : d === 1 ? 0 : d === 2 ? 3 : d === 3 ? 2 : 8);

export interface CameraTarget {
  getPx(): number;
  getPy(): number;
}

export interface SmallMapInfo {
  me: { gx: number; gy: number; dir: number } | null;
  npcs: { gx: number; gy: number; npcType: number; sign: number; jumpIcon: boolean; visible: boolean }[];
  /** Mission.newRadar*: the current quest target, when it is on this map. */
  radar?: { mapId: number; gx: number; gy: number } | null;
  /** GameCanvas.isMotion: the radar mark blinks with it. */
  motion?: number;
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
  /** Path-search scratch tables (byte in Java: values wrap past 127 like the original). */
  searchStep: Int8Array[] = [];
  nextSearchPosX: Int8Array = new Int8Array(0);
  nextSearchPosY: Int8Array = new Int8Array(0);
  /** GameWorld.getNPC(gx, gy) != null; injected by GameWorld to keep this module standalone. */
  static npcAt: (gx: number, gy: number) => boolean = () => false;
  /** What the mini map shows; GameWorld fills this in (avoids an import cycle). */
  static smallMapInfo: () => SmallMapInfo = () => ({ me: null, npcs: [] });
  /** Mini map box (GameMap.initSmallMapWidth: the HUD's EVENT_ALL_INFO_SMALL_MAP widget). */
  static SMALL_SHOW_MAP_WIDTH = 0;
  static MAP_X = 0;
  static MAP_Y = 0;
  private smallMap: Image | null = null;
  private mapSpaceX = 2;
  private mapSpaceY = 2;
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

  clearSearchTable(): void {
    for (const row of this.searchStep) row.fill(-1);
  }

  /**
   * Pointer path finding (GameMap.findPath): best-first search over 4-neighbours in pixel
   * coordinates with `step` px moves, scoring each cell by distance-to-start + distance-to-goal.
   * Returns the list of directions (0 right, 1 left, 2 down, 3 up) or null.
   * A blocked goal is allowed when an NPC stands on it, so the player can walk up to NPCs.
   */
  findPath(sgx: number, sgy: number, tgx: number, tgy: number, step: number): number[] | null {
    if (sgx === tgx && sgy === tgy) return null;
    const sx = sgx * TILE;
    const sy = sgy * TILE;
    const tx = tgx * TILE;
    const ty = tgy * TILE;
    this.clearSearchTable();
    const open: PathNode[] = [];
    const closed: PathNode[] = [];
    let cur: PathNode | null = [sx, sy, getCost(sx, sy, tx, ty), 8];
    closed.push(cur);
    this.searchStep[sgy][sgx] = 1;
    let x: number;
    let y: number;
    do {
      this.findAndCalculate(cur[0], cur[1], sx, sy, tx, ty, tgx, tgy, open, step);
      cur = this.findLessCostPos(open);
      if (cur == null) return null;
      open.splice(open.indexOf(cur), 1);
      closed.push(cur);
      y = cur[1];
      x = cur[0];
      this.searchStep[(y / TILE) | 0][(x / TILE) | 0] = 1;
    } while (x !== tx || y !== ty);
    return this.getPath(closed, cur, sx, sy, step);
  }

  protected findAndCalculate(x: number, y: number, sx: number, sy: number, tx: number, ty: number, tgx: number, tgy: number, open: PathNode[], step: number): void {
    this.calculateCost(x, y - step, sx, sy, tx, ty, tgx, tgy, open, 2);
    this.calculateCost(x, y + step, sx, sy, tx, ty, tgx, tgy, open, 3);
    this.calculateCost(x - step, y, sx, sy, tx, ty, tgx, tgy, open, 0);
    this.calculateCost(x + step, y, sx, sy, tx, ty, tgx, tgy, open, 1);
  }

  protected calculateCost(x: number, y: number, sx: number, sy: number, tx: number, ty: number, tgx: number, tgy: number, open: PathNode[], dirBack: number): void {
    const gx = (x / TILE) | 0;
    const gy = (y / TILE) | 0;
    if (gx < 0 || gx >= this.mapColumns || gy < 0 || gy >= this.mapRows) return;
    if (!this.isCanPass(gx, gy) && (gx !== tgx || gy !== tgy || !GameMap.npcAt(tgx, tgy))) return;
    if (this.searchStep[gy][gx] > 0) return;
    open.push([x, y, getCost(x, y, sx, sy) + getCost(x, y, tx, ty), dirBack]);
    this.searchStep[gy][gx] = 1;
  }

  /** First entry with the strictly lowest cost (ties keep the earliest, as in Java). */
  protected findLessCostPos(open: PathNode[]): PathNode | null {
    if (open.length === 0) return null;
    let best = open[0];
    for (let i = 1; i < open.length; i++) if (open[i][2] < best[2]) best = open[i];
    return best;
  }

  protected getPath(closed: PathNode[], end: PathNode | null, sx: number, sy: number, step: number): number[] | null {
    if (end == null || (end[0] === sx && end[1] === sy)) return null;
    const path: number[] = [];
    let k = setKeyXY(end[0] + moveX(end[3], step), end[1] + moveY(end[3], step));
    path.unshift(reverseDir(end[3]));
    for (;;) {
      const x = (getXKey(k) << 16) >> 16;
      const y = (getYKey(k) << 16) >> 16;
      if (x === sx && y === sy) return path;
      const node = this.getPathInfoByPos(x, y, closed);
      if (node == null) return null;
      closed.splice(closed.indexOf(node), 1);
      k = setKeyXY(node[0] + moveX(node[3], step), node[1] + moveY(node[3], step));
      path.unshift(reverseDir(node[3]));
    }
  }

  protected getPathInfoByPos(x: number, y: number, list: PathNode[]): PathNode | null {
    for (let i = list.length - 1; i >= 0; i--) if (list[i][0] === x && list[i][1] === y) return list[i];
    return null;
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
    this.searchStep = Array.from({ length: this.mapRows }, () => new Int8Array(this.mapColumns));
    this.nextSearchPosX = new Int8Array(this.mapRows * this.mapColumns);
    this.nextSearchPosY = new Int8Array(this.mapRows * this.mapColumns);
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
    if (withTop) this.drawSmallMap(g);
  }

  /** Places the mini map on the HUD widget, or top-right when there is no HUD. */
  static initSmallMapWidth(widget: { getW(): number; getAbsX(): number; getAbsY(): number } | null, screenW: number, map: GameMap | null): void {
    if (widget == null) {
      GameMap.MAP_X = screenW - GameMap.SMALL_SHOW_MAP_WIDTH - 2;
      GameMap.MAP_Y = 2;
    } else {
      GameMap.SMALL_SHOW_MAP_WIDTH = widget.getW();
      GameMap.MAP_X = widget.getAbsX();
      GameMap.MAP_Y = widget.getAbsY();
    }
    map?.initSmallMap();
  }

  initSmallMap(): void {
    if (this.layers == null || this.mapImages == null || this.smallMap != null) return;
    this.smallMap = this.createSimpleSamllMap(this.mapColumns * 2 + 4, this.mapRows * 2 + 4);
  }

  /** 2 px per cell: walkable cells light, the rest (and the margin) dark; centred if smaller than the box. */
  private createSimpleSamllMap(w: number, h: number): Image {
    this.mapSpaceX = 2;
    this.mapSpaceY = 2;
    const box = GameMap.SMALL_SHOW_MAP_WIDTH;
    if (w < box) {
      this.mapSpaceX = (((box - w) / 2) | 0) + 2;
      w = box;
    }
    if (h < box) {
      this.mapSpaceY = (((box - h) / 2) | 0) + 2;
      h = box;
    }
    const px = new Int32Array(w * h).fill(-714911416);
    for (let gy = 0; gy < this.mapRows; gy++) {
      for (let gx = 0; gx < this.mapColumns; gx++) {
        if (!this.isCanPass(gx, gy)) continue;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) px[(this.mapSpaceY + gy * 2 + dy) * w + this.mapSpaceX + gx * 2 + dx] = -711423127;
        }
      }
    }
    return Image.createRGBImage(px, w, h);
  }

  /**
   * Mini map scrolled to keep the player centred, NPC markers from image set 4 (GameView.mapSet),
   * the player arrow, the cell coordinates in set 1002 above it and the map name below.
   * Not ported: the "hide mini map" / "show monsters" player settings.
   */
  private drawSmallMap(g: Graphics): void {
    const { me, npcs, radar, motion } = GameMap.smallMapInfo();
    if (me == null) return;
    const set = getImageSet(4);
    const mx = GameMap.MAP_X;
    const my = GameMap.MAP_Y;
    const img = this.smallMap;
    const has = img != null && set != null;
    let bw = 0;
    let bh = 0;
    if (has) {
      bw = GameMap.SMALL_SHOW_MAP_WIDTH > 0 ? GameMap.SMALL_SHOW_MAP_WIDTH : img.getWidth();
      bh = GameMap.SMALL_SHOW_MAP_WIDTH > 0 ? GameMap.SMALL_SHOW_MAP_WIDTH : img.getHeight();
      g.setColor(0);
      g.drawRect(mx - 2, my - 2, bw + 3, bh + 3);
      g.setColor(0xffffff);
      g.drawRect(mx - 1, my - 1, bw + 1, bh + 1);
      g.setClip(mx, my, bw, bh);
      const px = me.gx * 2;
      const py = me.gy * 2;
      const cx = this.mapSpaceX + px;
      const cy = this.mapSpaceY + py;
      const ix = cx > bw >> 1 ? mx - (cx + (bw >> 1) >= img.getWidth() ? img.getWidth() - bw : cx - (bw >> 1)) : mx;
      const iy = cy > bh >> 1 ? my - (cy + (bh >> 1) >= img.getHeight() ? img.getHeight() - bh : cy - (bh >> 1)) : my;
      g.drawImage(img, ix, iy, 20);
      const ox = ix + this.mapSpaceX;
      const oy = iy + this.mapSpaceY;
      for (const n of npcs) {
        if (!n.visible) continue;
        const x = ox + n.gx * 2;
        const y = oy + n.gy * 2;
        if (!rectIn(mx, my, bw, bh, x, y)) continue;
        if (n.npcType === 1) continue; // monsters only show with the "show monsters" setting
        if (n.npcType === 3 || n.npcType === 8) {
          set.drawFrame(g, 4, x, y, 0, 3);
          continue;
        }
        set.drawFrame(g, n.jumpIcon ? 4 : 7, x, y, 0, 3);
        const signFrame = { 1: 0, 2: 5, 3: 1 }[n.sign];
        if (signFrame !== undefined) set.drawFrame(g, signFrame, x, y, 0, 3);
      }
      if (radar != null && radar.mapId === this.mapID && motion === 1) set.drawFrame(g, 6, ox + radar.gx * 2, oy + radar.gy * 2, 0, 3);
      const trans = ({ 0: 5, 1: 3, 3: 4 } as Record<number, number>)[me.dir] ?? 0;
      set.drawFrame(g, 2, ox + px, oy + py, trans, 3);
      g.setClip(0, 0, this.screenWidth, this.screenHeight);
    }
    const num = getImageSet(1002);
    let nameY = 0;
    if (num != null) {
      const fw = num.getFrameWidth(0);
      const fh = num.getFrameHeight(0);
      const w5 = fw * 5;
      const half = w5 >> 1;
      let y = my - (fh >> 1);
      const x = mx + ((bw / 2) | 0) - half;
      g.setColor(0xffffff);
      g.fillRect(x - 1, y, w5 + 2, fh + 2);
      y++;
      g.setColor(0);
      g.fillRect(x, y, w5, fh);
      drawImageNumber(g, num, 0, `${me.gx} ${me.gy}`, x + half, y, 0, 17);
      nameY = fh;
    }
    nameY = has ? my + bh : nameY + 3;
    drawBorderString(g, 0xffffff, 789517, this.name ? this.name : '--', mx + bw, nameY, 24);
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

