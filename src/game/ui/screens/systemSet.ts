// The system menu (ui/87, "H.Thống"): UIHandler.createSystemSetUI / updateDataToSystemSetUI /
// addSystemMenu and UIAction.processSystemSetLayer / processSystemMenu (CFR). One button per entry
// (a clone of library label 8703), each sending its event to doMenuButton.
import { GLabel, GWindow } from '../../gui/GWidget';
import { ATTR_LEVEL } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { UIHandler } from '../UIHandler';
import { doMenuButton, registerScreen } from '../UIAction';

export const TYPE_SYSTEM_SET = 87;

/** UIHandler.addSystemMenu with the offline switches (no request list, lottery, charge event…). */
function addSystemMenu(): [string, number][] {
  const m: [string, number][] = [['Nạp thẻ', 11244], ['Cài đặt', 11256]];
  if ((GameWorld.myPlayer?.get(ATTR_LEVEL) ?? 0) >= 10) {
    m.push(['Thông báo game', 11227]);
    // "Sự kiện" (11216) needs GameWorld.isShowActivityList from the server.
    m.push(['Chiến lược', 11217]);
    m.push(['Xếp hạng', 11287]);
  }
  m.push(['Nhân vật', 11228], ['Thoát lag', 11230], ['Rời game', 11231]);
  return m;
}

export function updateDataToSystemSetUI(ui: UIHandler, rebuild: boolean): boolean {
  if (!rebuild) return true;
  const menu = addSystemMenu();
  const tpl = ui.getGWidgetByEventType(8703);
  if (tpl == null || ui.getGWidgetByEventType(8701) == null) return false;
  const win = ui.getGWindowByEventType(8702);
  if (win == null) return false;
  win.setMinHeight(1);
  const rows = ((menu.length / 2) | 0) + (menu.length % 2);
  win.setH(Math.min(rows * 40 + rows + 14, 424));
  win.vm[14] = 424; // setMaxHeight
  for (const [text] of menu) {
    const b = tpl.getClone();
    if (b instanceof GLabel) b.setText(text);
    b.setObj(text);
    win.add(b);
  }
  win.setObj(menu.map((e) => e[1]));
  win.show();
  win.setFirstFocus();
  return true;
}

export function createSystemSetUI(): void {
  const ui = UIHandler.createUIFromXML(TYPE_SYSTEM_SET);
  ui.setDefaultListener();
  ui.show();
  if (updateDataToSystemSetUI(ui, true)) UIHandler.addUI(ui);
}

function processSystemSetLayer(ui: UIHandler, action: number): void {
  if (action === 119) {
    updateDataToSystemSetUI(ui, false);
    return;
  }
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  if (w.getEventType() !== 8703) return doMenuButton(w.getEventType());
  // processSystemMenu: run the entry's event and close the menu.
  const win = ui.getGWindowByEventType(8702);
  const ids = win?.getObj();
  if (!(win instanceof GWindow) || win.focusWidget == null || !Array.isArray(ids)) return;
  ui.close();
  doMenuButton(ids[win.focusIndex] as number);
}

registerScreen('systemSet', {
  uiTypes: [TYPE_SYSTEM_SET],
  open: () => createSystemSetUI(),
  processLayerAction: processSystemSetLayer,
});
