import { HCENTER, TOP, VCENTER } from '../midp/anchor';
import type { Graphics } from '../midp/Graphics';
import type { InputState } from '../midp/Input';
import { MenuScene } from './MenuScene';
import { COLOR_DIM, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';

const LOGOS = ['logo/0.png', 'logo/1.png'];
const TICKS_PER_LOGO = 40; // 2s at 50ms/tick

export class SplashScene implements Scene {
  private tick = 0;

  constructor(private readonly ctx: Context) {}

  update(input: InputState): void {
    this.tick++;
    const skip = input.key !== 0 || input.pointers.some((p) => p.type === 'down');
    if (skip || this.tick >= LOGOS.length * TICKS_PER_LOGO) this.ctx.go(new MenuScene(this.ctx));
  }

  paint(g: Graphics): void {
    g.setColor(0);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const idx = Math.min(LOGOS.length - 1, Math.floor(this.tick / TICKS_PER_LOGO));
    const img = this.ctx.images.get(LOGOS[idx]);
    if (img) {
      g.drawImage(img, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, HCENTER | VCENTER);
    } else if (this.ctx.images.isMissing(LOGOS[idx])) {
      g.setColor(COLOR_DIM);
      g.drawString('Chưa có ảnh – chạy: npm run import-assets', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, HCENTER | TOP);
    }
  }
}
