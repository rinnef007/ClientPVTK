import { describe, expect, it } from 'vitest';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_LEVEL, ATTR_MP, ATTR_MP_MAX, ATTR_POINTS, Player } from '../src/game/actor/Player';
import { TAB_NEW_POINTS, processUpLevelMsg } from '../src/game/main/LevelUp';

describe('MsgHandler.processUpLevelMsg', () => {
  it('applies the new level, exp, points and full HP / MP', () => {
    const p = new Player();
    [[ATTR_LEVEL, 25], [ATTR_EXP, 4200], [ATTR_EXP_MAX, 10000], [ATTR_HP, 10], [ATTR_HP_MAX, 1000], [ATTR_MP, 5], [ATTR_MP_MAX, 500]].forEach(([k, v]) => p.set(k, v));
    const text = processUpLevelMsg(p, { exp: 5800, levels: 1, newExp: 0, newExpMax: 12000, skillPoints: 5, attrPoints: 3 });
    expect(p.getLevel()).toBe(26);
    expect([p.get(ATTR_EXP), p.get(ATTR_EXP_MAX)]).toEqual([0, 12000]);
    expect(p.get(5)).toBe(5);
    expect(p.get(ATTR_POINTS)).toBe(3);
    expect(p.isTabStatus(TAB_NEW_POINTS)).toBe(true);
    expect([p.get(ATTR_HP), p.get(ATTR_MP)]).toEqual([1000, 500]);
    expect(text).toContain('Exp 5800');
    expect(text).toContain('thăng lên cấp 1/p'); // the byte as sent (levels gained)
  });

  it('only adds exp when no level is gained', () => {
    const p = new Player();
    p.set(ATTR_EXP, 100);
    p.set(ATTR_HP, 10);
    const text = processUpLevelMsg(p, { exp: 50, levels: 0, newExp: 0, newExpMax: 0, skillPoints: 0, attrPoints: 0 });
    expect(p.get(ATTR_EXP)).toBe(150);
    expect(p.get(ATTR_HP)).toBe(10);
    expect(text).toBe('/cFFFF00Exp 50/p\n');
  });
});
