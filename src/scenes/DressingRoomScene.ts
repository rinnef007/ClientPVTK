import { BOTTOM, HCENTER, LEFT, RIGHT, TOP } from '../midp/anchor';
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
import { getAssetFS } from '../game/common/Utilities';
import * as ResourceHandler from '../game/main/ResourceHandler';
import { ANIMATION_MOVE, ANIMATION_STAND, resolveSprite, type GameSprite } from '../game/sprite/GameSprite';
import {
  DEFAULT_APPEARANCE,
  createSpriteByIcon,
  encodeIcons,
  getWeaponIcon,
  type Appearance,
} from '../game/sprite/SpriteIcon';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, COLOR_SELECT, COLOR_TEXT, COLOR_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { SOFTKEY_H, TITLE_H, drawFrame, softKeyAt } from './ui';

type Key = keyof Appearance;

interface Field {
  key: Key;
  label: string;
  values: number[];
}

const COLORS = [0, 1, 2, 3];
const ROW_H = 15;
const LIST_TOP = TITLE_H + 6;
const LIST_W = 150;
const PANE_X = LIST_W + 6;
const PREVIEW_X = PANE_X + ((SCREEN_WIDTH - PANE_X) >> 1);

/** Shared appearance so the test map uses whatever was put together here. */
export let currentAppearance: Appearance = { ...DEFAULT_APPEARANCE };

function fragmentExists(id: number): boolean {
  const fs = getAssetFS();
  return fs.exists(`ani/ani2/${id}.fr`) || (ResourceHandler.packFrIDList?.includes(id) ?? false);
}

function spriteExists(id: number): boolean {
  return getAssetFS().exists(`ani/ani2/sprite_${id}.spr`);
}

/** Styles 1..max whose base fragment (colour 0) ships with the game, plus 0 = none. */
function stylesFor(idOf: (style: number) => number, max: number, allowNone = true): number[] {
  const out = allowNone ? [0] : [];
  for (let s = 1; s <= max; s++) if (fragmentExists(idOf(s))) out.push(s);
  return out;
}

/** Lets you dress a character through createSpriteByIcon/doChangeSpriteIcon (ported Java). */
export class DressingRoomScene implements Scene {
  private fields: Field[] = [];
  private sel = 0;
  private sprite: GameSprite | null = null;
  private loading = false;
  private token = 0;
  private walking = false;
  private mirror = false;
  private scroll = 0;

  constructor(private readonly ctx: Context) {
    this.buildFields();
    this.rebuild();
  }

  /** Style lists depend on sex (male/female fragments are separate ids). */
  private buildFields(): void {
    const a = currentAppearance;
    const sx = a.sex << 2;
    const part = (start: number) => (s: number) => (s << 3) + start - 7 + sx;
    const weapons: number[] = [0];
    for (let w = 1; w <= 255; w++) if (fragmentExists(getWeaponIcon(w, 0))) weapons.push(w);
    const mounts = [0];
    for (let m = 1; m <= 40; m++) if (spriteExists((a.sex === 0 ? 700 : 900) + m)) mounts.push(m);
    const backs = [0];
    for (let b = 1; b <= 30; b++) if (spriteExists(b + 1100)) backs.push(b);
    this.fields = [
      { key: 'sex', label: 'Giới tính', values: [0, 1] },
      { key: 'hair', label: 'Tóc', values: stylesFor(part(0), 60) },
      { key: 'hairColor', label: '  màu tóc', values: COLORS },
      { key: 'face', label: 'Mặt', values: stylesFor((s) => (s << 3) + 993 + sx, 60) },
      { key: 'top', label: 'Áo', values: stylesFor(part(6000), 60, false) },
      { key: 'topColor', label: '  màu áo', values: COLORS },
      { key: 'bottom', label: 'Quần', values: stylesFor(part(7000), 60, false) },
      { key: 'bottomColor', label: '  màu quần', values: COLORS },
      { key: 'hand', label: 'Găng', values: stylesFor(part(2000), 60) },
      { key: 'handColor', label: '  màu găng', values: COLORS },
      { key: 'leg', label: 'Giày', values: stylesFor(part(3000), 60) },
      { key: 'legColor', label: '  màu giày', values: COLORS },
      { key: 'shoulder', label: 'Vai', values: stylesFor(part(4000), 60) },
      { key: 'shoulderColor', label: '  màu vai', values: COLORS },
      { key: 'helmet', label: 'Mũ', values: stylesFor((s) => (s << 2) + 9997, 60) },
      { key: 'helmetColor', label: '  màu mũ', values: COLORS },
      { key: 'weaponL', label: 'Vũ khí trái', values: weapons },
      { key: 'weaponLColor', label: '  màu', values: COLORS },
      { key: 'weaponR', label: 'Vũ khí phải', values: weapons },
      { key: 'glow', label: 'Hào quang VK', values: [0, 1, 2, 3, 4, 5, 6, 7] },
      { key: 'back', label: 'Áo choàng', values: backs },
      { key: 'backColor', label: '  màu', values: COLORS },
      { key: 'mount', label: 'Thú cưỡi', values: mounts },
      { key: 'mountColor', label: '  màu', values: COLORS },
    ];
  }

  private rebuild(): void {
    const token = ++this.token;
    this.loading = true;
    const [i1, i2, i3] = encodeIcons(currentAppearance);
    resolveSprite(() => createSpriteByIcon(i1, i2, i3, false)).then(async (s) => {
      if (token !== this.token) return;
      const imgs = [...(s?.fragmentFiles ?? []), ...(s?.cloakSprite?.fragmentFiles ?? [])];
      await Promise.all(imgs.map((f) => f?.gameImage?.getImage()?.ready));
      if (token !== this.token) return;
      this.sprite = s;
      this.applyPose();
      this.loading = false;
    });
  }

  private applyPose(): void {
    const s = this.sprite;
    if (!s) return;
    s.setCurAnimation(this.walking ? ANIMATION_MOVE : ANIMATION_STAND);
    s.setRotate(this.mirror);
  }

  private change(d: number): void {
    const f = this.fields[this.sel];
    const vals = f.values;
    const cur = vals.indexOf(currentAppearance[f.key]);
    const next = vals[(Math.max(0, cur) + d + vals.length) % vals.length];
    currentAppearance = { ...currentAppearance, [f.key]: next };
    if (f.key === 'sex') this.buildFields();
    this.rebuild();
  }

  private move(d: number): void {
    const n = this.fields.length;
    this.sel = (this.sel + d + n) % n;
    const visible = this.visibleRows();
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + visible) this.scroll = this.sel - visible + 1;
  }

  private visibleRows(): number {
    return Math.floor((SCREEN_HEIGHT - SOFTKEY_H - LIST_TOP - 4) / ROW_H);
  }

  update(input: InputState): void {
    switch (input.key) {
      case KEY_UP:
        this.move(-1);
        break;
      case KEY_DOWN:
        this.move(1);
        break;
      case KEY_LEFT:
        this.change(-1);
        break;
      case KEY_RIGHT:
        this.change(1);
        break;
      case KEY_FIRE:
        this.walking = !this.walking;
        this.applyPose();
        break;
      case KEY_SOFT_LEFT:
        this.mirror = !this.mirror;
        this.applyPose();
        break;
      case KEY_SOFT_RIGHT:
        return this.ctx.go(new MenuScene(this.ctx));
    }
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      const soft = softKeyAt(p.x, p.y);
      if (soft === KEY_SOFT_RIGHT) return this.ctx.go(new MenuScene(this.ctx));
      if (p.x < LIST_W) {
        const row = Math.floor((p.y - LIST_TOP) / ROW_H) + this.scroll;
        if (row >= 0 && row < this.fields.length) {
          if (row === this.sel) this.change(p.x > LIST_W / 2 ? 1 : -1);
          else this.sel = row;
        }
      }
    }
    if (this.sprite) {
      this.sprite.action();
    }
  }

  paint(g: Graphics): void {
    drawFrame(g, 'Thay trang phục', 'Lật', 'Quay lại');
    g.setFontSize(FONT_SMALL);
    const visible = this.visibleRows();
    for (let r = 0; r < visible; r++) {
      const i = r + this.scroll;
      const f = this.fields[i];
      if (!f) break;
      const y = LIST_TOP + r * ROW_H;
      if (i === this.sel) {
        g.setColor(COLOR_SELECT);
        g.fillRect(2, y - 1, LIST_W - 2, ROW_H);
      }
      g.setColor(i === this.sel ? COLOR_TITLE : COLOR_TEXT);
      g.drawString(f.label, 6, y, LEFT | TOP);
      const v = currentAppearance[f.key];
      g.drawString(i === this.sel ? `◀ ${v} ▶` : String(v), LIST_W - 4, y, RIGHT | TOP);
    }

    // Preview pane.
    const footX = PREVIEW_X;
    const footY = 300;
    const paneW = SCREEN_WIDTH - PANE_X - 4;
    const paneH = SCREEN_HEIGHT - SOFTKEY_H - LIST_TOP - 4;
    g.setColor(0x1a2130);
    g.fillRect(PANE_X, LIST_TOP, paneW, paneH);
    g.setColor(0x2a3348);
    g.drawLine(footX - 30, footY, footX + 30, footY);
    const s = this.sprite;
    if (s) {
      const c = g.ctx;
      c.save();
      // Keep long weapons and cloaks inside the preview pane.
      c.beginPath();
      c.rect(PANE_X, LIST_TOP, paneW, paneH);
      c.clip();
      c.translate(footX, footY);
      c.scale(2, 2);
      c.translate(-footX, -footY);
      s.draw(g, footX, footY);
      c.restore();
    }
    g.setColor(COLOR_DIM);
    g.drawString(this.loading ? 'Đang tải…' : `sprite ${s?.nameID ?? '-'}`, footX, footY + 14, HCENTER | TOP);
    g.drawString('Enter: đi/đứng', footX, SCREEN_HEIGHT - SOFTKEY_H - 6, HCENTER | BOTTOM);
  }
}
