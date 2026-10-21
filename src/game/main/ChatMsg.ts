// The display part of com.hz.main.ChatMsg (Vineflower decompile): a chat line's channel tag,
// VIP/GM icons, sender name and text as PowerString markup, wrapped to the chat box.
// Not ported: the per-channel history tabs, red packets and the chat window (UI type 64).
import { isNullText } from '../common/Tool';
import { PowerString, type TextFont } from '../string/PowerString';

export const CHANNEL_WORLD = 1;
export const CHANNEL_AREA = 2;
export const CHANNEL_COUNTRY = 3;
export const CHANNEL_TEAM = 4;
export const CHANNEL_PRIVATE = 5;
export const CHANNEL_SYSTEM = 6;
export const CHANNEL_UNION = 7;
export const CHANNEL_CROSS_SERVER = 8;

export function getChannalTagText(channel: number): string {
  if (channel === 11) return '';
  return { 2: '【Khu】', 3: '【Quốc】', 4: '【Đội】', 5: '【Riêng】', 6: '【System】', 7: '【Minh】', 8: '【LSV】' }[channel] ?? '【Thế】';
}

export function getChannelColor(channel: number): number {
  return { 1: 16750848, 2: 16185078, 3: 16768550, 4: 65280, 5: 16751103, 6: 16711680, 7: 16385680, 8: 8388736 }[channel] ?? 0;
}

/** Sender names: flag bit 16 set → 16670559 (pink), else 57595 (cyan). */
export function getSexColor(female: boolean): number {
  return female ? 16670559 : 57595;
}

export class ChatMsg {
  name = '';
  remark = '';
  serverName = '';
  /** Bits: 1 GM icon, 2 "X nói", 16 female sender, 1024/2048 special icons. */
  flag = 0;
  vipLevel2 = 0;
  vipLevel3 = 0;
  maxVIP = 0;
  vip2LevelOverdue = 0;
  private parseTextMsg: (PowerString | null)[] | null = null;
  private parseTextTotalHeight = 0;

  constructor(
    readonly channel: number,
    readonly senderID: number,
    name: string,
    readonly text: string,
    readonly vipLevel: number,
  ) {
    if (name != null && name.trim().length > 0) this.name = name;
  }

  /** Markup for the whole line (GameWorld.isQQVip assumed false). */
  getFullText(): string {
    let head = PowerString.makeColorString(getChannalTagText(this.channel), getChannelColor(this.channel));
    if (this.channel === CHANNEL_CROSS_SERVER) head += `【${this.serverName}】`;
    let s = head;
    if (this.flag & 2048) s += PowerString.makeIconString(26, 1);
    else if (this.flag & 1024) s += PowerString.makeIconString(26, 0);
    else if (this.vipLevel === 1 && this.maxVIP < 2) s += PowerString.makeIconString(31, this.vipLevel - 1);
    else if (this.vipLevel2 > 1 && this.vip2LevelOverdue > 1) s += PowerString.makeIconString(31, this.vipLevel2 - 1);
    if (this.flag & 1) s += PowerString.makeIconString(8, 6);
    let who = isNullText(this.remark) ? this.name : this.remark;
    if (this.flag & 2) who = `${PowerString.makeColorString(who, 16776960)} nói`;
    if (!isNullText(who)) s += PowerString.makeColorString(`${who}: `, getSexColor((this.flag & 16) !== 0));
    s += this.vipLevel3 > 8 && this.vip2LevelOverdue > 0 ? PowerString.makeColorString(this.text, 16724838) : this.text;
    return s;
  }

  /** Wraps to `w` and drops lines (after the first) that would exceed `h`; cached. */
  parse(font: TextFont, w: number, h: number): (PowerString | null)[] | null {
    if (this.parseTextMsg == null) {
      const lines = PowerString.splitPowerString(this.getFullText(), font, w);
      this.parseTextMsg = lines;
      this.parseTextTotalHeight = 0;
      lines?.forEach((l, i) => {
        if (i > 0 && this.parseTextTotalHeight + l.height > h) lines[i] = null as unknown as PowerString;
        else this.parseTextTotalHeight += l.height;
      });
    }
    return this.parseTextMsg;
  }

  getTextTotalHeight(): number {
    return this.parseTextTotalHeight;
  }

  clean(): void {
    this.parseTextMsg = null;
  }
}
