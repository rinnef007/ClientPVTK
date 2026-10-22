// Mission requests and replies of client 1.2.0 (MsgHandler.createGetMissionDataMsg /
// createTastAcceptMsg / createTaskDeliverMsg / createTaskAbandonMsg, processMissionNPCStatus,
// processMissionReward, processUpLevelMsg, processAddItemMsg; NPC.doGetMissionData; jadx decompile).
import { PlayerBag } from '../../game/actor/Item';
import { ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, type Player } from '../../game/actor/Player';
import { Mission } from '../../game/core/Mission';
import { processUpLevelMsg } from '../../game/main/LevelUp';
import { PowerString } from '../../game/string/PowerString';
import { Message } from '../Message';
import { readItem } from './EnterGame';
import { ServerError } from './LoginMessages';

export const MSG_NPC_MISSION_DATA = 14501;
export const MSG_MISSION_ACCEPT = 14502;
export const MSG_MISSION_DELIVER = 14503;
export const MSG_MISSION_ABANDON = 14504;

/** A status byte; non-zero throws with the server's text (UIHandler.alertMessage in Java). */
export function checkStatus(m: Message): void {
  const b = m.getByte();
  if (b !== 0) throw new ServerError(m.remaining > 2 ? m.getString() : `Lỗi ${b}`);
}

/**
 * createGetMissionDataMsg: the NPC, then the monster groups and monsters the client already has
 * (none: the web client keeps no monster data yet, so the server may send them all).
 */
export function createGetMissionDataMsg(npcId: number): Message {
  const m = new Message(MSG_NPC_MISSION_DATA);
  m.putShort(npcId);
  m.putByte(0);
  m.putByte(0);
  return m;
}

/** NPC.doGetMissionData: the NPC's missions (the monster data after them is not read). */
export function readMissionData(m: Message): Mission[] {
  const n = m.getByte();
  if (n < 0) throw new ServerError(m.getString());
  const out: Mission[] = [];
  for (let i = 0; i < n; i++) out.push(Mission.fromBytes(m.getBytes()));
  return out;
}

export function createTaskAcceptMsg(npcId: number, missionId: number): Message {
  const m = new Message(MSG_MISSION_ACCEPT);
  m.putShort(npcId);
  m.putShort(missionId);
  return m;
}

/** createTaskDeliverMsg: the chosen reward item id, or -1. */
export function createTaskDeliverMsg(npcId: number, missionId: number, itemId = -1): Message {
  const m = new Message(MSG_MISSION_DELIVER);
  m.putShort(npcId);
  m.putShort(missionId);
  m.putInt(itemId);
  return m;
}

export function createTaskAbandonMsg(missionId: number): Message {
  const m = new Message(MSG_MISSION_ABANDON);
  m.putShort(missionId);
  return m;
}

/** processMissionNPCStatus: (npc id, sign) pairs. */
export function readNpcStatus(m: Message): [number, number][] {
  const out: [number, number][] = [];
  for (let n = m.getByte(); n > 0; n--) out.push([m.getByte(), m.getByte()]);
  return out;
}

/** MsgHandler.processUpLevelMsg (1.2.0): the first level, then the god level (read and dropped). */
export function readUpLevel(m: Message, p: Player): string {
  const exp = m.getInt();
  const levels = m.getByte();
  let newExp = 0;
  let newExpMax = 0;
  let skillPoints = 0;
  let attrPoints = 0;
  if (levels > 0) {
    newExp = m.getInt();
    newExpMax = m.getInt();
    skillPoints = m.getShort();
    attrPoints = m.getByte();
  }
  const text = processUpLevelMsg(p, { exp, levels, newExp, newExpMax, skillPoints, attrPoints });
  m.getInt(); // god exp
  if (m.getByte() > 0) {
    m.getInt(); // god exp after the level-up
    m.getInt(); // god exp max
  }
  return text;
}

/** processAddItemMsg: new items (kind 1) or more of a bag slot (kind 2), and the text listing them. */
export function readAddItems(m: Message, bag: PlayerBag): string {
  let s = '';
  for (let n = m.getByte(); n > 0; n--) {
    const kind = m.getByte();
    const count = m.getByte();
    let name = '';
    if (kind === 1) {
      m.getShort();
      const it = readItem(m);
      // PlayerBag.addItem: the web bag finds the slot itself (stacking by stackNum).
      bag.addItem(it, count);
      name = it.getNameInfo();
    } else if (kind === 2) {
      m.getInt();
      const it = bag.getItem(m.getShort());
      if (it) {
        it.quantity += count;
        name = it.getNameInfo();
      }
    }
    if (count > 0 && name) s += `${name} x ${count}\n`;
  }
  return s;
}

export interface MissionReward {
  finished: boolean;
  text: string;
}

/**
 * processMissionReward: finished flag, costs, Lá / Bạc, the level-up block, pet reward, items taken
 * and given, then the city / country rewards (read, only honour shown). Applies everything to `p`.
 */
export function readMissionReward(m: Message, p: Player, missionId: number): MissionReward {
  const finished = m.getBoolean();
  if (finished) Mission.setMissionStatus(p, missionId, true);
  const bag = p.bag ?? (p.bag = new PlayerBag());
  const cost1 = m.getShort();
  const cost2 = m.getInt();
  const cost3 = m.getInt();
  if (cost1 > 0) p.addValue(ATTR_MONEY1, -cost1);
  if (cost2 > 0) p.addValue(ATTR_MONEY2, -cost2);
  if (cost3 > 0) p.addValue(ATTR_MONEY3, -cost3);
  let s = '';
  const la = m.getInt();
  if (la > 0) {
    p.addValue(ATTR_MONEY2, la);
    s += PowerString.makeColorString(`Lá${la} `, 16776960);
  }
  const bac = m.getInt();
  if (bac > 0) {
    p.addValue(ATTR_MONEY3, bac);
    s += PowerString.makeColorString(`Bạc${bac} `, 16776960);
  }
  s += readUpLevel(m, p);
  if (m.getBoolean()) throw new Error('parsePetReward chưa được port');
  for (let n = m.getByte(); n > 0; n--) {
    m.getInt();
    const slot = m.getByte() & 0xff;
    const count = m.getByte();
    const it = bag.getItem(slot);
    if (it) {
      it.quantity -= count;
      if (it.quantity <= 0) bag.setItem(slot, null);
    }
  }
  s += readAddItems(m, bag);
  m.getBoolean(); // city refresh
  if (m.getBoolean()) {
    const honour = m.getInt();
    if (honour > 0) s += `Độ Cống Hiến ${honour}\n`; // STR_MISSION_REWARD_HONOR2
    for (let i = 0; i < 10; i++) m.getShort(); // city / country rewards
  }
  return { finished, text: s };
}
