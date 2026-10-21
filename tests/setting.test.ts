import { describe, expect, it } from 'vitest';
import { getSettingIndex, setSettingIndex } from '../src/game/ui/screens/setting';

describe('setting bits', () => {
  it('selects the default button (id < 10050) when no bit of the row is set', () => {
    expect(getSettingIndex(0, 10033)).toBe(true);
    expect(getSettingIndex(0, 10051)).toBe(false);
  });

  it('pressing a button sets its bit and clears the rest of the row', () => {
    let v = setSettingIndex(0, 10051); // bit 1
    expect(v).toBe(1 << 1);
    v = setSettingIndex(v, 10052); // bit 2
    expect(v).toBe(1 << 2);
    expect(getSettingIndex(v, 10052)).toBe(true);
    expect(getSettingIndex(v, 10033)).toBe(false);
    expect(setSettingIndex(v, 10033)).toBe(0);
  });

  it('toggles on/off rows; a 0 row means the bit turns it off', () => {
    expect(getSettingIndex(0, 10077)).toBe(false); // speed-up off
    expect(getSettingIndex(setSettingIndex(0, 10077), 10077)).toBe(true);
    expect(getSettingIndex(0, 10065)).toBe(true); // helper on while its bit is clear
    expect(getSettingIndex(setSettingIndex(0, 10065), 10065)).toBe(false);
  });
});
