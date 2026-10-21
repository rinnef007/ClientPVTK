// The pet screens: the pet / mercenary list (ui/61, UIHandler.createMercenaryListUI /
// updateDataToMercenaryListUI / updateDataToModelInfo, UIAction.processMercenaryListLayer) and
// the pet info screen (ui/52, UIHandler.createPetInfoUI, PlayerInfoUIAction.updatePetOpeMenuNew /
// processPetMerInfoAction / processMerPetAction) plus UIAction.doMerPetMenuButton (CFR and
// Vineflower decompiles). Offline: pets come from the bag's pet items (demo data), mercenaries
// need the server (the "Lính" tab stays empty), and only the active pet's details are local —
// every other button (fight / rest, release, rename, seal, items, the attribute and skill tabs)
// asks the server and so shows STR_NEED_SERVER.
import { GContainer, GGameIcon, GIcon, GLabel, GWidget, GWindow } from '../../gui/GWidget';
import { getGradeColor } from '../../actor/Item';
import { MyPet } from '../../actor/MyPet';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { GameSprite } from '../../sprite/GameSprite';
import { UIHandler, alertMessage } from '../UIHandler';
import { UIObject, registerPageUpdater } from '../UIObject';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';
import { PlayerInfoUIAction, TAB_ATTRIBUTE, TAB_SKILL, updatePlayerBaseUI } from './playerInfo';
import { EVENT_SKILL_PANEL, TYPE_PLAYER_SKILL, addSkillPanelTab, processSkillListAction, updatePlayerSkillUI } from './playerSkill';
import { EVENT_ATTRIBUTE_PANEL, TYPE_PLAYER_ATTRIBUTE, processAttributeAction, updatePlayerAttributeUI } from './playerAttribute';

export const TYPE_MERCENARY_LIST = 61;
export const TYPE_PET_INFO = 52;
const EVENT_LIST_WINDOW = 6101;
const EVENT_TAB_PET = 11203;
const EVENT_TAB_MERCENARY = 11213;
const EVENT_PET_TAB = 60;

const JOB_TEXT = ['', 'H.Khách', 'T.Chân', 'Ch.sĩ', 'P.sư', 'Hiền Giả', 'Võ Thánh', 'Duệ Trí', 'Dũng Mãnh', 'Tấn Tiệp', 'Vua Súng', 'Chùy Sư', 'Lam Vũ'];

const isMyActivePet = (p: unknown) => p != null && p === GameWorld.myPlayer?.getPet();

/** The list's sub type after the tab: 11203 pets (2), 11213 mercenaries (1). */
function listSubType(ui: UIHandler): number {
  const sub = ui.getSubType();
  const tabs = ui.getGWindowByEventType(240);
  if (tabs == null || sub === 0) return sub;
  if (tabs.focusWidget == null) tabs.setFirstFocus();
  const f = tabs.focusWidget;
  if (f instanceof GLabel) f.setIsFocusLabelOffset([0, 3]);
  const ev = f?.getEventType();
  if (ev === EVENT_TAB_PET) return sub !== 4 ? 2 : sub;
  if (ev === EVENT_TAB_MERCENARY) return 1;
  return sub;
}

/** GWindow.updateJavaChild: the rows become as many fresh copies of the template. */
function updateJavaChild(win: GWindow, tpl: GWidget): void {
  const n = win.getChildNum();
  win.clear();
  for (let i = 0; i < n; i++) win.add(tpl.getClone());
}

/** Rebuilds the rows for the current tab (rebuild) or fills them with one page. */
export function updateDataToMercenaryListUI(ui: UIHandler, page: unknown[] | null = null, rebuild = true): boolean {
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  const win = ui.getGWindowByEventType(EVENT_LIST_WINDOW);
  if (obj == null || win == null) return false;
  if (win.focusWidget == null) win.setFirstFocus();
  const sub = listSubType(ui);
  if (rebuild) {
    const tplEv = sub === 2 || sub === 4 ? 6103 : sub === 1 ? 6102 : sub === 0 ? 6107 : -1;
    const tpl = ui.getGWidgetByEventType(tplEv);
    if (tpl == null) return false;
    updateJavaChild(win, tpl);
    let list: unknown[] | null = null;
    if (sub === 1) list = obj.object as unknown[] | null; // tempObjList: mercenaries (server)
    else if (sub === 2) list = MyPet.doGetBagPetItem(GameWorld.myPlayer, GameWorld.myPlayer);
    obj.setPageObjList(list);
    const state = ui.getGWidgetByEventType(6106);
    if (state instanceof GLabel) state.setText(sub === 0 ? 'Thực lực' : 'Trạng thái ');
    ui.show();
    if (obj.getPageData() || sub !== 0) return true;
    alertMessage('Tiệm Dung Binh tạm chưa có dung binh có thể thuê!');
    return false;
  }
  const mode = sub === 1 ? 3 : sub === 2 || sub === 4 ? 2 : sub === 0 ? 4 : 0;
  const models = page ?? [];
  win.children.forEach((row, i) => {
    const m = (models[i] as Player | undefined) ?? null;
    row.setObj(m);
    if (row instanceof GContainer) updateDataToModelInfo(row, m, mode);
  });
  return true;
}

/** UIHandler.updateDataToModelInfo, the parts a pet row (mode 2) uses. */
function updateDataToModelInfo(row: GContainer, m: Player | null, mode: number): void {
  const doll = row.getJavaChildByEvent(30000);
  if (doll instanceof GGameIcon) {
    if (m != null) doll.setSprite(GameSprite.cloneSprite(m.getPlayerSprite()));
    doll.setShow(m != null);
  }
  const name = row.getJavaChildByEvent(30001);
  if (name instanceof GLabel) {
    name.setText(m?.getName() ?? '');
    if (m instanceof MyPet && mode === 2) name.labelColor = getGradeColor(m.grade);
  }
  const set = (ev: number, text: string) => {
    const l = row.getJavaChildByEvent(ev);
    if (l instanceof GLabel) l.setText(text);
  };
  set(30002, m != null ? `Lv ${m.getLevel()}` : '');
  set(30003, m != null ? (JOB_TEXT[m.getJob()] ?? '') : '');
  set(30023, ''); // mercenary fight type
  set(30022, ''); // mercenary cool down
  const active = m instanceof MyPet && isMyActivePet(m);
  const fight = row.getJavaChildByEvent(30014);
  if (fight instanceof GIcon) fight.setShow(active);
  const others = m instanceof MyPet && (m.owner == null || m.owner !== GameWorld.myPlayer);
  const ops = row.getJavaChildByEvent(30026);
  if (ops instanceof GContainer) {
    ops.setShow(m != null);
    const seal = ops.getJavaChild(1);
    if (seal instanceof GLabel) {
      seal.setShow(!others);
      seal.setText('P.Ấn');
      seal.setEventType(11365);
    }
    const rename = ops.getJavaChild(0);
    if (rename instanceof GLabel) {
      rename.setShow(!others);
      rename.setText('Sửa');
      rename.setEventType(11130);
    }
  }
  const btns = row.getJavaChildByEvent(30008);
  if (btns instanceof GContainer) {
    btns.setShow(m != null);
    if (m != null && mode === 2) {
      const [b0, b1, b2] = [0, 1, 2].map((i) => btns.getJavaChild(i));
      if (b0 instanceof GLabel) {
        b0.setText(active ? 'Nghỉ' : 'Chiến');
        b0.setEventType(active ? 11132 : 11131);
        b0.setShow(!others);
      }
      if (b1 instanceof GLabel) {
        b1.setText('C.Tiết');
        b1.setEventType(11133);
      }
      if (b2 instanceof GLabel) {
        b2.setShow(!others);
        b2.setText('P.sinh');
        b2.setEventType(11134);
      }
    }
  }
}

/** createMercenaryListUI(player, 2): the pet tab ("Pet"), opened from the HUD. */
export function createMercenaryListUI(player: Player | null, sub: number): void {
  if (player == null) return;
  const ui = UIHandler.createUIFromXML(TYPE_MERCENARY_LIST);
  const obj = UIObject.getUIObj(ui);
  ui.setSubType(sub);
  ui.setDefaultListener();
  const title = ui.getGWidgetByEventType(6104);
  if (!(title instanceof GLabel) || ui.getGWindowByEventType(240) == null) return;
  title.setText('Pet');
  title.setShow(false);
  obj.setPageClientData(true);
  obj.setPageRequestUpdate(true);
  const win = ui.getGWindowByEventType(EVENT_LIST_WINDOW);
  if (win == null) return;
  obj.setPageDisplayNum(win.getChildNum());
  const pets = MyPet.doGetBagPetItem(player, GameWorld.myPlayer);
  obj.object = null; // Mercenary.doMercenaryMyListMsg: the server's list, none offline
  if (pets == null || pets.length === 0) {
    alertMessage('Bạn chưa có trân thú hoặc dụng binh!', 'D.sách trân thú và dung binh ');
    return;
  }
  if (!updateDataToMercenaryListUI(ui)) return;
  ui.show();
  UIHandler.addUI(ui);
}

/** The list row (direct child of the list window) holding `w`; Java reads the focused row. */
function rowObjOf(win: GWindow, w: GWidget): unknown {
  for (let c: GWidget | null = w; c != null; c = c.parent) if (c.parent === win) return c.getObj();
  return win.focusWidget?.getObj() ?? null;
}

function processMercenaryListLayer(ui: UIHandler, action: number): void {
  const obj = ui.obj instanceof UIObject ? ui.obj : null;
  const win = ui.getGWindowByEventType(EVENT_LIST_WINDOW);
  if (obj == null || win == null) return;
  if (action === 1) return ui.close();
  if (action === 107) {
    updateDataToMercenaryListUI(ui);
    return;
  }
  if (action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  const ev = w.getEventType();
  if (obj.doUpAndDownPageEvent(ev)) return;
  if (w.getParentWindow()?.getEventType() === 240) {
    updateDataToMercenaryListUI(ui);
    return;
  }
  if (w instanceof GLabel) doMerPetMenuButton(rowObjOf(win, w), ui, ev);
}

/**
 * UIAction.doMerPetMenuButton. 998 closes; 11133 (C.Tiết) opens the info screen for the active
 * pet (MyPet.doPetSeeMsg answers locally for it, other pets are asked from the server); 11263
 * explains growth. The rest (11131 fight, 11132 rest, 11134 release, 11130 rename, 11365 seal,
 * 11135 items, 11137..11139 rebirth / refine / potential) are server requests.
 */
export function doMerPetMenuButton(target: unknown, ui: UIHandler | null, ev: number): boolean {
  if (target == null) return false;
  const pet = target instanceof MyPet ? target : null;
  if (ev === 998) {
    ui?.notifyLayerAction(1);
  } else if (ev === 11133) {
    if (pet != null && isMyActivePet(pet)) createPetInfoUI(pet, ui);
    else alertMessage(STR_NEED_SERVER);
  } else if (ev === 11263) {
    if (pet != null) {
      // The leading %U is the VIP level needed to send the pet out (empty when the pet has none).
      alertMessage(
        ` trânt thú exp trưởng thành hiện tại là ${pet.cp} điểm.\nCấp trưởng thành trân thú hiện tại là ${pet.growLevel}.\n` +
          'Cấp trưởng thành tăng sẽ tự động tăng thuộc tính trân thú.\nTrưởng thành ảnh hưởng tới exp trưởng thành của trân thú, ' +
          'mỗi lần thăng cấp có thể ngẫu nhiên nhận 1~3 điểm exp；Lĩnh Ngộ ảnh hưởng tới tỉ lệ lĩnh ngộ kĩ năng thiên phú của trân thú, ' +
          'kĩ năng thiên phú không thể thông qua Sở Kĩ Năng để học.',
        'Chi tiết trân thú',
      );
    }
  } else {
    alertMessage(STR_NEED_SERVER);
  }
  return false;
}

/** PlayerInfoUIAction.updatePetOpeMenuNew (sub types 0..3): the bottom button row (window 59). */
function updatePetOpeMenuNew(ui: UIHandler, pet: MyPet): void {
  if (pet.petItem == null) return;
  const win = ui.getGWindowByEventType(59);
  const tpl = ui.getLibGWidget(4);
  if (win == null || !(tpl instanceof GLabel)) return;
  win.clear();
  const add = (text: string, ev: number) => {
    const b = tpl.getClone() as GLabel;
    b.setText(text);
    b.setEventType(ev);
    win.add(b);
  };
  if (pet.owner != null && pet.owner === GameWorld.myPlayer) {
    if (isMyActivePet(pet)) add('Nghỉ', 11132);
    else add('Chiến', 11131);
    add('P.sinh', 11134);
    add('Đạo cụ', 11135);
    add('T.Sinh', 11137);
    add('T.Tủy', 11138);
    add('T.năng', 11139);
  } else {
    ui.getGWidgetByEventType(11130)?.setShow(false);
    add('Trở về', 998);
  }
  ui.show();
}

/**
 * updateDataToPetMerInfoUI: the "Pet" tab (60, panels 55 / 58 / 59) or "Th.Tính" (30, the
 * attribute list), then the tab row on top.
 */
function updateDataToPetInfoUI(ui: UIHandler, pet: MyPet, tab = EVENT_PET_TAB): void {
  const frame = ui.getFrameContainer();
  if (frame == null) return;
  frame.setObj(pet);
  for (const ev of [55, 58, 59, 2, EVENT_ATTRIBUTE_PANEL, EVENT_SKILL_PANEL]) {
    const w = ui.getGWidgetByEventType(ev);
    if (w) frame.remove(w);
  }
  if (tab === TAB_ATTRIBUTE) updatePlayerAttributeUI(ui, pet);
  else if (tab === TAB_SKILL) {
    addSkillPanelTab(ui);
    updatePlayerSkillUI(ui, pet, true);
  } else updatePlayerBaseUI(ui, pet, true, true, true);
  const tabs = ui.getGWindowByEventType(2);
  if (tabs == null) return;
  for (const c of tabs.children) {
    if (c.getEventType() !== tab) continue;
    tabs.setFocus(c);
    if (c instanceof GLabel) c.setIsFocusLabelOffset([0, 3]);
  }
  frame.add(tabs);
  ui.show();
}

/** PlayerInfoUIAction for ui/52: processPetMerInfoAction with the "Pet", "Th.Tính" and "Skill" tabs. */
class PetInfoUIAction extends PlayerInfoUIAction {
  constructor(readonly pet: MyPet) {
    super(pet);
  }

  /** The tab the frame shows: Th.Tính or Skill while its panel is on screen, else Pet. */
  private tab(ui: UIHandler): number {
    const shown = (ev: number) => {
      const panel = ui.getGWidgetByEventType(ev);
      return panel != null && (ui.getFrameContainer()?.children.includes(panel) ?? false);
    };
    if (shown(EVENT_ATTRIBUTE_PANEL)) return TAB_ATTRIBUTE;
    if (shown(EVENT_SKILL_PANEL)) return TAB_SKILL;
    return EVENT_PET_TAB;
  }

  processLayerAction(ui: UIHandler, action: number): void {
    if (action === 1) {
      ui.parent?.notifyLayerAction(107);
      ui.close();
      return;
    }
    if (action === 107 || action === 50) {
      updatePlayerBaseUI(ui, this.pet, true, true, true);
      updatePetOpeMenuNew(ui, this.pet);
      return;
    }
    if (action !== 0) return;
    const w = ui.getActionGWidget();
    if (w == null) return;
    if (w.getParentWindow()?.getEventType() === 2) {
      updateDataToPetInfoUI(ui, this.pet, w.getEventType());
      return;
    }
    if (this.tab(ui) === TAB_ATTRIBUTE) {
      processAttributeAction(ui, this.pet, action);
      return;
    }
    if (this.tab(ui) === TAB_SKILL) {
      processSkillListAction(ui, this.pet, action);
      return;
    }
    if (w.getEventType() === 7) return; // processMerIconAction: the doll's look menu (server)
    if (w instanceof GLabel) doMerPetMenuButton(this.pet, ui, w.getEventType());
  }
}

export function createPetInfoUI(pet: MyPet | null, parent: UIHandler | null, sub = 0): void {
  if (pet == null) return;
  const ui = UIHandler.createUIFromXML(TYPE_PET_INFO);
  ui.listener = new PetInfoUIAction(pet);
  ui.parent = parent;
  ui.obj = pet;
  ui.setSubType(sub);
  updatePetOpeMenuNew(ui, pet);
  updateDataToPetInfoUI(ui, pet);
  ui.show();
  UIHandler.addUI(ui);
}

registerPageUpdater(TYPE_MERCENARY_LIST, (ui, page) => void updateDataToMercenaryListUI(ui, page, false));

registerScreen('mercenaryList', {
  uiTypes: [TYPE_MERCENARY_LIST, TYPE_PET_INFO, TYPE_PLAYER_ATTRIBUTE, TYPE_PLAYER_SKILL],
  open: (sub = 2) => createMercenaryListUI(GameWorld.myPlayer, sub),
  processLayerAction: processMercenaryListLayer,
});

/** HUD pet portrait (946): createPetInfoUI(GameWorld.getPlayerPet()). */
registerScreen('petInfo', {
  uiTypes: [TYPE_PET_INFO, TYPE_PLAYER_ATTRIBUTE, TYPE_PLAYER_SKILL],
  open: () => {
    const pet = GameWorld.myPlayer?.getPet();
    createPetInfoUI(pet instanceof MyPet ? pet : null, null);
  },
});
