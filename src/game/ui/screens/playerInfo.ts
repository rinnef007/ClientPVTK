// The character screen (ui/3): UIHandler.createWorldPlayerInfoUI, PlayerInfoUIAction
// (updateDataToPlayerPetMerInfoUI, clean/addPlayerInfoTabGWidget, updatePlayerBaseUI,
// processBaseAction, isVaileAttBuff, cancelChangeAttValue) and UIHandler.updatePlayerPetMerInfoUI
// (CFR decompile). The base tab (C.Bản), the attribute tab (T.Tính, ./playerAttribute), the
// skill tab (./playerSkill), the society tab (X.Hội, ./playerSociety) and the talent tab (T.Phú,
// ./playerTalent) are ported; the photo tab and confirming attribute points need the server.
import { GGameBar, GGameIcon, GLabel, GLinePanel, GWindow } from '../../gui/GWidget';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_MP, ATTR_MP_MAX, ATTR_POINTS, Player } from '../../actor/Player';
import { ATTR_PET_GRADE, ATTR_PET_GROW_LEVEL, MyPet } from '../../actor/MyPet';
import * as GameWorld from '../../main/GameWorld';
import { GameSprite } from '../../sprite/GameSprite';
import { UIHandler, alertMessage, type UIListener } from '../UIHandler';
import { STR_NEED_SERVER, registerScreen } from '../UIAction';
import { TYPE_PLAYER_ATTRIBUTE, processAttributeAction, updatePlayerAttributeUI } from './playerAttribute';
import { TYPE_PLAYER_SKILL, addSkillPanelTab, processSkillListAction, updatePlayerSkillUI } from './playerSkill';
import { processSocietyAction, updatePlayerSocietyUI } from './playerSociety';
import { TYPE_PLAYER_TALENT, addTalentPanelTab, processTalentListAction, updatePlayerTalentUI } from './playerTalent';

export const TYPE_PLAYER_INFO = 3;
const FRAME_PLAYER_INFO = 502;

export const TAB_BASE = 29;
export const TAB_ATTRIBUTE = 30;
export const TAB_SKILL = 31;
export const TAB_SOCIETY = 32;
export const TAB_PHOTO = 34;
export const TAB_TALENT = 93;

/** Player.getPlayTabStr. */
const TABS: [string, number][] = [
  ['C.Bản', TAB_BASE],
  ['T.Tính', TAB_ATTRIBUTE],
  ['Skill', TAB_SKILL],
  ['X.Hội', TAB_SOCIETY],
  ['Ảnh', TAB_PHOTO],
  ['T.Phú', TAB_TALENT],
];

/** Define.jobText / raceText. */
const JOB_TEXT = ['', 'H.Khách', 'T.Chân', 'Ch.sĩ', 'P.sư', 'Hiền Giả', 'Võ Thánh', 'Duệ Trí', 'Dũng Mãnh', 'Tấn Tiệp', 'Vua Súng', 'Chùy Sư', 'Lam Vũ'];
const RACE_TEXT = ['Đông Phương', 'Tây Phương'];
const getJobString = (j: number) => JOB_TEXT[j] ?? `job_${j}`;
const getRaceString = (r: number) => RACE_TEXT[r] ?? `race_${r}`;
/** GameText 177 "Lv %U" through Utilities.manageString. */
const lv = (n: number) => `Lv ${n}`;

/** Attribute rows 24..28: [label, base field] — the row obj is the total's id 6..10. */
const ATT_ROWS: Record<number, [string, keyof Pick<Player, 'str' | 'con' | 'agi' | 'ilt' | 'wis'>, number]> = {
  24: ['Sức', 'str', 6],
  25: ['Thể', 'con', 7],
  26: ['Nhanh', 'agi', 8],
  27: ['Trí', 'ilt', 9],
  28: ['Cảm', 'wis', 10],
};

/** PlayerInfoUIAction: remembers the attributes as opened so +/- points can be undone. */
export class PlayerInfoUIAction implements UIListener {
  baseAtt: number[];
  buffAtt: number[];
  private readonly baseValues: [number, number][];

  constructor(readonly player: Player) {
    this.baseAtt = [player.str, player.con, player.agi, player.ilt, player.wis];
    this.buffAtt = [...this.baseAtt];
    this.baseValues = [ATTR_POINTS, 6, 7, 8, 9, 10].map((k) => [k, player.get(k)]);
  }

  isChangeAttValue(): boolean {
    return this.buffAtt.some((v, i) => v !== this.baseAtt[i]);
  }

  cancelChangeAttValue(): void {
    [this.player.str, this.player.con, this.player.agi, this.player.ilt, this.player.wis] = this.baseAtt;
    for (const [k, v] of this.baseValues) this.player.set(k, v);
    this.buffAtt = [...this.baseAtt];
  }

  /** Moves one point into (+1) or out of (-1) attribute `id` (6..10), keeping the total of points. */
  isVaileAttBuff(id: number, d: number): boolean {
    const i = id - 6;
    if (i < 0 || i >= this.buffAtt.length) return false;
    if (this.buffAtt[i] + d < 0 || this.player.get(ATTR_POINTS) - d < 0) return false;
    this.buffAtt[i] += d;
    this.player.addValue(id, d);
    this.player.addValue(ATTR_POINTS, -d);
    return true;
  }

  processLayerAction(ui: UIHandler, action: number): void {
    if (action === 14) return this.cancelChangeAttValue();
    // Java: confirm the changed points with the server (doChangeAttAction) or close. Offline the
    // points are undone and the screen closes, so "back" never gets stuck.
    if (action === 1) return this.processLayerClose(ui);
    const tabs = ui.getGWindowByEventType(2);
    const tab = (tabs?.focusWidget?.getObj() as number | null) ?? TAB_BASE;
    if (tab === TAB_BASE && action === 0) this.processBaseAction(ui);
    else if (tab === TAB_ATTRIBUTE && action === 0) processAttributeAction(ui, this.player, action);
    else if (tab === TAB_SKILL) processSkillListAction(ui, this.player, action);
    else if (tab === TAB_SOCIETY && action === 0) processSocietyAction(ui, this.player, action);
    else if (tab === TAB_TALENT) processTalentListAction(ui, action);
  }

  /** Closing with changed points asks to confirm them (a server request); offline they are undone. */
  processLayerClose(ui: UIHandler): void {
    if (this.isChangeAttValue()) {
      this.cancelChangeAttValue();
      alertMessage(STR_NEED_SERVER);
    }
    ui.close();
  }

  private doChangeAttAction(): boolean {
    if (!this.isChangeAttValue()) return false;
    alertMessage(STR_NEED_SERVER);
    return true;
  }

  private processBaseAction(ui: UIHandler): void {
    const ev = ui.getActionGWidget()?.getEventType();
    if (ev === 18) this.doPlayerInfoAttrChange(ui, 1);
    else if (ev === 19) this.doPlayerInfoAttrChange(ui, -1);
    else if (ev === 44) this.doChangeAttAction();
  }

  private doPlayerInfoAttrChange(ui: UIHandler, d: number): void {
    if (this.player !== GameWorld.myPlayer) return;
    const win = ui.getGWindowByEventType(4);
    if (win == null || (d > 0 && this.player.get(ATTR_POINTS) <= 0)) return;
    const row = win.focusWidget;
    const id = row?.getObj();
    if (typeof id !== 'number') return;
    if (this.isVaileAttBuff(id, d)) updatePlayerBaseUI(ui, this.player, false, false);
  }
}

function lbl(ui: UIHandler, ev: number): GLabel | null {
  const w = ui.getGWidgetByEventType(ev);
  return w instanceof GLabel ? w : null;
}

function bar(ui: UIHandler, ev: number): GGameBar | null {
  const w = ui.getGWidgetByEventType(ev);
  return w instanceof GGameBar ? w : null;
}

/** PlayerInfoUIAction.setText: green when raised, red when lowered. */
function setDiffText(l: GLabel | null, now: number, base: number, color: number): void {
  if (l == null) return;
  l.labelColor = now > base ? 65280 : now < base ? 0xff0000 : color;
  l.setText(`${now}`);
}

/** The base tab: name / level / job, HP MP EXP bars, the doll and the five attribute rows. */
export function updatePlayerBaseUI(ui: UIHandler, p: Player, full: boolean, addPanels: boolean, isPet = false): void {
  const action = ui.listener instanceof PlayerInfoUIAction ? ui.listener : null;
  if (addPanels) {
    const frame = ui.getFrameContainer();
    for (const ev of isPet ? [55, 58, 59] : [3, 4, 5]) {
      const w = ui.getGWidgetByEventType(ev);
      if (frame && w) frame.add(w);
    }
    ui.show();
  }
  if (full) {
    lbl(ui, 50)?.setText(`${p.getLevel()}`);
    lbl(ui, 51)?.setText(p.getClientUid());
    lbl(ui, 1)?.setText(`${p.getName()} ${lv(p.getLevel())}(ID:${p.getClientUid()})`);
    lbl(ui, 91)?.setText(`${lv(p.getLevel())}${getJobString(p.job)}`);
    lbl(ui, 92)?.setText(lv(p.level2));
  }
  lbl(ui, 52)?.setText(p.getName());
  lbl(ui, 9)?.setText(`${p.get(ATTR_HP)}/${p.get(ATTR_HP_MAX)}`);
  bar(ui, 8)?.setValue(p.get(ATTR_HP_MAX), p.get(ATTR_HP));
  lbl(ui, 11)?.setText(`${p.get(ATTR_MP)}/${p.get(ATTR_MP_MAX)}`);
  bar(ui, 10)?.setValue(p.get(ATTR_MP_MAX), p.get(ATTR_MP));
  if (full) {
    lbl(ui, 13)?.setText(`${p.get(ATTR_EXP)}/${p.get(ATTR_EXP_MAX)}`);
    bar(ui, 12)?.setValue(p.get(ATTR_EXP_MAX), p.get(ATTR_EXP));
    lbl(ui, 15)?.setText(getJobString(p.job));
  }
  if (isPet) {
    if (full && p instanceof MyPet) updatePetBaseLabels(ui, p);
    // Pets show plain "base(+bonus)" labels 24..28 instead of the point-assignment rows.
    for (const [ev, [, field, id]] of Object.entries(ATT_ROWS)) lbl(ui, Number(ev))?.setText(Player.getAttDesc(p[field], p.get(id)));
    if (full) {
      const doll = ui.getGWidgetByEventType(7);
      if (doll instanceof GGameIcon) doll.setSprite(GameSprite.cloneSprite(p.getPlayerSprite()));
    }
    return;
  }
  if (full) {
    lbl(ui, 14)?.setText(getRaceString(p.race));
    lbl(ui, 16)?.setText(p.countryRank);
    lbl(ui, 17)?.setText(p.countryName);
  }
  lbl(ui, 6)?.setText(`${p.get(ATTR_POINTS)}`);
  lbl(ui, 44)?.setShow(action?.isChangeAttValue() ?? false);
  const win = ui.getGWindowByEventType(4);
  let firstColor = -1;
  win?.children.forEach((row, k) => {
    const def = ATT_ROWS[row.getEventType()];
    if (!(row instanceof GLinePanel) || def == null) return;
    const [name, field, id] = def;
    if (full) {
      const n = row.getJavaChildByEvent(43);
      if (n instanceof GLabel) n.setText(`${name}:`);
      const v = row.getJavaChildByEvent(41);
      if (v instanceof GLabel) v.setText(Player.getAttDesc(p[field], p.get(id)));
      row.setObj(id);
    }
    const v = row.getJavaChildByEvent(41);
    if (k === 0 && v instanceof GLabel) firstColor = v.labelColor;
    const d = row.getJavaChildByEvent(42);
    const i = id - 6;
    setDiffText(d instanceof GLabel ? d : null, action?.buffAtt[i] ?? p[field], action?.baseAtt[i] ?? p[field], firstColor);
  });
  if (full) {
    const doll = ui.getGWidgetByEventType(7);
    if (doll instanceof GGameIcon) doll.setSprite(GameSprite.cloneSprite(p.getPlayerSprite()));
  }
}

/** Define.gradeText (getGradeString(grade, true) says "Ưu tú" for grade 1). */
const GRADE_TEXT = ['Thường', 'Tinh chế', 'Hiếm có', 'Sử thi', 'T.thuyết', 'Thần thoại'];

/** The pet part of updatePlayerBaseUI: growth level, grade, age and the cp/grow/compre bars. */
function updatePetBaseLabels(ui: UIHandler, pet: MyPet): void {
  lbl(ui, 62)?.setText(`${pet.get(ATTR_PET_GROW_LEVEL)}`);
  const g = pet.get(ATTR_PET_GRADE);
  lbl(ui, 64)?.setText(g < 0 || g >= GRADE_TEXT.length ? 'Tất cả' : g === 1 ? 'Ưu tú' : GRADE_TEXT[g]);
  const other = ui.getSubType() === 4 && pet.owner !== GameWorld.myPlayer;
  lbl(ui, 66)?.setText(`${other ? pet.petmaxage : pet.petAge}`);
  bar(ui, 6)?.setValue(10, pet.cp);
  bar(ui, 80)?.setValue(100, pet.grow);
  bar(ui, 81)?.setValue(100, pet.compre);
  lbl(ui, 83)?.setShow(false); // "Ngẫu nhiên" only for unknown growth in the composite view
  lbl(ui, 84)?.setShow(false);
}

/** Tab labels from Player.getPlayTabStr; an unknown tab falls back to the first one. */
export function updateDataToPlayerInfoUI(ui: UIHandler, p: Player, tabId: number, full: boolean): void {
  const tabs = ui.getGWindowByEventType(2);
  let tab = tabId;
  if (tabs != null) {
    tabs.setLRContent(TABS.map((t) => t[0]), TABS.map((t) => t[1]), -1);
    lbl(ui, 905)?.setShow(tabs.isLRCanLeft());
    lbl(ui, 906)?.setShow(tabs.isLRCanRight());
    if (!tabs.children.some((c) => c.getObj() === tab)) tab = (tabs.getJavaChild(0)?.getObj() as number | null) ?? tab;
  }
  ui.getFrameContainer()?.setObj(p);
  if (tab === -1) tab = TAB_BASE;
  if (full) cleanPlayerInfoTabGWidget(ui);
  if (tab === TAB_BASE) updatePlayerBaseUI(ui, p, full, true);
  else if (tab === TAB_ATTRIBUTE) updatePlayerAttributeUI(ui, p);
  else if (tab === TAB_SKILL) {
    addSkillPanelTab(ui);
    updatePlayerSkillUI(ui, p, true);
  } else if (tab === TAB_SOCIETY) updatePlayerSocietyUI(ui, p);
  else if (tab === TAB_TALENT) {
    addTalentPanelTab(ui);
    updatePlayerTalentUI(ui, p, true);
  }
  else alertMessage(STR_NEED_SERVER); // the other tabs are not ported
  if (full) addPlayerInfoTabGWidget(ui, tab);
}

function cleanPlayerInfoTabGWidget(ui: UIHandler): void {
  const frame = ui.getFrameContainer();
  if (frame == null) return;
  for (const ev of [3, 5, 4, 3301, 37, 3105, 31501, 54, 2]) {
    const w = ui.getGWidgetByEventType(ev);
    if (w) frame.remove(w);
  }
}

function addPlayerInfoTabGWidget(ui: UIHandler, tab: number): void {
  const frame = ui.getFrameContainer();
  const panel = ui.getGWidgetByEventType(54);
  if (frame && panel) frame.add(panel);
  const tabs = ui.getGWindowByEventType(2);
  if (frame == null || tabs == null) return;
  for (const c of tabs.children) {
    if (c.getObj() !== tab) continue;
    tabs.setFocus(c);
    tabs.setObj(tab);
    if (c instanceof GLabel) c.setIsFocusLabelOffset([0, 3]);
  }
  frame.add(tabs);
}

/** UIHandler.updatePlayerPetMerInfoUI: tab taps and the 905/906 paging arrows. */
function updatePlayerPetMerInfoUI(ui: UIHandler): void {
  const w = ui.getActionGWidget();
  if (w == null || ui.getOldActionGWidget() === w) return;
  const p = ui.getFrameContainer()?.getObj();
  if (!(p instanceof Player)) return;
  const tabs = ui.getGWindowByEventType(2);
  if (tabs == null) return;
  const ev = w.getEventType();
  if (ev === 905 || ev === 906) {
    if (ev === 905) tabs.doLRLeft(true);
    else tabs.doLRRight(true);
    updateDataToPlayerInfoUI(ui, p, tabs.getObj() as number, true);
  }
  const win = w.getParentWindow();
  if (win instanceof GWindow && win.getEventType() === 2) {
    const tab = typeof w.getObj() === 'number' ? (w.getObj() as number) : -1;
    updateDataToPlayerInfoUI(ui, p, tab, true);
  }
}

UIHandler.updateUIHooks.push((ui) => {
  if (ui.getFrameContainer()?.getEventType() === FRAME_PLAYER_INFO) updatePlayerPetMerInfoUI(ui);
});

export function createWorldPlayerInfoUI(p: Player | null, tab: number): UIHandler | null {
  if (p == null) return null;
  const ui = UIHandler.createUIFromXML(TYPE_PLAYER_INFO);
  ui.listener = new PlayerInfoUIAction(p);
  ui.show();
  const tabs = ui.getGWindowByEventType(2);
  if (tabs == null) return null;
  tabs.setLRMove();
  updateDataToPlayerInfoUI(ui, p, tab, true);
  UIHandler.addUI(ui);
  return ui;
}

registerScreen('playerInfo', {
  uiTypes: [TYPE_PLAYER_INFO, TYPE_PLAYER_ATTRIBUTE, TYPE_PLAYER_SKILL, TYPE_PLAYER_TALENT],
  open: (tab = -1) => void createWorldPlayerInfoUI(GameWorld.myPlayer, tab),
});
