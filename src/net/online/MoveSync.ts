// MsgHandler.doSoftSync / syncMoveTo (1.2.0): every 5 s the player's cell goes to the server
// (CG_SCENE_PLAYER_MOVING 10504: gx, gy as bytes) when it changed since the last send. The other
// players' positions (synOtherMoveTo, 10505) are not asked for: the web client does not show them yet.
import { Message } from '../Message';

export const MSG_MOVE = 10504;
const SYNC_INTERVAL_MS = 5000;

export function createMoveMessage(gx: number, gy: number): Message {
  const m = new Message(MSG_MOVE, 2);
  m.putByte(gx);
  m.putByte(gy);
  return m;
}

export class MoveSync {
  private lastGx: number;
  private lastGy: number;
  private nextSync = 0;

  /** initMyPlayerSyncPosition: the cell the server already knows. */
  constructor(gx: number, gy: number, private readonly send: (m: Message) => void) {
    this.lastGx = gx;
    this.lastGy = gy;
  }

  /** doSoftSync: call every tick with the player's cell. */
  tick(gx: number, gy: number, now = Date.now()): void {
    if (now < this.nextSync) return;
    this.nextSync = now + SYNC_INTERVAL_MS;
    this.syncMoveTo(gx, gy);
  }

  /** syncMoveTo: also called directly where Java forces a send (e.g. before talking to an NPC). */
  syncMoveTo(gx: number, gy: number): void {
    if (gx === this.lastGx && gy === this.lastGy) return;
    this.send(createMoveMessage(gx, gy));
    this.lastGx = gx;
    this.lastGy = gy;
  }
}
