// The battle powers of com.hz.core.Define (1.2.0, Vineflower / jadx decompiles):
// processBattlePower applies a skill's or an item's power to a target — HP / MP, attribute
// changes (absolute or percent) and statuses — and keeps it as a Buffer for the skill's rounds.
import type { Player } from '../actor/Player';
import { TAB_DIE_DELAY_DONE, TAB_KEEPOUT_HIT, TAB_REBORN_1HP_DONE, TAB_REBORN_DONE } from '../actor/Player';
import { idiv } from '../actor/PlayerStats';
import { Buffer } from '../core/Buffer';
import { getBufferBitValue, getBufferType } from '../core/DefineBattle';
import { Control } from '../main/Control';
import { addSystemChat } from '../main/WorldMessage';
import { PowerString } from '../string/PowerString';
import type { Battle } from './Battle';
import { getBufferString, type Skill } from '../core/Skill';

const green = (s: string) => PowerString.makeColorString(s, 0x00ff00);

/**
 * Define.processBattleHpMpPower: adds HP (2) or MP (3) to a living target and records the number
 * (effect 2 HP, 10 HP and died, 66 MP). False when the target is dead.
 */
export function processBattleHpMpPower(p: Player | null, id: number, value: number, anime: number, out: Control[] | null, self = false): boolean {
  if (p == null || p.isDead()) return false;
  p.addValue(id, value);
  const effect = id === 2 ? (p.isDeadNoWithDelay() ? 10 : 2) : 66;
  out?.push(Control.createBattleTargetEffect(p.position, value, effect, anime, self));
  return true;
}

/** Define.processBattleKeepOutPower: a keep-out charge blocks the damage. */
function processBattleKeepOutPower(p: Player | null, value: number, out: Control[] | null): boolean {
  if (p == null || value >= 0 || p.keepout_atk_time <= 0) return false;
  const effect = !p.isTabStatus(TAB_KEEPOUT_HIT) ? 16386 : 2;
  p.setTabStatus(true, TAB_KEEPOUT_HIT);
  out?.push(Control.createBattleTargetEffect(p.position, 0, effect, 0));
  return true;
}

/** Define.addBufferBySpecial: the no-revive status (30) still sticks to a dead target. */
function addBufferBySpecial(round: number, attr: number, value: number, status: number, p: Player, battle: Battle, anime: number, caster: Player | null): void {
  if (status !== 30 || round <= 0 || attr < 0) return;
  p.addBuffer(new Buffer(battle, attr, value, status, round - 1, anime, p.readAddValue, caster));
}

/** Define.processBattleReborn: revives a dead target with `hp` / `mp`; not under status 30. */
export function processBattleReborn(p: Player, hp: number, mp: number, anime: number, out: Control[] | null): boolean {
  if (!p.isDead() || p.isBattleStatus(getBufferBitValue(30))) return false;
  p.clearBufferList(true);
  p.addValue(2, hp);
  out?.push(Control.createBattleTargetEffect(p.position, hp, 18, anime));
  if (mp !== 0) p.addValue(3, mp);
  return true;
}

/** Statuses a target is immune to (status → its immunity status and the message). */
const IMMUNE: [number, number, string][] = [
  [8, 18, 'Miễn Định Thân!'],
  [7, 17, 'Miễn Phong Ma!'],
  [31, 32, 'Miễn dịch trào phúng!'],
  [9, 19, 'Miễn Hỗn Loạn!'],
  [5, 22, 'Miễn Cấm Ngôn!'],
  [6, 23, 'Miễn Phong Kĩ!'],
  [10, 24, 'Miễn Suy Yếu!'],
];

/** processBattlePower: percent powers → the attribute they change by a percent of its value. */
const PERCENT_POWER: Record<number, number> = {
  23: 31, 24: 43, 25: 42, 26: 44, 27: 45, 28: 36, 29: 37, 30: 38, 31: 39, 32: 40, 33: 41, 34: 48, 35: 49,
  37: 51, 38: 53, 39: 52, 40: 54, 41: 55, 42: 56, 43: 57, 44: 58, 45: 59, 46: 46, 47: 60, 48: 61,
};

/** processBattlePower: absolute powers → the attribute they add to. */
const ABS_POWER: Record<number, number> = {
  53: 31, 54: 43, 55: 42, 56: 44, 57: 45, 58: 36, 59: 37, 60: 38, 61: 39, 62: 40, 63: 41, 64: 48, 65: 49,
  67: 51, 68: 53, 69: 52, 70: 54, 71: 55, 72: 56, 73: 57, 74: 58, 75: 59, 76: 46, 77: 60, 78: 61,
};

/** Weapon-mastery attack-time powers: the weapon types they need (-401 = bare hands). */
const WEAPON_TIME_POWER: Record<number, number[] | null> = {
  122: [13, 14], 123: [15, 16], 124: [17, 18], 125: [20], 126: [19], 127: [-401], 128: [21, 22, 23], 129: [24],
  130: null, 174: [34], 190: [35, 36], 192: [37, 38], 194: [39],
};

/**
 * Define.processBattlePower: power `power` with `value` on `p` from `caster`, with the status
 * `status` and lasting `round` rounds (a Buffer). Immunities, invincibility and will (Battle.isWilSuccess)
 * can stop a harmful status. HP / MP numbers go to `out`.
 */
export function processBattlePower(
  battle: Battle | null, p: Player | null, caster: Player | null, skill: Skill | null,
  power: number, value: number, status: number, round: number, anime: number, out: Control[] | null,
): void {
  if (battle == null || p == null || power <= 0) return;
  // The once-only death statuses do nothing after they fired.
  if (status === 27 && p.isTabStatus(TAB_REBORN_1HP_DONE)) status = 0;
  if (status === 28 && p.isTabStatus(TAB_REBORN_DONE)) status = 0;
  if (status === 29 && p.isTabStatus(TAB_DIE_DELAY_DONE)) status = 0;
  if (status !== 0) {
    const name = green(p.getName());
    if (status !== 25 && status !== 26 && p.isBattleStatus(getBufferBitValue(21))) {
      addSystemChat(`${getBufferString(status)}Vô hiệu,(${name})Trạng thái vô địch!`);
      return;
    }
    if (getBufferType(status) === 26) {
      if (p.isBattleStatus(getBufferBitValue(20))) {
        addSystemChat(`${getBufferString(status)}Vô hiệu,(${name})Miễn toàn bộ giảm ích!`);
        return;
      }
      for (const [st, immune, text] of IMMUNE) {
        if (status === st && p.isBattleStatus(getBufferBitValue(immune))) {
          addSystemChat(`(${name})${text}`);
          return;
        }
      }
      if (battle.isWilSuccess(p, caster, skill)) {
        addSystemChat(`${getBufferString(status)}Vô hiệu,(${name})Kháng Trạng Thái!`);
        return;
      }
    }
  }

  let attr = -1;
  let keepoutBefore = 0;
  if (power === 97) {
    processBattleReborn(p, idiv(p.get(29) * value, 100), idiv(value * p.get(30), 100), anime, out);
    return;
  } else if (power in WEAPON_TIME_POWER) {
    const need = WEAPON_TIME_POWER[power];
    if (need != null && !need.includes(p.getEquipWeaponType())) return;
    attr = 35;
    p.addValue(35, value);
  } else if (power === 178) {
    keepoutBefore = p.keepout_atk_time;
    if (value < 0 && keepoutBefore + value <= 0 && p.isTabStatus(TAB_KEEPOUT_HIT)) value += 1;
    attr = 250;
    p.addValue(250, value);
  } else if (power in PERCENT_POWER) {
    attr = PERCENT_POWER[power];
    value = idiv(p.get(attr) * value, 100);
    p.addValue(attr, value);
  } else if (power in ABS_POWER) {
    attr = ABS_POWER[power];
    p.addValue(attr, value);
  } else if (power === 49 || power === 50) {
    attr = 2;
    if (power === 50) value = idiv(value * p.get(29), 100);
    if (skill == null || skill.area === 30 || !processBattleKeepOutPower(p, value, out)) {
      if (power === 50) {
        // A monster's reflection stops a percent hit that would not go past it.
        if (caster != null && caster.getType() === 2 && skill != null && value < 0 && caster.newReflection + value > 0) value = 0;
        if (value < 0) {
          let touch = battle.calTouchOf(p);
          if (caster != null && p !== caster) touch -= caster.get(205);
          if (touch > 700) touch = 700;
          if (touch > 0) {
            value -= idiv(touch * value, 1000);
            if (value > 0) value = 0;
          }
        }
      }
      if (value > 0 && p.isBattleStatus(getBufferBitValue(2))) value = idiv(value, 2);
      if (!processBattleHpMpPower(p, 2, value, anime, out)) {
        addBufferBySpecial(round, 2, value, status, p, battle, anime, caster);
        return;
      }
      battle.checkDie1Hp(p, null);
    }
  } else if (power === 51 || power === 52) {
    attr = 3;
    if (power === 52) value = idiv(value * p.get(30), 100);
    if (value > 0 && p.isBattleStatus(getBufferBitValue(1))) value = idiv(value, 2);
    if (!processBattleHpMpPower(p, 3, value, anime, out)) {
      addBufferBySpecial(round, 3, value, status, p, battle, anime, caster);
      return;
    }
  } else if (power === 79) {
    p.removeBufferByStatus(value);
    attr = 90;
  } else if (power === 80) {
    processBattleReborn(p, 0, 0, anime, out);
    return;
  } else {
    return;
  }

  if (round > 0 && attr >= 0) {
    if (value === 0 && status === 0) return;
    let realAdd = p.readAddValue;
    if (power === 178 && value < 0 && p.isTabStatus(TAB_KEEPOUT_HIT)) realAdd = p.keepout_atk_time - (keepoutBefore - 1);
    p.addBuffer(new Buffer(battle, attr, value, status, round - 1, anime, realAdd, caster));
  }
}
