// Made-up player data for the offline test map. In the real game all of this comes from the
// server at login; nothing here is taken from server data. Icon frames are picked from the item
// sheet /common/1 without knowing which frame is which item type.
import { BAG_START, ITEM_TYPE_PET, Item, PlayerBag, SLOT_PET } from '../actor/Item';
import { Talent } from '../core/Talent';
import { SKILL_TYPE_ACTIVE, SKILL_TYPE_AUTO, SKILL_TYPE_PASSIVE, Skill } from '../core/Skill';
import { CONDITION_HAVE_ITEM, CONDITION_KILL_MONSTER, Condition, Mission } from '../core/Mission';
import { ATTR_PET_GRADE, ATTR_PET_GROW_LEVEL, MyPet } from '../actor/MyPet';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_LEVEL, ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, ATTR_MP, ATTR_MP_MAX, type Player } from '../actor/Player';

function item(name: string, bagIcon: number, grade: number, quantity = 1, description = '', type = 0): Item {
  const it = new Item();
  it.type = type;
  it.name = name;
  it.bagIcon = bagIcon;
  it.grade = grade;
  it.quantity = quantity;
  it.description = description || `${name}\n(Dữ liệu giả – vật phẩm thật do server gửi.)`;
  return it;
}

/** Equipment slot → item, and bag items from slot 30. */
export function makeDemoBag(): PlayerBag {
  const bag = new PlayerBag();
  const equip: [number, Item][] = [
    // Types follow PlayerBag.getEquipPosByType so each sits in a slot of its type.
    [0, item('Mũ demo', 10, 1, 1, '', 8)],
    [3, item('Áo demo', 12, 2, 1, '', 12)],
    [2, item('Vũ khí demo', 3, 3, 1, '', 9)],
    [4, item('Giày demo', 16, 1, 1, '', 5)],
    [6, item('Nhẫn demo', 20, 4, 1, '', 7)],
  ];
  for (const [slot, it] of equip) bag.setItem(slot, it);
  const bagItems = [
    item('Bình máu demo', 30, 0, 25, 'Hồi 500 HP (dữ liệu giả).', 27),
    item('Bình mana demo', 31, 0, 12, 'Hồi 300 MP (dữ liệu giả).', 27),
    Object.assign(item('Đá cường hóa demo', 40, 2, 5), { id: DEMO_STONE_ID }),
    item('Bảo thạch demo', 45, 3, 2),
    item('Cuộn dịch chuyển demo', 50, 1, 3, 'Về thành (dữ liệu giả).', 31),
    item('Vũ khí túi demo', 14, 5, 1, '', 9),
  ];
  bagItems.forEach((it, i) => bag.setItem(BAG_START + i, it));
  // Pet items (type 32): the active pet sits in equipment slot 1, two more wait in the bag.
  bag.setItem(SLOT_PET, petItem('Pet demo', 18, 2n, 3));
  bag.setItem(BAG_START + 6, petItem('Pet túi demo A', 12, 6n, 1));
  bag.setItem(BAG_START + 7, petItem('Pet túi demo B', 9, 10n, 0));
  return bag;
}

/** A pet item; `icon` picks the sprite (kind + 499, so 2 → 501). */
function petItem(name: string, level: number, icon: bigint, grade: number): Item {
  const it = item(name, 60, grade, 1, `${name} (dữ liệu giả).`, ITEM_TYPE_PET);
  it.reqLv = level;
  it.icon = icon;
  return it;
}

const DEMO_STONE_ID = 9002;

/** Made-up missions for the mission list: one in progress, two whose goals are met. */
export function makeDemoMissions(): Mission[] {
  const kill = new Mission(9001);
  Object.assign(kill, {
    name: 'Diệt sói hoang (demo)',
    desc: 'Sói hoang quấy nhiễu dân làng. Hãy giúp trưởng thôn (nhiệm vụ giả, không có trong game).',
    simpleDesc: 'Hủy diệt 10 Sói hoang demo ở ngoài thôn.',
    dialogStartNotFinish: 'Còn chưa đủ sao? (dữ liệu giả)',
    exp: 1500,
    money3: 300,
  });
  kill.submitCondition = [new Condition(CONDITION_KILL_MONSTER, 'Sói hoang demo', 10, 4)];
  const collect = new Mission(9002);
  Object.assign(collect, {
    name: 'Thu thập đá (demo)',
    desc: 'Thợ rèn cần đá cường hóa (nhiệm vụ giả).',
    simpleDesc: 'Mang 3 Đá cường hóa demo cho thợ rèn.',
    exp: 800,
    money2: 20,
  });
  collect.submitCondition = [new Condition(CONDITION_HAVE_ITEM, 'Đá cường hóa demo', 3, 0, DEMO_STONE_ID)];
  const talk = new Mission(9003);
  Object.assign(talk, {
    name: 'Gặp NPC nhiệm vụ (demo)',
    desc: 'Tìm NPC có dấu "!" trên bản đồ nhỏ (nhiệm vụ giả).',
    simpleDesc: 'Nói chuyện với NPC nhiệm vụ.',
    honor: 5,
  });
  return [kill, collect, talk];
}

function skill(id: number, name: string, type: number, level: number, fields: Partial<Skill>): Skill {
  return Object.assign(new Skill(), { id, name, type, level }, fields);
}

/** Made-up skills (names, numbers and powers are not from the game data). */
export function makeDemoSkills(): Skill[] {
  return [
    skill(101, 'Kiếm thuật (demo)', SKILL_TYPE_PASSIVE, 5, { power1: 28, powerValue1: 10, info: 'Kỹ năng giả để thử màn hình.' }),
    skill(102, 'Thân pháp (demo)', SKILL_TYPE_PASSIVE, 3, { addLevel: 1, power1: 11, powerValue1: 120 }),
    skill(201, 'Chém mạnh (demo)', SKILL_TYPE_ACTIVE, 8, {
      area: 10, skillAtkType: 0, power1: 58, powerValue1: 50, atk_time: 1, useMP: 30, skillWeapon: 1,
      info: 'Kỹ năng giả: một đòn chém vào một địch.',
    }),
    skill(202, 'Hồi phục (demo)', SKILL_TYPE_ACTIVE, 4, { area: 20, skillAtkType: 6, power1: 49, powerValue1: 300, useMP: 50, isLearnByBook: true }),
    skill(301, 'Phản đòn (demo)', SKILL_TYPE_AUTO, 2, { area: 20, skillAtkType: 6, power1: 41, powerValue1: 5, round: 3, statusBit1: 11 }),
  ];
}

function talent(rankid: number, name: string, type: number, ranklevel: number, power1: number, powerValue1: number): Talent {
  return Object.assign(new Talent(), { rankid, name, type, ranklevel, power1, powerValue1, maxTalentLevel: 5 });
}

/** Made-up talents (not from the game data). */
export function makeDemoTalents(): Talent[] {
  return [
    talent(2, 'Bạo kích (demo)', 0, 2, 27, 3),
    talent(1, 'Sắc bén (demo)', 0, 1, 28, 5),
    talent(3, 'Da thép (demo)', 1, 1, 31, 4),
    talent(4, 'Sinh lực (demo)', 2, 3, 11, 150),
  ];
}

function makeDemoPetSkills(): Skill[] {
  return [
    skill(401, 'Cắn xé (demo)', SKILL_TYPE_ACTIVE, 3, { area: 10, skillAtkType: 2, power1: 59, powerValue1: 20, useMP: 10 }),
    skill(402, 'Da dày (demo)', SKILL_TYPE_PASSIVE, 2, { power1: 31, powerValue1: 8 }),
  ];
}

/** Sprites the demo pets use (for preloading). */
export const DEMO_PET_SPRITES = [501, 505, 509];

export const DEMO_PLAYER_VALUES: [number, number][] = [
  [ATTR_LEVEL, 25],
  [ATTR_HP, 820],
  [ATTR_HP_MAX, 1000],
  [ATTR_MP, 310],
  [ATTR_MP_MAX, 500],
  [ATTR_EXP, 4200],
  [ATTR_EXP_MAX, 10000],
  [ATTR_MONEY1, 123456],
  [ATTR_MONEY2, 789],
  [ATTR_MONEY3, 50],
];

/** Made-up combat values: speed 31, damage 33~34, hits 35, attack 36..38, defence 39..41, dodge 42,
 * hit 43..44, critical 45, and the extra ones a level 11+ character lists. */
const DEMO_COMBAT_VALUES: [number, number][] = [
  [31, 48], [33, 60], [34, 85], [35, 1], [36, 120], [37, 95], [38, 40], [39, 150], [40, 130], [41, 70],
  [42, 35], [43, 30], [44, 12], [45, 20], [46, 5], [48, 30], [49, 15], [51, 10], [64, 70],
];

export function fillDemoPlayer(p: Player): void {
  p.bag = makeDemoBag();
  for (const [k, v] of DEMO_PLAYER_VALUES) p.set(k, v);
  // Base attributes, totals with equipment bonus, and points left to assign.
  [p.str, p.con, p.agi, p.ilt, p.wis] = [40, 32, 25, 18, 20];
  [[6, 52], [7, 40], [8, 25], [9, 18], [10, 26], [4, 5]].forEach(([k, v]) => p.set(k, v));
  p.job = 3;
  p.race = 0;
  p.countryName = 'Quốc gia demo';
  p.countryRank = 'Dân thường';
  // Combat values for the T.Tính tab (ids as in PlayerInfoUIAction.updatePlayerAttributeUI).
  DEMO_COMBAT_VALUES.forEach(([k, v]) => p.set(k, v));
  p.missionList = makeDemoMissions();
  p.skillList = makeDemoSkills();
  p.talentList = makeDemoTalents();
  p.autoSkillID = [301, 0, 0];
  p.autoSkillID_Initiative = 201;
  p.set(5, 12); // skill points
  // X.Hội values: honour 68, storage slots 15, monsters killed 18, duels won 19.
  [[68, 320], [15, 24], [18, 1520], [19, 7]].forEach(([k, v]) => p.set(k, v));
  Object.assign(p, {
    arenaPoint: 150, skyarenaPoint: 40, combatPoint: 12345, enchantValue: 2600, exp2: 0, expMax2: 50000,
    Pkwincount: 7, Pklosecount: 3, title: 'Danh hiệu demo',
  });
  // The active pet: the item in slot 1 as a MyPet, with made-up stats.
  const petItemInSlot = p.bag.getItem(SLOT_PET);
  if (petItemInSlot != null) {
    const pet = MyPet.createItemPet(petItemInSlot, p);
    pet.petItem = petItemInSlot;
    [[ATTR_HP, 450], [ATTR_HP_MAX, 600], [ATTR_MP, 120], [ATTR_MP_MAX, 300], [ATTR_EXP, 700], [ATTR_EXP_MAX, 2000], [ATTR_PET_GROW_LEVEL, 7], [ATTR_PET_GRADE, petItemInSlot.grade]]
      .forEach(([k, v]) => pet.set(k, v));
    [pet.str, pet.con, pet.agi, pet.ilt, pet.wis] = [22, 18, 15, 12, 10];
    [[6, 25], [7, 18], [8, 17], [9, 12], [10, 10]].forEach(([k, v]) => pet.set(k, v));
    DEMO_COMBAT_VALUES.forEach(([k, v]) => pet.set(k, Math.max(1, (v * 0.6) | 0)));
    Object.assign(pet, { cp: 6, grow: 72, compre: 55, growLevel: 7, petAge: 1200, petmaxage: 2000, petHeadIcon: 501 });
    pet.skillList = makeDemoPetSkills();
    p.setPet(pet);
  }
}
