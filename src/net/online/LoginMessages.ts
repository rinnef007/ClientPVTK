// The login requests and replies of client 1.2.0 (MsgHandler.createCheckEditionMsg / createUserLoginMsg
// / createAreaLineListMsg / createFirstGameServerMsg / createPLayerListMsg / createAddPlayerMsg /
// createPlayerEnterMsg and the matching process*Msg, getMessagePlayer, ServerInfo.fromAreaBytes /
// fromLineBytes; jadx decompile). The web client only talks to the user's own backend: the CMN
// token is a fixed placeholder (the backend accepts any token) and the official test IP the Android
// client sends in createUserLoginMsg is left empty.
import { Message } from '../Message';

export const MSG_FIRST_GAME_SERVER = 1;
export const MSG_PLAYER_ENTER = 2;
export const MSG_CHECK_EDITION = 5000;
export const MSG_USER_LOGIN = 5002;
export const MSG_AREA_LINE_LIST = 5007;
export const MSG_PLAYER_LIST = 10001;
export const MSG_ADD_PLAYER = 10002;
export const MSG_WORLD_DATA = 10503;

/** GameWorld.GAME_ID / VERSION / CP_ID and Define.LOGIN_DATA_FLAG of the client the backend expects. */
export const GAME_ID = 1000;
export const VERSION = 360075;
export const CP_ID = 111;
export const LOGIN_DATA_FLAG = 22085694;
/** GameWorld.handset. */
export const HANDSET = 'web';
/** Stands in for the CMN SDK token, which the web client does not have. */
export const WEB_TOKEN = 'web-local';

/** A reply whose status byte is not 0, carrying the server's message. */
export class ServerError extends Error {}

/** Reads the status byte; a non-zero status throws with the string that follows. */
function checkStatus(m: Message): void {
  const b = m.getByte();
  if (b !== 0) throw new ServerError(m.remaining > 2 ? m.getString() : `Lỗi ${b}`);
}

export function createCheckEditionMsg(): Message {
  const m = new Message(MSG_CHECK_EDITION);
  m.putShort(GAME_ID);
  m.putInt(VERSION);
  m.putInt(CP_ID);
  m.putByte(5);
  m.putString(HANDSET);
  m.putByte(0);
  m.putByte(2);
  return m;
}

/** processCheckEditionMsg: 1 = update needed (text, url), 2 = refused (text); 0 goes on. */
export function readCheckEdition(m: Message): void {
  const b = m.getByte();
  if (b === 1) throw new ServerError(`${m.getString()}`);
  if (b === 2) throw new ServerError(m.getString());
}

export function createUserLoginMsg(deviceId: string): Message {
  const m = new Message(MSG_USER_LOGIN);
  m.putString(WEB_TOKEN);
  m.putLong(BigInt(Date.now()));
  m.putString('');
  m.putString(HANDSET);
  m.putString(deviceId);
  return m;
}

export interface LoginReply {
  ukey: bigint;
  sessionID: number;
}

/** processUserLoginMsg. */
export function readUserLogin(m: Message): LoginReply {
  checkStatus(m);
  const ukey = m.getLong();
  const sessionID = m.getInt();
  return { ukey, sessionID };
}

export function createAreaLineListMsg(): Message {
  return new Message(MSG_AREA_LINE_LIST);
}

export interface ServerLine {
  id: number;
  name: string;
  sockUrl: string;
  stateStr: string;
}

export interface ServerArea {
  id: number;
  name: string;
  actorCount: number;
  stateStr: string;
  lines: ServerLine[];
}

/** processAreaLineListMsg with ServerInfo.fromAreaBytes / fromLineBytes. */
export function readAreaLineList(m: Message): ServerArea[] {
  const areas: ServerArea[] = [];
  for (let a = m.getByte(); a > 0; a--) {
    const id = m.getShort();
    const name = m.getString();
    const actorCount = m.getByte();
    m.getByte(); // state
    const stateStr = m.getString();
    m.getString(); // tag
    m.getBoolean(); // isNeedSpecialCode
    const lines: ServerLine[] = [];
    for (let l = m.getByte(); l > 0; l--) {
      const lineId = m.getShort();
      const lineName = m.getString();
      const sockUrl = m.getString();
      m.getString(); // wapSocketUrl
      m.getString(); // httpUrl
      m.getByte(); // state
      lines.push({ id: lineId, name: lineName, sockUrl, stateStr: m.getString() });
    }
    areas.push({ id, name, actorCount, stateStr, lines });
  }
  return areas;
}

export function createFirstGameServerMsg(login: LoginReply): Message {
  const m = new Message(MSG_FIRST_GAME_SERVER);
  m.putLong(login.ukey);
  m.putInt(login.sessionID);
  m.putByte(5);
  m.putInt(VERSION);
  m.putByte(2);
  return m;
}

export function readFirstGameServer(m: Message): void {
  checkStatus(m);
}

export function createPlayerListMsg(): Message {
  return new Message(MSG_PLAYER_LIST);
}

/** ListPlayer as getMessagePlayer reads it. */
export interface ListPlayer {
  id: number;
  name: string;
  sex: number;
  race: number;
  job: number;
  level: number;
  mapName: string;
  icon1: bigint;
  icon2: bigint;
  icon3: bigint;
  status: number;
}

/** MsgHandler.getMessagePlayer. */
export function readListPlayer(m: Message): ListPlayer {
  const id = m.getInt();
  const name = m.getString();
  const [sex, race, job, level] = [m.getByte(), m.getByte(), m.getByte(), m.getByte()];
  m.getByte(); // vipLevel2
  m.getByte(); // vipLevel3
  const mapName = m.getString();
  const [icon1, icon2, icon3] = [m.getLong(), m.getLong(), m.getLong()];
  const status = m.getInt();
  if (status & 4) m.getShort(); // deletion countdown (minutes)
  if (status & 512 && !m.getBoolean()) {
    m.getShort(); // lock countdown
    m.getString(); // lock reason
  }
  return { id, name, sex, race, job, level, mapName, icon1, icon2, icon3, status };
}

/** processListPlayerMsg. */
export function readPlayerList(m: Message): ListPlayer[] {
  const out: ListPlayer[] = [];
  for (let n = m.getByte(); n > 0; n--) out.push(readListPlayer(m));
  return out;
}

export interface NewPlayer {
  sex: number;
  race: number;
  job: number;
  icons: [bigint, bigint, bigint];
  name: string;
}

export function createAddPlayerMsg(p: NewPlayer, deviceId: string): Message {
  const m = new Message(MSG_ADD_PLAYER);
  m.putByte(p.sex);
  m.putByte(p.race);
  m.putByte(p.job);
  for (const icon of p.icons) m.putLong(icon);
  m.putString(p.name);
  m.putString(deviceId);
  return m;
}

/** processAddPlayerMsg: the new character. */
export function readAddPlayer(m: Message): ListPlayer {
  checkStatus(m);
  return readListPlayer(m);
}

export function createPlayerEnterMsg(playerId: number, loginSetting: number, deviceId: string): Message {
  const m = new Message(MSG_PLAYER_ENTER);
  m.putInt(playerId);
  m.putInt(LOGIN_DATA_FLAG);
  m.putInt(loginSetting);
  m.putString('');
  m.putByte(2);
  m.putString('');
  m.putString(deviceId);
  m.putString(''); // phone
  return m;
}

/**
 * MsgHandler.createWorldDataMessage: map id, refresh flag, wanted blocks, then the map images still
 * needed (only with block 8192, which is not asked for here, so an empty list).
 */
export function createWorldDataMsg(mapId: number, refresh: boolean, flags: number): Message {
  const m = new Message(MSG_WORLD_DATA);
  m.putShort(mapId);
  m.putBoolean(refresh);
  m.putInt(flags);
  m.putByte(0);
  return m;
}

/** processPlayerEnterMsg's status byte (the data follows; see EnterGame.readEnterGame). */
export function readPlayerEnterStatus(m: Message): void {
  checkStatus(m);
}
