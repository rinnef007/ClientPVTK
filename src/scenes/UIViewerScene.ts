import { LEFT, TOP } from '../midp/anchor';
import { FONT_SMALL, FONT_MEDIUM, type Graphics } from '../midp/Graphics';
import { KEY_DOWN, KEY_FIRE, KEY_LEFT, KEY_RIGHT, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_UP, type InputState } from '../midp/Input';
import { getAssetFS } from '../game/common/Utilities';
import { imageSetFiles } from '../game/main/GameView';
import { uiFont, uiScreen, type GWidget } from '../game/gui/GWidget';
import { buildAndShow } from '../game/ui/UIBuilder';
import { collectImageSets } from '../game/ui/UIPreview';
import { PIXEL_FONT_SIZES } from '../game/string/PixelFont';
import { parseUIFile, uiMetrics, type UIFile } from '../game/ui/XmlParse';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { softKeyAt } from './ui';

/** Browses the game's 165 .ui layouts (preliminary rendering, see UIPreview). */
export class UIViewerScene implements Scene {
  private readonly ids: number[];
  private idx = 0;
  private file: UIFile | null = null;
  private root: GWidget | null = null;
  private status = '';
  private showInfo = true;
  private token = 0;

  constructor(private readonly ctx: Context) {
    this.ids = (ctx.manifest?.dirs['ui'] ?? [])
      .filter((n) => n.endsWith('.ui'))
      .map((n) => Number(n.slice(0, -3)))
      .sort((a, b) => a - b);
    uiMetrics.screenWidth = uiScreen.width = SCREEN_WIDTH;
    uiMetrics.screenHeight = uiScreen.height = SCREEN_HEIGHT;
    // Labels size themselves from text metrics while the tree is built (GLabel.resetSize).
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `${FONT_MEDIUM}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    uiFont.height = FONT_MEDIUM + 2;
    uiMetrics.fontHeight = uiFont.height;
    uiFont.stringWidth = (t) => Math.ceil(measure.measureText(t).width);
    void this.load();
  }

  private async load(): Promise<void> {
    const id = this.ids[this.idx];
    if (id === undefined) return;
    const token = ++this.token;
    this.status = 'Đang tải…';
    this.root = null;
    const fs = getAssetFS();
    await fs.preload([`ui/${id}.ui`, ...PIXEL_FONT_SIZES.map((n) => `common/${n}.t`)]);
    const data = fs.get(`ui/${id}.ui`);
    if (!data || token !== this.token) return;
    try {
      const f = parseUIFile(data);
      const sets = [...collectImageSets(f)];
      await fs.preload(sets.flatMap(imageSetFiles));
      if (token !== this.token) return;
      this.file = f;
      this.root = buildAndShow(f);
      this.status = '';
    } catch (e) {
      this.status = `Lỗi đọc: ${(e as Error).message}`;
    }
  }

  private step(d: number): void {
    const n = this.ids.length;
    if (!n) return;
    this.idx = (this.idx + d + n) % n;
    void this.load();
  }

  update(input: InputState): void {
    switch (input.key) {
      case KEY_LEFT:
      case KEY_UP:
        this.step(-1);
        break;
      case KEY_RIGHT:
      case KEY_DOWN:
        this.step(1);
        break;
      case KEY_FIRE:
      case KEY_SOFT_LEFT:
        this.showInfo = !this.showInfo;
        break;
      case KEY_SOFT_RIGHT:
        return this.ctx.go(new MenuScene(this.ctx));
    }
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      if (softKeyAt(p.x, p.y) === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
      this.step(p.x < SCREEN_WIDTH / 2 ? -1 : 1);
    }
  }

  paint(g: Graphics): void {
    // The world normally shows behind dialogs; a dark backdrop stands in for it.
    g.setColor(0x202833);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    g.setFontSize(FONT_MEDIUM);
    if (this.root) {
      this.root.paint(g);
      g.setClip(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
    if (!this.showInfo) return;
    g.setFontSize(FONT_SMALL);
    g.setColor(0xc0000000);
    g.fillRect(0, SCREEN_HEIGHT - 34, SCREEN_WIDTH, 34);
    g.setColor(COLOR_TITLE);
    const id = this.ids[this.idx];
    const lib = this.file?.lib.length ?? 0;
    g.drawString(`ui/${id}.ui  (${this.idx + 1}/${this.ids.length})  thư viện: ${lib}  ${this.status}`, 4, SCREEN_HEIGHT - 32, LEFT | TOP);
    g.setColor(COLOR_DIM);
    g.drawString('←/→ đổi · Enter ẩn chú thích · Esc thoát · GLabel: font hệ thống · GPixelLabel: font .t', 4, SCREEN_HEIGHT - 17, LEFT | TOP);
  }
}
