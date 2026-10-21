// The chat history window (ui/64, "Chat"): UIHandler.createChatMsgUI / updateDataToChatMsgUI and
// UIAction.processChatMsgLayer (CFR). Channel tabs page with 905/906; each message is a clone of
// the library text area (8) showing ChatMsg.getChatMsgUIText. New messages are added live.
// Not ported: typing a message (GameForm input: needs the server), the channel settings window
// and the per-sender menu.
import { GTextArea, GWidget } from '../../gui/GWidget';
import { ChatMsg, chatListeners, getChatMsgVector, getChatStr } from '../../main/ChatMsg';
import { UIHandler, alertMessage } from '../UIHandler';
import { STR_NEED_SERVER, doMenuButton, registerScreen } from '../UIAction';
import { UIObject } from '../UIObject';

export const TYPE_CHAT_MSG = 64;
export const CHANNEL_ALL = 10;
const MAX_LINES = 40;

function textOf(m: ChatMsg): string {
  return m.getFullText(); // ChatMsg.getChatMsgUIText
}

/** Rebuilds the tab row and, with `msg` null, the whole list; with a message, inserts it on top. */
export function updateDataToChatMsgUI(ui: UIHandler, focusChannel: number, msg: ChatMsg | null = null): void {
  const tabs = getChatStr();
  const tabWin = ui.getGWindowByEventType(5);
  if (tabWin == null) return;
  tabWin.setLRContent(tabs.map((t) => t[0]), tabs.map((t) => t[1]), focusChannel);
  ui.getGWidgetByEventType(905)?.setShow(tabWin.isLRCanLeft());
  ui.getGWidgetByEventType(906)?.setShow(tabWin.isLRCanRight());
  if (tabWin.focusWidget == null) tabWin.setFirstFocus();
  tabWin.focusWidget?.setObj(tabWin.focusWidget.getObj());
  const channel = tabWin.focusWidget?.getObj();
  if (typeof channel !== 'number' || channel === -1) return;
  tabWin.setObj(channel);
  const list = ui.getGWindowByEventType(1);
  const tpl = ui.getGWidgetByEventType(8);
  if (list == null || tpl == null) return;
  const make = (m: ChatMsg): GWidget => {
    const row = tpl.getClone();
    row.setObj(m);
    if (row instanceof GTextArea) row.setText(textOf(m));
    return row;
  };
  if (msg == null) {
    list.clear();
    for (const m of getChatMsgVector(channel)) if (channel === CHANNEL_ALL || m.channel === channel) list.add(make(m));
    list.show();
    list.setFirstFocus();
    return;
  }
  if (channel !== CHANNEL_ALL && channel !== msg.channel) return;
  const scroll = list.getScrollBar()?.scrollPos ?? 0;
  list.insert(make(msg), 0);
  const n = list.getChildNum();
  if (n > MAX_LINES) list.remove(list.getJavaChild(n - 1)!);
  if (list.getScrollBar()) list.getScrollBar()!.scrollPos = 0;
  list.show();
  if (n <= 1) {
    list.setFirstFocus();
    return;
  }
  list.setFocusIndex(Math.min(list.focusIndex + 1, MAX_LINES - 1));
  list.setChildrenOffset(0, -scroll);
}

export function createChatMsgUI(channel: number): void {
  const ui = UIHandler.createUIFromXML(TYPE_CHAT_MSG);
  UIObject.getUIObj(ui);
  ui.setDefaultListener();
  ui.show();
  const tabs = ui.getGWindowByEventType(5);
  if (tabs == null) return;
  tabs.setLRMove();
  updateDataToChatMsgUI(ui, channel);
  UIHandler.addUI(ui);
}

/** ChatMsg.addChatMsg → updateDataToChatMsgUI for an open chat window. */
chatListeners.push((m) => {
  const ui = UIHandler.getUIByType(TYPE_CHAT_MSG);
  if (ui != null) updateDataToChatMsgUI(ui, -1, m);
});

function processChatMsgLayer(ui: UIHandler, action: number): void {
  const tabs = ui.getGWindowByEventType(5);
  if (tabs == null || action !== 0) return;
  const w = ui.getActionGWidget();
  if (w == null) return;
  switch (w.getEventType()) {
    case 2:
      return doMenuButton(11219); // friends
    case 3: // channel settings window
    case 4: // type a message
    case 8: // sender menu
      alertMessage(STR_NEED_SERVER);
      return;
    case 9:
      return updateDataToChatMsgUI(ui, -1);
    case 905:
      tabs.doLRLeft(true);
      return updateDataToChatMsgUI(ui, -1);
    case 906:
      tabs.doLRRight(true);
      return updateDataToChatMsgUI(ui, -1);
  }
}

registerScreen('chat', {
  uiTypes: [TYPE_CHAT_MSG],
  open: (channel = -1) => createChatMsgUI(channel),
  processLayerAction: processChatMsgLayer,
});
