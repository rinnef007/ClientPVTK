// World map messages of client 1.2.0 (jadx decompile): 10521 the regions (WorldMap.doEnterWorldMap /
// fromBytes), 10522 a region's maps (doGetMapList / fromListBytes), 10523 entering one of them
// (WorldMap.doJumpMap: maybe a used teleport stone, then processDataBlockFlagMsg).
import { Message } from '../Message';
import { BLOCK_PLAYERS, readDataBlocks } from './EnterGame';
import type { MapBlocks } from './MapMessages';

export const MSG_WORLD_MAP = 10521;
export const MSG_WORLD_MAP_LIST = 10522;
export const MSG_WORLD_MAP_ENTER = 10523;

/** ObjectData.createWorldMapPosObject: a region dot. status 1 = event, 2 = done. */
export interface WorldMapRegion {
  id: number;
  x: number;
  y: number;
  name: string;
  status: number;
}

/** ObjectData.createWorldMapObject: a map of a region; needStone 1 = "Cần đá dịch chuyển". */
export interface WorldMapEntry {
  id: number;
  name: string;
  desc: string;
  status: number;
  needStone: number;
}

export function createWorldMapMsg(): Message {
  return new Message(MSG_WORLD_MAP);
}

export function createWorldMapListMsg(regionId: number): Message {
  const m = new Message(MSG_WORLD_MAP_LIST);
  m.putInt(regionId);
  return m;
}

/** createWorldMapEnterMsg: the map id and the blocks wanted (64, the players). */
export function createWorldMapEnterMsg(mapId: number): Message {
  const m = new Message(MSG_WORLD_MAP_ENTER);
  m.putInt(mapId);
  m.putInt(BLOCK_PLAYERS);
  return m;
}

/** WorldMap.fromBytes. */
export function readWorldMap(m: Message): WorldMapRegion[] {
  const out: WorldMapRegion[] = [];
  for (let n = m.getByte(); n > 0; n--) {
    out.push({ id: m.getByte() & 0xff, x: m.getShort(), y: m.getShort(), name: m.getString(), status: m.getByte() });
  }
  return out;
}

/** WorldMap.fromListBytes. */
export function readWorldMapList(m: Message): WorldMapEntry[] {
  const out: WorldMapEntry[] = [];
  for (let n = m.getByte(); n > 0; n--) {
    out.push({ id: m.getShort(), name: m.getString(), desc: m.getString(), status: m.getByte(), needStone: m.getByte() });
  }
  return out;
}

/**
 * WorldMap.doJumpMap's reply: 1 = a teleport stone was used (bag slot, item id), then the data
 * blocks. Java has no refusal branch here; a negative first byte is read as a refusal with its text
 * (an assumption of the web port, so a server error does not misread the blocks).
 */
export function readWorldMapEnter(m: Message): { blocks: MapBlocks; usedItem: { slot: number; id: number } | null } {
  const b = m.getByte();
  if (b < 0) throw new Error(m.getString());
  const usedItem = b === 1 ? { slot: m.getShort(), id: m.getInt() } : null;
  return { blocks: readDataBlocks(m), usedItem };
}
