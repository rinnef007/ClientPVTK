import { describe, expect, it } from 'vitest';
import { GLabel, uiFont } from '../src/game/gui/GWidget';

function label(w: number, text: string, status: number): GLabel {
  const l = new GLabel(new Int32Array(21));
  l.setBounds(0, 0, w, 20);
  l.setSetting(status, true);
  l.setText(text);
  return l;
}

describe('GLabel marquee', () => {
  it('only scrolls text wider than the box when bit 2 is set', () => {
    expect(uiFont.stringWidth('abcdefghij')).toBe(80);
    expect(label(100, 'abcdefghij', 2).needExecuteCycle()).toBe(false);
    expect(label(40, 'abcdefghij', 0).needExecuteCycle()).toBe(false);
    expect(label(40, 'abcdefghij', 2).needExecuteCycle()).toBe(true);
  });

  it('wraps around in single-direction mode (bit 8)', () => {
    const l = label(40, 'abcdefghij', 2 | 8);
    const seen: number[] = [];
    for (let i = 0; i < 70; i++) {
      l.cycle();
      seen.push(l.scrollOffset);
    }
    // One 3px step every second tick; restarts at the box width once the text has left.
    expect(seen.slice(0, 4)).toEqual([0, -3, -3, -6]);
    expect(Math.min(...seen)).toBe(-78); // -81 is already off-screen and resets within the same step
    expect(seen).toContain(40);
  });

  it('bounces back when the text end is reached (bit 8 clear)', () => {
    const l = label(40, 'abcdefghij', 2);
    let min = 0;
    let returned = false;
    for (let i = 0; i < 100; i++) {
      l.cycle();
      min = Math.min(min, l.scrollOffset);
      if (min < 0 && l.scrollOffset > 0) returned = true;
    }
    expect(min).toBeGreaterThanOrEqual(40 - 80 - 2 - 3);
    expect(returned).toBe(true);
  });
});
