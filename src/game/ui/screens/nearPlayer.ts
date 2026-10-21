// Players around (ui/73, "X.Quanh"): UIHandler.createNearPlayerUI / updateDataToNearPlayerUI /
// updateDataToNearPlayerSprite / updateDataToModelInfo and UIAction.processNearPlayerLayer (CFR).
// The "Quanh" tab lists GameWorld.otherModels 8 per page; "Đội" lists the team (empty offline).
// Not ported: VIP / GM / photo icons, the filter menu (7301) and the per-player menu (server
// actions: trade, team, duel…).
import { GGameIcon, GLabel, GLinePanel, GWidget, GWindow } from '../../gui/GWidget';
import type { Model } from '../../actor/Model';
import * as GameWorld from '../../main/GameWorld';
import { GameSprite } from '../../sprite/GameSprite';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject, registerPageUpdater } from '../UIObject';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';

export const TYPE_NEAR_PLAYER = 73;
export const EVENT_NEAR_LIST_WINDOW = 7302;
const STR_AROUND = 'Quanh'; // GameText 40
const STR_TEAM = 'Đội'; // GameText 105
const STR_NEAR_PLAYER = 'Người chơi xung quanh'; // GameText.STR_NEAR_PLAYER
const STR_NEAR_NO_PLAYER = 'Xung quanh không có người chơi khác!'; // GameText.STR_NEAR_NO_PLAYER
/** Define.NEARSTR: the filter label by filter index (0 = no filter). */
const NEARSTR = ['Lọc', 'Bày bán', 'Sạp', 'Tổ đội', 'Chiến đấu', 'Hình', 'Nhàn rỗi'];
const JOB_TEXT = ['', 'H.Khách', 'T.Chân', 'Ch.sĩ', 'P.sư', 'Hiền Giả', 'Võ Thánh', 'Duệ Trí', 'Dũng Mãnh', 'Tấn Tiệp', 'Vua Súng', 'Chùy Sư', 'Lam Vũ'];

/** GameWorld.getTypeModel(filter): other players, shuffled (the VIP/robot sort is not ported). */
function getTypeModel(filter: number): Model[] {
  const me = GameWorld.myPlayer;
  const all = [...GameWorld.otherModels.values()];
  if (filter === 7) return all.filter((m) => me?.isPlayerTeam() && m.isPlayerTeam());
  const keep = (m: Model) => {
    switch (filter) {
      case 1: return m.isShopMode() && m.shopType === 0;
      case 2: return m.isShopMode() && m.shopType === 1;
      case 3: return m.isPlayerTeam();
      case 4: return m.isBattleMode();
      case 5: return m.hasPhoto;
      case 6: return !m.isPlayerTeam() && !m.isShopMode() && !m.isBattleMode();
      default: return true;
    }
  };
  const list = all.filter(keep);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function tabText(ui: UIHandler): string {
  const tabs = ui.getGWindowByEventType(240);
  if (tabs == null) return STR_AROUND;
  if (tabs.focusWidget == null) tabs.setFirstFocus();
  if (tabs.focusWidget instanceof GLabel) tabs.focusWidget.setIsFocusLabelOffset([0, 3]);
  return tabs.focusWidget instanceof GLabel ? (tabs.focusWidget.getText() ?? STR_AROUND) : STR_AROUND;
}

/** Rebuilds the rows for the current tab (rebuild = true) or fills them with one page of models. */
export function updateDataToNearPlayerUI(ui: UIHandler, page: unknown[] | null = null, rebuild = true): void {
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  const me = GameWorld.myPlayer;
  const win = ui.getGWindowByEventType(EVENT_NEAR_LIST_WINDOW);
  if (obj == null || me == null || win == null) return;
  if (win.focusWidget == null) win.setFirstFocus();
  const tab = tabText(ui);
  if (rebuild) {
    for (let i = win.getChildNum() - 1; i >= 0; i--) win.remove(win.getJavaChild(i)!);
    let list: Model[] = [];
    if (tab === STR_AROUND) {
      list = getTypeModel(obj.intValue1);
      const tpl = ui.getGWidgetByEventType(7306);
      for (let i = 0; tpl && i < obj.getPageDisplayerNum(); i++) win.add(tpl.getClone());
    } else if (tab === STR_TEAM) {
      list = getTypeModel(7);
      const tpl = ui.getGWidgetByEventType(7307);
      for (let i = 0; tpl && i < 4; i++) win.add(tpl.getClone());
    }
    ui.show();
    obj.setPageObjList(list);
    obj.getPageData();
    return;
  }
  const filter = ui.getGWidgetByEventType(7301);
  if (filter instanceof GLabel) {
    if (tab === STR_AROUND) {
      filter.setShow(true);
      filter.setText(NEARSTR[obj.intValue1] ?? `near_${obj.intValue1}`);
    } else if (tab === STR_TEAM) {
      if (me.isPlayerTeam()) {
        filter.setShow(true);
        filter.setText(me.isLeader() ? 'Giải tán' : 'Rời đội');
      } else {
        filter.setShow(false);
      }
    }
  }
  const models = page ?? [];
  win.children.forEach((row, i) => {
    const m = (models[i] as Model | undefined) ?? null;
    row.setObj(m);
    if (tab === STR_AROUND) {
      const name = row instanceof GLinePanel ? row.getJavaChildByEvent(7303) : null;
      if (name instanceof GLabel) {
        let text = '';
        if (m != null) {
          text = m.isShopMode() ? m.shopName : `${m.getRemark().trim() ? m.getRemark() : m.getName()}(Lv ${m.getLevel()}${JOB_TEXT[m.getJob()] ?? ''})`;
        }
        name.setText(text);
      }
      const state = row instanceof GLinePanel ? row.getJavaChildByEvent(7305) : null;
      if (state instanceof GLabel) state.setText(m != null ? m.getModelString() : '');
      const see = row instanceof GLinePanel ? row.getJavaChildByEvent(7304) : null;
      see?.setShow(m != null);
    } else if (tab === STR_TEAM && row instanceof GLinePanel) {
      updateDataToModelInfo(row, m);
    }
  });
  const sel = win.focusWidget?.getObj();
  updateDataToNearPlayerSprite(ui, (sel as Model | null) ?? null);
}

/** The team row: doll, name, "Lv N" + job, team role. (Bars and rank text are not ported.) */
function updateDataToModelInfo(row: GLinePanel, m: Model | null): void {
  const doll = row.getJavaChildByEvent(30000);
  if (doll instanceof GGameIcon) {
    if (m != null) doll.setSprite(GameSprite.cloneSprite(m.getPlayerSprite()));
    doll.setShow(m != null);
  }
  const set = (ev: number, text: string) => {
    const l = row.getJavaChildByEvent(ev);
    if (l instanceof GLabel) l.setText(text);
  };
  set(30001, m?.getName() ?? '');
  const lv = m != null ? `Lv ${m.getLevel()}` : '';
  const job = m != null ? (JOB_TEXT[m.getJob()] ?? '') : '';
  set(30002, lv);
  set(30003, job);
  set(30004, `${lv}${job}`);
  set(30005, m == null ? '' : m.isLeader() ? 'Đội trưởng ' : m.isMember() ? 'Đội viên' : '');
  set(30038, ''); // country rank: "Lính" (8) / "Viện quân" (9), not known offline
}

/** The selected player's doll (7313), only on the "Quanh" tab. */
export function updateDataToNearPlayerSprite(ui: UIHandler, m: Model | null): void {
  const doll = ui.getGWidgetByEventType(7313);
  if (!(doll instanceof GGameIcon)) return;
  if (m != null && tabText(ui) === STR_AROUND) {
    doll.setSprite(GameSprite.cloneSprite(m.getPlayerSprite()));
    doll.setShow(true);
  } else {
    doll.setShow(false);
  }
}

export function createNearPlayerUI(focusTab: number): void {
  if (GameWorld.otherModels.size <= 0) {
    alertMessage(STR_NEAR_NO_PLAYER, STR_NEAR_PLAYER);
    return;
  }
  const ui = UIHandler.createUIFromXML(TYPE_NEAR_PLAYER);
  const obj = new UIObject(ui);
  obj.setPageClientData(true);
  obj.setPageRequestUpdate(true);
  obj.intValue1 = 0;
  ui.setDefaultListener();
  ui.show();
  const list = ui.getGWindowByEventType(EVENT_NEAR_LIST_WINDOW);
  if (list == null) return;
  obj.setPageDisplayNum(list.getChildNum());
  ui.getGWindowByEventType(240)?.setFocusIndex(focusTab);
  updateDataToNearPlayerUI(ui);
  UIHandler.addUI(ui);
}

function processNearPlayerLayer(ui: UIHandler, action: number): void {
  if (action === 116) return updateDataToNearPlayerUI(ui);
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  const win = ui.getGWindowByEventType(EVENT_NEAR_LIST_WINDOW);
  if (obj == null || win == null || action !== 0) return;
  const model = (win.getJavaChild(win.focusIndex)?.getObj() as Model | null) ?? null;
  const w: GWidget | null = ui.getActionGWidget();
  if (w == null) return;
  const ev = w.getEventType();
  if (obj.doUpAndDownPageEvent(ev)) return;
  if (ev === 7301) {
    alertMessage(STR_NEED_SERVER); // filter menu / leave or disband team
    return;
  }
  const parent = w.getParentWindow();
  if (!(parent instanceof GWindow)) return;
  const pev = parent.getEventType();
  if (pev === 240) updateDataToNearPlayerUI(ui);
  else if (pev === EVENT_NEAR_LIST_WINDOW) {
    if (ev === 7304) alertMessage(STR_NEED_SERVER); // view player: asks the server
    else updateDataToNearPlayerSprite(ui, model);
  }
}

registerPageUpdater(TYPE_NEAR_PLAYER, (ui, page) => updateDataToNearPlayerUI(ui, page, false));

registerScreen('nearPlayer', {
  uiTypes: [TYPE_NEAR_PLAYER],
  open: (tab = 0) => createNearPlayerUI(tab),
  processLayerAction: processNearPlayerLayer,
});
