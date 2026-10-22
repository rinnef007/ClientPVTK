import type { Graphics } from '../midp/Graphics';
import { KEY_DOWN, KEY_FIRE, KEY_SOFT_LEFT, KEY_UP, type InputState } from '../midp/Input';
import { AssetViewerScene } from './AssetViewerScene';
import { DressingRoomScene } from './DressingRoomScene';
import { MapScene } from './MapScene';
import { NetTestScene } from './NetTestScene';
import { OnlineLoginScene } from './OnlineLoginScene';
import { SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { drawFrame, drawList, drawParagraph, listIndexAt, softKeyAt } from './ui';
import { SplashScene } from './SplashScene';
import { SpriteViewerScene } from './SpriteViewerScene';
import { UIViewerScene } from './UIViewerScene';

const TOP = 120;

export class MenuScene implements Scene {
  private selected = 0;
  private readonly items: { label: string; open: () => Scene }[];

  constructor(private readonly ctx: Context) {
    this.items = [
      { label: 'Bản đồ thử', open: () => new MapScene(ctx) },
      { label: 'Vào server riêng (BE)', open: () => new OnlineLoginScene(ctx) },
      { label: 'Thay trang phục', open: () => new DressingRoomScene(ctx) },
      { label: 'Xem sprite / animation', open: () => new SpriteViewerScene(ctx) },
      { label: 'Xem giao diện (.ui)', open: () => new UIViewerScene(ctx) },
      { label: 'Xem tài nguyên', open: () => new AssetViewerScene(ctx) },
      { label: 'Kiểm tra mạng (mock)', open: () => new NetTestScene(ctx) },
      { label: 'Xem lại logo', open: () => new SplashScene(ctx) },
    ];
  }

  update(input: InputState): void {
    const n = this.items.length;
    if (input.key === KEY_UP) this.selected = (this.selected + n - 1) % n;
    if (input.key === KEY_DOWN) this.selected = (this.selected + 1) % n;
    if (input.key === KEY_FIRE || input.key === KEY_SOFT_LEFT) this.open();
    for (const p of input.pointers) {
      if (p.type !== 'down') continue;
      if (softKeyAt(p.x, p.y) === KEY_SOFT_LEFT) {
        this.open();
        continue;
      }
      const i = listIndexAt(p.y, TOP, n);
      if (i < 0) continue;
      if (i === this.selected) this.open();
      else this.selected = i;
    }
  }

  private open(): void {
    this.ctx.go(this.items[this.selected].open());
  }

  paint(g: Graphics): void {
    drawFrame(g, 'Phong Vân Truyền Kỳ 2', 'Chọn', '');
    drawParagraph(
      g,
      'Bản web học tập (sprite, trang phục & bản đồ). Dùng phím mũi tên / WASD, Enter để chọn, Esc để quay lại. Có thể chạm/bấm chuột.',
      16,
      50,
      SCREEN_WIDTH - 32,
    );
    drawList(g, this.items.map((i) => i.label), this.selected, TOP);
  }
}
