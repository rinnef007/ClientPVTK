// The client side of a level-up: MsgHandler.processUpLevelMsg (jadx decompile) applies the
// server's numbers (exp gained, levels gained, the new exp / exp max, skill and attribute points,
// god-level exp), builds the reward text and starts GameView.setLevelUPEffect. Offline nothing
// sends that message; MapScene simulates one on a dev key with made-up numbers.
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_LEVEL, ATTR_MP, ATTR_MP_MAX, ATTR_POINTS, type Player } from '../actor/Player';
import { PowerString } from '../string/PowerString';
import { setLevelUPEffect } from './MyPlayerEffect';

/** The fields of the server's level-up block, in message order. */
export interface UpLevelData {
  exp: number;
  levels: number;
  newExp: number;
  newExpMax: number;
  skillPoints: number;
  attrPoints: number;
}

const ATTR_SKILL_POINTS = 5;
/** Model.setTabStatus(16384): new attribute points (the HUD's "+" mark). */
export const TAB_NEW_POINTS = 16384;

/** Returns the reward text (STR_UPDATE_LV_EXP, STR_CONG_UPDATE_LV, STR_SP_POINT, STR_CP_POINT). */
export function processUpLevelMsg(p: Player, d: UpLevelData): string {
  let s = '';
  if (d.exp > 0) {
    p.addValue(ATTR_EXP, d.exp);
    s += `/cFFFF00Exp ${d.exp}/p\n`;
  }
  if (d.levels > 0) {
    // STR_CONG_UPDATE_LV is formatted with the byte the server sends, which Model.addValue(106)
    // adds to the level (clamped to 0..120): as written, the text shows the levels gained.
    s += `/c00FF00Chúc mừng bạn thăng lên cấp ${d.levels}/p`;
    p.set(ATTR_LEVEL, Math.min(120, Math.max(0, p.getLevel() + d.levels)));
    p.set(ATTR_EXP, d.newExp); // Model.SET_EXP
    p.set(ATTR_EXP_MAX, d.newExpMax); // Model.SET_EXPMAX
    if (d.skillPoints > 0) {
      p.addValue(ATTR_SKILL_POINTS, d.skillPoints);
      s += `${PowerString.makeColorString('Điểm kĩ năng', 16776960)}${d.skillPoints}\n`;
    }
    if (d.attrPoints > 0) {
      p.addValue(ATTR_POINTS, d.attrPoints);
      s += `${PowerString.makeColorString('Điểm thuộc tính', 16776960)}${d.attrPoints}\n`;
      p.setTabStatus(true, TAB_NEW_POINTS);
    }
  }
  if (d.levels > 0) {
    setLevelUPEffect();
    // Player.resumeHPMP: full HP and MP.
    p.set(ATTR_HP, p.get(ATTR_HP_MAX));
    p.set(ATTR_MP, p.get(ATTR_MP_MAX));
  }
  return s;
}
