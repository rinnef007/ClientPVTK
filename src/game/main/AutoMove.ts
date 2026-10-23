// Path finding with the server (Mission.doMissionAutoPathMsg and Player.fromBytesByAutoMove of
// client 1.2.0): the reply becomes the player's auto-move list: walk, jump map, …, then walk to the
// NPC and talk to it (Control's auto-move end step).
import type { Player } from '../actor/Player';
import { Control } from './Control';
import * as WorldPanel from './WorldPanel';
import { alertMessage, UIHandler } from '../ui/UIHandler';
import type { Message } from '../../net/Message';
import { AUTO_MOVE_SILENT_ERRORS, AutoMoveError, readAutoMove, type AutoMoveRoute } from '../../net/online/AutoMoveMessages';
import { online } from '../../net/online/Online';

/** Player.fromBytesByAutoMove: the player stops, then walks the route. */
export function applyAutoMove(p: Player, r: AutoMoveRoute): void {
  p.setPosition(p.getGx(), p.getGy());
  WorldPanel.clearMyMove();
  p.controlList = [];
  const list: Control[] = [];
  for (const leg of r.legs) {
    list.push(Control.createMoveTo(p.getId(), leg.gx, leg.gy));
    list.push(Control.createJumpMap(leg.mapId, leg.toGx, leg.toGy));
  }
  const end = Control.createMoveTo(p.getId(), r.gx, r.gy);
  end.setAutoMoveEndStep();
  list.push(end);
  p.autoMoveControlList = list;
}

/**
 * Mission.doMissionAutoPathMsg (and the other 10518 requests): a refusal shows its text (except
 * codes -26 / -27); otherwise the route starts and the dialogs close. True when it started.
 */
export async function doAutoMoveRequest(p: Player, req: Message): Promise<boolean> {
  const s = online.session;
  if (s == null) return false;
  let r: AutoMoveRoute;
  try {
    r = readAutoMove(await s.request(req));
  } catch (e) {
    if (!(e instanceof AutoMoveError && AUTO_MOVE_SILENT_ERRORS.includes(e.code))) {
      alertMessage(e instanceof Error ? e.message : String(e));
    }
    return false;
  }
  applyAutoMove(p, r);
  UIHandler.closeAllUI();
  return true;
}
