import { describe, expect, it } from 'vitest';
import { Talent } from '../src/game/core/Talent';

describe('Talent', () => {
  it('sorts by rank id', () => {
    const list = [3, 1, 2].map((rankid) => Object.assign(new Talent(), { rankid }));
    Talent.sortTalentlist(list);
    expect(list.map((t) => t.rankid)).toEqual([1, 2, 3]);
  });

  it('describes name, type, max level and powers', () => {
    const t = Object.assign(new Talent(), { name: 'T', ranklevel: 2, type: 0, maxTalentLevel: 5, power1: 27, powerValue1: 3 });
    const d = t.getDesc(2);
    expect(d).toContain('/cffff00T/p (Lv 2)    Công kích\n');
    expect(d).toContain('Thiên Phú có thể học cấp cao nhất:5\n');
    expect(d).toContain('/c00ff00Chí Mạng+3%\n/p');
  });
});
