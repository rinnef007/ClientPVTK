// The skill tab ("Skill"): PlayerInfoUIAction.addSkillPanelTab, updatePlayerSkillUI,
// updateSkillList and processSkillListAction with Skill.doMenuButton (CFR and Vineflower
// decompiles). The panel comes from ui/32 (panel 37, list 38, row 39, group titles in its library).
// "Xem" shows the skill description locally; "Bỏ" (forget), the auto-battle slots (11022) and the
// auto-cast toggle (11039) are server requests.
import { GContainer, GIcon, GLabel, GWidget } from '../../gui/GWidget';
import { WIDTH_MAX } from '../../core/MessageFrame';
import { SKILL_TYPE_ACTIVE, SKILL_TYPE_AUTO, SKILL_TYPE_FORMATION, SKILL_TYPE_PASSIVE, Skill } from '../../core/Skill';
import { TYPE_PET, TYPE_PLAYER } from '../../actor/Model';
import { MyPet } from '../../actor/MyPet';
import { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { UIHandler, alertMessage } from '../UIHandler';
import { STR_NEED_SERVER } from '../UIAction';

export const TYPE_PLAYER_SKILL = 32;
export const EVENT_SKILL_PANEL = 37;
const EVENT_SKILL_LIST = 38;
const EVENT_SKILL_ROW = 39;
const EVENT_VIEW = 11019;
const EVENT_DROP = 11020;
const EVENT_AUTO = 11022;
const EVENT_INITIATIVE = 11039;
/** Talent.talentID: skills 5900..5980 belong to the talent tab. */
const isTalentSkill = (id: number) => id >= 5900 && id <= 5980;
/** Define.isPetTalentSkill: ids 5000..6999. */
const isPetTalentSkill = (id: number) => id >= 5000 && id < 7000;

/** Adds panel 37 (from ui/32) to the screen, registering its widgets on first use. */
export function addSkillPanelTab(ui: UIHandler): void {
  let panel = ui.getGWidgetByEventType(EVENT_SKILL_PANEL);
  if (panel == null) {
    const sub = UIHandler.createUIFromXML(TYPE_PLAYER_SKILL);
    panel = sub.getGWidgetByEventType(EVENT_SKILL_PANEL);
    for (const ev of [EVENT_SKILL_PANEL, EVENT_SKILL_LIST, EVENT_SKILL_ROW, 40, 21, 3203, 3204, 3201, 3202]) {
      ui.addEventGWidget(sub.getGWidgetByEventType(ev));
    }
  }
  if (panel != null) ui.getFrameContainer()?.add(panel);
}

function lbl(ui: UIHandler, ev: number): GLabel | null {
  const w = ui.getGWidgetByEventType(ev);
  return w instanceof GLabel ? w : null;
}

/** One group: its title, then a row per skill with the auto / auto-cast icons and buttons. */
function updateSkillList(title: GWidget | null, tpl: GWidget | null, win: GContainer, p: Player, text: string, type: number): void {
  if (!(title instanceof GLabel) || !(tpl instanceof GContainer)) return;
  const otherPet = p.getType() === TYPE_PET && p !== GameWorld.myPlayer?.getPet();
  const otherPlayer = p.getType() === TYPE_PLAYER && p !== GameWorld.myPlayer;
  const list = type === SKILL_TYPE_FORMATION ? p.formationList : Player.getSkillListByType(p.skillList, type);
  if (list == null || list.length === 0) return;
  const head = title.getClone() as GLabel;
  head.setText(text);
  win.add(head);
  for (const skill of list) {
    if (skill == null || isTalentSkill(skill.id)) continue;
    const row = tpl.getClone() as GContainer;
    row.setObj(skill);
    const auto = p.isAutoSkill(skill.id);
    const name = row.getJavaChildByEvent(3102);
    if (name instanceof GLabel) {
      const s = `${skill.name}(${skill.getRealLevelInfo()})`;
      name.setText(skill.isLearnByBook ? `★${s}` : s);
    }
    const autoIcon = row.getJavaChildByEvent(EVENT_AUTO);
    if (autoIcon instanceof GIcon) {
      autoIcon.setShow(!otherPet && type === SKILL_TYPE_AUTO && !otherPlayer);
      autoIcon.setFocus(auto >= 0);
      autoIcon.setNumber(auto + 1);
      autoIcon.isClear = true;
    }
    const castIcon = row.getJavaChildByEvent(EVENT_INITIATIVE);
    if (castIcon instanceof GIcon) {
      if (type === SKILL_TYPE_FORMATION) {
        castIcon.setShow(true);
        castIcon.setFocus(skill.isDefault);
      } else {
        castIcon.setShow(!otherPet && type === SKILL_TYPE_ACTIVE);
        castIcon.setFocus(p.autoSkillID_Initiative === skill.id);
      }
      if (otherPlayer) castIcon.setShow(false);
    }
    const drop = row.getJavaChildByEvent(EVENT_DROP);
    if (drop instanceof GLabel) {
      drop.setShow(!otherPet && !otherPlayer);
      if (type === SKILL_TYPE_FORMATION) drop.setText('Quên');
    }
    win.add(row);
  }
}

/** Skill points (21), the learnt count (3204) and the four groups. */
export function updatePlayerSkillUI(ui: UIHandler, p: Player, first: boolean): void {
  const win = ui.getGWindowByEventType(EVENT_SKILL_LIST);
  if (win == null) return;
  const focus = win.focusIndex;
  const scroll = win.getScrollBar()?.scrollPos ?? 0;
  win.clear();
  win.setMinHeight(1);
  // Sub type 5: a pet shown from the pet composite screen lists the skills it can comprehend.
  const comprehend = p instanceof MyPet && ui.getSubType() === 5;
  const points = lbl(ui, 3201);
  if (points) {
    points.setText('Điểm skill:');
    points.setShow(!comprehend);
  }
  for (const ev of [21, 3203, 3204]) ui.getGWidgetByEventType(ev)?.setShow(!comprehend);
  const hint = lbl(ui, 3202);
  if (hint) {
    hint.setShow(comprehend);
    if (comprehend) hint.setText('Skill có thể lĩnh ngộ');
  }
  const sub = UIHandler.createUIFromXML(TYPE_PLAYER_SKILL);
  const tpl = ui.getGWidgetByEventType(EVENT_SKILL_ROW);
  updateSkillList(sub.getLibGWidget(2), tpl, win, p, 'Bị động', SKILL_TYPE_PASSIVE);
  updateSkillList(sub.getLibGWidget(1), tpl, win, p, 'Chủ động', SKILL_TYPE_ACTIVE);
  updateSkillList(sub.getLibGWidget(3), tpl, win, p, 'Từ động phóng', SKILL_TYPE_AUTO);
  updateSkillList(sub.getLibGWidget(4), tpl, win, p, 'Trận', SKILL_TYPE_FORMATION);
  ui.show();
  if (!first && p.skillList.length !== 1) {
    win.setPrevFocus(focus);
    win.setChildrenOffset(0, -scroll);
  } else {
    win.setFirstFocus();
  }
  lbl(ui, 21)?.setText(`${p.get(5)}`);
  let learnt = 0;
  if (p.skillList.length > 0) {
    learnt = p.skillList.filter((s) => s != null && !s.isAddSkill() && !isPetTalentSkill(s.id)).length;
  } else {
    win.setShow(false);
    ui.show();
  }
  lbl(ui, 3204)?.setText(`${learnt}`);
}

/** Skill.doMenuButton: "Xem" shows the description; forgetting and auto settings ask the server. */
function doMenuButton(skill: Skill, ev: number): void {
  if (ev === EVENT_VIEW) {
    // Formations (type 4) show Skill.getFormationInfo, which is not ported (none offline).
    if (skill.type === SKILL_TYPE_FORMATION) alertMessage(STR_NEED_SERVER);
    else alertMessage(skill.getDesc(WIDTH_MAX), 'Thông tin kĩ năng', 6, 0, true);
  } else if (ev === EVENT_DROP || ev === EVENT_AUTO || ev === EVENT_INITIATIVE) {
    alertMessage(STR_NEED_SERVER);
  }
}

/** processSkillListAction: 109 refreshes; a tap acts on the row it is in. */
export function processSkillListAction(ui: UIHandler, p: Player, action: number): void {
  if (action === 109) return updatePlayerSkillUI(ui, p, false);
  const win = ui.getGWindowByEventType(EVENT_SKILL_LIST);
  if (win == null) return;
  const w = ui.getActionGWidget();
  for (let c = w; c != null; c = c.parent) {
    if (c.parent === win) {
      if (win.focusWidget !== c) win.setFocus(c);
      break;
    }
  }
  const skill = win.focusWidget?.getObj();
  if (!(skill instanceof Skill) || action !== 0 || w == null) return;
  doMenuButton(skill, w.getEventType());
}
