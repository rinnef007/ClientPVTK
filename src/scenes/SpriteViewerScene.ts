import { BOTTOM, HCENTER, LEFT, TOP } from '../midp/anchor';
import { FONT_SMALL, type Graphics } from '../midp/Graphics';
import {
  KEY_DOWN,
  KEY_FIRE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SOFT_LEFT,
  KEY_SOFT_RIGHT,
  KEY_UP,
  type InputState,
} from '../midp/Input';
import { GameSprite, preloadSprite } from '../game/sprite/GameSprite';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_TEXT, COLOR_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { SOFTKEY_H, TITLE_H, drawFrame, softKeyAt } from './ui';

/** Browses every sprite_N.spr in the assets and plays its animations through GameSprite. */
export class SpriteViewerScene implements Scene {
  private readonly ids: number[];
  private idx = 0;
  private sprite: GameSprite | null = null;
  private loading = false;
  private aniIdx = 0;
  private mirror = false;
  private zoom = 2;
  private loadToken = 0;

  constructor(private readonly ctx: Context) {
    this.ids = (ctx.manifest?.dirs['ani/ani2'] ?? [])
      .filter((n) => n.startsWith('sprite_') && n.endsWith('.spr'))
      .map((n) => Number(n.slice(7, -4)))
      .sort((a, b) => a - b);
    // Start on the default male world sprite when present.
    this.idx = Math.max(0, this.ids.indexOf(100));
    this.load();
  }

  private load(): void {
    const id = this.ids[this.idx];
    if (id === undefined) return;
    const token = ++this.loadToken;
    this.loading = true;
    this.sprite = null;
    preloadSprite(id).then(async () => {
      if (token !== this.loadToken) return;
      const s = GameSprite.createSprite(id);
      // Wait for fragment images to decode so the first frame is complete.
      await Promise.all((s?.fragmentFiles ?? []).map((f) => f?.gameImage?.getImage()?.ready));
      if (token !== this.loadToken) return;
      this.sprite = s;
      this.aniIdx = 0;
      this.loading = false;
    });
  }

  private stepSprite(d: number, big = false): void {
    const n = this.ids.length;
    if (!n) return;
    this.idx = (this.idx + d * (big ? 10 : 1) + n * 10) % n;
    this.load();
  }

  private stepAnimation(d: number): void {
    const ids = this.sprite?.getAnimationIds() ?? [];
    if (!ids.length) return;
    this.aniIdx = (this.aniIdx + d + ids.length) % ids.length;
    this.sprite!.setCurAnimation(ids[this.aniIdx]);
  }

  update(input: InputState): void {
    switch (input.key) {
      case KEY_LEFT:
        this.stepSprite(-1);
        break;
      case KEY_RIGHT:
        this.stepSprite(1);
        break;
      case KEY_UP:
        this.stepAnimation(-1);
        break;
      case KEY_DOWN:
        this.stepAnimation(1);
        break;
      case KEY_FIRE:
        this.mirror = !this.mirror;
        break;
      case KEY_SOFT_LEFT:
        this.zoom = this.zoom >= 3 ? 1 : this.zoom + 1;
        break;
      case 49: // '1': jump back 10
        this.stepSprite(-1, true);
        break;
      case 51: // '3': jump forward 10
        this.stepSprite(1, true);
        break;
      case KEY_SOFT_RIGHT:
        return this.ctx.go(new MenuScene(this.ctx));
    }
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      const soft = softKeyAt(p.x, p.y);
      if (soft === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
      if (soft === KEY_SOFT_LEFT) this.zoom = this.zoom >= 3 ? 1 : this.zoom + 1;
      else if (p.x < SCREEN_WIDTH / 3) this.stepSprite(-1);
      else if (p.x > (SCREEN_WIDTH * 2) / 3) this.stepSprite(1);
      else this.stepAnimation(1);
    }
    if (this.sprite) {
      this.sprite.setRotate(this.mirror);
      this.sprite.action();
    }
  }

  paint(g: Graphics): void {
    drawFrame(g, 'Xem sprite', `Zoom x${this.zoom}`, 'Quay lại');
    const id = this.ids[this.idx];
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_TITLE);
    g.drawString(`◀▶ sprite_${id ?? '-'}  (${this.idx + 1}/${this.ids.length})  1/3: ±10`, 8, TITLE_H + 6, LEFT | TOP);
    const s = this.sprite;
    const aniIds = s?.getAnimationIds() ?? [];
    const a = s?.getCurAnimation();
    g.setColor(COLOR_TEXT);
    g.drawString(
      s
        ? `▲▼ animation ${s.getCurAniID()} (${this.aniIdx + 1}/${aniIds.length}) · frame ${a?.getCurFrame() ?? 0}/${a?.frameIds?.length ?? 0}${this.mirror ? ' · lật' : ''}`
        : this.loading
          ? 'Đang tải…'
          : 'Không tải được sprite này',
      8,
      TITLE_H + 22,
      LEFT | TOP,
    );

    const footX = SCREEN_WIDTH / 2;
    const footY = TITLE_H + 40 + (SCREEN_HEIGHT - SOFTKEY_H - TITLE_H - 60) * 0.7;
    // Ground cross marks the sprite origin (foot point).
    g.setColor(0x2a3348);
    g.drawLine(footX - 40, footY, footX + 40, footY);
    g.drawLine(footX, footY - 6, footX, footY + 6);
    if (s) {
      const c = g.ctx;
      c.save();
      // Zoom around the foot point; the canvas transform keeps the MIDP code unaware of scaling.
      c.translate(footX, footY);
      c.scale(this.zoom, this.zoom);
      c.translate(-footX, -footY);
      s.draw(g, footX, footY);
      c.restore();
      g.setColor(COLOR_DIM);
      g.drawString(`${s.getWidth()}×${s.getHeight()} · ${s.fragmentFiles?.length ?? 0} mảnh · ${s.frames?.length ?? 0} khung`, footX, SCREEN_HEIGHT - SOFTKEY_H - 4, HCENTER | BOTTOM);
    }
  }
}
