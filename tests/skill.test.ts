import { describe, expect, it } from 'vitest';
import { Skill, composeString, getPowerDesc } from '../src/game/core/Skill';
import { uiFont } from '../src/game/gui/GWidget';

describe('Define.getPowerDesc', () => {
  it('uses the + form for non-negative totals and adds the suffix', () => {
    expect(getPowerDesc(1, 5)).toBe('Sức Mạnh+5');
    expect(getPowerDesc(28, 10)).toBe('Lực Chém+10%');
    expect(getPowerDesc(1, -3)).toBe('Sức Mạnh-3');
  });

  it('returns null for powers that are not ported', () => {
    expect(getPowerDesc(15, 1)).toBeNull();
  });
});

describe('Utilities.composeString', () => {
  it('puts two short items on one line, padded to half the width', () => {
    const w = uiFont.stringWidth('ab');
    const out = composeString([['ab', null], ['cd', null]], w * 4);
    expect(out).toBe(`ab${' '.repeat(Math.ceil((w * 2 - w) / uiFont.stringWidth(' ')))}cd\n`);
  });

  it('puts items wider than half the width on their own lines', () => {
    expect(composeString([['ab', null], ['cd', 65280]], 2)).toBe('ab\n/c00ff00cd\n/p');
  });
});

describe('Skill', () => {
  it('shows equipment-added levels and detects equipment-only skills', () => {
    const s = Object.assign(new Skill(), { level: 3, addLevel: 1 });
    expect(s.getRealLevelInfo()).toBe('Lv 2+1');
    expect(s.isAddSkill()).toBe(false);
    expect(Object.assign(new Skill(), { level: 1, addLevel: 1 }).isAddSkill()).toBe(true);
  });

  it('describes name, type, powers, cost and info', () => {
    const s = Object.assign(new Skill(), { name: 'X', type: 3, level: 2, area: 10, power1: 58, powerValue1: 50, useMP: 30, info: 'i' });
    const d = s.getDesc(2);
    expect(d).toContain('/cffff00X/p (Lv 2)    Chủ động\n');
    expect(d).toContain('1 địch    Chém gần\n');
    expect(d).toContain('/c00ff00Lực Chém+50\n/p');
    expect(d).toContain('Kĩ năng tiêu ehao:  30 MP\n');
    expect(d.endsWith('i\n')).toBe(true);
  });
});
