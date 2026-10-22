// The battle helpers of com.hz.core.Define (1.2.0, Vineflower / jadx decompiles): buffer status
// bits, skill areas, attack types and the weapon checks of Skill.isValidSkillWeapon.

/** Define.getBufferBitValue: status n as its bit in Player.bStatus (0 = none). */
export function getBufferBitValue(n: number): bigint {
  return n === 0 ? 0n : 1n << BigInt(n);
}

/** Define.getBufferType(int): 26 for a harmful status (1–10, 30, 31), else 25. */
export function getBufferType(status: number): number {
  return (status >= 1 && status <= 10) || status === 30 || status === 31 ? 26 : 25;
}

/** Define.getSkillAreaPlayerNum: targets hit by a skill area (-1 = everyone). */
export function getSkillAreaPlayerNum(area: number): number {
  switch (area) {
    case 1: case 2: case 11: case 12: case 21: case 22: case 38:
      return 2;
    case 3: case 13: case 23:
      return 3;
    case 4: case 6: case 7: case 14: case 16: case 17: case 24: case 26: case 27:
      return 4;
    case 5: case 15: case 25:
      return 5;
    case 8: case 18: case 28:
      return 6;
    case 9: case 19: case 29: case 36: case 37:
      return -1;
    default:
      return 1;
  }
}

/** Define.isPhysicalAtkType: attack types 0–3 are physical, 4+ magic. */
export const isPhysicalAtkType = (t: number) => t <= 3;

/** Define.isPetJob. */
export const isPetJob = (job: number) => job === 7 || job === 8 || job === 9;

// Weapon checks on the two hands' item types (Player.get(71) / get(72); -1 empty, -400 broken).
const either = (a: number, b: number, t: number) => a === t || b === t;
export const isNullHand = (a: number, b: number) => a < 0 && b < 0;
export const isTwoHand = (a: number, b: number) => a > 0 && b > 0;
export const isValidOneSword = (a: number, b: number) => either(a, b, 13);
export const isValidTwoSword = (a: number, b: number) => either(a, b, 14);
export const isValidOneBlade = (a: number, b: number) => either(a, b, 15);
export const isValidTwoBlade = (a: number, b: number) => either(a, b, 16);
export const isValidOneHeavy = (a: number, b: number) => either(a, b, 17);
export const isValidTwoHeavy = (a: number, b: number) => either(a, b, 18);
export const isValidStaff = (a: number, b: number) => either(a, b, 19);
export const isValidLance = (a: number, b: number) => either(a, b, 20);
export const isValidOneCrossrow = (a: number, b: number) => either(a, b, 21);
export const isValidTwoCrossrow = (a: number, b: number) => either(a, b, 22);
export const isValidBow = (a: number, b: number) => either(a, b, 23);
export const isValidBall = (a: number, b: number) => either(a, b, 34);
export const isValidOneGun = (a: number, b: number) => either(a, b, 35);
export const isValidTwoGun = (a: number, b: number) => either(a, b, 36);
export const isValidOneHammer = (a: number, b: number) => either(a, b, 37);
export const isValidTwoHammer = (a: number, b: number) => either(a, b, 38);
export const isValidTwoFan = (a: number, b: number) => either(a, b, 39);
export const isValidSword = (a: number, b: number) => isValidOneSword(a, b) || isValidTwoSword(a, b);
export const isValidBlade = (a: number, b: number) => isValidOneBlade(a, b) || isValidTwoBlade(a, b);
export const isValidHeavy = (a: number, b: number) => isValidOneHeavy(a, b) || isValidTwoHeavy(a, b);
export const isValidCrossrow = (a: number, b: number) => isValidOneCrossrow(a, b) || isValidTwoCrossrow(a, b);
export const isValidGun = (a: number, b: number) => isValidOneGun(a, b) || isValidTwoGun(a, b);
export const isValidHammer = (a: number, b: number) => isValidOneHammer(a, b) || isValidTwoHammer(a, b);
export const isValidFan = isValidTwoFan;

/** Define.isNoHeavyTypeWeapon. */
export const isNoHeavyTypeWeapon = (t: number) => t > 0 && (t === 13 || t === 15 || t === 17 || t === 21 || t === 35 || t === 37);

/** Define.isOneHandWeapon. */
export function isOneHandWeapon(a: number, b: number): boolean {
  if (isNullHand(a, b)) return false;
  if (isTwoHand(a, b) && a !== 24 && b !== 24) return false;
  return isNoHeavyTypeWeapon(a) || isNoHeavyTypeWeapon(b);
}

/** Skill.isValidSkillWeapon: whether the hands' weapons fit the skill's weapon limit. */
export function isValidSkillWeapon(a: number, b: number, skillWeapon: number): boolean {
  switch (skillWeapon) {
    case 0: return true;
    case 1: return isNullHand(a, b) || isValidSword(a, b) || isValidBlade(a, b) || isValidHeavy(a, b) || isValidLance(a, b);
    case 2: return isValidOneSword(a, b) || isValidOneBlade(a, b);
    case 3: return isValidTwoSword(a, b) || isValidTwoBlade(a, b) || isValidTwoHeavy(a, b) || isValidLance(a, b);
    case 4: return isValidCrossrow(a, b) || isValidBow(a, b);
    case 5: return isOneHandWeapon(a, b) || isNullHand(a, b);
    case 6: return isOneHandWeapon(a, b) && isValidOneSword(a, b);
    case 7: return a === 13 && b === 13;
    case 8: return isValidTwoSword(a, b);
    case 9: return isValidBlade(a, b);
    case 10: return a === 15 && b === 15;
    case 11: return isValidTwoBlade(a, b);
    case 12: return isValidTwoHeavy(a, b);
    case 13: return isValidLance(a, b);
    case 14: return isValidCrossrow(a, b);
    case 15: return a === 21 && b === 21;
    case 16: return isValidTwoCrossrow(a, b);
    case 17: return isValidBow(a, b);
    case 18: return isNullHand(a, b);
    case 19: return isValidStaff(a, b);
    case 20: return isValidSword(a, b);
    case 21: return isOneHandWeapon(a, b) && isValidOneBlade(a, b);
    case 22: return isValidBall(a, b);
    case 23: return isValidGun(a, b);
    case 24: return a === 35 && b === 35;
    case 25: return isValidTwoGun(a, b);
    case 26: return isValidHammer(a, b);
    case 27: return a === 37 && b === 37;
    case 28: return isValidTwoHammer(a, b);
    case 29: return isValidFan(a, b);
    default: return false;
  }
}

/** Define.getSearchTypeByArea: 1 enemy side, 2 own side, 3 self, 4 owner, 0 any. */
export function getSearchTypeByArea(area: number): number {
  if ((area >= 10 && area <= 19) || area === 31 || area === 32) return 1;
  if ((area >= 20 && area <= 29) || area === 33 || area === 34 || area === 36) return 2;
  if (area === 30) return 3;
  return area === 35 ? 4 : 0;
}
