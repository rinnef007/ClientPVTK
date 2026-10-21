// The settings screen (ui/88 "Cài game", with ui/108's widgets registered as Java does):
// UIHandler.createSettingUI / updateDataToSettingUI / getSettingIndex / setSettingIndex /
// isMultiple / findSettingIndex and UIAction.processSettingLayer (CFR and Vineflower decompiles).
// Each row is a group of buttons for bits of Model.setting: in a normal row the button whose bit
// is set is focused (ids below 10050 mean "no bit"), a two-entry row [id, 0|1] is an on/off
// toggle (0: the bit means off). Closing with changes asks to confirm and sends them to the server
// (createChangeSettingMessgae); offline the value is applied and kept by GameStore (localStorage).
import type { Player } from '../../actor/Player';
import * as GameStore from '../../main/GameStore';
import * as GameWorld from '../../main/GameWorld';
import { GLabel } from '../../gui/GWidget';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject } from '../UIObject';
import { registerScreen } from '../UIAction';

export const TYPE_SETTING = 88;
const TYPE_SETTING_2 = 108;
const TAB_SETTING_1 = 8806;
const TAB_SETTING_2 = 8807;

/** UIHandler.SETTING_1: team requests, invites, apprentices, speed-up, helper, chat rows, names, mini map, players. */
const SETTING_1 = [
  [10033, 10051, 10052],
  [10034, 10050],
  [10036, 10064],
  [10077, 1],
  [10065, 0],
  [10035, 10063],
  [10030, 10070, 10071],
  [10031, 10068, 10069],
  [10032, 10073, 10074],
];
/** UIHandler.SETTING_2 (ui/108's display / performance page; ui/88 has no tab for it). */
const SETTING_2 = [[10030, 10070, 10071], [10031, 10068, 10069], [10032, 10073, 10074], [10039, 10078], [10040, 10079, 10080]];
let settingMenu = SETTING_1;

const EXPLAIN_952 = "/cffff00 tăng tốc trò chơi /p\n mở: Trò chơi tiến vào chế độ tăng tốc\n Đóng: Trò chơi thoát chế độ tăng tốc";
const EXPLAIN_953 = "/cffff00Hiện tên người/p\nĐơn giản:  Hiện tên người chơi mặc định\nChi tiết:  Tên người chơi hiện rõ ràng/cff0000(Ảnh hưởng độ mượt)/p\nĐóng:  Không hiện tên người chơi/c00ff00(Mượt)/p\n/cffff00Bản đồ nhỏ/p\nĐơn giản:  Không hiện quái\nĐóng:  Không hiện bản đồ nhỏ/c00ff00(Mượt)/p\n/cffff00Hiện người chơi/p\nĐơn giản:  Chỉ hiện người chơi quanh mình\nChi tiết:  Hiện toàn bộ/cff0000(Ảnh hưởng độ mượt)/p\n Đóng:  Không hiện người chơi khác/c00ff00(Mượt)/p\n/cffff00Bản đồ/p\nMặc định:  Bản đồ đẹp\nĐơn giản:  Bản đồ đơn giản/c00ff00(Tiết kiệm lưu lượng, game mượt)/p\n Đóng:  Không hiện nguyên tố bản đồ/c00ff00(Tiết kiệm lưu lượng, game mượt)/p\n/cffff00Hình động/p\nMặc định:  NPC phong phú,Hình động quái vật\nĐơn giản:  Hình động bản tiết kiệm/c00ff00(Tiết kiệm lưu lượng, game mượt)/p\n/cffff0Hình nhân vật/p\nMặc định:  Nhiều hình đổi trang bị\nĐơn giản:  Tỉ lệ nhỏ, hình động tác đơn giản/c00ff00(Tiết kiệm bộ nhớ, game mượt)/p\n/cffff00Số người chơi/p\nTất cả:  Tải mọi người chơi bản đồ\n50 hoặc 20 người:  Tải không quá 50 hoặc 20 người trên bản đồ (/c00ff00Tiết kiệm lưu lượng/p, /cff0000Nhưng ảnh hưởng tới tương tác/p)\nNhiều người và cần xã giao, có thể thiết lập <Tất cả>, lúc khác nên thiết lập <50/20> người";
const isBit = (bit: number, v: number) => (v & bit) !== 0;
const setBit = (on: boolean, bit: number, v: number) => (on ? v | bit : v & ~bit);

function findSettingIndex(id: number): number {
  return settingMenu.findIndex((row) => row.includes(id));
}

function isMultiple(row: number): boolean {
  const r = settingMenu[row];
  return r.length === 2 && (r[1] === 0 || r[1] === 1);
}

/** Whether button `id` shows as selected for setting value `v`. */
export function getSettingIndex(v: number, id: number): boolean {
  const row = findSettingIndex(id);
  if (row < 0) return false;
  if (isMultiple(row)) {
    const on = isBit(1 << (id - 10050), v);
    return settingMenu[row][1] === 0 ? !on : on;
  }
  if (id < 10050) return !settingMenu[row].some((x) => x >= 10050 && isBit(1 << (x - 10050), v));
  return isBit(1 << (id - 10050), v);
}

/** The setting value after pressing button `id`. */
export function setSettingIndex(v: number, id: number): number {
  const row = findSettingIndex(id);
  if (row < 0) return v;
  const bit = 1 << (id - 10050);
  if (isMultiple(row)) return setBit(!isBit(bit, v), bit, v);
  let out = v;
  for (const x of settingMenu[row]) if (x >= 10050) out = setBit(false, 1 << (x - 10050), out);
  return id >= 10050 ? setBit(true, bit, out) : out;
}

function updateDataToSettingUI(ui: UIHandler, rebuild: boolean): boolean {
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  const tabs = ui.getGWindowByEventType(240);
  if (obj == null || tabs == null) return false;
  tabs.setFocusIndex(tabs.focusIndex);
  const tab = tabs.focusWidget;
  if (tab instanceof GLabel) tab.setIsFocusLabelOffset([0, 3]);
  const ev = tab?.getEventType();
  if (rebuild) {
    if (ev === TAB_SETTING_1) settingMenu = SETTING_1;
    else if (ev === TAB_SETTING_2) settingMenu = SETTING_2;
    else return false;
    const frame = ui.getFrameContainer();
    const p1 = ui.getGWidgetByEventType(8808);
    const p2 = ui.getGWidgetByEventType(8809);
    if (frame == null || p1 == null || p2 == null) return false;
    frame.remove(p1);
    frame.remove(p2);
    frame.add(ev === TAB_SETTING_1 ? p1 : p2);
    frame.setAbs();
  }
  const v = obj.intValue1;
  settingMenu.forEach((row, n) => {
    for (const id of row) {
      ui.getGWidgetByEventType(id)?.setFocus(getSettingIndex(v, id));
      if (isMultiple(n)) break;
    }
  });
  // The sound rows (8810 / 8811) are hidden.
  ui.getGWidgetByEventType(8810)?.setShow(false);
  ui.getGWidgetByEventType(8811)?.setShow(false);
  return true;
}

export function createSettingUI(p: Player | null): void {
  const ui = UIHandler.createUIFromXML(TYPE_SETTING);
  const obj = UIObject.getUIObj(ui);
  obj.object = p;
  obj.intValue1 = p != null ? p.setting : GameStore.getGameSetting();
  const extra = UIHandler.createUIFromXML(TYPE_SETTING_2);
  for (const [ev, w] of extra.vmGWidgets) if (ui.getGWidgetByEventType(ev) == null) ui.addEventGWidget(w);
  if (!updateDataToSettingUI(ui, true)) {
    alertMessage('Tạo UI cài đặt thất bại!!');
    return;
  }
  ui.setDefaultListener();
  ui.show();
  UIHandler.addUI(ui);
}

function processSettingLayer(ui: UIHandler, action: number): void {
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  if (obj == null) return;
  const v = obj.intValue1;
  if (action === 1) {
    const p = obj.object as Player | null;
    // Java: "Đồng ý cài đặt như vậy không?" then the server, then GameStore.saveSetting; offline
    // the value is applied and stored locally.
    if (p != null && p.setting !== v) {
      p.setting = v;
      GameStore.saveSetting();
    }
    if (p == null && GameStore.getGameSetting() !== v) {
      GameStore.setGameSetting(v);
      GameStore.saveSystem();
    }
    ui.close();
    return;
  }
  if (action === 119) {
    updateDataToSettingUI(ui, false);
    return;
  }
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  const ev = w.getEventType();
  if (ev === 952) {
    alertMessage(EXPLAIN_952, 'Gợi ý', 20, 0, true);
    return;
  }
  if (ev === 953) {
    alertMessage(EXPLAIN_953, 'Gợi ý', 20, 0, true);
    return;
  }
  if (w.getParentWindow()?.getEventType() === 240) {
    updateDataToSettingUI(ui, true);
    return;
  }
  obj.intValue1 = setSettingIndex(v, ev);
  updateDataToSettingUI(ui, false);
}

registerScreen('setting', {
  uiTypes: [TYPE_SETTING, TYPE_SETTING_2],
  open: () => createSettingUI(GameWorld.myPlayer),
  processLayerAction: processSettingLayer,
});
