// Readers for the "enter game" reply (CG_LOGIN_ACTORENTER, 2) of client 1.2.0, which the user's
// backend speaks: MsgHandler.processPlayerEnterMsg / processDataBlockFlagMsg and the per-block
// readers Player.fromBytes, MyPet.fromBytesDetail, Item.fromBytes, Skill.fromBytes (jadx decompile of
// 1.2.0; the title line of Player.fromBytes and some Item fields differ from the older client this
// web port started from). Values the web client has no use for yet are read and dropped so the
// cursor stays aligned. Blocks are read in increasing bit order; reading stops after the map block
// (512) because the later blocks (formations, talents…) are not ported.
import { Item } from '../../game/actor/Item';
import { Skill } from '../../game/core/Skill';
import { Message } from '../Message';

/** Block bits of processDataBlockFlagMsg that this reader understands. */
export const BLOCK_PLAYER_DETAIL = 2;
export const BLOCK_MISSION_STATUS = 4;
export const BLOCK_MISSIONS = 8;
export const BLOCK_ITEMS = 16;
export const BLOCK_SKILLS = 32;
export const BLOCK_MAP_TEST = 256;
export const BLOCK_MAP = 512;

/** Tool.byte2short: an unsigned byte. */
const u8 = (m: Message) => m.getByte() & 0xff;
const u16 = (m: Message) => m.getShort() & 0xffff;

/** The fields of Player.fromBytes the web client shows. */
export interface PlayerDetail {
  id: number;
  name: string;
  title: string;
  sex: number;
  race: number;
  job: number;
  level: number;
  level2: number;
  exp2: number;
  expMax2: number;
  icon1: bigint;
  icon2: bigint;
  icon3: bigint;
  setting: number;
  countryName: string;
  exp: number;
  expMax: number;
  hp: number;
  mp: number;
  cp: number;
  sp: number;
  str: number;
  con: number;
  agi: number;
  ilt: number;
  wis: number;
  money1: number;
  money2: number;
  money3: number;
  killCount: number;
  Pkwincount: number;
  Pklosecount: number;
  masterFlag: number;
  partnerName: string;
  helpCountry: string;
  lovePlayer: string;
  arenaPoint: number;
  skyarenaPoint: number;
  combatPoint: number;
  vipLevel: number;
  vipLevel2: number;
  autoSkillID: number[];
  autoSkillID_Initiative: number;
  enchantValue: number;
}

/** MyPet.fromBytesDetail (the active pet), null when the id byte is negative. */
export interface PetDetail {
  id: number;
  name: string;
  level: number;
  icon1: bigint;
  hp: number;
  mp: number;
  exp: number;
  expMax: number;
  grade: number;
  job: number;
  skills: Skill[];
  headIcon: number;
}

export interface EnterGameData {
  loginSetting: number;
  mapId: number;
  gx: number;
  gy: number;
  flags: number;
  player: PlayerDetail | null;
  pet: PetDetail | null;
  missionStatus: Uint8Array | null;
  /** Mission.fromBytes blobs (not decoded yet). */
  missions: Uint8Array[];
  items: Item[];
  skills: Skill[];
  /** Map data block: GameMap bytes (maybe gzip), name, tip, weather. */
  mapBytes: Uint8Array | null;
  mapName: string;
  mapTip: string;
}

/** Player.fromBytes (1.2.0). GameWorld.isQQVip is false here, so its extra byte is not read. */
export function readPlayerDetail(m: Message): PlayerDetail {
  const id = m.getInt();
  const name = m.getString();
  m.getString(); // ip
  m.getString(); // info
  const title = m.getString();
  const [sex, race, job, level, level2] = [m.getByte(), m.getByte(), m.getByte(), m.getByte(), m.getByte()];
  const exp2 = m.getInt();
  const expMax2 = m.getInt();
  const icon1 = m.getLong();
  const icon2 = m.getLong();
  const icon3 = m.getLong();
  const setting = m.getInt();
  m.getInt(); // status
  m.getByte(); // mode
  const countryId = m.getInt();
  let countryName = '';
  if (countryId >= 0) {
    countryName = m.getString();
    m.getByte(); // countryRank
  }
  const exp = m.getInt();
  const expMax = m.getInt();
  const hp = m.getInt();
  const mp = m.getInt();
  const cp = m.getShort();
  const sp = m.getInt();
  const [str, con, agi, ilt, wis] = [m.getShort(), m.getShort(), m.getShort(), m.getShort(), m.getShort()];
  const [money1, money2, money3] = [m.getInt(), m.getInt(), m.getInt()];
  m.getByte(); // numBag
  m.getByte(); // numStore
  m.getInt(); // countryHonor
  m.getInt(); // cityId
  const killCount = m.getInt();
  const Pkwincount = m.getInt();
  const Pklosecount = m.getInt();
  const masterFlag = m.getByte();
  const partnerId = m.getInt();
  const partnerName = partnerId >= 0 ? m.getString() : '';
  const helpCountry = m.getString();
  const lovePlayer = m.getString();
  m.getInt(); // integral
  const arenaPoint = m.getInt();
  const skyarenaPoint = m.getInt();
  const combatPoint = m.getInt();
  for (let i = 0; i < 6; i++) m.getInt(); // ignore_back … ignore_touch
  const vipLevel = m.getByte();
  const vipLevel2 = m.getByte();
  m.getByte(); // vipLevel3
  m.getByte(); // vip2LevelOverdue
  m.getByte(); // maxVIP
  m.getByte(); // superQqLevel
  const autoSkillID: number[] = [];
  for (let i = m.getByte(); i > 0; i--) autoSkillID.push(m.getShort());
  const autoSkillID_Initiative = m.getShort();
  for (let i = m.getByte(); i > 0; i--) m.getShort(); // fromItemSetData
  u8(m); // power (medicine)
  m.getShort(); // powerValue
  for (let i = m.getByte(); i > 0; i--) {
    u8(m); // titleInfos: power
    m.getShort(); // value
  }
  m.getByte(); // countrypowerValue
  const enchantValue = m.getInt();
  m.getByte(); // MoveWarehouseLevel
  return {
    id, name, title, sex, race, job, level, level2, exp2, expMax2, icon1, icon2, icon3, setting, countryName, exp,
    expMax, hp, mp, cp, sp, str, con, agi, ilt, wis, money1, money2, money3, killCount, Pkwincount, Pklosecount,
    masterFlag, partnerName, helpCountry, lovePlayer, arenaPoint, skyarenaPoint, combatPoint, vipLevel, vipLevel2,
    autoSkillID, autoSkillID_Initiative, enchantValue,
  };
}

/** Skill.fromBaseBytes; `withAddLevel` reads the extra byte of processDataPlayerSkillMsg(…, true). */
export function readSkill(m: Message): Skill {
  const s = new Skill();
  s.id = u16(m);
  s.level = m.getByte();
  s.name = m.getString();
  s.type = m.getByte();
  s.info = m.getString();
  s.skillWeapon = m.getByte();
  s.power1 = u8(m);
  s.powerValue1 = m.getShort();
  s.power2 = u8(m);
  s.powerValue2 = m.getShort();
  s.power3 = u8(m);
  s.powerValue3 = m.getShort();
  if (s.type !== 1) {
    s.skillAtkType = m.getByte();
    s.area = m.getByte();
    s.round = m.getByte();
    s.atk_time = m.getByte();
    s.useMP = u16(m);
    s.useHP = u16(m);
    m.getByte(); // anime1
    m.getShort(); // anime2
    m.getShort(); // anime3
    m.getByte(); // position
    s.statusBit1 = m.getByte();
    s.statusBit2 = m.getByte();
    s.statusBit3 = m.getByte();
  }
  s.isLearnByBook = m.getBoolean();
  return s;
}

/** MsgHandler.processDataPlayerSkillMsg. */
export function readSkillList(m: Message, withAddLevel: boolean): Skill[] {
  const list: Skill[] = [];
  for (let n = m.getShort(); n > 0; n--) {
    const s = readSkill(m);
    if (withAddLevel) s.addLevel = m.getByte();
    list.push(s);
  }
  return list;
}

/** MyPet.fromBytesDetail. */
export function readPetDetail(m: Message): PetDetail | null {
  const id = m.getByte();
  if (id < 0) return null;
  const name = m.getString();
  const level = m.getByte();
  const icon1 = m.getLong();
  const [hp, mp, exp, expMax] = [m.getInt(), m.getInt(), m.getInt(), m.getInt()];
  m.getInt(); // sp
  for (let i = 0; i < 5; i++) m.getShort(); // str … wis
  for (let i = 0; i < 4; i++) m.getByte(); // grow, compre, cp, growLevel
  m.getLong(); // age time
  m.getShort(); // petHitrate
  m.getByte(); // atkType
  m.getShort(); // atkMin
  m.getShort(); // atkMax
  m.getByte(); // petAtkTime
  const job = m.getByte();
  const grade = m.getByte();
  for (let i = m.getByte(); i > 0; i--) m.getShort(); // autoSkillID
  m.getShort(); // autoSkillID_Initiative
  const skills = readSkillList(m, false);
  m.getByte(); // vipLevel
  m.getLong(); // bornStatus
  const headIcon = m.getShort();
  return { id, name, level, icon1, hp, mp, exp, expMax, grade, job, skills, headIcon };
}

/** Item.fromItemAscensionStarInfo. */
function readAscension(m: Message, it: Item): void {
  for (let i = 0; i < 3; i++) m.getShort(); // def_str, def_agi, def_mag
  for (let i = 0; i < 3; i++) {
    u8(m); // power1..3
    m.getShort();
  }
  m.getString(); // skillDesc
  for (let i = 0; i < 2; i++) {
    u8(m); // bindPower1..2
    m.getShort();
  }
  if (it.getItemClass() === 1) {
    m.getByte(); // atkType
    m.getByte(); // atk_time
    m.getShort(); // atkMin
    m.getShort(); // atkMax
  }
  it.ascensionStar = m.getByte();
  it.star = m.getByte();
}

/** The tail shared by weapons (class 1) and armour (class 2), after the class-specific part. */
function readEquipTail(m: Message, it: Item): void {
  m.getByte(); // vipLevelReq
  for (let i = 0; i < 4; i++) m.getShort(); // enchantPower1/Value1/Power2/Value2
  it.isUpgradeItem = m.getBoolean();
  if (it.isUpgradeItem) for (let i = 0; i < 8; i++) m.getShort(); // power4..7 and values
  m.getByte(); // upgradeAscensionStar
  m.getByte(); // upgradeStar
}

/** Item.fromBytes: fromBytesAtts1 (bag state) then fromBytesAtts2 (the item's data by class). */
export function readItem(m: Message): Item {
  const it = new Item();
  it.quantity = m.getShort();
  m.getShort(); // durability
  it.attachDone = m.getByte();
  u8(m); // attachPower
  m.getShort(); // attachValue
  it.slotPos = m.getShort();
  const status = m.getShort();
  if ((status & 1) > 0) {
    // Item.isTimeItem: minutes left (an int for the fashion slot 17).
    const minutes = it.slotPos === 17 ? m.getInt() : u16(m);
    it.expireTime = Date.now() + minutes * 60000;
  }
  it.binded = (status & 2) !== 0;
  it.type = m.getByte();
  const cls = it.getItemClass();
  if (cls === 3) {
    it.id = 24;
    it.name = m.getString();
    it.bagIcon = u8(m);
    it.info = m.getString();
    it.grade = m.getByte();
    m.getByte(); // autoBinding
    it.icon = BigInt(m.getShort());
    it.reqLv = m.getByte();
    m.getByte(); // vipLevelReq
    return it;
  }
  it.id = u16(m);
  it.name = m.getString();
  it.bagIcon = u8(m);
  it.info = m.getString();
  it.grade = m.getByte();
  m.getByte(); // autoBinding
  it.stackNum = m.getByte();
  if (cls === 1 || cls === 2) {
    it.icon = BigInt(m.getShort());
    u16(m); // ownTime
    u8(m); // durMax
    it.price = m.getInt();
    m.getByte(); // attachCount
    it.itemSetID = m.getByte();
    it.reqLv = m.getByte();
    for (let i = 0; i < 5; i++) m.getShort(); // reqStr … reqWis
    readAscension(m, it);
    if (cls === 1) m.getByte(); // hitrate
    else if (it.type === 12) for (let i = 0; i < 3; i++) m.getLong(); // fashIcon1..3
    readEquipTail(m, it);
  } else if (cls === 4) {
    it.reqLv = m.getByte();
    u16(m); // ownTime
    u8(m); // durMax
    it.price = m.getInt();
    m.getByte(); // round
    m.getByte(); // area
    const power1 = u8(m);
    m.getShort();
    u8(m); // power2
    m.getShort();
    m.getByte(); // vipLevelReq
    if (power1 === 181) {
      u8(m); // power3
      m.getShort();
    }
  } else if (cls === 6) {
    it.price = m.getInt();
    u8(m); // power1
    m.getShort();
  } else if (cls === 5 || cls === 7) {
    it.price = m.getInt();
  }
  return it;
}

/** processPlayerEnterMsg after the status byte: the money tables, then processDataBlockFlagMsg. */
export function readEnterGame(m: Message): EnterGameData {
  const loginSetting = m.getInt();
  m.getByte(); // Skill.DELETE_SKILL_MONEY
  m.getInt();
  m.getByte(); // PlayerInfoUIAction.DEL_ARRTIBUTE
  m.getInt();
  m.getInt();
  m.getByte(); // Country.ACTIVATE_MONEY
  m.getInt();
  m.getByte(); // MyPet.PET_CHANGE_NAME_MONEY
  m.getShort();
  m.getByte(); // GameWorld.PARTNER_ADD_MONEY
  m.getInt();
  return { loginSetting, ...readDataBlocks(m) };
}

/**
 * processDataBlockFlagMsg: map id (mirror maps — Define.isAllocateMirrorMap — are not handled),
 * position, flags, then each block. Throws on a block it cannot read before the map.
 */
export function readDataBlocks(m: Message): Omit<EnterGameData, 'loginSetting'> {
  const mapId = m.getInt();
  const gx = m.getByte();
  const gy = m.getByte();
  const flags = m.getInt();
  const d: Omit<EnterGameData, 'loginSetting'> = {
    mapId, gx, gy, flags, player: null, pet: null, missionStatus: null, missions: [], items: [], skills: [],
    mapBytes: null, mapName: '', mapTip: '',
  };
  for (let bit = 0; bit < 32; bit++) {
    const block = flags & (1 << bit);
    if (block === 0) continue;
    switch (block) {
      case BLOCK_PLAYER_DETAIL:
        d.player = readPlayerDetail(m);
        d.pet = readPetDetail(m);
        if (m.getByte() > 0) throw new Error('Mercenary.fromBytesFull chưa được port');
        m.getBoolean(); // tab status 8192
        break;
      case BLOCK_MISSION_STATUS:
        d.missionStatus = m.getBytes();
        break;
      case BLOCK_MISSIONS:
        for (let n = m.getByte(); n > 0; n--) d.missions.push(m.getBytes());
        break;
      case BLOCK_ITEMS:
        for (let n = m.getShort(); n > 0; n--) d.items.push(readItem(m));
        break;
      case BLOCK_SKILLS:
        d.skills = readSkillList(m, true);
        break;
      case BLOCK_MAP_TEST:
      case BLOCK_MAP:
        d.mapBytes = m.getBytes();
        d.mapName = m.getString();
        d.mapTip = m.getString();
        m.getByte(); // Weather.update
        return d;
      default:
        throw new Error(`Khối dữ liệu ${block} chưa được port`);
    }
  }
  return d;
}
