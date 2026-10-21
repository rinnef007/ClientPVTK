// The talent tab ("T.Phú"): PlayerInfoUIAction.addTalentPanelTab, updatePlayerTalentUI,
// updateTalentList and processTalentListAction (CFR decompile). The panel comes from ui/315
// (panel 31501, list 31502, row 31505, group titles in its library); "Xem" shows Talent.getDesc.
import { GContainer, GLabel, GWidget } from '../../gui/GWidget';
import { WIDTH_MAX } from '../../core/MessageFrame';
import { TALENT_TYPE_ATTACK, TALENT_TYPE_COMMON, TALENT_TYPE_DEFENCE, Talent } from '../../core/Talent';
import { Player } from '../../actor/Player';
import { UIHandler, alertMessage } from '../UIHandler';

export const TYPE_PLAYER_TALENT = 315;
export const EVENT_TALENT_PANEL = 31501;
const EVENT_TALENT_LIST = 31502;
const EVENT_TALENT_ROW = 31505;
const EVENT_VIEW = 31507;

export function addTalentPanelTab(ui: UIHandler): void {
  let panel = ui.getGWidgetByEventType(EVENT_TALENT_PANEL);
  if (panel == null) {
    const sub = UIHandler.createUIFromXML(TYPE_PLAYER_TALENT);
    panel = sub.getGWidgetByEventType(EVENT_TALENT_PANEL);
    for (const ev of [EVENT_TALENT_PANEL, EVENT_TALENT_LIST, EVENT_TALENT_ROW, 31508, 31504, 31503]) {
      ui.addEventGWidget(sub.getGWidgetByEventType(ev));
    }
  }
  if (panel != null) ui.getFrameContainer()?.add(panel);
}

function updateTalentList(title: GWidget | null, tpl: GWidget | null, win: GContainer, p: Player, text: string, type: number): void {
  if (!(title instanceof GLabel) || !(tpl instanceof GContainer)) return;
  const list = Player.getTalentListByType(p.talentList, type);
  if (list == null) return;
  Talent.sortTalentlist(list);
  if (list.length === 0) return;
  const head = title.getClone() as GLabel;
  head.setText(text);
  win.add(head);
  for (const t of list) {
    const row = tpl.getClone() as GContainer;
    row.setObj(t);
    const name = row.getJavaChildByEvent(31506);
    if (name instanceof GLabel) name.setText(`${t.name}(${t.ranklevel})`);
    win.add(row);
  }
}

/** "Số Thiên Phú đã học" and the attack / defence / common groups. */
export function updatePlayerTalentUI(ui: UIHandler, p: Player, first: boolean): void {
  const win = ui.getGWindowByEventType(EVENT_TALENT_LIST);
  if (win == null) return;
  const focus = win.focusIndex;
  const scroll = win.getScrollBar()?.scrollPos ?? 0;
  win.clear();
  win.setObj(p);
  const head = ui.getGWidgetByEventType(31503);
  if (head instanceof GLabel) {
    head.setShow(true);
    head.setText('Số Thiên Phú đã học：');
  }
  const count = ui.getGWidgetByEventType(31504);
  if (count instanceof GLabel) {
    count.setShow(true);
    count.setText(`${p.talentList.length}`);
  }
  if (p.talentList.length > 0) {
    const sub = UIHandler.createUIFromXML(TYPE_PLAYER_TALENT);
    const tpl = ui.getGWidgetByEventType(EVENT_TALENT_ROW);
    updateTalentList(sub.getLibGWidget(1), tpl, win, p, 'Công kích', TALENT_TYPE_ATTACK);
    updateTalentList(sub.getLibGWidget(2), tpl, win, p, 'Phòng thủ', TALENT_TYPE_DEFENCE);
    updateTalentList(sub.getLibGWidget(3), tpl, win, p, 'Thông dụng', TALENT_TYPE_COMMON);
    if (!first && p.talentList.length !== 1) {
      win.setPrevFocus(focus);
      win.setChildrenOffset(0, -scroll);
    } else {
      win.setFirstFocus();
    }
  } else {
    win.setShow(false);
  }
  ui.show();
}

/** processTalentListAction: "Xem" (31507) shows the focused talent. */
export function processTalentListAction(ui: UIHandler, action: number): void {
  const win = ui.getGWindowByEventType(EVENT_TALENT_LIST);
  if (win == null || action !== 0) return;
  const w = ui.getActionGWidget();
  for (let c = w; c != null; c = c.parent) {
    if (c.parent === win) {
      if (win.focusWidget !== c) win.setFocus(c);
      break;
    }
  }
  const t = win.focusWidget?.getObj();
  if (!(t instanceof Talent) || w?.getEventType() !== EVENT_VIEW) return;
  alertMessage(t.getDesc(WIDTH_MAX), 'Thông tin kĩ năng', 6, 0, true);
}
