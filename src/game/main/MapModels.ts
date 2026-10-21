// The model part of com.hz.map.PlayerLayer.draw (jadx decompile): on each map row, the other
// players (filtered by the "Người chơi" setting, at most 20, team mates always), then the NPCs,
// then the player; drawPlayerModel puts a player's pet behind or in front of it by y;
// drawModel puts names over other players (per the "Tên" setting), names and quest signs over
// NPCs, and the stall / fight icons. Not ported: mercenaries (getMerList), riding pets (tab 256),
// NPC welcome bubbles, the hide-players NPCs
// (NPC.isPlayerSHow is always true) and the default NPC image for sprite-less NPCs.
import type { Graphics } from '../../midp/Graphics';
import type { Model } from '../actor/Model';
import { NPC } from '../actor/NPC';
import type { Player } from '../actor/Player';
import { readPNGFile, drawGameImage } from '../common/Utilities';
import { isMotion } from '../gui/GWidget';
import type { Image } from '../image/Image';
import { drawBorderString, drawSimpleBorderString, getImageSet } from './GameView';

/** Model.setting bits read here (see ui/screens/setting.ts). */
export const SETTING_NAME_DETAIL = 1048576; // 10070 "C.tiết"
export const SETTING_NAME_OFF = 2097152; // 10071 "Đóng"
export const SETTING_PLAYER_ALL = 8388608; // 10073 "C.tiết"
export const SETTING_PLAYER_OFF = 16777216; // 10074 "Đóng"
const TAB_HIDDEN = 524288;
const MAX_OTHER_PLAYERS = 20;
const NPC_TYPE_JUMP = 1;

let fightImg: Image | null | undefined;
let stallImg: Image | null | undefined;
/** GameView.fightImg / stallImg (/common/f.png, /common/9.png). */
export const MAP_MODEL_IMAGES = ['common/f.png', 'common/9.png', 'common/11.fr', 'common/11.png'];

const isSetting = (me: Player | null, bit: number) => me != null && (me.setting & bit) !== 0;

/** PlayerLayer.isShowOtherPlayer: "Đóng" hides everyone, "Đ.giản" only players within 72 px. */
function isShowOtherPlayer(m: Model, me: Player | null): boolean {
  if (me == null || isSetting(me, SETTING_PLAYER_OFF)) return false;
  if (!isSetting(me, SETTING_PLAYER_ALL)) {
    if (Math.abs(me.px - m.px) > 72 || Math.abs(me.py - m.py) > 72) return false;
  }
  return true;
}

/** Model.isSameTeam: both in the same team (leader ids are server data; none offline). */
function isSameTeam(a: Model, b: Model | null): boolean {
  return b != null && a.leaderID > 0 && b.leaderID > 0 && a.leaderID === b.leaderID;
}

function drawModelName(g: Graphics, m: Model, x: number, y: number, isMe: boolean, me: Player | null): void {
  if (isMe || !m.name || isSetting(me, SETTING_NAME_OFF)) return;
  if (m.isShopMode()) {
    drawBorderString(g, 16737038, 16777215, m.shopName, x, y, 33);
    return;
  }
  if (isSetting(me, SETTING_NAME_DETAIL)) {
    drawBorderString(g, 5263183, 16777215, m.getName(), x, y, 33);
    const title = (m as Partial<Player>).title;
    if (title) drawBorderString(g, 0, 16711926, title, x, y - g.getFontHeight(), 33);
    return;
  }
  drawSimpleBorderString(g, 5263183, 16777215, m.getName(), x, y, 33);
}

function drawModelIcon(g: Graphics, m: Model, x: number, y: number, h: number, rotate: boolean): void {
  if (m.mode === 1) {
    stallImg ??= readPNGFile('/common/9.png');
    drawGameImage(g, stallImg, x, y + h, 3, rotate ? 1 : 0);
  }
  if (m.mode === 50 || m.mode === 51 || m.mode === 52) {
    fightImg ??= readPNGFile('/common/f.png');
    drawGameImage(g, fightImg, x, y, 17);
  }
}

/** GameView.drawNPCSign: the quest sign (set 11, frame sign-1) bobbing over the name. */
function drawNPCSign(g: Graphics, npc: NPC, x: number, y: number): void {
  const set = getImageSet(11);
  const sign = npc.getSign();
  if (set == null || sign === 0) return;
  set.drawFrame(g, sign - 1, x, y - 8 - isMotion(), 0, 33);
}

/** PlayerLayer.drawModel. */
export function drawModel(g: Graphics, ox: number, oy: number, m: Model, isMe: boolean, me: Player | null): void {
  const x = m.px + ox + 12;
  const y = m.py + oy + 24;
  const sp = m.getPlayerSprite();
  if (m instanceof NPC) {
    if (!m.isVisible() || sp == null) return;
    sp.draw(g, x, y);
    const top = y - sp.getHeight();
    const name = m.getName();
    if (name) {
      if (m.npcType === NPC_TYPE_JUMP) drawSimpleBorderString(g, 1380111, 16716288, name, x, top, 33);
      else drawBorderString(g, 0, 1900540, name, x, top, 33);
    }
    drawNPCSign(g, m, x, top);
    return;
  }
  if (m.isTabStatus(TAB_HIDDEN) || sp == null) return;
  sp.draw(g, x, y);
  const h = sp.getHeight();
  drawModelName(g, m, x, y - h, isMe, me);
  drawModelIcon(g, m, x, y - h, h, sp.getRotate());
}

/** PlayerLayer.drawPlayerModel: the pet first when it stands higher on screen than its owner. */
function drawPlayerModel(g: Graphics, ox: number, oy: number, m: Model, isMe: boolean, me: Player | null): void {
  const pet = m.getPet();
  if (pet != null && !m.isTabStatus(256)) {
    if (pet.py > m.py) {
      drawModel(g, ox, oy, m, isMe, me);
      drawModel(g, ox, oy, pet, isMe, me);
    } else {
      drawModel(g, ox, oy, pet, isMe, me);
      drawModel(g, ox, oy, m, isMe, me);
    }
    return;
  }
  drawModel(g, ox, oy, m, isMe, me);
}

/** One map row of PlayerLayer.draw; `shown` counts the other players drawn so far this frame. */
export function drawModelRow(
  g: Graphics, row: number, ox: number, oy: number, startGx: number, endGx: number,
  others: Iterable<Model>, npcs: NPC[], me: Player | null, shown: { n: number },
): void {
  for (const m of others) {
    const gx = m.getGx();
    if (gx < startGx || gx > endGx || m.getGy() !== row) continue;
    if (isSameTeam(m, me) || (shown.n < MAX_OTHER_PLAYERS && isShowOtherPlayer(m, me))) {
      shown.n++;
      drawPlayerModel(g, ox, oy, m, false, me);
    }
  }
  for (const n of npcs) {
    const gx = n.getGx();
    if (gx >= startGx && gx <= endGx && n.getGy() === row) drawModel(g, ox, oy, n, false, me);
  }
  if (me != null && me.getGy() === row) drawPlayerModel(g, ox, oy, me, true, me);
}
