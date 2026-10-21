// The mission list (ui/37, "N.vụ"): UIHandler.createPlayerMissionListUI / updatePlayerMissionListUI
// / updateDataToPlayerMissionListUI / updateDataToPlayerMissionInfo, UIAction.doPlayerMissionListEvent
// / processPlayerMissionListLayer; and the mission details dialog (ui/46): NPC.doMissionInfoView
// (case 9), UIHandler.createMissionUI / updateDataToMissionUI, UIAction.processMissionLayer (CFR and
// Vineflower decompiles). Offline the list shows the player's missions (demo data); the selected
// mission's goal pops up in a MessageFrame. The other tabs (H.Động activities, Tăng upgrades, Sôi Nổi
// vitality) and the challenge (random) mission come from the server, as do "Dò đường" (auto path)
// and "Hủy" (give up).
import { GContainer, GLabel, GTextArea, GWidget, GWindow, uiScreen } from '../../gui/GWidget';
import { MessageFrame, WIDTH_MAX } from '../../core/MessageFrame';
import type { Mission } from '../../core/Mission';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject } from '../UIObject';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';

export const TYPE_MISSION_LIST = 37;
export const TYPE_MISSION = 46;
const TAB_MISSION = 12;
const STR_NO_MISSION = 'Chưa có Nhiệm Vụ';
const STR_MAIN_MISSION = 'Nhiệm vụ chính';
const STR_FIND_PATH = 'Dò đường'; // GameText 65
const STR_CANCEL = 'Hủy'; // GameText 29
const EVENT_FIND_PATH = 11024;
const EVENT_GIVE_UP = 11025;

/** The list row (direct child of window 1) holding `w`; Java reads the window's focused row. */
function rowOf(win: GWindow, w: GWidget | null): GWidget | null {
  for (let c: GWidget | null = w; c != null; c = c.parent) if (c.parent === win) return c;
  return null;
}

/** UIAction.getMissionByWindow: the mission in the focused row of window 1. */
function getMissionByWindow(ui: UIHandler): Mission | null {
  const win = ui.getGWindowByEventType(1);
  const m = win?.focusWidget?.getObj();
  return m != null && typeof m === 'object' && 'getNameInfo' in m ? (m as Mission) : null;
}

export function createPlayerMissionListUI(sub: number, tab: number): UIHandler {
  const ui = UIHandler.createUIFromXML(TYPE_MISSION_LIST);
  UIObject.getUIObj(ui).object = null;
  ui.setDefaultListener();
  ui.setSubType(sub);
  if (sub === 0) ui.getFrameContainer()?.addTopDraw(new MessageFrame(WIDTH_MAX, 2, true));
  let ev = TAB_MISSION;
  if (tab > 0) {
    const tabs = ui.getGWindowByEventType(11);
    tabs?.setFocus(tabs.getJavaChildByEvent(tab));
    ev = tab;
  }
  doPlayerMissionListEvent(ui, ev);
  ui.show();
  UIHandler.addUI(ui);
  if (tab === TAB_MISSION && !(GameWorld.myPlayer?.missionList ?? []).some((m) => m != null)) alertMessage(STR_NO_MISSION);
  return ui;
}

/** Tab panels: only "N.Vụ" (12, panel 14) is local; the others load server data into ui/81, 169, 119, 170. */
function updatePlayerMissionListUI(ui: UIHandler, rebuild: boolean): void {
  const frame = ui.getFrameContainer();
  if (frame == null) return;
  const panel = ui.getGWidgetByEventType(14);
  if (rebuild && panel) frame.remove(panel);
  const tabs = ui.getGWindowByEventType(11);
  const tab = tabs?.focusWidget?.getEventType() ?? TAB_MISSION;
  if (tabs != null) {
    const w = tabs.getJavaChildByEvent(tab);
    tabs.setFocus(w);
    if (w instanceof GLabel) w.setIsFocusLabelOffset([0, 3]);
  }
  if (rebuild) {
    if (tab === TAB_MISSION && panel) frame.add(panel);
    frame.show();
  }
  if (tab === TAB_MISSION) updateDataToPlayerMissionListUI(ui, rebuild);
  if (rebuild) ui.show();
}

/** "Nhiệm vụ chính" title, then one row per mission (name + green [Xong] when done). */
export function updateDataToPlayerMissionListUI(ui: UIHandler, _rebuild: boolean): void {
  const title = ui.getGWidgetByEventType(15);
  const win = ui.getGWindowByEventType(1);
  const tpl = ui.getGWidgetByEventType(6);
  const me: Player | null = GameWorld.myPlayer;
  if (win == null || tpl == null || me == null) return;
  const focus = win.focusIndex;
  const scroll = win.getScrollBar()?.scrollPos ?? 0;
  win.clear();
  win.setMinHeight(1);
  // Level 30+: the challenge mission (RandomMission.doRandomMissionInfo) asks the server first.
  if (title instanceof GLabel) {
    const t = title.getClone() as GLabel;
    t.setText(STR_MAIN_MISSION);
    t.setFragmentTable([701, 76, 0, 0, 0, 0, 701, 76, 137, 0, 1, 0]);
    win.add(t);
  }
  let any = false;
  for (const m of me.missionList) {
    if (m == null) continue;
    const row = tpl.getClone();
    row.setObj(m);
    const name = row instanceof GContainer ? row.getJavaChildByEvent(7) : null;
    if (name instanceof GLabel) name.setPowerText(m.getNameInfo(me));
    win.add(row);
    any = true;
  }
  if (!any && UIHandler.getTopUI()?.getType() === TYPE_MISSION_LIST) alertMessage(STR_NO_MISSION);
  win.show();
  if (win.focusWidget == null) {
    win.setFirstFocus();
  } else {
    win.setPrevFocus(focus);
    win.setChildrenOffset(0, -scroll);
  }
  updateDataToPlayerMissionInfo(ui, true);
}

/** The focused mission's goal in the MessageFrame, above or below its row; `show` false hides it. */
export function updateDataToPlayerMissionInfo(ui: UIHandler, show: boolean): void {
  const win = ui.getGWindowByEventType(1);
  const mf = ui.getFrameContainer()?.getJavaTopDraw(0);
  if (win == null || !(mf instanceof MessageFrame)) return;
  const row = win.focusWidget;
  if (row == null) {
    mf.setDrawCount(0);
    return;
  }
  const m = getMissionByWindow(ui);
  if (m == null) return;
  const text = show ? m.getDoingDesc(true, GameWorld.myPlayer) : null;
  mf.doUpdate(text, row, row.getAbsY() < uiScreen.height >> 1, 2);
  mf.setDrawCount(120);
}

export function doPlayerMissionListEvent(ui: UIHandler, ev: number): void {
  if (ui.getType() !== TYPE_MISSION_LIST || !(ui.obj instanceof UIObject)) return;
  switch (ev) {
    case 12:
      updatePlayerMissionListUI(ui, true);
      updateDataToPlayerMissionInfo(ui, true);
      break;
    case 13: // activities (ActivityData.doBrowseActivityList)
    case 16: // vitality (Vitality.doEnter)
    case 17:
    case 18: // upgrade guide (GameUpGrade.doGameUpgradeGetData)
    case 19: // milestones (Milestone.doMilestoneEnter)
      alertMessage(STR_NEED_SERVER);
      ui.getGWindowByEventType(11)?.setFocus(ui.getGWindowByEventType(11)?.getJavaChildByEvent(TAB_MISSION) ?? null);
      updatePlayerMissionListUI(ui, true);
      break;
    case 9: {
      const m = getMissionByWindow(ui);
      if (m != null) doMissionInfoView(GameWorld.myPlayer, m, ui);
      updateDataToPlayerMissionInfo(ui, false);
      break;
    }
    case 6:
      updateDataToPlayerMissionInfo(ui, true);
      break;
    case 1:
      updateDataToPlayerMissionInfo(ui, false);
      break;
    case 11023: // challenge mission accept / submit / view (RandomMission)
    case 11026:
    case 11029:
      alertMessage(STR_NEED_SERVER);
      break;
  }
}

function processPlayerMissionListLayer(ui: UIHandler, action: number): void {
  if (action === 1) return ui.close();
  if (action === 110) return updateDataToPlayerMissionListUI(ui, true);
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  // A tap on a row's button selects that row first (Java taps the focused row).
  const win = ui.getGWindowByEventType(1);
  const row = win ? rowOf(win, w) : null;
  if (win && row && win.focusWidget !== row) win.setFocus(row);
  doPlayerMissionListEvent(ui, w.getEventType());
}

// --- mission details (ui/46) ---

/** NPC.doMissionInfoView(player, mission, null, 9): details with "Dò đường" and "Hủy". */
function doMissionInfoView(p: Player | null, m: Mission, parent: UIHandler): void {
  createMissionUI(m.name, m.getDetails(true, p), [STR_FIND_PATH, STR_CANCEL], [EVENT_FIND_PATH, EVENT_GIVE_UP], 9, m, parent);
}

export function createMissionUI(title: string, text: string, labels: string[], events: number[], sub: number, obj: unknown, parent: UIHandler | null): UIHandler | null {
  if (labels.length === 0 && !text.trim()) return null;
  const ui = UIHandler.createUIFromXML(TYPE_MISSION);
  ui.parent = parent;
  ui.setDefaultListener();
  ui.setSubType(sub);
  ui.obj = obj;
  updateDataToMissionUI(ui, title, text, labels, events);
  ui.show();
  UIHandler.addUI(ui);
  return ui;
}

/** Title, text area (taller when there are at most two buttons), no reward items, button list. */
function updateDataToMissionUI(ui: UIHandler, title: string, text: string, labels: string[], events: number[]): void {
  const frame = ui.getGWidgetByEventType(3);
  const buttons = ui.getGWindowByEventType(6);
  const tpl = ui.getGWidgetByEventType(8);
  if (!(frame instanceof GContainer)) return;
  const box = frame;
  const head = ui.getGWidgetByEventType(1);
  if (head instanceof GLabel) head.setText(title);
  const panel = ui.getGWidgetByEventType(4);
  const area = ui.getGWidgetByEventType(5);
  if (area instanceof GTextArea) {
    if (labels.length <= 2 && tpl != null && buttons != null) {
      const extra = buttons.getMaxH() - labels.length * tpl.getMinH();
      if (extra > 0) {
        area.setMaxSize(-1, area.getMaxH() + extra);
        area.setH(area.getMaxH());
      }
    }
    area.setText(text);
    if (!text.trim()) {
      area.setMaxSize(-1, 0);
      area.setH(0);
      box.remove(area);
    }
  }
  // Reward items to choose (window 7): none for the player's own missions offline.
  const items = ui.getGWindowByEventType(7);
  if (items != null) {
    items.setMaxSize(-1, 0);
    items.setH(0);
    box.remove(items);
  }
  if (labels.length > 2 && buttons != null) {
    const used = (panel?.getMaxH() ?? 0) + (area?.getH() ?? 0);
    buttons.setMaxSize(-1, uiScreen.height - used - 30);
  }
  if (buttons == null || tpl == null) return;
  labels.forEach((t, i) => {
    const b = tpl.getClone();
    if (b instanceof GLabel) b.setText(t);
    b.setObj(events[i] ?? null);
    buttons.add(b);
  });
  buttons.setFirstFocus();
}

/** Mission.doMenuButton for the details buttons: -1 closes; auto path and give up need the server. */
function processMissionLayer(ui: UIHandler, action: number): void {
  if (action === 1) return ui.close();
  if (action !== 0 && action !== 6) return;
  const buttons = ui.getGWindowByEventType(6);
  if (buttons == null) return;
  const w = ui.getActionGWidget();
  const target = w != null && w.parent === buttons ? w : buttons.focusWidget;
  const ev = target?.getObj();
  if (typeof ev !== 'number') return;
  if (ev === -1) {
    ui.close();
    return;
  }
  if (ev === EVENT_FIND_PATH || ev === EVENT_GIVE_UP) alertMessage(STR_NEED_SERVER);
}

registerScreen('missionList', {
  uiTypes: [TYPE_MISSION_LIST, TYPE_MISSION],
  open: (tab = TAB_MISSION) => void createPlayerMissionListUI(0, tab),
  processLayerAction: (ui, action) =>
    ui.getType() === TYPE_MISSION ? processMissionLayer(ui, action) : processPlayerMissionListLayer(ui, action),
});
