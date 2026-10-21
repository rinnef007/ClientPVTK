// GameView.drawMyPlayerEffect / setLevelUPEffect (jadx decompile): the marker over the player's
// head (sprite 1231, GameSprite.SPRITE_MYPLAYER_POS) and the one-shot level-up effect at the
// player's feet (sprite 1217, SPRITE_LEVUP_UP). Drawn after the map, before the HUD.
import type { Graphics } from '../../midp/Graphics';
import type { Player } from '../actor/Player';
import { uiClock } from '../gui/GWidget';
import { GameSprite } from '../sprite/GameSprite';

export const SPRITE_LEVUP_UP = 1217;
export const SPRITE_MYPLAYER_POS = 1231;

let myPlayerPosSprite: GameSprite | null = null;
let lvUPSprite: GameSprite | null = null;
/** Java paints (and steps the sprites) once per 50 ms tick; the browser paints every frame. */
let lastTick = -1;

/** GameView.initImage part: the marker sprite (call once its files are loaded). */
export function initMyPlayerEffect(): void {
  myPlayerPosSprite = GameSprite.createSprite(SPRITE_MYPLAYER_POS);
}

export function setLevelUPEffect(): void {
  const s = GameSprite.createSprite(SPRITE_LEVUP_UP);
  lvUPSprite = s;
  if (s == null) return;
  s.setMotionAlive(true);
  s.setMotionTurnOff(true);
  s.setCurAnimationLoopTime(1);
}

export function isLevelUpPlaying(): boolean {
  return lvUPSprite != null;
}

/** ox / oy: the map's screen offsets (GameMap.offsetLeftX / offsetTopY). */
export function drawMyPlayerEffect(g: Graphics, p: Player | null, ox: number, oy: number): void {
  const sp = p?.getPlayerSprite();
  if (p == null || sp == null) return;
  const h = sp.getHeight();
  const x = p.px + ox + 12;
  const y = p.py + oy + 24;
  const step = uiClock.tick !== lastTick;
  lastTick = uiClock.tick;
  if (myPlayerPosSprite != null) {
    if (step) myPlayerPosSprite.action();
    myPlayerPosSprite.draw(g, x, y - h);
  }
  if (lvUPSprite != null) {
    if (step) lvUPSprite.action();
    lvUPSprite.draw(g, x, y);
    if (!lvUPSprite.isMotionAlive()) lvUPSprite = null;
  }
}
