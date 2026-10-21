// Keyboard/pointer → J2ME key codes, following GameCanvas.keyPressed()/pointerPressed().

export const KEY_SOFT_LEFT = -6;
export const KEY_SOFT_RIGHT = -7;
export const KEY_NUM0 = 48;
export const KEY_UP = 50; // '2'
export const KEY_LEFT = 52; // '4'
export const KEY_FIRE = 53; // '5'
export const KEY_RIGHT = 54; // '6'
export const KEY_DOWN = 56; // '8'
export const KEY_STAR = 42;
export const KEY_POUND = 35;

const KEYMAP: Record<string, number> = {
  ArrowUp: KEY_UP,
  ArrowDown: KEY_DOWN,
  ArrowLeft: KEY_LEFT,
  ArrowRight: KEY_RIGHT,
  KeyW: KEY_UP,
  KeyS: KEY_DOWN,
  KeyA: KEY_LEFT,
  KeyD: KEY_RIGHT,
  Enter: KEY_FIRE,
  Space: KEY_FIRE,
  Escape: KEY_SOFT_RIGHT,
  Backspace: KEY_SOFT_RIGHT,
  KeyQ: KEY_SOFT_LEFT,
  KeyE: KEY_SOFT_RIGHT,
  NumpadMultiply: KEY_STAR,
  Minus: KEY_STAR,
  Equal: KEY_POUND,
};

export function mapKey(ev: Pick<KeyboardEvent, 'code' | 'key'>): number {
  const m = KEYMAP[ev.code];
  if (m !== undefined) return m;
  // Digits on the main row or numpad map straight to their ASCII code, like a phone keypad.
  const d = /^(?:Digit|Numpad)(\d)$/.exec(ev.code);
  if (d) return KEY_NUM0 + Number(d[1]);
  return 0;
}

/** GameCanvas packs pointer coords as x | (y << 15). */
export function packPoint(x: number, y: number): number {
  return (x & 0x7fff) | ((y & 0x7fff) << 15);
}

export function unpackPoint(p: number): [number, number] {
  return [p & 0x7fff, (p >>> 15) & 0x7fff];
}

export interface PointerEventData {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
}

/**
 * Collects input between ticks. Game code reads `key`/`pointers` once per tick, mirroring
 * GameCanvas.gkey/pointPressedFlag. Key presses are queued so that two presses landing in the
 * same 50ms tick are handled on consecutive ticks instead of overwriting each other.
 */
export class InputState {
  /** Key pressed for this tick (0 = none). */
  key = 0;
  /** Key currently held (0 = none). */
  holding = 0;
  pointers: PointerEventData[] = [];
  private keyQueue: number[] = [];
  private pointerQueue: PointerEventData[] = [];

  constructor(
    target: HTMLCanvasElement,
    private readonly toLogical: (cx: number, cy: number) => [number, number],
  ) {
    window.addEventListener('keydown', (e) => {
      const k = mapKey(e);
      if (!k) return;
      e.preventDefault();
      this.keyQueue.push(k);
      this.holding = k;
    });
    window.addEventListener('keyup', (e) => {
      if (mapKey(e) === this.holding) this.holding = 0;
    });
    const push = (type: PointerEventData['type']) => (e: PointerEvent) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      this.pointerQueue.push({ type, x, y });
    };
    target.addEventListener('pointerdown', push('down'));
    target.addEventListener('pointermove', (e) => {
      if (e.buttons) push('move')(e);
    });
    target.addEventListener('pointerup', push('up'));
  }

  beginTick(): void {
    this.key = this.keyQueue.shift() ?? 0;
    this.pointers = this.pointerQueue;
    this.pointerQueue = [];
  }
}
