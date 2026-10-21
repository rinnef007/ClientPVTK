import { describe, expect, it } from 'vitest';
import { Player } from '../src/game/actor/Player';
import { getPlayerAttributeText } from '../src/game/ui/screens/playerAttribute';

function player(values: [number, number][]): Player {
  const p = new Player();
  for (const [k, v] of values) p.set(k, v);
  return p;
}

describe('getPlayerAttributeText', () => {
  it('fills HP from current / max', () => {
    expect(getPlayerAttributeText(player([[2, 820], [29, 1000]]), 0)).toBe('HP:/c00FF00820/1000/p');
  });

  it('uses Battle.calc(8) for the cut defence against a same-level target', () => {
    // (150 * 80 / 100) / (25 + 12) = 3
    const text = getPlayerAttributeText(player([[106, 25], [39, 150]]), 10);
    expect(text).toContain('(/c00FF0025/p)');
    expect(text).toContain('/c00FF003%/p');
  });

  it('shows tenths with Tool.getPointValue and maps ids 39..44 to 32..37', () => {
    expect(getPlayerAttributeText(player([[57, 15]]), 28)).toContain('/c00FF001.5%/p');
    expect(getPlayerAttributeText(player([[200, 7]]), 39)).toContain('/c00FF007/p');
  });

  it('falls back for unknown ids', () => {
    expect(getPlayerAttributeText(new Player(), 99)).toBe('Chưa miêu tả!');
  });
});
