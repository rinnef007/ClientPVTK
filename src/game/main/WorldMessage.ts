// Port of com.hz.main.WorldMessage (Vineflower decompile): the chat lines shown over the world
// (each for 3 s, at the HUD's chat area) and the notice / prompt / point message queues.
// Not ported: the arena / "hide chat" setting checks in addMsg.
import type { Graphics } from '../../midp/Graphics';
import { isNullText } from '../common/Tool';
import { PowerMsg, msgEnv } from '../core/PowerMsg';
import { fillAlphaRect } from './GameView';
import { CHANNEL_SYSTEM, ChatMsg } from './ChatMsg';

const BG_COLOR_WORLD = -1424870314; // 0xAB1D2B56
const TEXT_COLOR = 16709814;
const LAST_TIME = 3000;
const WORLD_MESSAGE_MAX_NUM = 10;

/** HUD widgets that only mark where messages go (hidden once read). */
export const EVENT_CHAT_AREA = 948;
export const EVENT_POINT_AREA = 950;
export const EVENT_PROMPT_AREA = 951;

interface Area {
  getXX(): number;
  getYY(): number;
  getW(): number;
  getH(): number;
  setShow(v: boolean): void;
}

const chat = { x: 0, y: 0, w: 0, h: 0 };
const point = { x: 0, y: 0 };
const prompt = { x: 0, y: 0 };

const chatMessages: ChatMsg[] = [];
const messageTime: number[] = [];
const noticeMessages: PowerMsg[] = [];
const pointMessages: PowerMsg[] = [];
const promptMessages: PowerMsg[] = [];

function defaultChat(): { x: number; y: number; w: number; h: number } {
  const h = msgEnv.font.height * 4;
  return { x: 0, y: msgEnv.height - h, w: msgEnv.width, h };
}

function setChatLocationParam(x: number, y: number, w: number, h: number): void {
  const d = defaultChat();
  Object.assign(chat, { x, y, w: w <= 0 ? d.w : w, h: h <= 0 ? d.h : h });
  if (y < 0) chat.y = 0;
  else if (y + chat.h > msgEnv.height) chat.y = msgEnv.height - chat.h;
  if (chat.x < 0) chat.x = 0;
  else if (chat.x + chat.w > msgEnv.width) chat.x = msgEnv.width - chat.w;
}

/**
 * GameCanvas calls this with `first` = true when the HUD is created (point and prompt areas) and
 * again with false (chat area); the marker widgets are hidden and only their rectangles kept.
 */
export function initWorldShowLocation(find: ((ev: number) => Area | null) | null, first: boolean): void {
  if (find != null) {
    if (first) {
      const p = find(EVENT_POINT_AREA);
      if (p) {
        p.setShow(false);
        Object.assign(point, { x: p.getXX(), y: p.getYY() });
      }
      const q = find(EVENT_PROMPT_AREA);
      if (q) {
        q.setShow(false);
        Object.assign(prompt, { x: q.getXX(), y: q.getYY() });
      }
      return;
    }
    const c = find(EVENT_CHAT_AREA);
    if (c) {
      c.setShow(false);
      setChatLocationParam(c.getXX(), c.getYY(), c.getW(), c.getH());
      return;
    }
  }
  const d = defaultChat();
  setChatLocationParam(d.x, d.y, d.w, d.h);
}

export function addMsg(m: ChatMsg | null): void {
  if (m == null) return;
  if (chatMessages.length >= WORLD_MESSAGE_MAX_NUM) {
    chatMessages.length = 0;
    messageTime.length = 0;
  }
  chatMessages.push(m);
  messageTime.push(msgEnv.now());
}

export function addSystemChat(text: string, channel = CHANNEL_SYSTEM): void {
  addMsg(new ChatMsg(channel, -1, '', text, 0));
}

/** The scrolling banner (Java also files it in the system chat history, not ported). */
export function addNoticeMsg(text: string): void {
  if (!isNullText(text)) noticeMessages.push(PowerMsg.createPowerMsgNotice(text));
}

export function addPromptMsg(text: string): void {
  if (!isNullText(text)) promptMessages.push(PowerMsg.createPowerMsgPrompt2(text, prompt.x, prompt.y));
}

/** At the HUD's point area (Java falls back to below the player panel when it is off screen). */
export function addPointMsg(text: string): void {
  if (isNullText(text)) return;
  pointMessages.push(PowerMsg.createPowerMsgPoint(text, point.x, point.y));
}

export function clearAll(): void {
  for (const q of [chatMessages, messageTime, noticeMessages, pointMessages, promptMessages]) q.length = 0;
}

/** Drops the head of each queue once its time is up (GameCanvas logic tick). */
export function logic(): void {
  for (const q of [promptMessages, noticeMessages, pointMessages]) if (q.length > 0 && q[0].destroy()) q.shift();
}

/** The oldest chat line, shown for 3 s, then the next one gets a fresh 3 s. */
export function paintBottomUIMsg(g: Graphics): void {
  while (chatMessages.length > 0) {
    if (msgEnv.now() - messageTime[0] < LAST_TIME) {
      drawMsg(g, chatMessages[0]);
      return;
    }
    chatMessages.shift()?.clean();
    messageTime.shift();
    if (messageTime.length > 0) messageTime[0] = msgEnv.now();
  }
}

/** Lines stack upwards from the bottom of the chat area when it is in the lower half. */
function drawMsg(g: Graphics, m: ChatMsg): number {
  const lines = m.parse(msgEnv.font, chat.w, chat.h);
  if (lines == null) return 0;
  const total = m.getTextTotalHeight();
  let y = chat.y;
  if (chat.y > msgEnv.height >> 1) y = Math.max(chat.h + chat.y - total, chat.y);
  g.setClip(chat.x, y, chat.w, chat.h);
  fillAlphaRect(g, BG_COLOR_WORLD, chat.x, y, chat.w, total);
  g.setColor(TEXT_COLOR);
  let yy = y;
  for (const l of lines) {
    if (l == null) continue;
    l.draw(g, chat.x, yy + 3, 0);
    yy += l.height;
  }
  g.setClip(0, 0, msgEnv.width, msgEnv.height);
  return total;
}

export function paintUpUIMsg(g: Graphics): void {
  pointMessages[0]?.paint(g);
  promptMessages[0]?.paint(g);
  noticeMessages[0]?.paint(g);
}
