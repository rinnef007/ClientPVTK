// The item pop-up of the equipment screen (ui/4): UIAction.createPlayerEquipPopMenu /
// updatePlayerEquipPopMenu ("T.Bị" mode), UIHandler.updateDataToEquipPopUI and
// UIAction.processEquipPopLayer (Vineflower and CFR decompiles). The box shows the item's name,
// count, price and description; the buttons follow Java's choice for the item class. Every action
// (equip / unequip, attach gems, bind, identify, use, sell…) is a server request and shows the
// offline notice; "Trở về" closes. Not ported: comparing with the equipped item (needs the item
// attributes, Item.getEquipCompareDesc), the VIP card slot (17), colour boxes, the warehouse /
// stall / country storage / sell / resolve / enchant modes and the guide arrows.
import { GContainer, GLabel, GTextArea, GWindow } from '../../gui/GWidget';
import { Item, PlayerBag } from '../../actor/Item';
import { MyPet } from '../../actor/MyPet';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { PowerString } from '../../string/PowerString';
import { UIHandler, alertMessage } from '../UIHandler';
import { STR_NEED_SERVER } from '../UIAction';
import { createPetInfoUI } from './pet';

export const TYPE_EQUIP_POP = 4;
const STR_EQUIP_MODE = 'T.Bị'; // GameText 0
const STR_BACK = 'Trở về'; // GameText 4
const STR_SELL = 'Bán'; // GameText 99
const STR_X = ' x '; // GameText 64
const EV_EQUIP = 11096;
const EV_COMPARE = 11098;
const EV_UNEQUIP = 11103;

/** updatePlayerEquipPopMenu in "T.Bị" mode: [text, event] per button (event 0 = close). */
function equipMenu(p: Player, item: Item): [string, number][] {
  const m: [string, number][] = [];
  const add = (text: string | null, ev: number) => {
    if (text != null) m.push([text, ev > 0 ? ev : 0]);
  };
  if (p !== GameWorld.myPlayer) {
    add(STR_BACK, -1);
    return m;
  }
  const cls = item.getItemClass();
  const equipped = item.isEquited();
  if (cls === 1 || cls === 2) {
    add(equipped ? 'Tháo' : 'Trang bị', equipped ? EV_UNEQUIP : EV_EQUIP);
    // "Khảm" (11100) needs Item.isCanAttach (sockets, server data): none offline.
    if (!item.binded) add('Khóa', 11097);
    else if (item.ascensionStar > 0) add('Tăng sao', 11190);
    if (PlayerBag.getCompareEquip(p.bag, item.type) != null && !equipped) add('So sánh', EV_COMPARE);
    // "Giám định" (11099) needs Item.isIdentifyItem; "Bán tùy ý" (11518) a VIP 8+ account.
    if (!equipped) add(STR_SELL, 11191);
  } else if (cls === 3) {
    add(equipped ? 'Nghỉ' : 'Chiến', equipped ? EV_UNEQUIP : EV_EQUIP);
    add('Đạo cụ', 11106);
    if (!equipped) add('P.sinh', 11102);
  } else if (cls === 4) {
    if (item.isCanUse(1)) add('Dùng', 11104);
    else add(STR_BACK, -1);
    add(STR_SELL, 11191);
  } else {
    add(STR_BACK, -1);
    add(STR_SELL, 11191);
  }
  // "Nhập kho" needs a mobile warehouse (Model.getPlayerMoveWarehouseMax): none offline.
  return m;
}

/** Puts the menu into window 4's buttons (hiding the rest) and sizes it 3 per row. */
function updatePlayerEquipPopMenu(ui: UIHandler, p: Player, item: Item): void {
  const win = ui.getGWindowByEventType(4);
  if (win == null) return;
  const menu = equipMenu(p, item);
  if (win.focusWidget == null) win.setFirstFocus();
  win.children.forEach((c, i) => {
    if (!(c instanceof GLabel)) return;
    const e = menu[i];
    if (e == null) c.setShow(false);
    else {
      c.setText(e[0]);
      c.setEventType(e[1]);
    }
  });
  for (let i = win.getChildNum() - 1; i > 0; i--) {
    const c = win.getJavaChild(i);
    if (c != null && !c.isShow()) win.remove(c);
  }
  const n = win.children.length;
  const h = (((n / 3) | 0) + (n % 3 > 0 ? 1 : 0)) * 40;
  win.setBounds(7, 238, 286, h);
  win.setMinSize(286, h);
}

/** updateDataToEquipPopUI (not comparing): "Gợi ý", the text box and the close button. */
function updateDataToEquipPopUI(ui: UIHandler, item: Item): void {
  const frame = ui.getGWidgetByEventType(501);
  const win = ui.getGWindowByEventType(4);
  if (!(frame instanceof GContainer) || win == null) return;
  frame.setMinHeight(0);
  frame.setMaxSize(260, -1);
  win.setObj(item);
  const compare = ui.getGWidgetByEventType(7);
  const extra = compare?.getMinH() ?? 0;
  if (compare) frame.remove(compare);
  const title = ui.getGWidgetByEventType(10);
  if (title instanceof GLabel) title.setText('Gợi ý');
  const close = ui.getGWidgetByEventType(998);
  if (close) frame.remove(close);
  const area = ui.getGWidgetByEventType(2);
  if (area instanceof GTextArea) {
    if (win.layoutData[0] === 2) {
      area.setMaxSize(-1, area.getMinH() + extra);
      area.setH(area.getMaxH());
    }
    let text = item.getNameInfo();
    if (item.slotPos !== 17) text += `${STR_X}${item.quantity}  ${PowerString.makeIconString(2, 2)}${item.price}`;
    text += `\n${item.description}`;
    area.setText(text);
  }
  ui.show();
  if (close) {
    frame.add(close);
    close.setPos(frame.getW() - close.getW(), 0);
  }
}

/**
 * createPlayerEquipPopMenu: the active pet's item opens the pet screen; otherwise ui/4 over the
 * equipment screen (its frame object is the player).
 */
export function createPlayerEquipPopMenu(parent: UIHandler, item: Item, mode = STR_EQUIP_MODE): void {
  const p = parent.getFrameContainer()?.getObj() as Player | null;
  if (p == null) return;
  if (item.isPetType() && item.isPetEquip() && p === GameWorld.myPlayer) {
    const pet = p.getPet();
    if (pet instanceof MyPet) pet.petItem = item;
    createPetInfoUI(pet instanceof MyPet ? pet : null, parent);
    return;
  }
  if (mode !== STR_EQUIP_MODE) {
    alertMessage(STR_NEED_SERVER); // shop / resolve / enchant menus
    return;
  }
  const ui = UIHandler.createUIFromXML(TYPE_EQUIP_POP);
  ui.parent = parent;
  updatePlayerEquipPopMenu(ui, p, item);
  ui.setDefaultListener();
  UIHandler.addUI(ui);
  updateDataToEquipPopUI(ui, item);
}

/** processEquipPopLayer: unknown events (the "Trở về" button) close; the rest ask the server. */
export function processEquipPopLayer(ui: UIHandler, action: number): void {
  if (action === 1) return ui.close();
  if (action !== 0) return;
  const win = ui.getGWindowByEventType(4);
  const item = win?.getObj();
  if (!(win instanceof GWindow) || !(item instanceof Item)) return;
  const w = ui.getActionGWidget();
  const target = w != null && w.parent === win ? w : win.focusWidget;
  if (!(target instanceof GLabel)) return;
  const ev = target.getEventType();
  if (ev <= 0) {
    ui.close();
    return;
  }
  if (ev === EV_COMPARE) {
    alertMessage('So sánh cần thuộc tính chi tiết của vật phẩm (dữ liệu server), bản offline chưa có.');
    return;
  }
  alertMessage(STR_NEED_SERVER);
}
