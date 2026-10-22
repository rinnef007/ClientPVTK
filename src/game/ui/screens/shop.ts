// The NPC item shop (ui/42): GameWorld.doBrowseShop / ShopItem.openItemShop, UIHandler.createShopItemUI
// / updateDataToShopItemUI / updateDataToShopItemInfo / updateDataToPlayerMoney and
// UIAction.processShopItemLayer / processShopItemMenu, ShopItem.doItemShopBuyMsg / doItemshopSellMsg,
// Model.checkEnoughMoney (CFR, Vineflower and jadx decompiles). Tabs "Mua" (the shop's goods) and
// "Bán" (the bag), 8 rows a page; a row shows the item's icon, name and price, the box below its
// buy / sell buttons. The goods and the answers to buying and selling come from ShopServer, a local
// simulation. Not ported: the other shop kinds (mercenaries, compose, arena, pets, enchant, VIP…),
// the equipment preview sprite (4228), "Bán thông minh" (auto sell) and paying KNB for missing Lá.
import { GContainer, GIcon, GLabel, GWidget, GWindow, uiScreen } from '../../gui/GWidget';
import { MessageFrame } from '../../core/MessageFrame';
import { ShopItem } from '../../core/ShopItem';
import { Item, copyAsItem } from '../../actor/Item';
import { ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, type Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { setPlayerMoney, simBuy, simSell, simShopList } from '../../main/ShopServer';
import { online } from '../../../net/online/Online';
import { createItemShopBuy, createItemShopListMsg, createItemShopSell, readBuyReply, readSellReply, readShopList } from '../../../net/online/ShopMessages';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject, registerPageUpdater } from '../UIObject';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';
import { updateDataToPlayerMoney } from './equip';
import { confirm } from './twiceSure';

export const TYPE_SHOP_ITEM = 42;
const STR_BUY = 'Mua'; // GameText 62
const STR_SELL = 'Bán'; // GameText 99
const STR_BUY99 = 'Mua99'; // GameText 59
const STR_BUY30 = 'Mua30'; // GameText 60
const STR_BUY1 = 'Mua1'; // GameText 61
const STR_SELL1 = 'Bán1'; // GameText 36
const STR_SELL_ALL = 'BánHết'; // GameText 38
const STR_SELL_ONE = 'Bán'; // GameText 63
const STR_TIP = 'Gợi ý'; // GameText 15
const STR_X = ' x '; // GameText 64
/** GameText.ITEM_SHOP_TAB[0]: the item shop's tabs. */
const ITEM_SHOP_TAB = [STR_BUY, STR_SELL];
const EV_TABS = 240;
const EV_GRID = 4212;
const EV_ROW = 4222;
const EV_BUTTONS = 4225;
const EV_BUY99 = 4208;
const EV_BUY30 = 4210;
const EV_BUY1 = 4211;

function lbl(ui: UIHandler, ev: number): GLabel | null {
  const w = ui.getGWidgetByEventType(ev);
  return w instanceof GLabel ? w : null;
}

function tabText(ui: UIHandler): string {
  const tabs = ui.getGWindowByEventType(EV_TABS);
  if (tabs == null) return STR_BUY;
  if (tabs.focusWidget == null) tabs.setFirstFocus();
  return tabs.focusWidget instanceof GLabel ? (tabs.focusWidget.getText() ?? STR_BUY) : STR_BUY;
}

/** The row (direct child of the grid) holding `w`. */
function rowOf(win: GWindow, w: GWidget | null): GWidget | null {
  for (let c: GWidget | null = w; c != null; c = c.parent) if (c.parent === win) return c;
  return null;
}

/**
 * GameWorld.doBrowseShop: only the ordinary item shop (ShopItem.openItemShop) is ported; the shop
 * kinds Java tells apart by id ranges (Define.isSoldierShop…) are not known offline.
 */
export function doBrowseShop(id: number): void {
  const session = online.session;
  if (session) {
    // ShopItem.openItemShop against the user's backend.
    void session
      .request(createItemShopListMsg(id))
      .then((r) => {
        const goods = readShopList(r, id);
        if (goods.length === 0) return;
        shopID = id;
        createShopItemUI(goods, 0);
      })
      .catch((e) => alertMessage(e instanceof Error ? e.message : String(e), 'Lỗi'));
    return;
  }
  const list = simShopList(id);
  if (list == null) {
    alertMessage(STR_NEED_SERVER);
    return;
  }
  createShopItemUI(list, 0);
}

/** createShopItemUI (sub type 0, not a VIP shop): the tabs, a goods MessageFrame, the first page. */
export function createShopItemUI(list: ShopItem[], sub: number): void {
  const ui = UIHandler.createUIFromXML(TYPE_SHOP_ITEM);
  const o = new UIObject(ui);
  ui.setDefaultListener();
  ui.setSubType(sub);
  ui.show();
  o.setPageClientData(true);
  o.setPageRequestUpdate(true);
  o.object = list; // UIObject.tempObjList
  const grid = ui.getGWindowByEventType(EV_GRID);
  if (grid == null) return;
  o.setPageDisplayNum(grid.getChildNum());
  const tabs = ui.getGWindowByEventType(EV_TABS);
  if (tabs == null) return;
  tabs.children.forEach((c, i) => c instanceof GLabel && c.setText(ITEM_SHOP_TAB[i] ?? ''));
  ui.getFrameContainer()?.addTopDraw(new MessageFrame(((uiScreen.width / 3) | 0) * 2, 2, true));
  updateDataToShopItemUI(ui);
  UIHandler.addUI(ui);
}

/** The tab's list ("Mua": the goods, "Bán": the bag) into the pager, which fills the grid. */
export function updateDataToShopItemUI(ui: UIHandler): void {
  const o = ui.obj;
  if (!(o instanceof UIObject)) return;
  const tabs = ui.getGWindowByEventType(EV_TABS);
  if (tabs?.focusWidget instanceof GLabel) tabs.focusWidget.setIsFocusLabelOffset([0, 3]);
  const tab = tabText(ui);
  let list: unknown[] | null = null;
  if (tab === STR_BUY) list = o.object as ShopItem[];
  else if (tab === STR_SELL) list = GameWorld.myPlayer?.bag?.bagItems().map(([, it]) => it) ?? [];
  o.setPageObjList(list);
  o.getPageData();
}

/** One page into the grid rows: name, icon (greyed when sold out), hot / new marks, price. */
function updateShopItemPage(ui: UIHandler, page: unknown[]): void {
  const grid = ui.getGWindowByEventType(EV_GRID);
  if (grid == null) return;
  if (grid.focusWidget == null) grid.setFirstFocus();
  grid.children.forEach((row, n) => {
    if (!(row instanceof GContainer)) return;
    const it = page[n] instanceof Item ? (page[n] as Item) : null;
    row.setObj(it);
    const name = row.getJavaChildByEvent(4218);
    if (name instanceof GLabel) {
      const up = it?.isUpgradeItem ? '/cFFFF00(Tiến bậc)/p' : '';
      name.setPowerText(it ? it.name + up : '');
    }
    const icon = row.getJavaChildByEvent(4219);
    if (icon instanceof GIcon) {
      icon.setShow(it != null);
      if (it != null) {
        icon.setIconIndex(it.bagIcon, it.grade);
        icon.setNumber(it.quantity > 1 ? it.quantity : 0);
        icon.setMask(it instanceof ShopItem && it.isSoldOut());
      }
    }
    const hot = row.getJavaChildByEvent(4230);
    const fresh = row.getJavaChildByEvent(4231);
    hot?.setShow(it instanceof ShopItem && it.hotTypeOrNewItem === 1);
    fresh?.setShow(it instanceof ShopItem && it.hotTypeOrNewItem === 2);
    const money = row.getJavaChildByEvent(4224);
    if (money instanceof GIcon) money.setIconIndex(it != null && it.getPrice() > 0 ? it.getMoneyIconIndex() : -1);
    const price = row.getJavaChildByEvent(4217);
    if (price instanceof GLabel) {
      price.setShow(it != null);
      if (it != null) price.setText(it.getPrice() > 0 ? `${it.getPrice()}` : '');
    }
  });
  updateDataToShopItemInfo(ui, tabText(ui), focusedItem(ui));
  const me = GameWorld.myPlayer;
  if (me != null) updateDataToPlayerMoney(ui, me);
}

function focusedItem(ui: UIHandler): Item | null {
  const obj = ui.getGWindowByEventType(EV_GRID)?.focusWidget?.getObj();
  return obj instanceof Item ? obj : null;
}

/**
 * The box under the grid: icon, name, total price and the buttons for the tab; the item's
 * description goes to the MessageFrame, or to an alert when a row was tapped.
 */
function updateDataToShopItemInfo(ui: UIHandler, tab: string, item: Item | null): void {
  ui.getGWidgetByEventType(4228)?.setShow(false); // equipment preview (Player.getCompareSprite): not ported
  const box = ui.getGWidgetByEventType(4229);
  box?.setPos(15, box.getY());
  const total = lbl(ui, 4206);
  if (total) {
    total.setShow(item != null);
    if (item) total.setText(`${item.quantity > 0 ? item.getPrice() * item.quantity : item.getPrice()}`);
  }
  const icon = ui.getGWidgetByEventType(4207);
  if (icon instanceof GIcon) {
    icon.setShow(item != null);
    if (item) icon.setIconIndex(item.bagIcon, item.grade);
  }
  const name = lbl(ui, 4209);
  if (name) {
    name.setShow(item != null);
    if (item) name.setText(item.name);
  }
  const money = ui.getGWidgetByEventType(4223);
  if (money instanceof GIcon) {
    money.setShow(item != null);
    if (item) money.setIconIndex(item.getMoneyIconIndex());
  }
  const buttons = ui.getGWindowByEventType(EV_BUTTONS);
  const b99 = lbl(ui, EV_BUY99);
  const b30 = lbl(ui, EV_BUY30);
  const b1 = lbl(ui, EV_BUY1);
  if (buttons && b99 && b30 && b1) {
    buttons.clear();
    const add = (b: GLabel, t: string) => {
      buttons.add(b);
      b.setText(t);
    };
    if (item && tab === STR_BUY) {
      if (item.stackNum > 1) {
        add(b99, STR_BUY99);
        add(b30, STR_BUY30);
        add(b1, STR_BUY1);
      } else add(b1, STR_BUY);
    } else if (item && tab === STR_SELL) {
      if (item.stackNum > 1) {
        add(b30, STR_SELL_ALL);
        add(b1, STR_SELL1);
      } else add(b1, STR_SELL_ONE);
    }
    buttons.show();
  }
  if (item != null && ui.getActionGWidget()?.getEventType() === EV_ROW) alertMessage(item.getDesc());
}

/** processShopItemLayer: 108 refreshes; tabs, pages, rows and the buy / sell buttons. */
function processShopItemLayer(ui: UIHandler, action: number): void {
  const o = ui.obj;
  if (!(o instanceof UIObject)) return;
  if (action === 108) return updateDataToShopItemUI(ui);
  if (action === 1) return ui.close();
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  const ev = w.getEventType();
  const tabs = ui.getGWindowByEventType(EV_TABS);
  const grid = ui.getGWindowByEventType(EV_GRID);
  if (tabs != null && w.parent === tabs) {
    if (tabs.focusWidget !== w) tabs.setFocus(w);
    return updateDataToShopItemUI(ui);
  }
  if (ev === 902 || ev === 903) {
    o.doUpAndDownPageEvent(ev);
    return;
  }
  const row = grid ? rowOf(grid, w) : null;
  if (grid && row) {
    if (grid.focusWidget !== row) grid.setFocus(row);
    return updateDataToShopItemInfo(ui, tabText(ui), focusedItem(ui));
  }
  if ((ev === EV_BUY99 || ev === EV_BUY30 || ev === EV_BUY1) && w instanceof GLabel) {
    processShopItemMenu(ui, focusedItem(ui), w.getText() ?? '');
  }
}

/** processShopItemMenu: the button's text picks how many to buy or sell. */
function processShopItemMenu(ui: UIHandler, item: Item | null, text: string): void {
  const p = GameWorld.myPlayer;
  if (p == null) return;
  if (item == null) {
    alertMessage('Không có vật phẩm lựa chọn', 'Cảnh cáo'); // UIHandler.warnMessage
    return;
  }
  const done = () => ui.notifyLayerAction(108);
  const shop = item instanceof ShopItem ? item : null;
  if (text === STR_BUY99 && shop) doItemShopBuyMsg(p, shop, 99, done);
  else if (text === STR_BUY30 && shop) doItemShopBuyMsg(p, shop, 30, done);
  else if ((text === STR_BUY1 || text === STR_BUY) && shop && ui.getSubType() === 0) doItemShopBuyMsg(p, shop, 1, done);
  else if (text === STR_SELL_ALL) doItemshopSellMsg(p, item, item.quantity, done);
  else if (text === STR_SELL1 || text === STR_SELL_ONE) doItemshopSellMsg(p, item, 1, done);
}

/**
 * Model.checkEnoughMoney: the shortfall per money with what the player has. Java offers to top up
 * (createPayInfoListUI) when KNB or Lá are short, and lets KNB cover missing Lá; here it only says so.
 */
export function checkEnoughMoney(p: Player, m1: number, m2: number, m3: number): boolean {
  let s = '';
  const short = (have: number, need: number, name: string) => {
    if (have >= need) return false;
    s += `${name} không đủ, cần ${need}/cFF0000(Hiện có  ${have})/p\n`;
    return true;
  };
  const a = short(p.get(ATTR_MONEY1), m1, 'KNB');
  const b = short(p.get(ATTR_MONEY2), m2, 'Lá');
  const c = short(p.get(ATTR_MONEY3), m3, 'Bạc');
  if (a || b) alertMessage(s, 'Tiền không đủ');
  else if (c) alertMessage(s, 'Đồng không đủ');
  return !(a || b || c);
}

/** ShopItem.doItemShopBuyMsg: asks first for big spends, then buys (ShopServer) and reports. */
function doItemShopBuyMsg(p: Player, item: ShopItem, n: number, done: () => void): void {
  const [m1, m2, m3] = [item.money1 * n, item.money2 * n, item.money3 * n];
  const buy = () => {
    if (!checkEnoughMoney(p, m1, m2, m3)) return;
    if (online.session) {
      void buyOnline(p, item, n, done);
      return;
    }
    const r = simBuy(p, item, n);
    if (!r.ok) {
      alertMessage(r.text, 'Lỗi'); // UIHandler.errorMessage
      return;
    }
    alertMessage(`Mua thành công${item.getNameInfo()}${STR_X}${n}\n${r.text}`);
    done();
  };
  if ((n > 1 && m1 > 0) || m1 >= 40 || m2 >= 100) {
    let cost = '';
    if (m1 > 0) cost += `KNB${m1}`;
    if (m2 > 0) cost += ` Lá${m2}`;
    if (m3 > 0) cost += ` Bạc${m3}`;
    confirm(STR_TIP, `Mua/cFFFF00${item.name} ${n}/p cái, cần tiêu hao /cff0000${cost}/p , đồng ý không?`, buy);
  } else buy();
}

/** ShopItem.doItemshopSellMsg: always asks, then sells (ShopServer). */
function doItemshopSellMsg(p: Player, item: Item, n: number, done: () => void): void {
  confirm(STR_TIP, `Đồng ý bán ${item.getNameInfo()} không?`, () => {
    if (online.session) {
      void sellOnline(p, item, n, done);
      return;
    }
    const r = simSell(p, item, n);
    if (!r.ok) {
      alertMessage(r.text, 'Lỗi');
      return;
    }
    alertMessage(`Bán thành công${item.getNameInfo()}${STR_X}${n}`);
    done();
  });
}

/** GameWorld.shopID: the shop being browsed (sent with buy / sell requests). */
let shopID = 0;

/** The rest of doItemShopBuyMsg once the backend answers. */
async function buyOnline(p: Player, item: ShopItem, n: number, done: () => void): Promise<void> {
  try {
    const r = readBuyReply(await online.session!.request(createItemShopBuy(shopID, item, n)));
    if (r.kind === 'priceChanged') {
      alertMessage('Người quản lý đã điều chỉnh thuế suất khiến giá tiền thay đổi, mời bạn xem!'); // STR_COUNTRY_PRICE_ADUST
      return;
    }
    if (r.kind === 'appearance') {
      alertMessage('Đổi kiểu tóc / khuôn mặt chưa được hỗ trợ.', 'Lỗi');
      return;
    }
    item.maxBuy = r.maxBuy;
    item.allCount = r.allCount;
    if (r.id !== item.id || r.count !== n) return;
    p.bag?.addItem(copyAsItem(item), n);
    const money = setPlayerMoney(p, ...r.money);
    alertMessage(`Mua thành công${item.getNameInfo()}${STR_X}${n}\n${money}`);
    done();
  } catch (e) {
    alertMessage(e instanceof Error ? e.message : String(e), 'Lỗi');
  }
}

/** doItemshopSellMsg: the bag loses the items, the reply carries the new Bạc (setMoneyByType 13). */
async function sellOnline(p: Player, item: Item, n: number, done: () => void): Promise<void> {
  try {
    const bac = readSellReply(await online.session!.request(createItemShopSell(shopID, item.id, item.slotPos, n)));
    const bag = p.bag;
    if (bag) {
      item.quantity -= n;
      if (item.quantity <= 0) bag.setItem(item.slotPos, null);
    }
    p.set(ATTR_MONEY3, bac);
    alertMessage(`Bán thành công${item.getNameInfo()}${STR_X}${n}`);
    done();
  } catch (e) {
    alertMessage(e instanceof Error ? e.message : String(e), 'Lỗi');
  }
}

registerPageUpdater(TYPE_SHOP_ITEM, updateShopItemPage);

registerScreen('shopItem', {
  uiTypes: [TYPE_SHOP_ITEM],
  open: (id = 0) => doBrowseShop(id),
  processLayerAction: processShopItemLayer,
});
