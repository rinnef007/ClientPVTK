/** Logic tick length. The J2ME loop slept ~50ms per frame (Tool.sleep(50) in MsgHandler waits). */
export const TICK_MS = 50;

/**
 * Fixed-step update with requestAnimationFrame rendering.
 * `update` runs at TICK_MS intervals (catching up at most a few steps), `render` once per frame.
 */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;

  constructor(
    private readonly update: () => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const frame = (now: number) => {
      this.acc += Math.min(now - this.last, TICK_MS * 5);
      this.last = now;
      while (this.acc >= TICK_MS) {
        this.update();
        this.acc -= TICK_MS;
      }
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
