// com.hz.actor.Player: only what world movement needs so far.
import { Model, TYPE_PLAYER } from './Model';

export class Player extends Model {
  constructor() {
    super(TYPE_PLAYER);
  }

  /** Auto-walk to a quest target (Player.autoMoveControlList) is not ported yet. */
  isAutoMove(): boolean {
    return false;
  }
}
