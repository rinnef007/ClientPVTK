// com.hz.core.Buffer (1.2.0, Vineflower decompile): a battle effect on a player for some rounds —
// an attribute change taken back when it ends, HP / MP each round (ids 2 / 3), or clearing a
// status (id 90) — together with the status bit it sets.
import type { Battle } from '../battle/Battle';
import type { Player } from '../actor/Player';
import type { Control } from '../main/Control';
import { getBufferType } from './DefineBattle';
import { processBattleHpMpPower } from '../battle/BattlePower';

export class Buffer {
  private addValue: number;
  private statusBit: number;
  private lastTime: number;

  constructor(
    private readonly battle: Battle,
    private readonly attrID: number,
    addValue: number,
    statusBit: number,
    lastTime: number,
    private readonly animeID: number,
    realAdd: number,
    private readonly target: Player | null,
  ) {
    this.addValue = this.isPermanentBuffer() ? addValue : realAdd;
    this.statusBit = statusBit;
    this.lastTime = lastTime;
  }

  /** HP, MP and status clearing are applied each round, not taken back. */
  private isPermanentBuffer(): boolean {
    return this.attrID === 2 || this.attrID === 3 || this.attrID === 90;
  }

  private doBuffer(p: Player, out: Control[]): void {
    if (this.attrID === 2 || this.attrID === 3) {
      processBattleHpMpPower(p, this.attrID, this.addValue, this.animeID, out);
      this.battle.checkDie1Hp(p, out);
    }
  }

  clearStatus(): void {
    this.statusBit = 0;
  }

  /** Takes the attribute change back. */
  destroy(p: Player | null): void {
    if (p != null && !this.isPermanentBuffer()) p.addValue(this.attrID, -this.addValue);
  }

  finish(): void {
    this.lastTime = 0;
  }

  getAddValue(): number {
    return this.addValue;
  }

  getLastTime(): number {
    return this.lastTime;
  }

  getStatus(): number {
    return this.statusBit;
  }

  /** The one who cast it (the taunt target for status 31). */
  getTarget(): Player | null {
    return this.target;
  }

  isCannotReliveStatus(): boolean {
    return this.statusBit === 30;
  }

  isClearStatusBitBuffer(): boolean {
    return this.attrID === 90;
  }

  isDieStatus(): boolean {
    return this.statusBit === 27 || this.statusBit === 28 || this.statusBit === 29;
  }

  /** The same status, or for 25 / 26 any good / bad status. */
  isSameStatusType(t: number): boolean {
    if (t !== 25 && t !== 26) return this.statusBit === t;
    return this.statusBit !== 0 && getBufferType(this.statusBit) === t;
  }

  run(p: Player, out: Control[]): void {
    if (this.lastTime > 0) {
      this.lastTime--;
      this.doBuffer(p, out);
    }
  }

  /** A keep-out buffer (250) uses one of its charges. */
  useKeeAtkTime(): boolean {
    if (this.attrID !== 250 || this.addValue <= 0) return false;
    this.addValue--;
    return true;
  }
}
