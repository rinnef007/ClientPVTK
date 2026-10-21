import { BOTTOM, HCENTER, LEFT, TOP, VCENTER } from '../midp/anchor';
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
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_TEXT, COLOR_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { SOFTKEY_H, TITLE_H, drawFrame, drawParagraph, softKeyAt } from './ui';

const PLAY_TICKS = 3; // 150ms per frame while playing

/**
 * Browses imported PNGs by directory. "Play" steps through files in numeric order, which shows
 * the raw frame strips; proper animation needs the .spr/.fr data that is not in the upload.
 */
export class AssetViewerScene implements Scene {
  private dir = 0;
  private idx = 0;
  private playing = false;
  private zoom = 2;
  private tick = 0;
  private readonly dirs: [string, string[]][];

  constructor(private readonly ctx: Context) {
    this.dirs = Object.entries(ctx.manifest?.dirs ?? {}).filter(([, files]) => files.length > 0);
  }

  private get files(): string[] {
    return this.dirs[this.dir]?.[1] ?? [];
  }

  private step(d: number): void {
    const n = this.files.length;
    if (n) this.idx = (this.idx + d + n) % n;
  }

  private switchDir(d: number): void {
    const n = this.dirs.length;
    if (!n) return;
    this.dir = (this.dir + d + n) % n;
    this.idx = 0;
  }

  update(input: InputState): void {
    switch (input.key) {
      case KEY_LEFT:
        this.step(-1);
        break;
      case KEY_RIGHT:
        this.step(1);
        break;
      case KEY_UP:
        this.switchDir(-1);
        break;
      case KEY_DOWN:
        this.switchDir(1);
        break;
      case KEY_FIRE:
        this.playing = !this.playing;
        break;
      case KEY_SOFT_LEFT:
        this.zoom = this.zoom >= 4 ? 1 : this.zoom + 1;
        break;
      case KEY_SOFT_RIGHT:
        this.ctx.go(new MenuScene(this.ctx));
        return;
    }
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      const soft = softKeyAt(p.x, p.y);
      if (soft === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
      if (soft === KEY_SOFT_LEFT) this.zoom = this.zoom >= 4 ? 1 : this.zoom + 1;
      else if (p.y < TITLE_H + 40) this.switchDir(1);
      else if (p.x < SCREEN_WIDTH / 3) this.step(-1);
      else if (p.x > (SCREEN_WIDTH * 2) / 3) this.step(1);
      else this.playing = !this.playing;
    }
    if (this.playing && ++this.tick % PLAY_TICKS === 0) this.step(1);
  }

  paint(g: Graphics): void {
    drawFrame(g, 'Xem tài nguyên', `Zoom x${this.zoom}`, 'Quay lại');
    if (!this.dirs.length) {
      drawParagraph(
        g,
        'Chưa có manifest. Giải nén ảnh rồi chạy:\nnpm run import-assets -- <thư mục chứa assets/>',
        16,
        TITLE_H + 16,
        SCREEN_WIDTH - 32,
        COLOR_TEXT,
      );
      return;
    }
    const [dirName, files] = this.dirs[this.dir];
    const file = files[this.idx];
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_TITLE);
    g.drawString(`▲▼ ${dirName}/  (${this.dir + 1}/${this.dirs.length})`, 8, TITLE_H + 6, LEFT | TOP);
    g.setColor(COLOR_TEXT);
    g.drawString(`◀▶ ${file}  ${this.idx + 1}/${files.length}`, 8, TITLE_H + 22, LEFT | TOP);

    const img = this.ctx.images.get(`${dirName}/${file}`);
    const areaTop = TITLE_H + 40;
    const areaH = SCREEN_HEIGHT - SOFTKEY_H - areaTop - 20;
    const cx = SCREEN_WIDTH / 2;
    const cy = areaTop + areaH / 2;
    if (img) {
      // Fit inside the view area, but never upscale past the chosen zoom.
      const s = Math.min(this.zoom, (SCREEN_WIDTH - 16) / img.width, areaH / img.height);
      const w = Math.max(1, Math.round(img.width * s));
      const h = Math.max(1, Math.round(img.height * s));
      g.ctx.save();
      g.ctx.imageSmoothingEnabled = s < 1;
      g.ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
      g.ctx.restore();
      g.setColor(COLOR_DIM);
      g.drawString(`${img.width}×${img.height}${this.playing ? '  ▶' : ''}`, cx, SCREEN_HEIGHT - SOFTKEY_H - 4, HCENTER | BOTTOM);
    } else {
      g.setColor(COLOR_DIM);
      g.drawString('Đang tải…', cx, cy, HCENTER | VCENTER);
    }
  }
}
