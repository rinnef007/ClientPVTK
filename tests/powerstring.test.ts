import { describe, expect, it } from 'vitest';
import { PowerString, splitString, type TextFont } from '../src/game/string/PowerString';

// Monospace stand-in: 6px per char, 12px lines.
const font: TextFont = { height: 12, stringWidth: (s) => s.length * 6 };

const texts = (lines: PowerString[] | null) => lines?.map((l) => l.getValue());
const colors = (p: PowerString) => p.entities?.map((e) => [e.getStrValue(), e.index]);

describe('Utilities.splitString', () => {
  it('wraps at spaces and keeps the space on the line', () => {
    expect(splitString('ab cd ef', font, 30)).toEqual(['ab ', 'cd ef']);
  });

  it('hard-breaks a word wider than the line', () => {
    expect(splitString('abcdefgh', font, 30)).toEqual(['abcde', 'fgh']);
  });

  it('breaks at newlines and between CJK characters', () => {
    expect(splitString('a\nb', font, 100)).toEqual(['a', 'b']);
    expect(splitString('中文字', font, 12)).toEqual(['中文', '字']);
  });

  it('returns one empty line for empty text', () => {
    expect(splitString('', font, 10)).toEqual(['']);
  });
});

describe('PowerString', () => {
  it('parses colour runs, keeping -1 for uncoloured text', () => {
    const p = PowerString.createPowerString('x/cff0000red/py', font);
    expect(colors(p)).toEqual([['x', -1], ['red', 0xff0000], ['y', -1]]);
    expect(p.width).toBe(30);
    expect(p.height).toBe(12);
  });

  it('handles nested colour runs', () => {
    const p = PowerString.createPowerString('/c00ff00a/c0000ffb/pc/p', font);
    expect(colors(p)).toEqual([['a', 0x00ff00], ['b', 0x0000ff], ['c', 0x00ff00]]);
  });

  it('marks "{}" runs as underlined', () => {
    const p = PowerString.createPowerString('/c112233{}u/p', font);
    expect(p.entities?.[0].underLine).toBe(true);
    expect(p.getValue()).toBe('u');
  });

  it('keeps an unterminated colour code as plain text', () => {
    expect(PowerString.createPowerString('/cff0000abc', font).getValue()).toBe('/cff0000abc');
  });

  it('splits on newlines and wraps coloured runs across lines', () => {
    expect(texts(PowerString.splitPowerString('ab\ncd', font, 100))).toEqual(['ab', 'cd']);
    const lines = PowerString.splitPowerString('/cff0000aaaa bbbb/p', font, 30)!;
    expect(texts(lines)).toEqual(['aaaa ', 'bbbb']);
    expect(lines.map((l) => l.entities![0].index)).toEqual([0xff0000, 0xff0000]);
  });
});
