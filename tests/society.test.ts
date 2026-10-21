import { describe, expect, it } from 'vitest';
import { Player } from '../src/game/actor/Player';
import { getSocietyExplain } from '../src/game/ui/screens/playerSociety';

describe('getSocietyExplain', () => {
  it('fills the money row with the amount', () => {
    const p = new Player();
    p.set(12, 789);
    expect(getSocietyExplain(p, 1)).toContain('Tiền hiện tại/c9acaff789/p');
  });

  it('fills combat power and enchant points', () => {
    const p = Object.assign(new Player(), { combatPoint: 12345, enchantValue: 2600 });
    expect(getSocietyExplain(p, 6)).toContain('12345');
    expect(getSocietyExplain(p, 7)).toContain('2600/10000');
  });

  it('falls back outside the table', () => {
    expect(getSocietyExplain(new Player(), 40)).toBe('Chưa miêu tả!');
  });
});
