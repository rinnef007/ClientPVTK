// Made-up player data for the offline test map. In the real game all of this comes from the
// server at login; nothing here is taken from server data. Icon frames are picked from the item
// sheet /common/1 without knowing which frame is which item type.
import { BAG_START, ITEM_TYPE_PET, Item, PlayerBag, SLOT_PET } from '../actor/Item';
import { Talent } from '../core/Talent';
import { ShopItem } from '../core/ShopItem';
import { SKILL_TYPE_ACTIVE, SKILL_TYPE_AUTO, SKILL_TYPE_PASSIVE, Skill } from '../core/Skill';
import { CONDITION_MISSION_FINISHED, CONDITION_HAVE_ITEM, CONDITION_KILL_MONSTER, Condition, Mission } from '../core/Mission';
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
  // Ids, stack sizes and selling prices are made up (the shop sells the same ids, so they stack).
  const bagItems = [
    Object.assign(item('Bình máu demo', 30, 0, 25, 'Hồi 500 HP (dữ liệu giả).', 27), { id: DEMO_HP_ID, stackNum: 99, price: 2 }),
    Object.assign(item('Bình mana demo', 31, 0, 12, 'Hồi 300 MP (dữ liệu giả).', 27), { id: DEMO_MP_ID, stackNum: 99, price: 3 }),
    Object.assign(item('Đá cường hóa demo', 40, 2, 5), { id: DEMO_STONE_ID, stackNum: 99, price: 5 }),
    Object.assign(item('Bảo thạch demo', 45, 3, 2), { id: 9103, stackNum: 99, price: 20 }),
    Object.assign(item('Cuộn dịch chuyển demo', 50, 1, 3, 'Về thành (dữ liệu giả).', 31), { id: 9104, stackNum: 20, price: 4 }),
    Object.assign(item('Vũ khí túi demo', 14, 5, 1, '', 9), { id: 9105, price: 150 }),
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
const DEMO_HP_ID = 9101;
const DEMO_MP_ID = 9102;

/** The demo shop's id (NPC demo 3 opens it). */
export const DEMO_SHOP_ID = 1;

function goods(name: string, bagIcon: number, grade: number, fields: Partial<ShopItem>, description = ''): ShopItem {
  const it = Object.assign(new ShopItem(), { name, bagIcon, grade, quantity: 1 }, fields);
  it.description = description || `${name}\n(Hàng giả – hàng thật do server gửi.)`;
  return it;
}

/** Made-up goods: names, prices, limits and stock are invented. */
export function makeDemoShopGoods(): ShopItem[] {
  return [
    goods('Bình máu demo', 30, 0, { id: DEMO_HP_ID, type: 27, stackNum: 99, money3: 10, price: 2 }, 'Hồi 500 HP (dữ liệu giả).'),
    goods('Bình mana demo', 31, 0, { id: DEMO_MP_ID, type: 27, stackNum: 99, money3: 12, price: 3 }, 'Hồi 300 MP (dữ liệu giả).'),
    goods('Đá cường hóa demo', 40, 2, { id: DEMO_STONE_ID, stackNum: 99, money2: 5, maxBuy: 20, price: 5 }),
    goods('Cuộn dịch chuyển demo', 50, 1, { id: 9104, type: 31, stackNum: 20, money3: 25, price: 4 }, 'Về thành (dữ liệu giả).'),
    goods('Mũ sắt demo', 10, 1, { id: 9201, type: 8, money3: 300, hotTypeOrNewItem: 1, price: 60 }),
    goods('Áo giáp demo', 12, 2, { id: 9202, type: 12, money3: 800, allCount: 3, price: 160 }),
    goods('Cánh demo', 22, 4, { id: 9203, type: 9, money1: 50, hotTypeOrNewItem: 2, price: 0 }),
    goods('Nhẫn bạc demo', 20, 1, { id: 9204, type: 7, money3: 450, price: 90 }),
    goods('Giày da demo', 16, 1, { id: 9205, type: 5, money3: 250, price: 50 }),
    goods('Bảo thạch demo', 45, 3, { id: 9103, stackNum: 99, money2: 30, price: 20 }),
  ];
}

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
    dialogStartFinish: 'Ngươi đã tìm thấy ta. (lời thoại giả)',
    honor: 5,
    exp: 300,
  });
  return [kill, collect, talk];
}

/** Ids of the demo NPCs that give and take the made-up missions (MapScene creates them). */
export const DEMO_QUEST_NPC_ID = 201;
export const DEMO_ELDER_NPC_ID = 200;

/**
 * Made-up NPC missions for the local simulation: the quest NPC offers a letter to deliver to the
 * elder (who then hands out the report back, chained with submitNextMissionID) and a level 50
 * mission that stays hidden. All names, texts and rewards are invented.
 */
export function makeDemoNpcMissions(mapId: number): { quest: Mission[]; elder: Mission[] } {
  const letter = new Mission(9004);
  Object.assign(letter, {
    name: 'Thư cho trưởng thôn (demo)',
    desc: 'Mang lá thư này tới NPC demo 1 (nhiệm vụ giả).',
    simpleDesc: 'Nói chuyện với NPC demo 1.',
    dialogStartFinish: 'Thư của ta đây à? Cảm ơn. (lời thoại giả)',
    mapId, npcId: DEMO_ELDER_NPC_ID, level: 1, exp: 600, money3: 50, submitNextMissionID: 9006,
  });
  const report = new Mission(9006);
  Object.assign(report, {
    name: 'Hồi âm (demo)',
    desc: 'Trưởng thôn nhờ mang hồi âm về cho NPC demo 2 (nhiệm vụ giả).',
    simpleDesc: 'Quay lại NPC demo 2.',
    dialogStartFinish: 'Tốt lắm, cảm ơn ngươi. (lời thoại giả)',
    mapId, npcId: DEMO_QUEST_NPC_ID, level: 1, exp: 900, money2: 10,
  });
  report.acceptCondition = [new Condition(CONDITION_MISSION_FINISHED, '', 1, 0, letter.getId())];
  const hard = new Mission(9005);
  Object.assign(hard, {
    name: 'Thử thách cấp cao (demo)',
    desc: 'Chỉ dành cho cấp 50 trở lên (nhiệm vụ giả).',
    dialogNotStartNotReady: 'Ngươi còn quá yếu.',
    mapId, npcId: DEMO_QUEST_NPC_ID, level: 50, exp: 99999,
  });
  return { quest: [letter, hard], elder: [report] };
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
  p.missionList.forEach((m) => m != null && (m.npcId = DEMO_QUEST_NPC_ID));
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
