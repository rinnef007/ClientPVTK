// The login sequence of GameCanvas (stages version check → CMN login → area list → game server →
// character list / create → enter game) against the user's backend, plus the world data request the
// client makes on entering a map (players, then NPCs, monsters and map images). The Android client opens a new socket to the
// line's sockUrl after the area list; through the WebSocket bridge the same connection is kept,
// which the backend accepts (it checks the session id and ukey of message 1).
import { BLOCK_PLAYERS, NEW_SCENE_DATA_FLAG, readDataBlocks, readEnterGame, type EnterGameData } from './EnterGame';
import {
  createAddPlayerMsg, createAreaLineListMsg, createCheckEditionMsg, createFirstGameServerMsg, createPlayerEnterMsg,
  createPlayerListMsg, createUserLoginMsg, createWorldDataMsg, readAddPlayer, readAreaLineList, readCheckEdition,
  readFirstGameServer, readPlayerEnterStatus, readPlayerList, readUserLogin, type ListPlayer, type NewPlayer,
} from './LoginMessages';
import type { OnlineSession } from './OnlineSession';
import { readWorldData, type NpcData } from './WorldData';
import type { OtherPlayerData } from './OtherPlayers';
import type { Message } from '../Message';
import type { Monster } from '../../game/actor/Monster';
import type { MonsterGroup } from '../../game/core/MonsterGroup';

export interface OnlineWorld {
  session: OnlineSession;
  character: ListPlayer;
  enter: EnterGameData;
  npcs: NpcData[];
  /** The battles of the map's monster NPCs (blocks 2048 / 4096); replaced on a map change. */
  groups: MonsterGroup[];
  monsters: Monster[];
  /** Block 64: the other players on the map and their teams. */
  players: OtherPlayerData[];
  teams: [number, number[]][];
  /** Block 8192: map images to fetch with 10536. */
  mapImageIds: number[];
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
  // GameCanvas.doConnWorld (stage 14): the players of the map; doMapImage (stage 15): NPCs,
  // monsters and map images (Define.NEW_SCENE_DATA_FLAG).
  o.onStep('Tải người chơi…');
  const others = readPlayersBlock(await session.request(createWorldDataMsg(enter.mapId, false, BLOCK_PLAYERS)));
  o.onStep('Tải NPC và quái…');
  const world = await readWorldData(await session.request(createWorldDataMsg(enter.mapId, false, NEW_SCENE_DATA_FLAG)));
  return {
    session, character, enter, npcs: world.npcs, groups: world.groups ?? [], monsters: world.monsters ?? [],
    players: others.players ?? [], teams: others.teams, mapImageIds: world.mapImageIds, areaName,
  };
}

/** processWorldDataMsg for block 64: the players and teams (a refusal leaves the map empty). */
function readPlayersBlock(m: Message): { players: OtherPlayerData[] | null; teams: [number, number[]][] } {
  if (m.getByte() !== 0) return { players: null, teams: [] };
  const d = readDataBlocks(m);
  return { players: d.players, teams: d.teams };
}
