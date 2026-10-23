// Path finding of client 1.2.0 (jadx decompile): 10518 asks the server for the way to an NPC
// (MsgHandler.createAutoMoveMsg: mode 1 an NPC of a map, 2 a mission, 3 an activity / route id) and
// the reply lists the map crossings (Player.fromBytesByAutoMove).
import { Message } from '../Message';

export const MSG_AUTO_MOVE = 10518;
/** Mission.AUTO_MOVE_ERROR26 / 27: refusals shown without a message box. */
export const AUTO_MOVE_SILENT_ERRORS = [-26, -27];

/** createAutoMoveMsg(int, int): mode 1, map id and NPC id. */
export function createAutoMoveToNpcMsg(mapId: number, npcId: number): Message {
  const m = new Message(MSG_AUTO_MOVE);
  m.putByte(1);
  m.putShort(mapId);
  m.putByte(npcId);
  return m;
}

/** createAutoMoveMsg(int): mode 2, a mission id (Mission.doMissionAutoPathMsg). */
export function createAutoMoveMissionMsg(missionId: number): Message {
  const m = new Message(MSG_AUTO_MOVE);
  m.putByte(2);
  m.putShort(missionId);
  return m;
}

/** createAutoMoveMsg(Short): mode 3, an activity's route id. */
export function createAutoMoveRouteMsg(routeId: number): Message {
  const m = new Message(MSG_AUTO_MOVE);
  m.putByte(3);
  m.putShort(routeId);
  return m;
}

export interface AutoMoveRoute {
  /** Walk to (gx, gy), then jump to map `mapId` at (toGx, toGy). */
  legs: { gx: number; gy: number; mapId: number; toGx: number; toGy: number }[];
  /** The last cell (the NPC) on the final map. */
  gx: number;
  gy: number;
}

export class AutoMoveError extends Error {
  constructor(readonly code: number, text: string) {
    super(text);
  }
}

/** The status byte (negative: refused with a text), then Player.fromBytesByAutoMove's data. */
export function readAutoMove(m: Message): AutoMoveRoute {
  const st = m.getByte();
  if (st < 0) throw new AutoMoveError(st, m.getString());
  const legs = [];
  for (let n = m.getByte(); n > 0; n--) legs.push({ gx: m.getByte(), gy: m.getByte(), mapId: m.getShort(), toGx: m.getByte(), toGy: m.getByte() });
  return { legs, gx: m.getByte(), gy: m.getByte() };
}
