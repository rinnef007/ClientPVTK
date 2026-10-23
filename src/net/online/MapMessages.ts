// Map change messages of client 1.2.0 (jadx decompile): 10506 jumps to another map
// (MsgHandler.createJumpMapMessage / processJumpMapMsg, sent by GameWorld.doJumpMap through stage 12)
// and 10536 fetches map images listed in data block 8192 (processDataMapImageMsg).
import { Message } from '../Message';
import { BLOCK_PLAYERS, readDataBlocks, type EnterGameData } from './EnterGame';

export const MSG_GO_MAP = 10506;
export const MSG_MAP_IMAGE = 10536;

export type MapBlocks = Omit<EnterGameData, 'loginSetting'>;

/** createJumpMapMessage: map, cell, the blocks wanted (GameWorld.doJumpMap asks for 64, the players). */
export function createJumpMapMsg(mapId: number, gx: number, gy: number, flags = BLOCK_PLAYERS): Message {
  const m = new Message(MSG_GO_MAP);
  m.putShort(mapId);
  m.putByte(gx);
  m.putByte(gy);
  m.putInt(flags);
  return m;
}

/** processJumpMapMsg: a non-zero status is refused with its text; else processDataBlockFlagMsg. */
export function readJumpMap(m: Message): MapBlocks {
  if (m.getByte() !== 0) throw new Error(m.getString());
  return readDataBlocks(m);
}

export function createMapImageMsg(id: number): Message {
  const m = new Message(MSG_MAP_IMAGE);
  m.putShort(id);
  return m;
}

/** The 10536 reply: (image id, PNG bytes) pairs for ResourceHandler.mapImage. */
export function readMapImages(m: Message): [number, Uint8Array][] {
  const out: [number, Uint8Array][] = [];
  for (let n = m.getShort(); n > 0; n--) {
    const id = m.getInt() & 0xffff;
    out.push([id, m.getBytes()]);
  }
  return out;
}
