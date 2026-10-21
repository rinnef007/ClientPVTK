// The mission list (ui/37, "N.vụ"): UIHandler.createPlayerMissionListUI / updatePlayerMissionListUI
// / updateDataToPlayerMissionListUI / updateDataToPlayerMissionInfo, UIAction.doPlayerMissionListEvent
// / processPlayerMissionListLayer; the mission dialog (ui/46): UIHandler.createMissionUI /
// updateDataToMissionUI, UIAction.processMissionLayer, Mission.doMenuButton; and talking to a quest
// NPC: NPC.doNpc / doMissionNpc / handlerMissionNPCAction / handleChoiceMissionAction /
// doMissionInfoView (CFR and Vineflower decompiles). Offline the list shows the player's missions
// (demo data); accepting, handing in and giving up get their answer from MissionServer, a local
// simulation of the server. The other list tabs (H.Động activities, Tăng upgrades, Sôi Nổi vitality),
// the challenge (random) mission and "Dò đường" (auto path) need the server. Not ported: escort,
// offline, guide and one-key missions, reward items to choose, special NPCs (shops, teachers, jumps).
import { GContainer, GLabel, GTextArea, GWidget, GWindow, ICON_SIGN, uiScreen } from '../../gui/GWidget';
import { isNullText } from '../../common/Tool';
import { MessageFrame, WIDTH_MAX } from '../../core/MessageFrame';
import { Mission, STATUS_NOT_READY, STATUS_SUBMIT } from '../../core/Mission';
import { NPC, NPC_TYPE_MONSTER } from '../../actor/NPC';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import * as WorldMessage from '../../main/WorldMessage';
import { simAcceptMission, simDeleteMission, simRefreshNpcSigns, simSubmitMission } from '../../main/MissionServer';
import { PowerString } from '../../string/PowerString';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject } from '../UIObject';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';

export const TYPE_MISSION_LIST = 37;
export const TYPE_MISSION = 46;
const TAB_MISSION = 12;
const STR_NO_MISSION = 'Chưa có Nhiệm Vụ';
const STR_MAIN_MISSION = 'Nhiệm vụ chính';
const STR_BACK = 'Trở về'; // GameText 4
const STR_ACCEPT = 'Nhận nhiệm vụ'; // GameText 27
const STR_SUBMIT = 'Xong nhiệm vụ'; // GameText 28
const STR_CANCEL = 'Hủy'; // GameText 29
const STR_FIND_PATH = 'Dò đường'; // GameText 65
const STR_LEAVE = 'Rời đi'; // GameText 147
const EVENT_ACCEPT = 11023;
const EVENT_FIND_PATH = 11024;
const EVENT_GIVE_UP = 11025;
const EVENT_SUBMIT = 11026;
const EVENT_CONTINUE = 11095;
/** createMissionUI sub types: the NPC's mission list, then doMissionInfoView's cases. */
const SUB_NPC = 1;
const SUB_DIRECT_SUBMIT = 5;
const SUB_FINISH_DIALOG = 6;
const SUB_ACCEPT = 7;
const SUB_DOING = 8;
const SUB_VIEW = 9;
const SUB_SUBMIT = 10;
/**
 * Not in Java: UIHandler.waitForTwiceSureUI (a blocking yes/no box) is not ported, so giving up asks
 * with a ui/46 dialog of this sub type instead.
 */
const SUB_SURE_GIVE_UP = 100;
const EVENT_SURE = 1;
/** handlerMissionNPCAction kinds: 1 choose a mission, 7 leave. */
const NPC_ACTION_MISSION = 1;
const NPC_ACTION_LEAVE = 7;

/** UIObject of a mission dialog: who is looking, at which mission, with which NPC. */
interface MissionUIObj {
  player: Player | null;
  mission: Mission | null;
  npc: NPC | null;
}
/** A button: its text, and for NPC lists the mission status shown as an icon (set 3). */
type MissionLabel = [string] | [string, number];
type NpcAction = [number, Mission?];

const curMapId = () => GameWorld.gameMap?.getMapID() ?? 0;

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
      if (m != null) doMissionInfoView(GameWorld.myPlayer, m, null, SUB_VIEW, ui);
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

// --- mission dialog (ui/46) ---

/** NPC.doMissionInfoView: the dialog for one mission (`sub` picks the text and buttons). */
export function doMissionInfoView(p: Player | null, m: Mission, npc: NPC | null, sub: number, parent: UIHandler | null = null): void {
  const labels: MissionLabel[] = [];
  const events: number[] = [];
  const add = (t: string, ev: number) => {
    labels.push([t]);
    events.push(ev);
  };
  let text = '';
  switch (sub) {
    case SUB_DIRECT_SUBMIT:
      text = m.desc;
      if (!isNullText(m.dialogStartFinish)) add('Tiếp tục ', EVENT_CONTINUE);
      else add('Chọn', EVENT_SUBMIT);
      break;
    case SUB_FINISH_DIALOG:
      text = m.dialogStartFinish;
      add('Chọn', EVENT_SUBMIT);
      break;
    case SUB_ACCEPT:
      text = m.getDetails(false, p);
      add(STR_ACCEPT, EVENT_ACCEPT);
      break;
    case SUB_DOING:
      text = m.getDoingDesc(false, p);
      add(STR_FIND_PATH, EVENT_FIND_PATH);
      add(STR_CANCEL, EVENT_GIVE_UP);
      break;
    case SUB_VIEW:
      text = m.getDetails(true, p);
      add(STR_FIND_PATH, EVENT_FIND_PATH);
      add(STR_CANCEL, EVENT_GIVE_UP);
      break;
    case SUB_SUBMIT:
      text = m.getSubmitDetails(p);
      add(STR_SUBMIT, EVENT_SUBMIT);
      break;
  }
  createMissionUI(m.name, text, labels, events, sub, { player: p, mission: m, npc }, parent);
}

export function createMissionUI(title: string, text: string, labels: MissionLabel[], events: unknown[], sub: number, obj: MissionUIObj, parent: UIHandler | null): UIHandler | null {
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

/**
 * Title, text area (taller when there are at most two buttons), no reward items, button list. The
 * NPC's portrait (widget 2, GGameIcon) is not filled.
 */
function updateDataToMissionUI(ui: UIHandler, title: string, text: string, labels: MissionLabel[], events: unknown[]): void {
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
  // Reward items to choose (window 7): none offline.
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
  labels.forEach((l, i) => {
    const b = tpl.getClone();
    if (b instanceof GLabel) {
      b.setText(l[0]);
      if (l.length > 1) b.setIconValue(l[1] ?? 0, ICON_SIGN);
    }
    b.setObj(events[i] ?? null);
    buttons.add(b);
  });
  buttons.setFirstFocus();
}

/** processMissionLayer: the NPC list runs the chosen entry; mission dialogs run Mission.doMenuButton. */
function processMissionLayer(ui: UIHandler, action: number): void {
  if (action === 1) return ui.close();
  if (action !== 0 && action !== 6) return;
  const buttons = ui.getGWindowByEventType(6);
  if (buttons == null) return;
  const w = ui.getActionGWidget();
  const target = w != null && w.parent === buttons ? w : buttons.focusWidget;
  const ev = target?.getObj();
  const o = ui.obj as MissionUIObj | null;
  if (ui.getSubType() === SUB_NPC) {
    ui.close();
    if (Array.isArray(ev) && o?.npc) handlerMissionNPCAction(o.npc, ev as NpcAction);
    return;
  }
  if (typeof ev !== 'number' || o == null) return;
  if (ui.getSubType() === SUB_SURE_GIVE_UP) {
    ui.close();
    if (ev === EVENT_SURE) giveUp(ui.parent, o);
    return;
  }
  if (doMenuButton(ui, o, ev)) ui.close();
}

/** Mission.doMenuButton (ordinary missions). true closes the dialog. */
function doMenuButton(ui: UIHandler, o: MissionUIObj, ev: number): boolean {
  const { player: p, mission: m, npc } = o;
  if (ev === -1) return true;
  if (m == null) return false;
  if (ev === EVENT_CONTINUE) {
    doMissionInfoView(p, m, npc, SUB_FINISH_DIALOG, ui.parent);
    return true;
  }
  if (m.isRandomMission() || ev === EVENT_FIND_PATH) {
    alertMessage(STR_NEED_SERVER); // RandomMission / doMissionAutoPathMsg
    return false;
  }
  if (ev === EVENT_GIVE_UP) {
    const sure = `Mi đồng ý hủy nhiệm vụ ${PowerString.makeColorString(m.name, 16711680)} không?`;
    createMissionUI(STR_CANCEL, sure, [[STR_CANCEL], [STR_BACK]], [EVENT_SURE, -1], SUB_SURE_GIVE_UP, o, ui.parent);
    return true;
  }
  let ok = false;
  if (ev === EVENT_ACCEPT) ok = doAcceptMissionMsg(p, npc, m);
  else if (ev === EVENT_SUBMIT) ok = doSubmitMissionMsg(p, npc, m);
  if (ok) ui.parent?.notifyLayerAction(110);
  return ok;
}

/** doDeleteMissionMsg after "Hủy" is confirmed; the mission list below refreshes. */
function giveUp(parent: UIHandler | null, o: MissionUIObj): void {
  if (o.player == null || o.mission == null || !simDeleteMission(o.player, o.mission)) return;
  checkNPCMissions(o.player);
  parent?.notifyLayerAction(110);
}

/** processMissionNPCStatus stand-in after every change. */
function checkNPCMissions(p: Player): void {
  simRefreshNpcSigns(p, GameWorld.npcList, curMapId());
}

/** Mission.doAcceptMissionMsg: on success the "Sơ lược" prompt. */
function doAcceptMissionMsg(p: Player | null, npc: NPC | null, m: Mission): boolean {
  if (p == null || npc == null) return false;
  const err = simAcceptMission(p, npc, m);
  if (err != null) {
    alertMessage(err, 'Lỗi');
    return false;
  }
  if (!isNullText(m.simpleDesc)) WorldMessage.addPromptMsg(`Sơ lược: ${m.simpleDesc}`);
  checkNPCMissions(p);
  return true;
}

/** Mission.doSubmitMissionMsg + processMissionReward, then doSubmitEndCheck (the next mission). */
function doSubmitMissionMsg(p: Player | null, npc: NPC | null, m: Mission): boolean {
  if (p == null || npc == null) return false;
  const reward = simSubmitMission(p, npc, m, curMapId());
  if (reward == null) {
    alertMessage('Chưa hoàn thành nhiệm vụ.', 'Lỗi');
    return false;
  }
  if (!isNullText(reward)) WorldMessage.addPointMsg(reward);
  checkNPCMissions(p);
  onMissionReward(p);
  const next = m.submitNextMissionID > 0 ? npc.getMissonById(m.submitNextMissionID) : null;
  if (next != null) {
    UIHandler.closeAllUI();
    handleChoiceMissionAction(next, npc);
  }
  return true;
}

/** UIHandler.updateWorldPlayerInfoUI after a reward: the scene refreshes its HUD. */
let onMissionReward: (p: Player) => void = () => {};
export function setOnMissionReward(fn: (p: Player) => void): void {
  onMissionReward = fn;
}

// --- talking to a quest NPC ---

/**
 * NPC.doNpc: an NPC taking back a finished mission, or having missions or a greeting, opens the
 * mission list. Not ported: the mission data request (doGetMissionData), city buildings and
 * special NPCs (doSpecialNpc: shops, teachers, battles, jumps).
 */
export function doNpc(npc: NPC): boolean {
  const p = GameWorld.myPlayer;
  if (!npc.isEnable() || p == null) return false;
  p.setAnimationByDir(false);
  if (!Mission.isHaveSubmitMission(p, npc, curMapId()) && npc.talkDetail == null && npc.missions.length === 0) return true;
  doMissionNpc(p, npc);
  return true;
}

/**
 * NPC.doMissionNpc: the player's missions this NPC takes back, then the ones it offers (with a
 * status icon each) and "Rời đi". A single entry, or a single mission to hand in, opens directly.
 */
function doMissionNpc(p: Player, npc: NPC): void {
  if (npc.npcType === NPC_TYPE_MONSTER || npc.npcType === 4) return;
  const curMap = curMapId();
  const labels: MissionLabel[] = [];
  const actions: NpcAction[] = [];
  const done: NpcAction[] = [];
  const push = (m: Mission, status: number) => {
    const a: NpcAction = [NPC_ACTION_MISSION, m];
    labels.push([m.name, status]);
    actions.push(a);
    if (status === STATUS_SUBMIT) done.push(a);
  };
  for (const m of p.missionList) if (m != null && m.isVisibleAndSubmit(npc, curMap)) push(m, m.getMissionStatus(p));
  for (const m of npc.missions) {
    if (p.getMissionById(m.getId()) != null || Mission.isMissionFinish(p, m.getId())) continue;
    const status = m.getMissionStatus(p);
    // Mission.isShowNotAcceptMission needs accept conditions of a kind not ported: hidden.
    if (status !== STATUS_NOT_READY) push(m, status);
  }
  if (labels.length === 1 && actions.length === 1) return handlerMissionNPCAction(npc, actions[0]);
  if (done.length === 1 && npc.npcType === 0) return handlerMissionNPCAction(npc, done[0]);
  labels.push([STR_LEAVE]);
  actions.push([NPC_ACTION_LEAVE]);
  createMissionUI(npc.name, npc.talkDetail ?? '', labels, actions, SUB_NPC, { player: p, mission: null, npc }, null);
}

/** NPC.handlerMissionNPCAction: 1 opens the mission; 7 ("Rời đi") closes everything. */
function handlerMissionNPCAction(npc: NPC, a: NpcAction): void {
  if (a[0] === NPC_ACTION_MISSION && a[1]) handleChoiceMissionAction(a[1], npc);
  else if (a[0] === NPC_ACTION_LEAVE) UIHandler.closeAllUI();
}

/** NPC.handleChoiceMissionAction: hand in / in progress / accept, or why it cannot be accepted. */
export function handleChoiceMissionAction(m: Mission, npc: NPC): void {
  const p = GameWorld.myPlayer;
  if (p == null) return;
  if (p.getMissionById(m.getId()) != null) {
    doMissionInfoView(p, m, npc, m.isComplete(p) && m.isVisibleAndSubmit(npc, curMapId()) ? SUB_SUBMIT : SUB_DOING);
  } else if (m.isCanAccept(p)) {
    doMissionInfoView(p, m, npc, SUB_ACCEPT);
  } else {
    alertMessage(`Nhiệm vụ ${PowerString.makeColorString(m.name, 16776960)} chưa đạt điều kiện nhận.\n${m.dialogNotStartNotReady}`);
  }
}

registerScreen('missionList', {
  uiTypes: [TYPE_MISSION_LIST, TYPE_MISSION],
  open: (tab = TAB_MISSION) => void createPlayerMissionListUI(0, tab),
  processLayerAction: (ui, action) =>
    ui.getType() === TYPE_MISSION ? processMissionLayer(ui, action) : processPlayerMissionListLayer(ui, action),
});
