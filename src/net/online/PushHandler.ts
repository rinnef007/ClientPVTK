// MsgHandler.handleMessages for the messages the user's backend sends without being asked (or
// whose request did not wait): 11004 player values, 12003 the whole bag, 14011 the skill list, and
// the other players of the map: 10501 enters (processSendEnterMap), 10502 leaves
// (processSendLeaveMap), 10505 positions (processOtherMoveTo). The rest is still dropped.
import type { Player } from '../../game/actor/Player';
import { Control } from '../../game/main/Control';
import * as GameWorld from '../../game/main/GameWorld';
import { buildOtherPlayer } from '../../game/main/OnlineWorld';
import type { Message } from '../Message';
import { MSG_ENTER_MAP, MSG_LEAVE_MAP, MSG_OTHER_MOVE, readOtherMoves, readOtherPlayer } from './OtherPlayers';
import { MSG_ATTRIBUTE_UPDATE, MSG_BAG_REFRESH, readAttributeUpdate, readBagRefresh } from './BagMessages';
import { readSkillList } from './EnterGame';

export const MSG_SKILL_UPDATE = 14011;

/**
 * processOtherMoveTo: the mode, then the position; at most 5 walk there (MoveTo) per message, the
 * rest, those far away (not in the player's team) and everyone during a battle are placed.
 */
function applyOtherMoves(m: Message, inBattle: boolean): void {
  let walking = 0;
  const myId = GameWorld.myPlayer?.getId() ?? -1;
  for (const o of readOtherMoves(m)) {
    const model = o.id === myId ? null : GameWorld.getModel(o.id);
    if (model == null) continue;
    model.mode = o.mode;
    if (model.isMember()) continue;
    const me = GameWorld.myPlayer;
    const sameTeam = me != null && me.leaderID > 0 && model.leaderID === me.leaderID;
    if (walking >= 5 || inBattle || (!sameTeam && (Math.abs(model.getGx() - o.gx) > 6 || Math.abs(model.getGy() - o.gy) > 6))) {
      model.setPosition(o.gx, o.gy);
    } else {
      walking++;
      model.addControl(Control.createMoveTo(o.id, o.gx, o.gy));
    }
  }
}

/**
 * Applies one pushed message; true when the player's own values, bag or skills changed (the
 * screens then redraw). `inBattle`: GameCanvas.gStage == 31.
 */
export function handlePush(m: Message, me: Player | null, inBattle = false): boolean {
  if (me == null) return false;
  try {
    switch (m.type) {
      case MSG_ATTRIBUTE_UPDATE:
        readAttributeUpdate(m, me);
        return true;
      case MSG_BAG_REFRESH:
        readBagRefresh(m, me);
        return true;
      case MSG_SKILL_UPDATE: {
        // Skill.updatePlayerSkill
        me.skillList = readSkillList(m, true);
        me.autoSkillID = [];
        for (let n = m.getByte(); n > 0; n--) me.autoSkillID.push(m.getShort());
        me.autoSkillID_Initiative = m.getShort();
        return true;
      }
      case MSG_ENTER_MAP:
        GameWorld.addModel(buildOtherPlayer(readOtherPlayer(m)).model);
        return false;
      case MSG_LEAVE_MAP:
        GameWorld.removeModel(m.getInt());
        return false;
      case MSG_OTHER_MOVE:
        applyOtherMoves(m, inBattle);
        return false;
    }
  } catch {
    // A malformed push is ignored, as Java's catch-all in handleMessages.
  }
  return false;
}
