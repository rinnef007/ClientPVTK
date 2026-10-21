import { describe, expect, it } from 'vitest';
import { CHANNEL_SYSTEM, CHANNEL_WORLD, ChatMsg } from '../src/game/main/ChatMsg';
import { PowerMsg, msgEnv } from '../src/game/core/PowerMsg';
import { PowerString } from '../src/game/string/PowerString';
import { doGetLevelImageSetIndex } from '../src/game/ui/WorldHud';

const font = { height: 12, stringWidth: (s: string) => s.length * 6 };

describe('PowerString markup builders', () => {
  it('pads colours to 6 hex digits and formats icons', () => {
    expect(PowerString.makeColorString('ab', 0xff)).toBe('/c0000ffab/p');
    expect(PowerString.makeColorString('x', 0x123456, true)).toBe('/c123456{}x/p');
    expect(PowerString.makeIconString(8, 6)).toBe('/i08060');
  });
});

describe('ChatMsg', () => {
  it('builds tag, coloured sender and text', () => {
    const m = new ChatMsg(CHANNEL_WORLD, 9, 'An', 'hi', 0);
    expect(m.getFullText()).toBe('/cff9900【Thế】/p/c00e0fbAn: /phi');
    m.flag |= 16;
    expect(m.getFullText()).toContain('/cfe5f5fAn: /p');
  });

  it('system lines have no sender', () => {
    expect(new ChatMsg(CHANNEL_SYSTEM, -1, '', 'x', 0).getFullText()).toBe('/cff0000【System】/px');
  });

  it('drops wrapped lines beyond the box height (keeping the first)', () => {
    const m = new ChatMsg(CHANNEL_SYSTEM, -1, '', 'a b c d e f g h', 0);
    const lines = m.parse(font, 60, 24)!;
    expect(lines.filter((l) => l != null).length).toBe(2);
    expect(m.getTextTotalHeight()).toBe(24);
  });
});

describe('PowerMsg timing', () => {
  it('a notice lasts until its text has scrolled across', () => {
    let now = 1000;
    Object.assign(msgEnv, { width: 320, height: 480, font, now: () => now });
    const n = PowerMsg.createPowerMsgNotice('abcdefghij'); // 60 px
    const g = { setColor() {}, fillRect() {}, setClip() {}, getColor: () => 0, drawString() {}, drawLine() {} };
    n.paint(g as never); // starts the clock
    expect(n.destroy()).toBe(false);
    now += (((60 + 160) / 2 + 1) * 65);
    expect(n.destroy()).toBe(true);
  });
});

describe('doGetLevelImageSetIndex', () => {
  it('picks the portrait frame by rebirth level', () => {
    expect([0, 1, 96, 97].map(doGetLevelImageSetIndex)).toEqual([0, 1, 1, 2]);
  });
});
