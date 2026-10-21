import { LEFT, TOP } from '../midp/anchor';
import { FONT_SMALL, type Graphics } from '../midp/Graphics';
import {
  KEY_DOWN,
  KEY_FIRE,
  KEY_LEFT,
  KEY_POUND,
  KEY_RIGHT,
  KEY_SOFT_LEFT,
  KEY_SOFT_RIGHT,
  KEY_UP,
  type InputState,
} from '../midp/Input';
import { GameMap, TAG_FORCE_PAINT, TAG_MAP_IMG_OFF } from '../game/map/GameMap';
import type { MapModel } from '../game/map/PlayerLayer';
import { TEST_MAP_SPRITES, buildTestMap } from '../game/map/TestMap';
import { TILE } from '../game/map/TileLayer';
import { ANIMATION_MOVE, ANIMATION_STAND, GameSprite, preloadSprite } from '../game/sprite/GameSprite';
import { MenuScene } from './MenuScene';
import { COLOR_TEXT, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { softKeyAt } from './ui';

const PLAYER_SPRITE = 100;
/** Pixels per 50ms tick. Simplified: the real Player walks grid paths from server-confirmed moves. */
const WALK_SPEED = 4;
const HUD_H = 20;

/**
 * Stand-in for com.hz.actor.Player on the map (that class is not ported yet). Position is the
 * top-left of its grid cell in world pixels, like Model.getPx()/getPy(); drawing follows
 * PlayerLayer.drawModel (foot at px+12, py+24).
 */
class WalkingPlayer implements MapModel {
  px: number;
  py: number;

  constructor(
    readonly sprite: GameSprite,
    gx: number,
    gy: number,
  ) {
    this.px = gx * TILE;
    this.py = gy * TILE;
  }

  getPx(): number {
    return this.px;
  }
  getPy(): number {
    return this.py;
  }
  getGx(): number {
    return ((this.px + 12) / TILE) | 0;
  }
  getGy(): number {
    return ((this.py + 12) / TILE) | 0;
  }

  drawOnMap(g: Graphics, ox: number, oy: number): void {
    this.sprite.draw(g, this.px + ox + 12, this.py + oy + 24);
  }

  step(dx: number, dy: number, map: GameMap): void {
    const moving = dx !== 0 || dy !== 0;
    if (dx !== 0) this.sprite.setRotate(dx < 0);
    this.sprite.setCurAnimation(moving ? ANIMATION_MOVE : ANIMATION_STAND);
    if (moving) {
      // Axis-separated so the player slides along walls.
      if (this.canStand(this.px + dx, this.py, map)) this.px += dx;
      if (this.canStand(this.px, this.py + dy, map)) this.py += dy;
    }
    this.sprite.action();
  }

  private canStand(px: number, py: number, map: GameMap): boolean {
    if (px < 0 || py < 0 || px > map.mapWidth - TILE || py > map.mapHeight - TILE) return false;
    return map.isCanPass(((px + 12) / TILE) | 0, ((py + 12) / TILE) | 0);
  }
}

export class MapScene implements Scene {
  private map: GameMap | null = null;
  private player: WalkingPlayer | null = null;
  private status = 'Đang tải bản đồ…';
  private showGrid = false;

  constructor(private readonly ctx: Context) {
    void this.load();
  }

  private async load(): Promise<void> {
    const map = GameMap.loadMap(buildTestMap());
    if (!map) {
      this.status = 'Lỗi đọc dữ liệu bản đồ';
      return;
    }
    await Promise.all([PLAYER_SPRITE, ...TEST_MAP_SPRITES].map(preloadSprite));
    const sprite = GameSprite.createSprite(PLAYER_SPRITE);
    if (!sprite) {
      this.status = `Không tải được sprite ${PLAYER_SPRITE}`;
      return;
    }
    map.initGameMapData(SCREEN_WIDTH, SCREEN_HEIGHT, HUD_H, 0);
    map.loadMapPalette();
    map.getPlayerLayer()?.createMapSprites();
    await map.whenImagesReady();
    await Promise.all((sprite.fragmentFiles ?? []).map((f) => f?.gameImage?.getImage()?.ready));
    const player = new WalkingPlayer(sprite, 20, 17);
    map.models = [player];
    map.camera = player;
    map.init();
    this.map = map;
    this.player = player;
  }

  update(input: InputState): void {
    if (input.key === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
    if (input.key === KEY_SOFT_LEFT) this.map?.setTag(TAG_MAP_IMG_OFF, !this.map.isTag(TAG_MAP_IMG_OFF));
    if (input.key === KEY_FIRE) this.showGrid = !this.showGrid;
    // Full repaint of the back buffer, e.g. to compare against the incremental scroll path.
    if (input.key === KEY_POUND) this.map?.setTag(TAG_FORCE_PAINT, true);
    for (const p of input.pointers) {
      if (p.type === 'down' && softKeyAt(p.x, p.y) === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
    }
    const map = this.map;
    const player = this.player;
    if (!map || !player) return;
    const k = input.holding;
    const dx = k === KEY_LEFT ? -WALK_SPEED : k === KEY_RIGHT ? WALK_SPEED : 0;
    const dy = k === KEY_UP ? -WALK_SPEED : k === KEY_DOWN ? WALK_SPEED : 0;
    player.step(dx, dy, map);
    map.setCameraToPlayer(player);
  }

  paint(g: Graphics): void {
    g.setColor(0);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const map = this.map;
    if (!map || !this.player) {
      g.setColor(COLOR_TEXT);
      g.drawString(this.status, 8, 8, LEFT | TOP);
      return;
    }
    map.draw(g, true);
    if (this.showGrid) this.drawCollision(g, map);
    // Minimal HUD where GameView.topViewImg would go.
    g.setColor(0x10141c);
    g.fillRect(0, 0, SCREEN_WIDTH, HUD_H);
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_TEXT);
    const p = this.player;
    g.drawString(`Ô (${p.getGx()},${p.getGy()}) · Enter lưới · Q tắt ảnh · Esc thoát`, 4, 3, LEFT | TOP);
  }

  private drawCollision(g: Graphics, map: GameMap): void {
    for (let gy = map.mapStartGy; gy <= map.mapEndGy; gy++) {
      for (let gx = map.mapStartGx; gx <= map.mapEndGx; gx++) {
        const x = gx * TILE + map.offsetLeftX;
        const y = gy * TILE + map.offsetTopY;
        g.setColor(map.isCanPass(gx, gy) ? 0x3a5a3a : 0xc04040);
        g.drawRect(x, y, TILE - 1, TILE - 1);
      }
    }
  }
}
