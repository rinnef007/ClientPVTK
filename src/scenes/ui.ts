import { HCENTER, LEFT, TOP, VCENTER } from '../midp/anchor';
import { FONT_LARGE, FONT_MEDIUM, FONT_SMALL, type Graphics } from '../midp/Graphics';
import { uiFont, uiScreen } from '../game/gui/GWidget';
import { uiMetrics } from '../game/ui/XmlParse';
import {
  COLOR_BG,
  COLOR_BORDER,
  COLOR_DIM,
  COLOR_PANEL,
  COLOR_SELECT,
  COLOR_TEXT,
  COLOR_TITLE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from './Scene';

export const TITLE_H = 36;
export const SOFTKEY_H = 28;

export function drawFrame(g: Graphics, title: string, leftSoft = '', rightSoft = ''): void {
  g.setColor(COLOR_BG);
  g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  g.setColor(COLOR_PANEL);
  g.fillRect(0, 0, SCREEN_WIDTH, TITLE_H);
  g.setColor(COLOR_BORDER);
  g.drawLine(0, TITLE_H, SCREEN_WIDTH, TITLE_H);
  g.setFontSize(FONT_LARGE);
  g.setColor(COLOR_TITLE);
  g.drawString(title, SCREEN_WIDTH / 2, TITLE_H / 2, HCENTER | VCENTER);

  const y = SCREEN_HEIGHT - SOFTKEY_H;
  g.setColor(COLOR_PANEL);
  g.fillRect(0, y, SCREEN_WIDTH, SOFTKEY_H);
  g.setColor(COLOR_BORDER);
  g.drawLine(0, y, SCREEN_WIDTH, y);
  g.setFontSize(FONT_MEDIUM);
  g.setColor(COLOR_TEXT);
  if (leftSoft) g.drawString(leftSoft, 8, y + SOFTKEY_H / 2, LEFT | VCENTER);
  if (rightSoft) g.drawString(rightSoft, SCREEN_WIDTH - 8 - g.stringWidth(rightSoft), y + SOFTKEY_H / 2, LEFT | VCENTER);
}

/** Which soft key (if any) a tap hits: -6 left, -7 right. */
export function softKeyAt(x: number, y: number): number {
  if (y < SCREEN_HEIGHT - SOFTKEY_H) return 0;
  if (x < SCREEN_WIDTH / 3) return -6;
  if (x > (SCREEN_WIDTH * 2) / 3) return -7;
  return 0;
}

export const ITEM_H = 40;

export function drawList(g: Graphics, items: string[], selected: number, top: number): void {
  g.setFontSize(FONT_MEDIUM);
  items.forEach((label, i) => {
    const y = top + i * ITEM_H;
    if (i === selected) {
      g.setColor(COLOR_SELECT);
      g.fillRoundRect(16, y + 2, SCREEN_WIDTH - 32, ITEM_H - 4, 8, 8);
      g.setColor(COLOR_TITLE);
      g.drawRoundRect(16, y + 2, SCREEN_WIDTH - 32, ITEM_H - 4, 8, 8);
    }
    g.setColor(i === selected ? COLOR_TITLE : COLOR_TEXT);
    g.drawString(label, SCREEN_WIDTH / 2, y + ITEM_H / 2, HCENTER | VCENTER);
  });
}

export function listIndexAt(y: number, top: number, count: number): number {
  const i = Math.floor((y - top) / ITEM_H);
  return i >= 0 && i < count ? i : -1;
}

/** Word-wraps text into lines that fit `maxW` at the current font. */
export function wrap(g: Graphics, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (g.stringWidth(next) > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

export function drawParagraph(g: Graphics, text: string, x: number, y: number, maxW: number, color = COLOR_DIM): number {
  g.setFontSize(FONT_SMALL);
  g.setColor(color);
  const lines = wrap(g, text, maxW);
  lines.forEach((l, i) => g.drawString(l, x, y + i * g.getFontHeight(), LEFT | TOP));
  return y + lines.length * g.getFontHeight();
}

/**
 * Screen size and text metrics for the gui widgets (GameCanvas.SCREEN_* and Utilities.FONT):
 * labels size themselves from these while a .ui tree is built.
 */
export function initUIEnvironment(): void {
  uiMetrics.screenWidth = uiScreen.width = SCREEN_WIDTH;
  uiMetrics.screenHeight = uiScreen.height = SCREEN_HEIGHT;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${FONT_MEDIUM}px Roboto, Arial, "Liberation Sans", Helvetica, sans-serif`;
  uiFont.height = FONT_MEDIUM + 2;
  uiMetrics.fontHeight = uiFont.height;
  uiFont.stringWidth = (t) => Math.ceil(measure.measureText(t).width);
}
