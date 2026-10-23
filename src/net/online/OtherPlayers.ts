// Other players on the map, as client 1.2.0 reads them (jadx decompile): MsgHandler
// processDataPlayerListBase (Model.fromBytes, MyPet.fromBytesOtherPlayer, Mercenary.fromBytesSimple,
// remark, enchant value, pet icon) used by data block 64 and by 10501 (a player enters the map),
// processDataTeamMsg (the teams after block 64), 10502 (a player leaves) and 10505 (positions).
import { Message } from '../Message';

export const MSG_ENTER_MAP = 10501;
export const MSG_LEAVE_MAP = 10502;
export const MSG_OTHER_MOVE = 10505;

/** Mercenary.fromBytesSimpleData: id (negative = none) and the three icons. */
export interface MercenaryLook {
  id: number;
  icon1: bigint;
  icon2: bigint;
  icon3: bigint;
}

export interface OtherPlayerData {
  vipLevel2: number;
  vipLevel3: number;
  vip2LevelOverdue: number;
  maxVIP: number;
  id: number;
  name: string;
  info: string;
  title: string;
  level: number;
  level2: number;
  icon1: bigint;
  icon2: bigint;
  icon3: bigint;
  setting: number;
  status: number;
  /** Model.mode: 1 = stall (shopName / shopType follow). */
  mode: number;
  shopName: string;
  shopType: number;
  /** -1 = no country. */
  countryId: number;
  countryName: string;
  countryRank: number;
  gx: number;
  gy: number;
  vipLevel: number;
  /** MyPet.fromBytesOtherPlayer: id byte (negative = no pet), name, look. */
  pet: { id: number; name: string; icon1: bigint } | null;
  mercenaries: { groupId: number; look: MercenaryLook | null; pet: MercenaryLook | null }[];
  remark: string;
  enchantValue: number;
  iconpet1: number;
}

function readMercenaryLook(m: Message): MercenaryLook | null {
  const id = m.getInt();
  if (id < 0) return null;
  return { id, icon1: m.getLong(), icon2: m.getLong(), icon3: m.getLong() };
}

/** processDataPlayerListBase. */
export function readOtherPlayer(m: Message): OtherPlayerData {
  const d = {
    vipLevel2: m.getByte(),
    vipLevel3: m.getByte(),
    vip2LevelOverdue: m.getByte(),
    maxVIP: m.getByte(),
    id: m.getInt(),
    name: m.getString(),
    info: m.getString(),
    title: m.getString(),
    level: m.getByte(),
    level2: m.getByte(),
    icon1: m.getLong(),
    icon2: m.getLong(),
    icon3: m.getLong(),
    setting: m.getInt(),
    status: m.getInt(),
    mode: m.getByte(),
    shopName: '',
    shopType: 0,
    countryId: -1,
    countryName: '',
    countryRank: 0,
    gx: 0,
    gy: 0,
    vipLevel: 0,
  } as OtherPlayerData;
  if (d.mode === 1) {
    d.shopName = m.getString();
    d.shopType = m.getByte();
  }
  d.countryId = m.getInt();
  if (d.countryId >= 0) {
    d.countryName = m.getString();
    d.countryRank = m.getByte();
  }
  d.gx = m.getByte();
  d.gy = m.getByte();
  d.vipLevel = m.getByte();
  const petId = m.getByte();
  d.pet = petId < 0 ? null : { id: petId, name: m.getString(), icon1: m.getLong() };
  d.mercenaries = [];
  for (let n = m.getByte(); n > 0; n--) {
    const groupId = m.getShort();
    const look = readMercenaryLook(m);
    d.mercenaries.push({ groupId, look, pet: readMercenaryLook(m) });
  }
  d.remark = m.getString();
  d.enchantValue = m.getInt();
  d.iconpet1 = m.getShort();
  return d;
}

/** processDataTeamMsg: [leader id, member ids] per team. */
export function readTeams(m: Message): [number, number[]][] {
  const out: [number, number[]][] = [];
  for (let n = m.getShort(); n > 0; n--) {
    const leader = m.getInt();
    const members: number[] = [];
    for (let k = m.getByte(); k > 0; k--) members.push(m.getInt());
    out.push([leader, members]);
  }
  return out;
}

/** processOtherMoveTo: (id, gx, gy, mode) per player. */
export function readOtherMoves(m: Message): { id: number; gx: number; gy: number; mode: number }[] {
  const out = [];
  for (let n = m.getShort(); n > 0; n--) out.push({ id: m.getInt(), gx: m.getByte(), gy: m.getByte(), mode: m.getByte() });
  return out;
}
