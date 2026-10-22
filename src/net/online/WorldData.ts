// Reader for the world data reply (10503) block 1024: the map's NPCs, gzip-wrapped, in the format of
// NPC.loadNPC / NPC.fromBytes of client 1.2.0 (jadx decompile). NPC.readMissionNPCData is empty in
// 1.2.0, so mission NPCs (type 0) carry nothing after the common part.
// Blocks 2048 / 4096 carry the monster groups, monsters and their AI (MsgHandler
// processDataMonsterGroupMsg / processDataMonsterMsg / processDataMonsterAIMsg).
import { Monster } from '../../game/actor/Monster';
import { MonsterAI } from '../../game/battle/MonsterAI';
import { DataInputStream } from '../../game/common/DataStream';
import { MonsterGroup } from '../../game/core/MonsterGroup';
import type { Skill } from '../../game/core/Skill';
import { Message } from '../Message';
import { readSkill } from './EnterGame';

export const BLOCK_NPC = 1024;
export const BLOCK_MONSTER_GROUPS = 2048;
export const BLOCK_MONSTERS = 4096;

/** A menu entry of a "power" NPC (type 5): its text, target id and the mission state it needs. */
export interface NpcMenu {
  text: string;
  id: number;
  reqMissionID: number;
  reqMissionState: number;
  gx?: number;
  gy?: number;
}

export interface NpcData {
  /** NPC.readNPCSign: quest sign 0..4 (out-of-range values become 0). */
  sign: number;
  id: number;
  missionGroupID: number;
  npcType: number;
  /** Sprite id (NPC.icon1). */
  icon1: number;
  businessIcon: number;
  name: string;
  welcome: string;
  talkDetail: string;
  status: number;
  dir: number;
  gx: number;
  gy: number;
  rangeX: number;
  rangeY: number;
  missionData: number[] | null;
  topic: string;
  battleID: number[];
  comeOutTime: number;
  shopID: number[];
  teacherId: number[];
  jumpMap: NpcMenu[];
  menuBattle: NpcMenu[];
  menuShop: NpcMenu[];
  menuTeacher: NpcMenu[];
}

function readMenus(dis: DataInputStream, withPos: boolean): NpcMenu[] {
  const out: NpcMenu[] = [];
  for (let n = dis.readByte(); n > 0; n--) {
    const text = dis.readUTF();
    const id = dis.readShort();
    const pos = withPos ? { gx: dis.readByte(), gy: dis.readByte() } : {};
    out.push({ text, id, ...pos, reqMissionID: dis.readShort(), reqMissionState: dis.readByte() });
  }
  return out;
}

/** NPC.fromBytes. */
export function readNpc(dis: DataInputStream): NpcData {
  const sign = dis.readByte();
  const npc: NpcData = {
    sign: sign < 0 || sign > 4 ? 0 : sign,
    id: dis.readByte(),
    missionGroupID: dis.readByte(),
    npcType: dis.readByte(),
    icon1: dis.readShort(),
    businessIcon: dis.readShort(),
    name: dis.readUTF(),
    welcome: dis.readUTF(),
    talkDetail: dis.readUTF(),
    status: dis.readByte() & 0xff,
    dir: dis.readByte(),
    gx: dis.readByte(),
    gy: dis.readByte(),
    rangeX: dis.readByte(),
    rangeY: dis.readByte(),
    missionData: null,
    topic: '',
    battleID: [],
    comeOutTime: 0,
    shopID: [],
    teacherId: [],
    jumpMap: [],
    menuBattle: [],
    menuShop: [],
    menuTeacher: [],
  };
  if ((npc.status & 8) !== 0) {
    // NPC.isUseMissionData
    npc.missionData = [dis.readShort(), dis.readByte(), dis.readShort(), dis.readByte()];
  }
  switch (npc.npcType) {
    case 1:
      npc.battleID = [dis.readShort()];
      npc.comeOutTime = dis.readByte() & 0xff;
      break;
    case 2:
      npc.topic = dis.readUTF();
      npc.shopID = [dis.readShort()];
      break;
    case 3: {
      npc.topic = dis.readUTF();
      const id = dis.readShort();
      npc.jumpMap = [{ text: npc.topic, id, gx: dis.readByte(), gy: dis.readByte(), reqMissionID: 0, reqMissionState: 0 }];
      break;
    }
    case 5:
      npc.jumpMap = readMenus(dis, true);
      npc.menuBattle = readMenus(dis, false);
      npc.menuShop = readMenus(dis, false);
      npc.menuTeacher = readMenus(dis, false);
      break;
    case 7:
      npc.topic = dis.readUTF();
      npc.teacherId = [dis.readShort()];
      break;
    case 9:
      npc.topic = dis.readUTF();
      break;
  }
  return npc;
}

/** NPC.loadNPC: an unsigned count, then the NPCs. */
export function readNpcList(data: Uint8Array): NpcData[] {
  const dis = new DataInputStream(data);
  const out: NpcData[] = [];
  for (let n = dis.readByte() & 0xff; n > 0; n--) out.push(readNpc(dis));
  return out;
}

/** GZIP.inflate: gzip data is inflated, anything else is used as is (Java catches the failure too). */
export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (data.length < 2 || data[0] !== 0x1f || data[1] !== 0x8b) return data;
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface WorldData {
  npcs: NpcData[];
  groups: MonsterGroup[];
  monsters: Monster[];
}

/** processDataMonsterMsg then processDataMonsterAIMsg (only when monsters came). */
function readMonsters(m: Message, out: Monster[]): void {
  const n = m.getByte();
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const o = Monster.fromBytes(m);
    if (o != null) out.push(o);
  }
  const skills: Skill[] = [];
  for (let i = m.getByte(); i > 0; i--) skills.push(readSkill(m));
  for (let i = m.getByte(); i > 0; i--) {
    const ai = MonsterAI.fromBytes(m, skills);
    const o = out.find((x) => x.id === ai.id);
    if (o != null) o.monsterAI = ai;
  }
}

/**
 * The 10503 reply for blocks 1024 (NPCs), 2048 (monster groups) and 4096 (monsters): status,
 * header, then the blocks in bit order. Other blocks are not expected here.
 */
export async function readWorldData(m: Message): Promise<WorldData> {
  if (m.getByte() !== 0) throw new Error(m.getString());
  m.getInt(); // map id
  m.getByte(); // gx
  m.getByte(); // gy
  const flags = m.getInt();
  const known = BLOCK_NPC | BLOCK_MONSTER_GROUPS | BLOCK_MONSTERS;
  if ((flags & ~known) !== 0) throw new Error(`10503: khối ${flags & ~known} chưa hỗ trợ`);
  const out: WorldData = { npcs: [], groups: [], monsters: [] };
  if (flags & BLOCK_NPC) out.npcs = readNpcList(await gunzip(m.getBytes()));
  if (flags & BLOCK_MONSTER_GROUPS) for (let i = m.getByte(); i > 0; i--) out.groups.push(MonsterGroup.fromBytes(m));
  if (flags & BLOCK_MONSTERS) readMonsters(m, out.monsters);
  return out;
}

/** The 10503 reply when only block 1024 was asked for. */
export async function readWorldNpcs(m: Message): Promise<NpcData[]> {
  return (await readWorldData(m)).npcs;
}
