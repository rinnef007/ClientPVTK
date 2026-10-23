// The world item list (ui/35, "Thuốc"): UIHandler.createWorldItemListUI / updateDataToWorldItemListUI
// / updateDataToWorldItemInfo and UIAction.processWorldItemLayer (jadx + Vineflower decompiles).
// Only the player's own list (sub type 0) is ported; the pet item lists and batch use (VIP 8+)
// are not. Using an item is a server request.
import { GIcon, GLabel, GLinePanel, GTextArea } from '../../gui/GWidget';
import { Item } from '../../actor/Item';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { UIHandler, alertMessage } from '../UIHandler';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';
import { doWorldUseItemAction } from '../../main/BagActions';
import { isOnline } from '../../../net/online/Online';

export const TYPE_WORLD_ITEM = 35;
const STR_NO_WORLD_ITEM_USE = 'Túi không có đạo cụ có thể dùng!'; // GameText
const STR_X = ' x '; // GameText 64

export function createWorldItemListUI(player: Player | null, subType: number): void {
  const bag = player?.bag;
  if (player == null || bag == null) return;
  const list = subType === 0 ? bag.getCanUseItemList(1) : [];
  if (list.length === 0) {
    alertMessage(STR_NO_WORLD_ITEM_USE);
    return;
  }
  const ui = UIHandler.createUIFromXML(TYPE_WORLD_ITEM);
  ui.setSubType(subType);
  ui.setDefaultListener();
  ui.show();
  UIHandler.addUI(ui);
  updateDataToWorldItemListUI(ui, player);
}

/** One row (lib panel 4 with label 6 "name x count") per usable item, the quick-HP entry first. */
export function updateDataToWorldItemListUI(ui: UIHandler, player: Player): void {
  const bag = player.bag;
  if (bag == null) return;
  const list = ui.getSubType() === 0 ? bag.getCanUseItemList(1) : [];
  if (list.length > 0) list.unshift(Item.getOneKeyQuickHP());
  const win = ui.getGWindowByEventType(5);
  if (win == null) return;
  if (win.focusWidget == null) win.setFirstFocus();
  const focus = win.focusIndex;
  const scrollPos = win.getScrollBar()?.scrollPos ?? 0;
  win.clear();
  const template = ui.getGWidgetByEventType(4);
  if (!(template instanceof GLinePanel)) return;
  for (const it of list) {
    const row = template.getClone() as GLinePanel;
    row.setObj(it);
    const name = row.getJavaChildByEvent(6);
    if (name instanceof GLabel) name.setText(it.quantity > 0 ? `${it.name}${STR_X}${it.quantity}` : it.name);
    win.add(row);
  }
  ui.show();
  if (focus >= win.getChildNum()) win.setPrevFocus(focus);
  else win.setFocusIndex(focus);
  win.setChildrenOffset(0, -scrollPos);
  const sel = win.focusWidget;
  updateDataToWorldItemInfo(ui, sel?.getObj() instanceof Item ? (sel.getObj() as Item) : null);
}

/** Icon (1) and description (2) of the selected item; the text box moves up for longer text. */
export function updateDataToWorldItemInfo(ui: UIHandler, item: Item | null, prefix: string | null = null): void {
  const area = ui.getGWidgetByEventType(2);
  if (area instanceof GTextArea) {
    if (item != null) {
      let desc = item.getPowerDesc();
      if (!desc.trim()) desc = item.getInfo();
      if (prefix != null) {
        area.setAlertText(`${prefix}\n${desc}`);
        return;
      }
      area.setPos(60, desc.length < 10 ? 52 : desc.length > 20 ? 35 : 41);
      area.setText(desc);
    } else {
      area.setText('');
    }
  }
  const icon = ui.getGWidgetByEventType(1);
  if (icon instanceof GIcon) {
    if (item != null) icon.setIconIndex(item.bagIcon, item.grade);
    else icon.setIconIndex(-1);
  }
}

/** Tapping a new row shows it; tapping the selected row again (or 3) uses the item. */
function processWorldItemLayer(ui: UIHandler, action: number): void {
  const win = ui.getGWindowByEventType(5);
  const row = win?.focusWidget;
  const item = row?.getObj();
  if (win == null || !(item instanceof Item) || action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  if (win.oldFocusIndex === win.focusIndex || w.getEventType() === 3) {
    const me = GameWorld.myPlayer;
    if (isOnline() && me != null) {
      // GameWorld.doWorldUseItemAction, then the list shows what is left.
      void doWorldUseItemAction(me, item).then(() => ui.close());
    } else {
      alertMessage(STR_NEED_SERVER);
    }
  }
  else if (w.getEventType() === 4) updateDataToWorldItemInfo(ui, item);
}

registerScreen('itemList', {
  uiTypes: [TYPE_WORLD_ITEM],
  open: (sub = 0) => createWorldItemListUI(GameWorld.myPlayer, sub),
  processLayerAction: processWorldItemLayer,
});
