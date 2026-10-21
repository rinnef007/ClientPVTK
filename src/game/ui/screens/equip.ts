// The equipment screen (ui/2): UIHandler.createWorldEquipUI / updateDataToPlayerEquipUI /
// updateBagEquipItemToGIcon / updateItemToGIcon / updateDataToMyPlayerBag /
// updateDataToPlayerMoney / updateItemNameToBagUI / updateEquipUI and
// UIAction.processPlayerEquipLayer (jadx + Vineflower decompiles).
// Not ported: the shop / resolve / enchant / mobile-warehouse modes (their tabs stay hidden or
// empty: they need server data) and bag sorting (server request). The item pop-up is ./equipPop.
import { GContainer, GGameIcon, GIcon, GLabel, GLinePanel, GWidget } from '../../gui/GWidget';
import { BAG_PAGE_SIZE, BAG_START, Item, type PlayerBag } from '../../actor/Item';
import { ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, type Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { GameSprite } from '../../sprite/GameSprite';
import { PowerString } from '../../string/PowerString';
import { UIHandler, alertMessage } from '../UIHandler';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';
import { TYPE_EQUIP_POP, createPlayerEquipPopMenu, processEquipPopLayer } from './equipPop';

export const TYPE_PLAYER_EQUIP = 2;
/** ui/67 holds the shop item panel (39) the equipment screen borrows. */
export const TYPE_SHOP_PANEL = 67;

const STR_EQUIP = 'T.Bị'; // GameText 0
const STR_SORT = 'Sắp xếp'; // 82
const STR_SELL = 'B.Bán'; // 117
const STR_SELL_LOG = 'Nhật kí'; // 98
const STR_HANG = 'T.bán'; // 113
const STR_PROVIDE = 'C.Ứng'; // 114
const STR_CANCEL = 'Hủy bỏ'; // 118
const STR_RESOLVE = 'P.Giải'; // 159
const STR_RESOLVE_DO = 'Phân hủy'; // 160
const STR_ENCHANT = 'Phụ Ma'; // GameText2.STR_ENCHANT
const STR_ENCHANT_EQUIP = 'Hấp thụ T.Bị'; // GameText2.STR_ENCHANT_EQUIP
const STR_BAG_NULL = 'Túi trống'; // GameText.STR_BAG_NULL
const STR_OPEN = 'Mở'; // 83
const STR_X = ' x '; // 64
const STATUS_SHOW_STAR = 8192;

/** Server switches that decide which tabs exist (off offline). */
const isShowResolveMenu = false;
const isEnchantOpen = false;

function label(ui: UIHandler, ev: number): GLabel | null {
  const w = ui.getGWidgetByEventType(ev);
  return w instanceof GLabel ? w : null;
}

/** Tool.getMoneyText(v, 1). */
function getMoneyText(v: number): string {
  return `${v}`;
}

export function updateItemToGIcon(item: Item | null, icon: GIcon | null, showStars: boolean): void {
  if (icon == null) return;
  icon.setIconIndex(item ? item.bagIcon : -1, item ? item.grade : -1);
  icon.setNumber(item && item.quantity > 1 ? item.quantity : 0);
  icon.setObj(item);
  icon.clearsetIconStarNum();
  if (item != null && showStars) {
    if (item.ascensionStar > 0 && item.star > 0) icon.setIconStarNum(item.star, 1);
    if (item.attachDone > 0) icon.setIconStarNum(item.attachDone, 0);
  }
  icon.setMask(false);
  icon.isClear = true;
}

/** Equipment slots 0..17 are the GIcons whose event type is the slot number. */
export function updateBagEquipItemToGIcon(ui: UIHandler, bag: PlayerBag): void {
  for (let i = 0; i <= 17; i++) {
    const icon = ui.getGWidgetByEventType(i);
    if (icon instanceof GIcon) updateItemToGIcon(bag.getItem(i), icon, ui.isStatusFlag(STATUS_SHOW_STAR));
  }
  const fashion = ui.getGWidgetByEventType(17);
  const item = bag.getItem(17);
  if (fashion instanceof GIcon && item != null) fashion.setMask(item.expireTime - Date.now() <= 0 && item.expireTime !== 0);
}

/** Bag page (window 32 tab) i shows slots 30 + 30·i … into window 34. */
export function updateDataToMyPlayerBag(ui: UIHandler, player: Player): void {
  const tabs = ui.getGWindowByEventType(32);
  if (tabs == null || player.bag == null) return;
  const page = tabs.focusIndex;
  tabs.setFocusIndex(page);
  if (tabs.focusWidget instanceof GLabel) tabs.focusWidget.setIsFocusLabelOffset([0, 3]);
  const grid = ui.getGWindowByEventType(34);
  if (grid == null) return;
  const start = page * BAG_PAGE_SIZE + BAG_START;
  for (let i = 0; i < grid.getChildNum(); i++) {
    const icon = grid.getJavaChild(i);
    updateItemToGIcon(player.bag.getItem(start + i), icon instanceof GIcon ? icon : null, ui.isStatusFlag(STATUS_SHOW_STAR));
  }
  updateDataToPlayerMoney(ui, player);
}

export function updateDataToPlayerMoney(ui: UIHandler, player: Player): void {
  label(ui, 907)?.setText(getMoneyText(player.get(ATTR_MONEY1)));
  label(ui, 908)?.setText(getMoneyText(player.get(ATTR_MONEY2)));
  label(ui, 909)?.setText(getMoneyText(player.get(ATTR_MONEY3)));
}

/** Name and count of the selected item in label 31 ("(Tiến bậc)" in yellow for upgrade items). */
export function updateItemNameToBagUI(ui: UIHandler, w: GWidget | null): void {
  if (w == null) return;
  const name = label(ui, 31);
  if (name == null) return;
  const item = w.getObj();
  if (item instanceof Item) {
    const up = item.isUpgradeItem ? PowerString.makeColorString('(Tiến bậc)', 16776960) : '';
    name.setPowerText(`${item.name}${up}${STR_X}${item.quantity >= 1 ? item.quantity : 1}`);
  } else {
    name.setPowerText('');
  }
}

function tabText(ui: UIHandler): string {
  const tabs = ui.getGWindowByEventType(240);
  const t = tabs?.focusWidget instanceof GLabel ? tabs.focusWidget.getText() : null;
  return t ?? STR_EQUIP;
}

export function updateDataToPlayerEquipUI(ui: UIHandler, player: Player, firstTime: boolean): void {
  const frame = ui.getFrameContainer();
  if (frame == null || player.bag == null || GameWorld.myPlayer == null) return;
  frame.setObj(player);
  let shopPanel = ui.getGWidgetByEventType(39);
  if (shopPanel == null) {
    // The shop panel lives in ui/67; borrow it (and its children) into this screen's table.
    const other = UIHandler.createUIFromXML(TYPE_SHOP_PANEL);
    const panel = other.getGWidgetByEventType(39);
    if (panel instanceof GContainer) {
      shopPanel = panel;
      ui.addEventGWidget(panel);
      for (const ev of [41, 43, 11356]) ui.addEventGWidget(panel.getJavaChildByEvent(ev));
    }
  }
  if (shopPanel) frame.remove(shopPanel);
  const equipWin = ui.getGWindowByEventType(30);
  if (equipWin) frame.remove(equipWin);
  const bagPanel = ui.getGWidgetByEventType(42);
  if (bagPanel) frame.remove(bagPanel);
  const tabs = ui.getGWindowByEventType(240);
  if (tabs != null) {
    tabs.setFocusIndex(tabs.focusIndex);
    if (tabs.focusWidget instanceof GLabel) tabs.focusWidget.setIsFocusLabelOffset([0, 3]);
  }
  const text = tabText(ui);
  const left = label(ui, 38);
  const right = label(ui, 43);
  left?.setShow(true);
  right?.setShow(true);
  if (text === STR_EQUIP) {
    if (equipWin) frame.add(equipWin);
    const doll = ui.getGWidgetByEventType(33);
    if (doll instanceof GGameIcon) doll.setSprite(GameSprite.cloneSprite(player.getPlayerSprite()));
    updateBagEquipItemToGIcon(ui, player.bag);
    if (left) {
      left.setText(STR_SORT);
      if (player !== GameWorld.myPlayer) left.setShow(false);
    }
  } else if (text === STR_SELL || text === STR_HANG || text === STR_RESOLVE || text === STR_ENCHANT) {
    if (shopPanel) frame.add(shopPanel);
    // GameWorld.shopList / tempList / tempEnChantList come from the server: empty offline.
    const grid = ui.getGWindowByEventType(41);
    for (let i = 0; grid != null && i < grid.getChildNum(); i++) {
      const icon = grid.getJavaChild(i);
      updateItemToGIcon(null, icon instanceof GIcon ? icon : null, ui.isStatusFlag(STATUS_SHOW_STAR));
    }
    if (left) {
      if (text === STR_SELL) left.setText(STR_SELL_LOG);
      else if (text === STR_HANG) left.setText(STR_HANG);
      else left.setShow(false);
    }
    if (right) {
      if (text === STR_SELL) right.setText(STR_OPEN);
      else if (text === STR_HANG) right.setText(STR_CANCEL);
      else if (text === STR_RESOLVE) right.setText(STR_RESOLVE_DO);
      else right.setText(STR_ENCHANT_EQUIP);
    }
  } else if (text === STR_PROVIDE && left) {
    left.setText(STR_PROVIDE);
  }
  if (bagPanel) frame.add(bagPanel);
  updateDataToMyPlayerBag(ui, player);
  const grid = ui.getGWindowByEventType(34);
  if (grid == null) return;
  if (firstTime) {
    grid.setFocus(grid.getJavaChild(0));
    updateItemNameToBagUI(ui, grid.getJavaChild(0));
  }
  label(ui, 11316)?.setText(ui.isStatusFlag(STATUS_SHOW_STAR) ? 'Đóng' : 'Xem');
  const enchantSell = ui.getGWidgetByEventType(11356);
  if (enchantSell instanceof GLinePanel) enchantSell.setShow(text === STR_SELL && isEnchantOpen);
  ui.show();
}

/** UIHandler.updateEquipUI: reacts when the acted-on widget changes window (runs for every UI). */
function updateEquipUI(ui: UIHandler): void {
  const w = ui.getActionGWidget();
  if (w == null || ui.getOldActionGWidget() === w) return;
  const win = w.getParentWindow();
  if (win == null) return;
  const ev = win.getEventType();
  const player = ui.getFrameContainer()?.getObj();
  if (ev === 30) equipUIWindowChange(ui, true);
  else if (ev === 32) {
    if (player != null) updateDataToMyPlayerBag(ui, player as Player);
    ui.getGWindowByEventType(34)?.setFirstFocus();
    equipUIWindowChange(ui, false);
  } else if (ev === 34) equipUIWindowChange(ui, false);
  else if (ev === 240 && ui.getFrameContainer()?.getEventType() === 500) {
    if (ui.getGWindowByEventType(32) == null || player == null) return;
    updateDataToPlayerEquipUI(ui, player as Player, false);
  }
}

/** Only one of the equipment (30) and bag (34) grids keeps a focus; the name follows it. */
function equipUIWindowChange(ui: UIHandler, equipSide: boolean): void {
  const bag = ui.getGWindowByEventType(34);
  const equip = ui.getGWindowByEventType(30);
  let focused: GWidget | null = null;
  if (equipSide) {
    bag?.setFocus(null);
    focused = equip?.focusWidget ?? null;
  } else {
    equip?.setFocus(null);
    focused = bag?.focusWidget ?? null;
  }
  updateItemNameToBagUI(ui, focused);
}

UIHandler.updateUIHooks.push((ui) => updateEquipUI(ui));

/** UIHandler.createWorldEquipUI(player, tab). */
export function createWorldEquipUI(player: Player | null, tab: number): void {
  if (player == null) return;
  if (player.bag == null) {
    alertMessage(STR_BAG_NULL);
    return;
  }
  const other = player !== GameWorld.myPlayer;
  const ui = UIHandler.createUIFromXML(TYPE_PLAYER_EQUIP);
  ui.setDefaultListener();
  ui.show();
  UIHandler.addUI(ui);
  ui.setStatusFlag(false, 1024);
  const tabs = ui.getGWindowByEventType(240);
  if (tabs != null) {
    tabs.setFocusIndex(tab);
    const hide = (text: string) => {
      for (const c of tabs.children) if (c instanceof GLabel && c.getText() === text) return c.setShow(false);
    };
    if (!isShowResolveMenu || other) hide(STR_RESOLVE);
    if (!isEnchantOpen || other) hide(STR_ENCHANT);
    if (other) tabs.getJavaChild(1)?.setShow(false);
  }
  updateDataToPlayerEquipUI(ui, player, true);
}

/** UIAction.processPlayerEquipLayer (the parts that work without the server). */
function processPlayerEquipLayer(ui: UIHandler, action: number): void {
  const player = ui.getFrameContainer()?.getObj() as Player | null;
  if (player == null) return;
  if (action === 1 || action === 14) {
    ui.close();
    return;
  }
  if (action === 50 || action === 107 || action === 150 || action === 108) {
    updateDataToPlayerEquipUI(ui, player, false);
    return;
  }
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  const item = w.getObj();
  const ev = w.getEventType();
  if (ev === 11316) {
    ui.setStatusFlag(!ui.isStatusFlag(STATUS_SHOW_STAR), STATUS_SHOW_STAR);
    updateDataToPlayerEquipUI(ui, player, false);
    return;
  }
  if (ev === 38 || ev === 43) {
    // processEquipTextAction: sorting, selling, resolving… all are server requests.
    if (w instanceof GLabel && w.getText()) alertMessage(STR_NEED_SERVER);
    return;
  }
  if (ev === 11356 || ev === 11371) {
    alertMessage(STR_NEED_SERVER);
    return;
  }
  const win = w.getParentWindow();
  if (win == null) return;
  const wev = win.getEventType();
  if ((wev === 30 || wev === 34 || wev === 41) && item instanceof Item) createPlayerEquipPopMenu(ui, item, tabText(ui));
}

registerScreen('equip', {
  // ui/4 (item pop-up), 52 / 31 / 32 (pet info and its tabs, from the pet item).
  uiTypes: [TYPE_PLAYER_EQUIP, TYPE_SHOP_PANEL, TYPE_EQUIP_POP, 52, 31, 32],
  open: (tab = 0) => createWorldEquipUI(GameWorld.myPlayer, tab),
  processLayerAction: (ui, action) =>
    ui.getType() === TYPE_EQUIP_POP ? processEquipPopLayer(ui, action) : processPlayerEquipLayer(ui, action),
});
