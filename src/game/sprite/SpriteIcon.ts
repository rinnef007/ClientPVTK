// Port of the appearance/equipment composition part of com.hz.sprite.GameSprite:
// createSpriteByIcon, createPetSpriteByIcon, createHeadSpriteByIcon, doChangeSpriteIcon and the
// sprite-id helpers. These are GameSprite statics/instance methods in Java; they live in their
// own module here only to keep files readable.
//
// Source of truth: jadx output for this code is wrong in places (e.g. the 17/24 cases of
// getHorseSpriteNameIDByWeapon) and doChangeSpriteIcon is marked "decompiled incorrectly".
// This port follows a Vineflower decompile of classes2.dex, spot-checked against the Dalvik
// bytecode (androguard disassembly).
//
// Icons are Java longs; they are bigints here. Bit layout (from the field extraction below):
//   icon1: sex(0) · mini-style(3..6) · hair(7..10,+32..34) hairColor(11..12) · face(13..16,+35)
//          hand(17..18,+36..39) handColor(19..20) · leg(21..22,+40..43) legColor(23..24)
//          helmet(25..29,+44..45) helmetColor(30..31)
//   icon2: shoulder(0..3,+31,+36..37) shoulderColor(4..5) · weaponL(6..13,+32..33) colorL(14..15)
//          weaponR(16..23,+34..35) colorR(24..25) · weaponFlash(28..30)
//   icon3: back(0..3,+28,+32..33) backColor(4..5) · top(6..11,+34) topColor(12..13)
//          bottom(14..19,+35) bottomColor(20..21) · mount(22..25,+29,+31,+36) mountColor(26..27)
//          fashion(30)
import { FragmentFile } from './FragmentFile';
import { GameSprite } from './GameSprite';

export const SPRITE_MAN_HEAD = 1213;
export const SPRITE_WOMAN_HEAD = 1214;
export const HOUSE_TWO_PEOPLE_SPRITE = 790;
const START_SHOULDER = 4000; // Model.START_SHOULDER
const START_WEAPON = 8000; // Model.START_WEAPON
const PATH_ANI = '/ani/';

/** Tool.getBitNum: number of set bits among the low 8 bits. */
export function getBitNum(n: number): number {
  let c = 0;
  for (let i = 0; i < 8; i++) if (n & (1 << i)) c++;
  return c;
}

/** (int)((icon >> shift) & mask) */
function bits(icon: bigint, shift: number, mask: number): number {
  return Number((icon >> BigInt(shift)) & BigInt(mask));
}

/** A field whose extra high bits live elsewhere in the long: low | (high << getBitNum(lowMask) + extraShift). */
function widen(base: number, high: number, lowMask: number, extraShift = 0): number {
  return high > 0 ? base + (high << (getBitNum(lowMask) + extraShift)) : base;
}

export function getDefaultSprNameID(sex: number, battle: boolean): number {
  return sex === 0 ? (battle ? 200 : 100) : battle ? 400 : 300;
}

/** Maps a weapon item id to its weapon "class" used for sprite selection (0 = none). */
function weaponClass(w: number, skip24: boolean): number {
  let v = w > 500 ? w - 500 : w;
  if (v <= 0) return 0;
  v = ((v - 1) >> 4) + 13;
  if (skip24 && v === 24) return 0;
  switch (v) {
    case 25:
      return 34;
    case 26:
      return 35;
    case 27:
      return 36;
    case 28:
      return 37;
    case 29:
      return 38;
    case 30:
      return 39;
    default:
      return v;
  }
}

export function getSpriteNameIDByWeapon(base: number, left: number, right: number, dual: boolean, _battle: boolean): number {
  let c = weaponClass(left, true);
  const r = weaponClass(right, true);
  if (r !== 0) c = r;
  if (c === 0) return base;
  switch (c) {
    case 13:
      return base + (dual ? 63 : 13);
    case 15:
      return base + (dual ? 65 : 15);
    case 17:
    case 24:
      return base;
    case 21:
      return base + (dual ? 71 : 21);
    case 35:
      return base + (dual ? 72 : 24);
    case 36:
      return base + 73;
    case 37:
      return base + (dual ? 74 : 44);
    case 38:
      return base + 36;
    case 39:
      return base + 37;
    default:
      return base + c;
  }
}

/** Sprite id while riding mount `mount` (verified against bytecode: 17 and 24 fall back to 700/900). */
export function getHorseSpriteNameIDByWeapon(sex: number, mount: number, left: number, right: number, dual: boolean): number {
  let c = weaponClass(left, false);
  const r = weaponClass(right, false);
  if (r !== 0) c = r;
  let base = (mount - 1) * 100 + 2000;
  if (base >= 4000) base = (mount - 1) * 100 + 28000;
  if (sex === 1) base += 50;
  const plain = sex === 0 ? mount + 700 : mount + 900;
  if (c === 0) return plain;
  switch (c) {
    case 13:
      return base + (dual ? 33 : 13);
    case 15:
      return base + (dual ? 35 : 15);
    case 17:
    case 24:
      return plain;
    case 21:
      return base + (dual ? 41 : 21);
    case 35:
      return base + 42;
    case 36:
      return base + 43;
    case 37:
      return base + (dual ? 44 : 24);
    case 38:
      return base + 36;
    case 39:
      return base + 37;
    default:
      return base + c;
  }
}

export function getWeaponIcon(weapon: number, color: number): number {
  return (weapon > 500 ? ((weapon - 500) << 2) + 30000 : (weapon << 2) + START_WEAPON) - 3 + color;
}

export function isTwoPeopleStyle(i: number): boolean {
  return i === 11 || (i >= 54 && i < 64);
}

export function isTwoPeopleSprite(i: number): boolean {
  return i === HOUSE_TWO_PEOPLE_SPRITE || (i >= 50000 && i < 50010);
}

/**
 * Builds a fully dressed character from the three appearance longs a Model carries.
 * (The "simple sprites" game setting, which switches to createMiniSpriteByIcon, is not ported.)
 */
export function createSpriteByIcon(icon1: bigint, icon2: bigint, icon3: bigint, battle: boolean): GameSprite | null {
  const sex = bits(icon1, 0, 1);
  const left = widen(bits(icon2, 6, 255), bits(icon2, 32, 3), 255);
  const right = widen(bits(icon2, 16, 255), bits(icon2, 34, 3), 255);
  let back = widen(widen(bits(icon3, 0, 15), bits(icon3, 28, 1), 15), bits(icon3, 32, 3), 15, 1);
  let mount = widen(bits(icon3, 22, 15), bits(icon3, 29, 1), 15);
  mount = widen(mount, bits(icon3, 31, 1), 15, 1);
  mount = widen(mount, bits(icon3, 36, 1), 15, 2);
  const dual = left > 0 && right > 0;

  let id: number;
  if (mount <= 0 || battle) id = getSpriteNameIDByWeapon(getDefaultSprNameID(sex, battle), left, right, dual, battle);
  else if (isTwoPeopleStyle(mount)) id = sex === 0 ? mount + 700 : mount + 900;
  else id = getHorseSpriteNameIDByWeapon(sex, mount, left, right, dual);

  const sp = GameSprite.createSpriteFull(id, false, false, battle, sex);
  if (sp == null) return null;
  // Mounts that already include a back part (5xxx fragment) suppress the cloak.
  if (mount > 0) {
    for (const f of sp.fragmentFiles ?? []) if (f != null && ((f.getNameID() / 1000) | 0) === 5) back = 31;
  }
  doChangeSpriteIcon(sp, icon1, icon2, icon3, sex, left, right, back, mount, dual, battle);
  if (back > 0 && back !== 31) {
    const cloak = GameSprite.createSprite(back + 1100, battle);
    sp.cloakSprite = cloak;
    if (cloak != null) doChangeSpriteIcon(cloak, icon1, icon2, icon3, sex, left, right, back, mount, dual, battle);
  }
  if ((mount === 2 || mount === 4) && !battle) sp.setHighTransport(true);
  return sp;
}

export function createPetSpriteByIcon(icon: bigint, battle: boolean): GameSprite | null {
  const kind = bits(icon, 0, 63);
  const color = bits(icon, 6, 3);
  if (kind <= 0) return null;
  const sp = GameSprite.createSpriteFull(battle ? kind + 599 : kind + 499, false, false, battle, -1);
  // weaponR = -99 marks "pet": weapon parts keep their own id.
  if (sp != null) doChangeSpriteIcon(sp, icon, 0n, 0n, 0, 0, -99, color, kind, false, battle);
  return sp;
}

export function createHeadSpriteByIcon(icon1: bigint): GameSprite | null {
  const sex = bits(icon1, 0, 1);
  const sp = GameSprite.createSprite(sex === 0 ? SPRITE_MAN_HEAD : SPRITE_WOMAN_HEAD);
  if (sp != null) doChangeSpriteIcon(sp, icon1, 0n, 0n, sex, 0, 0, 0, 0, false, false);
  return sp;
}

function updateFragmentByPngName(sp: GameSprite, dir: string, s: number, battle: boolean): FragmentFile | null {
  return sp.lookupFragment(dir, s, battle);
}

/**
 * Re-points every fragment of `sp` at the image for the chosen style/colour of its body part.
 * Part = fragment nameID / 1000: 0 hair, 1 face, 2 hands, 3 legs, 4 shoulders, 5 back, 6 top,
 * 7 bottom, 8/9 weapon, 10 helmet, 12 pet colour, 14 mount colour, 15 weapon glow, 16 mini parts.
 * Style 0 hides the part (clearImage). Within a part, ids are laid out as
 * (style << 3) + base - 7 + (sex << 2) + colour, i.e. 8 slots per style: 2 sexes × 4 colours.
 */
export function doChangeSpriteIcon(
  sp: GameSprite,
  icon1: bigint,
  icon2: bigint,
  icon3: bigint,
  sex: number,
  left: number,
  right: number,
  back: number,
  mount: number,
  dual: boolean,
  battle: boolean,
): void {
  const hair = widen(bits(icon1, 7, 15), bits(icon1, 32, 7), 15);
  const hairColor = bits(icon1, 11, 3);
  let face = widen(bits(icon1, 13, 15), bits(icon1, 35, 1), 15);
  const hand = widen(bits(icon1, 17, 3), bits(icon1, 36, 15), 3);
  const handColor = bits(icon1, 19, 3);
  const legRaw = widen(bits(icon1, 21, 3), bits(icon1, 40, 15), 3);
  const leg = hand === 3 ? 4 : legRaw;
  const legColor = bits(icon1, 23, 3);
  let helmet = widen(bits(icon1, 25, 31), bits(icon1, 44, 3), 31);
  const helmetColor = bits(icon1, 30, 3);
  let shoulder = widen(bits(icon2, 0, 15), bits(icon2, 31, 1), 15);
  shoulder = widen(shoulder, bits(icon2, 36, 3), 15, 1);
  const shoulderColor = bits(icon2, 4, 3);
  const leftColor = bits(icon2, 14, 3);
  const rightColor = bits(icon2, 24, 3);
  const glow = bits(icon2, 28, 7);
  const backColor = bits(icon3, 4, 3);
  let top = widen(bits(icon3, 6, 63), bits(icon3, 34, 1), 63);
  if (top <= 0) top = 1;
  const topColor = bits(icon3, 12, 3);
  let bottom = widen(bits(icon3, 14, 63), bits(icon3, 35, 1), 63);
  if (bottom <= 0) bottom = 1;
  const bottomColor = bits(icon3, 20, 3);
  const fashion = bits(icon3, 30, 1);

  // Fashion outfits (top style 41..49) carry their own face/helmet.
  if (fashion > 0) {
    switch (top) {
      case 41:
        face = topColor + 16;
        break;
      case 42:
        face = topColor + 20;
        break;
      case 43:
        face = topColor + 24;
        break;
      case 44:
        face = topColor + 27;
        break;
      case 45:
        if (sex === 1) helmet = 45;
        break;
      case 47:
        if (sex === 1) helmet = 48;
        break;
      case 49:
        if (sex === 1) helmet = 51;
        break;
    }
  }

  const mountColor = bits(icon3, 26, 3);
  const files = sp.fragmentFiles;
  if (files == null) return;
  const house = back === HOUSE_TWO_PEOPLE_SPRITE;
  let firstWeapon: FragmentFile | null = null;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f == null) continue;
    const nameId = f.getNameID();
    let part = (nameId / 1000) | 0;
    if (part === 9) part = 8;
    const sexSlot = ((nameId - 1) >> 2) & 1;

    let target: number;
    let secondWeapon = false;

    if (house) {
      // Two-people house sprite: each fragment belongs to one of the two characters (by its sex
      // slot); only the matching character's parts are restyled. Mirrors the bytecode, including
      // its quirk of using the part number itself as the id when a style is 0.
      if (part !== 0 && part !== 1 && part !== 4 && part !== 14 && part !== 6 && part !== 7) {
        if (f.isNullImage()) f.loadImage(PATH_ANI, nameId);
        continue;
      }
      if (part === 7) {
        if (bottom > 0) {
          if (sexSlot !== sex) continue;
          target = (bottom << 3) + 6993 + (sex << 2) + bottomColor;
        } else target = part;
      } else if (part === 6) {
        if (top > 0) {
          if (sexSlot !== sex) continue;
          target = (top << 3) + 5993 + (sex << 2) + topColor;
        } else target = part;
      } else if (part === 14) {
        if (mount <= 0) continue;
        target = nameId - ((nameId - 1) & 3) + mountColor;
      } else if (part === 4) {
        if (sexSlot !== sex) continue;
        target = shoulder > 0 ? (shoulder << 3) + START_SHOULDER - 7 + (sex << 2) + shoulderColor : part;
      } else if (part === 1) {
        if (face > 0) {
          if (sexSlot !== sex) continue;
          target = (face << 3) + 993 + (sex << 2);
        } else target = part;
      } else {
        if (hair > 0) {
          if (sexSlot !== sex) continue;
          target = (hair << 3) - 7 + (sex << 2) + hairColor;
        } else target = part;
      }
    } else {
      switch (part) {
        case 0:
          target = hair > 0 ? (hair << 3) - 7 + (sex << 2) + hairColor : -1;
          break;
        case 1:
          target = face > 0 ? (face << 3) + 993 + (sex << 2) : -1;
          break;
        case 2:
          target = hand > 0 ? (hand << 3) + 1993 + (sex << 2) + handColor : -1;
          break;
        case 3:
          target = leg > 0 ? (leg << 3) + 2993 + (sex << 2) + legColor : -1;
          break;
        case 4:
          target = shoulder > 0 ? (shoulder << 3) + START_SHOULDER - 7 + (sex << 2) + shoulderColor : -1;
          break;
        case 5:
          target = back > 0 ? (back << 2) + 4997 + backColor : -1;
          break;
        case 6:
          target = top > 0 ? (top << 3) + 5993 + (sex << 2) + topColor : -1;
          break;
        case 7:
          target = bottom > 0 ? (bottom << 3) + 6993 + (sex << 2) + bottomColor : -1;
          break;
        case 8:
          if (dual) {
            // Dual wield: the first weapon fragment shows the left weapon, the second the right.
            if (firstWeapon != null) {
              target = right > 0 ? getWeaponIcon(right, rightColor) : -1;
              secondWeapon = true;
            } else {
              target = left > 0 ? getWeaponIcon(left, leftColor) : -1;
              firstWeapon = f;
            }
          } else {
            target = left > 0 ? getWeaponIcon(left, leftColor) : -1;
            if (right > 0) target = getWeaponIcon(right, rightColor);
            else if (right === -99) target = nameId;
          }
          break;
        case 10:
          target = helmet > 0 ? (helmet << 2) + 9997 + helmetColor : -1;
          break;
        case 12:
          target = mount > 0 ? nameId - ((nameId - 1) & 3) + back : -1;
          break;
        case 14:
          target = mount > 0 ? nameId - ((nameId - 1) & 3) + mountColor : -1;
          break;
        case 15:
          if (glow > 0) target = nameId - ((nameId - 1) & 3) + (glow - 1);
          else target = right === -99 ? nameId : -1;
          break;
        case 16:
          if (nameId >= 16100 && nameId < 16200) {
            target = getSpriteNameIDByWeapon(16100, left, right, false, true);
            if (target === 16100) target = -1;
          } else if (nameId < 16007 || nameId >= 16100) {
            if (f.isNullImage()) f.loadImage(PATH_ANI, nameId);
            continue;
          } else {
            target = miniBodyId(bits(icon1, 3, 15), nameId, sex);
          }
          break;
        default:
          // 9 (folded into 8), 11, 13 and anything else: keep, just make sure it is loaded.
          if (f.isNullImage()) f.loadImage(PATH_ANI, nameId);
          continue;
      }
    }

    if (target === -1) {
      f.clearImage();
      continue;
    }
    let cur: FragmentFile | null = f;
    if (target !== nameId) {
      if (secondWeapon && firstWeapon != null && firstWeapon.getNameID() === target) {
        files[i] = FragmentFile.cloneFragmentFile(firstWeapon);
        if (files[i]!.isNullImage()) files[i]!.loadImage(PATH_ANI, target);
        continue;
      }
      cur = updateFragmentByPngName(sp, PATH_ANI, target, battle);
      if (cur == null) files[i]!.clearImage();
      else files[i] = cur;
    }
    if (cur != null && cur.isNullImage()) cur.loadImage(PATH_ANI, target);
  }
}

/** Part 16 bodies 16007..16022, chosen by the 4-bit mini style in icon1 bits 3..6. */
function miniBodyId(style: number, nameId: number, sex: number): number {
  const alt = [16007, 16008, 16011, 16013, 16015, 16017, 16019, 16021].includes(nameId);
  const pick = (a: number, b: number, c: number, d: number) => (alt ? (sex === 0 ? a : b) : sex === 0 ? c : d);
  if (style === 4) return pick(16015, 16017, 16016, 16018);
  if (style === 2) return pick(16019, 16021, 16020, 16022);
  if (style === 1) return pick(16011, 16013, 16012, 16014);
  return pick(16007, 16008, 16009, 16010);
}

/** Appearance fields, as decoded by createSpriteByIcon/doChangeSpriteIcon. */
export interface Appearance {
  sex: number;
  hair: number;
  hairColor: number;
  face: number;
  hand: number;
  handColor: number;
  leg: number;
  legColor: number;
  helmet: number;
  helmetColor: number;
  shoulder: number;
  shoulderColor: number;
  weaponL: number;
  weaponLColor: number;
  weaponR: number;
  weaponRColor: number;
  glow: number;
  back: number;
  backColor: number;
  top: number;
  topColor: number;
  bottom: number;
  bottomColor: number;
  mount: number;
  mountColor: number;
  fashion: number;
}

/**
 * Web-only inverse of the decoding above (the server builds these longs in the real game).
 * Each field is split into its low bits and the "extra" high bits stored further up the long.
 */
export function encodeIcons(a: Appearance): [bigint, bigint, bigint] {
  const put = (v: number, shift: number) => BigInt(v) << BigInt(shift);
  const split = (v: number, lowBits: number) => [v & ((1 << lowBits) - 1), v >> lowBits] as const;

  const [hairLo, hairHi] = split(a.hair, 4);
  const [faceLo, faceHi] = split(a.face, 4);
  const [handLo, handHi] = split(a.hand, 2);
  const [legLo, legHi] = split(a.leg, 2);
  const [helmLo, helmHi] = split(a.helmet, 5);
  const icon1 =
    put(a.sex & 1, 0) |
    put(hairLo, 7) | put(a.hairColor & 3, 11) | put(hairHi & 7, 32) |
    put(faceLo, 13) | put(faceHi & 1, 35) |
    put(handLo, 17) | put(a.handColor & 3, 19) | put(handHi & 15, 36) |
    put(legLo, 21) | put(a.legColor & 3, 23) | put(legHi & 15, 40) |
    put(helmLo, 25) | put(a.helmetColor & 3, 30) | put(helmHi & 3, 44);

  const [shLo, shRest] = split(a.shoulder, 4);
  const [wlLo, wlHi] = split(a.weaponL, 8);
  const [wrLo, wrHi] = split(a.weaponR, 8);
  const icon2 =
    put(shLo, 0) | put(a.shoulderColor & 3, 4) | put(shRest & 1, 31) | put((shRest >> 1) & 3, 36) |
    put(wlLo, 6) | put(a.weaponLColor & 3, 14) | put(wlHi & 3, 32) |
    put(wrLo, 16) | put(a.weaponRColor & 3, 24) | put(wrHi & 3, 34) |
    put(a.glow & 7, 28);

  const [bkLo, bkRest] = split(a.back, 4);
  const [topLo, topHi] = split(a.top, 6);
  const [botLo, botHi] = split(a.bottom, 6);
  const [mtLo, mtRest] = split(a.mount, 4);
  const icon3 =
    put(bkLo, 0) | put(a.backColor & 3, 4) | put(bkRest & 1, 28) | put((bkRest >> 1) & 3, 32) |
    put(topLo, 6) | put(a.topColor & 3, 12) | put(topHi & 1, 34) |
    put(botLo, 14) | put(a.bottomColor & 3, 20) | put(botHi & 1, 35) |
    put(mtLo, 22) | put(a.mountColor & 3, 26) | put(mtRest & 1, 29) | put((mtRest >> 1) & 1, 31) | put((mtRest >> 2) & 1, 36) |
    put(a.fashion & 1, 30);
  return [icon1, icon2, icon3];
}

export const DEFAULT_APPEARANCE: Appearance = {
  sex: 0, hair: 1, hairColor: 0, face: 1, hand: 1, handColor: 0, leg: 1, legColor: 0,
  helmet: 0, helmetColor: 0, shoulder: 0, shoulderColor: 0, weaponL: 0, weaponLColor: 0,
  weaponR: 0, weaponRColor: 0, glow: 0, back: 0, backColor: 0, top: 1, topColor: 0,
  bottom: 1, bottomColor: 0, mount: 0, mountColor: 0, fashion: 0,
};
