// The login sequence of GameCanvas (stages version check → CMN login → area list → game server →
// character list / create → enter game) against the user's backend, plus the world data request the
// client makes on entering a map (NPCs only for now). The Android client opens a new socket to the
// line's sockUrl after the area list; through the WebSocket bridge the same connection is kept,
// which the backend accepts (it checks the session id and ukey of message 1).
import { readEnterGame, type EnterGameData } from './EnterGame';
import {
  createAddPlayerMsg, createAreaLineListMsg, createCheckEditionMsg, createFirstGameServerMsg, createPlayerEnterMsg,
  createPlayerListMsg, createUserLoginMsg, createWorldDataMsg, readAddPlayer, readAreaLineList, readCheckEdition,
  readFirstGameServer, readPlayerEnterStatus, readPlayerList, readUserLogin, type ListPlayer, type NewPlayer,
} from './LoginMessages';
import type { OnlineSession } from './OnlineSession';
import { BLOCK_NPC, readWorldNpcs, type NpcData } from './WorldData';

export interface OnlineWorld {
  session: OnlineSession;
  character: ListPlayer;
  enter: EnterGameData;
  npcs: NpcData[];
  areaName: string;
}

export interface LoginOptions {
  url: string;
  deviceId: string;
  /** Used when the account has no character yet. */
  newPlayer: () => NewPlayer;
  onStep: (text: string) => void;
}

export async function runLogin(session: OnlineSession, o: LoginOptions): Promise<OnlineWorld> {
  o.onStep(`Kết nối ${o.url}…`);
  await session.open(o.url);
  o.onStep('Kiểm tra phiên bản…');
  readCheckEdition(await session.request(createCheckEditionMsg()));
  o.onStep('Đăng nhập…');
  const login = readUserLogin(await session.request(createUserLoginMsg(o.deviceId)));
  const areas = readAreaLineList(await session.request(createAreaLineListMsg()));
  const areaName = areas[0]?.name ?? '';
  o.onStep(`Vào khu ${areaName || '(không tên)'}…`);
  readFirstGameServer(await session.request(createFirstGameServerMsg(login)));
  const list = readPlayerList(await session.request(createPlayerListMsg()));
  let character = list[0];
  if (character == null) {
    const p = o.newPlayer();
    o.onStep(`Tạo nhân vật ${p.name}…`);
    character = readAddPlayer(await session.request(createAddPlayerMsg(p, o.deviceId)));
  }
  o.onStep(`Vào game: ${character.name}…`);
  const reply = await session.request(createPlayerEnterMsg(character.id, 0, o.deviceId));
  readPlayerEnterStatus(reply);
  const enter = readEnterGame(reply);
  o.onStep('Tải NPC…');
  const npcs = await readWorldNpcs(await session.request(createWorldDataMsg(enter.mapId, false, BLOCK_NPC)));
  return { session, character, enter, npcs, areaName };
}
