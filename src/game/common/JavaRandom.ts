// java.util.Random (48-bit linear congruential generator), so a battle seeded like the Java client
// draws the same numbers.
const MULT = 0x5deece66dn;
const ADD = 0xbn;
const MASK = (1n << 48n) - 1n;

export class JavaRandom {
  private seed = 0n;

  constructor(seed?: number | bigint) {
    this.setSeed(seed ?? BigInt(Date.now()) ^ BigInt(Math.floor(Math.random() * 2 ** 32)));
  }

  setSeed(seed: number | bigint): void {
    this.seed = (BigInt.asIntN(64, BigInt(seed)) ^ MULT) & MASK;
  }

  protected next(bits: number): number {
    this.seed = (this.seed * MULT + ADD) & MASK;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }

  /** Random.nextInt(): a full signed 32-bit value. */
  nextInt(): number {
    return this.next(32);
  }
}
