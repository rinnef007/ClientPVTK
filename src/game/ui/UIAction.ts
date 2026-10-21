// The dispatch part of com.hz.ui.UIAction (Vineflower decompile): processLayerAction by UI type,
// processLayerClose, the world panel (HUD) handler and doMenuButton for the HUD's buttons.
// Screens are opened by the modules registered in `screens` (see ./screens); a button whose
// Java handler needs the server answers with an alert instead.
import { GIcon, GLabel } from '../gui/GWidget';
import { TYPE_ALERT, UIHandler, alertMessage, preloadUI, updateDataToTipInfoUI, type UIListener } from './UIHandler';

export const TYPE_WORLD_PANEL = 211;

/** Shown for buttons whose Java handler talks to the server first. */
export const STR_NEED_SERVER = 'Chức năng này cần kết nối server. Bản offline chưa hỗ trợ.';

/** A screen module: opens its UI (creating and filling it) and handles its actions. */
export interface ScreenModule {
  /** UI files the screen (and the screens it opens directly) need. */
  uiTypes: number[];
  open(arg?: number): void;
  processLayerAction?(ui: UIHandler, action: number): void;
}

const screens = new Map<string, ScreenModule>();
const actionByType = new Map<number, ScreenModule>();

export function registerScreen(name: string, m: ScreenModule): void {
  screens.set(name, m);
  for (const t of m.uiTypes) actionByType.set(t, m);
}

/** Loads a screen's files, then opens it (UI creation itself is synchronous, as in Java). */
export async function openScreen(name: string, arg?: number): Promise<void> {
  const m = screens.get(name);
  if (m == null) {
    alertMessage(STR_NEED_SERVER);
    return;
  }
  await preloadUI(...m.uiTypes);
  m.open(arg);
}

function needServer(): void {
  alertMessage(STR_NEED_SERVER);
}

/** Tip dialog (ui/7): 8 closes, 3 / 6 next page, 5 previous page (UIHandler.updateTipsInfoUI). */
function processTipsInfoLayer(ui: UIHandler, action: number): void {
  if (action === 1) {
    ui.close();
    return;
  }
  const ev = ui.getActionGWidget()?.getEventType();
  if (ev === 8) ui.notifyLayerAction(1);
  else if (ev === 3) updateDataToTipInfoUI(ui, 1, true);
  else if (ev === 5) updateDataToTipInfoUI(ui, -1, false);
  else if (ev === 6) updateDataToTipInfoUI(ui, 1, false);
}

/** 18 folds both button bars into their small tabs (labels 19 / 9), 19 unfolds them. */
function processWorldPanelShow(ui: UIHandler, windowEv: number, tabEv: number, ev: number): void {
  const win = ui.getGWindowByEventType(windowEv);
  const tab = ui.getGWidgetByEventType(tabEv);
  const frame = ui.getFrameContainer();
  if (win == null || !(tab instanceof GLabel) || frame == null) return;
  if (ev === 8 || ev === 18) {
    frame.remove(win);
    frame.add(tab);
  } else if (ev === 9 || ev === 19) {
    frame.remove(tab);
    frame.add(win);
  }
  frame.show();
}

export function processWorldPanelLayer(ui: UIHandler, action: number): void {
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  const ev = w.getEventType();
  if (ev === 18 || ev === 19) {
    processWorldPanelShow(ui, 10, 19, ev);
    processWorldPanelShow(ui, 3, 9, ev);
  } else if (ev === 11379) {
    const tip = ui.getGWidgetByEventType(11380);
    if (tip instanceof GIcon) tip.setShow(!tip.isShow());
  } else {
    doMenuButton(ev);
  }
}

/**
 * UIAction.doMenuButton for the events the world HUD can send. Entries map to a screen module
 * (opened with its argument) or to "needs the server" / a fixed alert, following the Java cases.
 */
const MENU: Record<number, [string, number?] | (() => void)> = {
  11205: ['chat', -1], // chat history
  942: ['chat', 5], // new private message → private tab
  11207: ['mission', 12], // mission list
  11208: ['equip', 0], // equipment ("Item")
  11201: ['itemList', 0], // bag ("Thuốc")
  11209: ['playerInfo', -1], // character ("N.vật")
  935: ['playerInfo', -1], // new attribute points
  944: ['playerInfo', -1], // doWorldTouristFiveLevel (non-tourist path)
  11210: ['nearPlayer', 0], // players around ("X.Quanh")
  938: ['nearPlayer', 1], // team icon
  11203: ['mercenaryList', 2], // pets
  946: ['petInfo'], // pet portrait
  11202: ['systemSet'], // settings ("H.Thống")
  941: ['playerEvent'], // events
  11219: () => alertMessage('Bạn chưa kết bạn'), // GameWorld.isShowRelation is false without server data
  11231: () => onQuitGame(), // "Rời game": GameWorld.doLogOutMsg(3); offline it leaves the map
};

/** What "Rời game" does offline (the scene sets it; Java logs out from the server). */
export let onQuitGame: () => void = () => {};
export function setOnQuitGame(fn: () => void): void {
  onQuitGame = fn;
}

export function doMenuButton(ev: number): void {
  const m = MENU[ev];
  if (m == null) return needServer();
  if (typeof m === 'function') return m();
  void openScreen(m[0], m[1]);
}

export const UIAction: UIListener = {
  processLayerAction(ui: UIHandler, action: number): void {
    switch (ui.getType()) {
      case TYPE_ALERT:
        processTipsInfoLayer(ui, action);
        return;
      case TYPE_WORLD_PANEL:
        processWorldPanelLayer(ui, action);
        return;
    }
    actionByType.get(ui.getType())?.processLayerAction?.(ui, action);
  },
  processLayerClose(ui: UIHandler): void {
    ui.close();
  },
};

UIHandler.defaultListener = UIAction;
