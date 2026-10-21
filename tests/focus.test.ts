import { describe, expect, it } from 'vitest';
import {
  GLabel,
  GTextArea,
  GWindow,
  SETTING_ENABLE_FOCUS,
  SETTING_KEY_DOWN,
  SETTING_KEY_RIGHT,
  SETTING_PRESS,
  VM,
} from '../src/game/gui/GWidget';
import { UIInput } from '../src/game/ui/UIInput';
import { KEY_DOWN, KEY_RIGHT } from '../src/midp/Input';

function cell(x: number, y: number, event: number): GLabel {
  const l = new GLabel(new Int32Array(21));
  l.setBounds(x, y, 20, 20);
  l.setGWidgetSetting(SETTING_ENABLE_FOCUS | SETTING_PRESS, true);
  l.setEventType(event);
  return l;
}

function window(n: number, keys: number, grid = 0): GWindow {
  const w = new GWindow(new Int32Array(21));
  w.setBounds(0, 0, 100, 100);
  w.setGWidgetSetting(keys, true);
  if (grid) w.setLayoutMode(4, 0, 0, 0, 0, grid);
  for (let i = 0; i < n; i++) w.add(cell((i % 2) * 30, ((i / 2) | 0) * 30, 100 + i));
  w.setAbs();
  return w;
}

const focused = (w: GWindow) => w.children.indexOf(w.focusWidget!);

describe('GWindow focus', () => {
  it('moves to the next focusable child and wraps', () => {
    const w = window(3, SETTING_KEY_DOWN);
    w.keyPressDown();
    expect(focused(w)).toBe(1); // focusIndex starts at 0, so the first press lands on child 1
    w.keyPressDown();
    w.keyPressDown();
    expect(focused(w)).toBe(0);
    expect(w.children.filter((c) => c.isFocus())).toEqual([w.children[0]]);
  });

  it('ignores directions whose setting bit is off', () => {
    const w = window(3, SETTING_KEY_DOWN);
    w.keyPressRight();
    expect(w.focusWidget).toBe(null);
  });

  it('moves along rows and columns in grid layouts', () => {
    const w = window(4, SETTING_KEY_DOWN | SETTING_KEY_RIGHT, 2);
    w.setFirstFocus();
    w.keyPressRight();
    expect(focused(w)).toBe(1);
    w.keyPressDown();
    expect(focused(w)).toBe(3);
    w.keyPressRight(); // row [2, 3] wraps to 2
    expect(focused(w)).toBe(2);
    expect(w.moveFlag).toBe(1);
  });
});

describe('UIInput', () => {
  it('routes arrow keys to the window that takes them and taps to the widget under the finger', () => {
    const w = window(4, SETTING_KEY_DOWN);
    const input = new UIInput(w);
    const acted: number[] = [];
    input.onAction = (x) => acted.push(x?.getEventType() ?? -1);
    input.handleKey(KEY_RIGHT); // not taken: no window has the right-key bit
    expect(w.focusWidget).toBe(null);
    input.handleKey(KEY_DOWN);
    expect(input.actionGWidget).toBe(w.children[1]);
    input.pointerPressed(35, 35);
    input.pointerReleased(35, 35);
    expect(w.focusWidget).toBe(w.children[3]);
    expect(acted).toEqual([103]);
  });
});

describe('GTextArea scrolling', () => {
  it('scrolls line by line and pages through overflowing text', () => {
    const t = new GTextArea(new Int32Array(21));
    t.setBounds(0, 0, 100, 40);
    t.setText('a\nb\nc\nd');
    expect(t.needScrollBar).toBe(true);
    expect(t.vm[VM.H]).toBe(36); // shrunk to the two whole lines that fit
    t.keyPressDown();
    expect(t.getOffsetY()).toBe(-18);
    t.keyPressDown();
    t.keyPressDown();
    expect(t.getOffsetY()).toBe(-36); // clamped at the last page
    t.keyPressUp();
    expect(t.getOffsetY()).toBe(-18);
    expect(t.totalPage).toBe(2);
    t.keyPressRight();
    expect([t.curPage, t.getOffsetY()]).toEqual([1, -36]);
    t.keyPressRight();
    expect([t.curPage, t.getOffsetY()]).toEqual([0, 0]);
  });
});
