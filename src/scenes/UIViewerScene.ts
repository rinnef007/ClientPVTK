import { LEFT, TOP } from '../midp/anchor';
import { FONT_SMALL, FONT_MEDIUM, type Graphics } from '../midp/Graphics';
import { KEY_POUND, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_STAR, type InputState } from '../midp/Input';
import { getAssetFS } from '../game/common/Utilities';
import { imageSetFiles } from '../game/main/GameView';
import {
  GContainer,
  GWindow,
  SETTING_KEY_DOWN,
  SETTING_KEY_LEFT,
  SETTING_KEY_RIGHT,
  SETTING_KEY_UP,
  uiClock,
  type GWidget,
} from '../game/gui/GWidget';
import { UIInput } from '../game/ui/UIInput';
import { buildAndShow, collectSpriteIds, uiContext } from '../game/ui/UIBuilder';
import { preloadSprite, resolveSprite } from '../game/sprite/GameSprite';
import { createSpriteByIcon, encodeIcons } from '../game/sprite/SpriteIcon';
import { currentAppearance } from './DressingRoomScene';
import { collectImageSets } from '../game/ui/UIPreview';
import { PIXEL_FONT_SIZES } from '../game/string/PixelFont';
import { parseUIFile, type UIFile } from '../game/ui/XmlParse';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { initUIEnvironment, softKeyAt } from './ui';

const INFO_H = 34;

/**
 * Browses the game's 165 .ui layouts. Arrow keys, Enter and taps drive the layout like
 * UIHandler's generic input (focus, scrolling); "-"/"=" or a tap on the caption bar switch files.
 */
export class UIViewerScene implements Scene {
  private readonly ids: number[];
  private idx = 0;
  private file: UIFile | null = null;
  private root: GWidget | null = null;
  private status = '';
  private showInfo = true;
  private token = 0;
  private input: UIInput | null = null;
  private lastAction = '';

  constructor(private readonly ctx: Context) {
    this.ids = (ctx.manifest?.dirs['ui'] ?? [])
      .filter((n) => n.endsWith('.ui'))
      .map((n) => Number(n.slice(0, -3)))
      .sort((a, b) => a - b);
    initUIEnvironment();
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
      await Promise.all(collectSpriteIds(f).map(preloadSprite));
      if (!uiContext.myPlayerSprite) {
        const [i1, i2, i3] = encodeIcons(currentAppearance);
        uiContext.myPlayerSprite = await resolveSprite(() => createSpriteByIcon(i1, i2, i3, false));
      }
      if (token !== this.token) return;
      this.file = f;
      this.root = buildAndShow(f);
      this.input = this.root instanceof GContainer ? this.makeInput(this.root) : null;
      this.lastAction = '';
      this.status = '';
    } catch (e) {
      this.status = `Lỗi đọc: ${(e as Error).message}`;
    }
  }

  private makeInput(root: GContainer): UIInput {
    const input = new UIInput(root);
    input.onAction = (w) => {
      this.lastAction = w == null ? 'chọn: (không có)' : `chọn: sự kiện ${w.getEventType()} (loại ${w.getType()})`;
    };
    input.onClose = () => {
      this.lastAction = 'đóng (soft phải / nút đóng)';
    };
    // Screens pick their first focus in UIHandler; the viewer focuses the first window that
    // takes arrow keys so the focus colours are visible straight away.
    for (const bit of [SETTING_KEY_DOWN, SETTING_KEY_RIGHT, SETTING_KEY_UP, SETTING_KEY_LEFT]) {
      const c = root.getCatchKeyContainer(false, bit);
      if (c instanceof GWindow) {
        c.setFirstFocus();
        break;
      }
    }
    return input;
  }

  private step(d: number): void {
    const n = this.ids.length;
    if (!n) return;
    this.idx = (this.idx + d + n) % n;
    void this.load();
  }

  update(input: InputState): void {
    uiClock.tick++;
    switch (input.key) {
      case 0:
        break;
      case KEY_STAR:
        this.step(-1);
        break;
      case KEY_POUND:
        this.step(1);
        break;
      case KEY_SOFT_LEFT:
        this.showInfo = !this.showInfo;
        break;
      case KEY_SOFT_RIGHT:
        return this.ctx.go(new MenuScene(this.ctx));
      default:
        this.input?.handleKey(input.key);
    }
    for (const p of input.pointers) {
      if (p.type === 'down' && softKeyAt(p.x, p.y) === KEY_SOFT_RIGHT && !this.showInfo) return this.ctx.go(new MenuScene(this.ctx));
      if (this.showInfo && p.y >= SCREEN_HEIGHT - INFO_H) {
        if (p.type === 'down') this.step(p.x < SCREEN_WIDTH / 2 ? -1 : 1);
        continue;
      }
      if (p.type === 'down') this.input?.pointerPressed(p.x, p.y);
      else if (p.type === 'move') this.input?.pointerDragged(p.x, p.y);
      else this.input?.pointerReleased(p.x, p.y);
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
    g.fillRect(0, SCREEN_HEIGHT - INFO_H, SCREEN_WIDTH, INFO_H);
    g.setColor(COLOR_TITLE);
    const id = this.ids[this.idx];
    const lib = this.file?.lib.length ?? 0;
    g.drawString(`ui/${id}.ui  (${this.idx + 1}/${this.ids.length})  thư viện: ${lib}  ${this.status || this.lastAction}`, 4, SCREEN_HEIGHT - 32, LEFT | TOP);
    g.setColor(COLOR_DIM);
    g.drawString('-/= hoặc chạm đây: đổi file · mũi tên/Enter/chạm: thao tác · Q ẩn · Esc thoát', 4, SCREEN_HEIGHT - 17, LEFT | TOP);
  }
}
