import { describe, expect, it } from 'vitest';
import { BOTTOM, HCENTER, LEFT, RIGHT, TOP, TRANS_ROT90, TRANS_MIRROR, VCENTER, anchorBox, swapsAxes } from '../src/midp/anchor';
import { mapKey, packPoint, unpackPoint, KEY_UP, KEY_FIRE } from '../src/midp/Input';

describe('anchorBox', () => {
  it('handles the common MIDP anchors', () => {
    expect(anchorBox(100, 100, 20, 10, 0)).toEqual([100, 100]);
    expect(anchorBox(100, 100, 20, 10, TOP | LEFT)).toEqual([100, 100]);
    expect(anchorBox(100, 100, 20, 10, HCENTER | VCENTER)).toEqual([90, 95]);
    expect(anchorBox(100, 100, 20, 10, RIGHT | BOTTOM)).toEqual([80, 90]);
  });

  it('knows which transforms swap axes', () => {
    expect(swapsAxes(TRANS_MIRROR)).toBe(false);
    expect(swapsAxes(TRANS_ROT90)).toBe(true);
  });
});

describe('input mapping', () => {
  it('maps keyboard to J2ME key codes', () => {
    expect(mapKey({ code: 'ArrowUp', key: 'ArrowUp' })).toBe(KEY_UP);
    expect(mapKey({ code: 'Enter', key: 'Enter' })).toBe(KEY_FIRE);
    expect(mapKey({ code: 'Digit7', key: '7' })).toBe(55);
    expect(mapKey({ code: 'KeyZ', key: 'z' })).toBe(0);
  });

  it('packs pointer coords like GameCanvas', () => {
    expect(packPoint(319, 479)).toBe(319 | (479 << 15));
    expect(unpackPoint(packPoint(319, 479))).toEqual([319, 479]);
  });
});
