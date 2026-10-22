// The in-world HUD: WorldPanel.gameworldPanelUI = UIHandler.createUIFromXML(211), filled by
// UIHandler.updateWorldPlayerInfoUI / updateWorldIconPoint / initAgeIconTip and placed for the
// mini map by GameMap.initSmallMapWidth (as GameCanvas does when entering the world).
// Without a server the player numbers come from `HudPlayerInfo` (made-up values in the scene)
// and every server-driven icon flag (mail, team, events, shops…) is off.
import { UIHandler } from './UIHandler';
import { GContainer, GGameBar, GGameIcon, GIcon, GImageNumer, GWidget } from '../gui/GWidget';
import type { Image } from '../image/Image';
import { readPNGFile } from '../common/Utilities';
import type { GameSprite } from '../sprite/GameSprite';

export const UI_WORLD_PANEL = 211;

// UIHandler / UIDefine event types used by the world HUD.
export const EVENT_ALL_INFO_PANEL = 921;
export const EVENT_ALL_INFO_PLAYER_ICON = 922;
export const EVENT_ALL_INFO_PLAYER_LEVEL = 923;
export const EVENT_ALL_INFO_PLAYER_HP = 924;
export const EVENT_ALL_INFO_PLAYER_MP = 925;
export const EVENT_ALL_INFO_PET_PANEL = 931;
export const EVENT_ALL_INFO_PET_ICON = 926;
export const EVENT_ALL_INFO_PET_LEVEL = 927;
export const EVENT_ALL_INFO_PET_HP = 928;
export const EVENT_ALL_INFO_PET_MP = 929;
export const EVENT_ALL_INFO_PET_EXP = 958;
export const EVENT_ALL_PLAYER_LEVEL2_ICON = 11323;
/** GameView.levelSet: the frame round the portrait (0 = no rebirth yet, 1 = rebirth 1–96, 2 = above). */
export const LEVEL_SET_ID = 216;
export const EVENT_ALL_INFO_SMALL_MAP = 939;
export const EVENT_ALL_INFO_PLAYER_EXP = 957;
export const EVENT_COMBAT_POINT = 967;
export const EVENT_PLAYER_VALUE_118 = 966;
export const EVENT_ALL_AGE_TIP = 11380;
export const EVENT_GAME_AD = 51;

/** Icons that updateWorldIconPoint shows only when the server says so (all off here). */
export const WORLD_FLAG_ICONS = [
  11284, // world buff
  938, // team
  937, // broken equipment
  936, // new mail
  935, // new attribute points
  941, // new event
  942, // private chat
  11224, 11236, 11235, // stall (shop mode)
  11319, // auto fight
  11318, 11347, // sprite guide
  11344, // login lottery
  11348, 11349, // online reward
  11321, // world shop
  11353, // charge activity
  11355, // formation
  11367, // consumer shop
  11227, // notice
  11373, // daily
  11376, // feedback app
  11375, // popup event
  EVENT_GAME_AD,
];

export interface HudPlayerInfo {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
  combatPoint: number;
  /** player.get(118), shown next to the level; its meaning is not identified yet. */
  value118: number;
  headSprite: GameSprite | null;
  /** Player.getLevel2() (rebirth level); picks the portrait frame. */
  level2: number;
  pet: HudPetInfo | null;
}

export interface HudPetInfo {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
  /** Model.getPetIcon(): portrait common/PetIcon/tx_<n>.png. */
  petIcon: number;
}

/** GameWorld.doGetLevelImageSetIndex(false, 0). */
export function doGetLevelImageSetIndex(level2: number): number {
  if (level2 <= 0) return 0;
  return level2 > 96 ? 2 : 1;
}

/**
 * MyPet.getPetIcon: the downloaded resource first (AniResourceSave, not available offline), then
 * the copy shipped in the APK.
 */
export function getPetIcon(name: string): Image | null {
  return readPNGFile(`/common/PetIcon/${name}.png`);
}

export function petIconFiles(n: number): string[] {
  return [`common/PetIcon/tx_${n}.png`];
}

/** UIHandler.getGWidgetByEventType (the handler's table keeps the last widget registered). */
export function getGWidgetByEventType(root: GWidget, ev: number): GWidget | null {
  let found: GWidget | null = null;
  const visit = (w: GWidget) => {
    if (w.getEventType() === ev) found = w;
    if (w instanceof GContainer) w.children.forEach(visit);
  };
  visit(root);
  return found;
}

export class WorldHud {
  private constructor(readonly ui: UIHandler) {}

  get root(): GContainer {
    return this.ui.uiFrame!;
  }

  /** GameCanvas: createUIFromXML(211), setDefaultListener, show (ui/211 must be preloaded). */
  static create(): WorldHud | null {
    const ui = UIHandler.createUIFromXML(UI_WORLD_PANEL);
    if (ui.uiFrame == null) return null;
    ui.setDefaultListener();
    ui.show();
    const hud = new WorldHud(ui);
    hud.updateWorldIconPoint();
    hud.get(EVENT_ALL_AGE_TIP)?.setShow(false); // initAgeIconTip
    return hud;
  }

  /** Another UI with the same info widgets (the battle order bar, ui/100). */
  static wrap(ui: UIHandler): WorldHud {
    return new WorldHud(ui);
  }

  get(ev: number): GWidget | null {
    return this.ui.getGWidgetByEventType(ev);
  }

  updateWorldIconPoint(): void {
    for (const ev of WORLD_FLAG_ICONS) this.get(ev)?.setShow(false);
  }

  /** updateWorldPlayerInfoUI(ui, 0, true); `full` false (kind 2) only updates the bars. */
  updateWorldPlayerInfoUI(p: HudPlayerInfo, full = true): void {
    const combat = this.get(EVENT_COMBAT_POINT);
    if (combat instanceof GImageNumer) {
      combat.setOffsetXY(3, 2);
      combat.setNumerString(String(p.combatPoint));
      combat.setData(238, 0, 0);
    }
    const head = this.get(EVENT_ALL_INFO_PLAYER_ICON);
    if (full && head instanceof GGameIcon) {
      p.headSprite?.setRotate(true);
      head.setSprite(p.headSprite);
    }
    const level = this.get(EVENT_ALL_INFO_PLAYER_LEVEL);
    if (level instanceof GImageNumer) level.setNumerString(String(p.level));
    const v118 = this.get(EVENT_PLAYER_VALUE_118);
    if (v118 instanceof GImageNumer) v118.setNumerString(String(p.value118));
    this.updateLevelIcon(p.level2);
    const exp = this.get(EVENT_ALL_INFO_PLAYER_EXP);
    if (exp instanceof GGameBar) exp.setValue(p.maxExp, p.exp);
    const hp = this.get(EVENT_ALL_INFO_PLAYER_HP);
    if (hp instanceof GGameBar) hp.setValue(p.maxHp, p.hp);
    const mp = this.get(EVENT_ALL_INFO_PLAYER_MP);
    if (mp instanceof GGameBar) mp.setValue(p.maxMp, p.mp);
    const panel = this.get(EVENT_ALL_INFO_PET_PANEL);
    if (panel == null) return;
    const pet = p.pet;
    if (pet == null) {
      panel.setShow(false);
      return;
    }
    panel.setShow(true);
    const icon = this.get(EVENT_ALL_INFO_PET_ICON);
    const img = getPetIcon(`tx_${pet.petIcon}`);
    if (icon instanceof GGameIcon && img != null) icon.setImage(img);
    const lv = this.get(EVENT_ALL_INFO_PET_LEVEL);
    if (lv instanceof GImageNumer) lv.setNumerString(String(pet.level));
    const exp2 = this.get(EVENT_ALL_INFO_PET_EXP);
    if (exp2 instanceof GGameBar) exp2.setValue(pet.maxExp, pet.exp);
    const php = this.get(EVENT_ALL_INFO_PET_HP);
    if (php instanceof GGameBar) php.setValue(pet.maxHp, pet.hp);
    const pmp = this.get(EVENT_ALL_INFO_PET_MP);
    if (pmp instanceof GGameBar) pmp.setValue(pet.maxMp, pet.mp);
  }

  /** The portrait frame by rebirth level (updateWorldPlayerInfoUI / updateWorldIconPoint). */
  updateLevelIcon(level2: number): void {
    const w = this.get(EVENT_ALL_PLAYER_LEVEL2_ICON);
    if (w instanceof GIcon) w.setIconData(LEVEL_SET_ID, doGetLevelImageSetIndex(level2), 0, 3);
  }

  /**
   * WorldPanel.handleWorldPanelMouse: a tap on a HUD widget becomes its action (without moving the
   * focus, unlike taps in dialogs); returns false when the tap is for the world.
   */
  handleWorldPanelMouse(x: number, y: number): boolean {
    const w = this.root.searchPressGWidget(x, y);
    if (w == null) return false;
    this.ui.setActionGWidget(w);
    this.ui.notifyLayerAction(0);
    return true;
  }
}
