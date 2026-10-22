import { describe, expect, it } from 'vitest';
import { JavaRandom } from '../src/game/common/JavaRandom';

describe('JavaRandom', () => {
  it('matches java.util.Random for seed 42', () => {
    // new java.util.Random(42).nextInt() ×3
    const r = new JavaRandom(42);
    expect([r.nextInt(), r.nextInt(), r.nextInt()]).toEqual([-1170105035, 234785527, -1360544799]);
  });
});
