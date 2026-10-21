import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkInt, parseUIFile, type UINode } from '../src/game/ui/XmlParse';

describe('checkInt', () => {
  it('keeps small values and decodes screen fractions', () => {
    expect(checkInt(120)).toBe(120);
    expect(checkInt(-5)).toBe(-5);
    // 1/2 of the 320px screen width + 10
    expect(checkInt(1200010)).toBe(170);
    // 1 font height + 3/4 of the 480px screen height + 7
    expect(checkInt(10034007)).toBe(18 + 360 + 7);
  });
});

const DIR = new URL('../public/assets/ui/', import.meta.url);
describe.skipIf(!existsSync(DIR))('every shipped .ui file', () => {
  it('parses and is consumed to the last byte', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ui'));
    const bad: string[] = [];
    let widgets = 0;
    const count = (n: UINode): number => 1 + n.children.reduce((a, c) => a + count(c), 0);
    for (const f of files) {
      const data = new Uint8Array(readFileSync(new URL(f, DIR)));
      try {
        const ui = parseUIFile(data);
        if (ui.consumed !== data.length) bad.push(`${f}: ${ui.consumed}/${data.length}`);
        widgets += count(ui.root) + ui.lib.reduce((a, l) => a + count(l), 0);
      } catch (e) {
        bad.push(`${f}: ${(e as Error).message}`);
      }
    }
    console.log(`${files.length} files, ${widgets} widgets; problems: ${bad.slice(0, 8).join(' | ')}`);
    expect(bad).toEqual([]);
  });
});
