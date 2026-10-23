// MsgHandler.handleMessages for the messages the user's backend sends without being asked (or
// whose request did not wait): 11004 player values, 12003 the whole bag, 14011 the skill list.
// The rest is still dropped.
import type { Player } from '../../game/actor/Player';
import type { Message } from '../Message';
import { MSG_ATTRIBUTE_UPDATE, MSG_BAG_REFRESH, readAttributeUpdate, readBagRefresh } from './BagMessages';
import { readSkillList } from './EnterGame';

export const MSG_SKILL_UPDATE = 14011;

/** Applies one pushed message to the player; true when it was one of ours. */
export function handlePush(m: Message, me: Player | null): boolean {
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
    }
  } catch {
    // A malformed push is ignored, as Java's catch-all in handleMessages.
  }
  return false;
}
