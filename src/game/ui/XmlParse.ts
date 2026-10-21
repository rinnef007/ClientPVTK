// Port of com.hz.ui.XmlParse (Vineflower decompile of classes2.dex): reads the binary .ui
// files into a widget tree. Every attribute code below was matched against XmlParse's named
// constants (ATTR_SET_*); argument layouts and the "wrong widget class → stop reading" quirk
// follow the bytecode. Widgets are kept as data (UINode) here; behaviour lives in the gui port.
import { DataInputStream } from '../common/DataStream';

export const TYPE_GICON = 1;
export const TYPE_GGAME_ICON = 2;
export const TYPE_GIMAGE_NUMBER = 3;
export const TYPE_GLABEL = 4;
export const TYPE_GPIXEL_LABEL = 5;
export const TYPE_GSCROLL_BAR = 6;
export const TYPE_GGAME_BAR = 7;
export const TYPE_GSPINNER = 8;
export const TYPE_GCONTAINER = 50;
export const TYPE_GLINE_PANEL = 51;
export const TYPE_GTEXT_AREA = 52;
export const TYPE_GWINDOW = 53;

// vmData slots (GWidget.GW_VM_*).
export const VM_SYS_TYPE = 0;
export const VM_TYPE = 1;
export const VM_X = 2;
export const VM_Y = 3;
export const VM_W = 4;
export const VM_H = 5;
export const VM_EVENT_TYPE = 19;
export const VM_EVENT_SETTING = 20;
export const VM_DATA_SIZE = 21;

export const ATTR_NAMES: Record<number, string> = {
  0: 'BORDER', 1: 'BOUNDS', 2: 'LAYOUTMODE', 3: 'FOCUSCOLORTABLE', 4: 'NONEEDLAYOUT', 5: 'POS',
  6: 'MINSIZE', 7: 'MAXSIZE', 8: 'OFFSETXY', 9: 'SIZE', 11: 'DATA_LINEPANEL', 12: 'DATA_LABEL',
  13: 'BACK_LABEL', 14: 'BACK_TEXTAREA', 15: 'DATA_ICON', 16: 'BACKGROUND_LABEL', 17: 'FONT',
  18: 'LINECOLORTABLE', 19: 'ADDLIB', 21: 'BACKGROUND_GAMEICON', 22: 'DATA_GAMEICON',
  23: 'BORDERCOLOR', 24: 'BGCOLOR', 25: 'FGCOLOR', 26: 'VALUE', 27: 'DATA_TEXTAREA',
  28: 'LINECOLOR', 29: 'ADD_SCROLLBAR', 30: 'WINDOW_CHILD_FOCUS', 31: 'ICON_NUM_DATA',
  32: 'UNDERLINECOLOR', 33: 'LEFT_RIGHT_BG_COLOR_DISABLE', 34: 'LINE_SPACE',
  35: 'SELECT_BORDERCOLOR', 36: 'SHADE_COLOR_TABLE', 37: 'FOCUS_SHADE_COLOR_TABLE',
  38: 'PIXEL_COLOR_TABLE', 39: 'FOCUS_PIXEL_COLOR_TABLE', 40: 'IMGNUMBER_DATA',
  41: 'IMGNUMBER_STRING', 42: 'COLORTABLE', 43: 'FRAGMENTTABLE', 44: 'FOCUSFRAGMENTTABLE',
  45: 'DATA_SPINNER', 46: 'GAMEBAR_TYPE', 47: 'LABEL_STATUS', 48: 'DRAW_VIEW_IMAGE',
};

export type ArgValue = number | boolean | string | number[] | string[];

export interface UICall {
  code: number;
  args: ArgValue[];
}

export interface UINode {
  type: number;
  vm: Int32Array;
  calls: UICall[];
  children: UINode[];
}

export interface UIFile {
  lib: UINode[];
  root: UINode;
}

/** Screen-relative sizes used by checkInt (GameCanvas.SCREEN_* and Utilities.FONT_HEIGHT). */
export const uiMetrics = { screenWidth: 320, screenHeight: 480, fontHeight: 18 };

/**
 * Decodes the "relative" ints of layouts: |v| < 1000 is literal; otherwise the decimal digits
 * above the last three encode extra font heights and fractions of the screen width/height.
 */
export function checkInt(v: number): number {
  let q = (Math.abs(v) / 1000) | 0;
  if (q === 0) return v;
  const base = v % 1000;
  const fonts = (q / 10000) | 0;
  q %= 10000;
  const wNum = (q / 1000) | 0;
  q %= 1000;
  const wDen = (q / 100) | 0;
  q %= 100;
  const hNum = (q / 10) | 0;
  const hDen = q % 10;
  let r = base;
  if (fonts > 0) r += fonts * uiMetrics.fontHeight;
  if (wNum > 0 && wDen > 0) r += ((uiMetrics.screenWidth * wNum) / wDen) | 0;
  if (hNum > 0 && hDen > 0) r += ((uiMetrics.screenHeight * hNum) / hDen) | 0;
  return r;
}

// Class hierarchy of the gui package, for the instanceof checks in parseMethod.
const isLabel = (t: number) => t === TYPE_GLABEL || t === TYPE_GPIXEL_LABEL || t === TYPE_GICON;
const isPixelLabel = (t: number) => t === TYPE_GPIXEL_LABEL || t === TYPE_GICON;
const isContainer = (t: number) => t >= TYPE_GCONTAINER && t <= TYPE_GWINDOW;
const isLinePanel = (t: number) => t === TYPE_GLINE_PANEL || t === TYPE_GTEXT_AREA || t === TYPE_GWINDOW;

const readBoolean = (d: DataInputStream) => d.readByte() === 1;

function readIntArray(d: DataInputStream, check = false): number[] {
  const n = d.readByte() & 0xff;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(d.readInt());
  return check ? out.map(checkInt) : out;
}

function readStringArray(d: DataInputStream): string[] {
  const n = d.readByte() & 0xff;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(d.readUTF());
  return out;
}

/** Calls whose first int (an image-set id) is read before the widget cast that fails. */
function readFirstThenFail(d: DataInputStream): null {
  d.readInt();
  return null;
}

const ints = (d: DataInputStream, n: number) => Array.from({ length: n }, () => d.readInt());
const checked = (d: DataInputStream, n: number) => ints(d, n).map(checkInt);

/**
 * Reads one method call. Returns null when Java would hit a ClassCastException or skip the
 * call before reading its arguments (the stream position is then left unchanged, as in Java).
 */
function parseMethod(t: number, d: DataInputStream): UICall | null {
  const code = d.readByte();
  const call = (args: ArgValue[]): UICall => ({ code, args });
  switch (code) {
    case 0:
      return call([d.readByte(), d.readByte(), d.readByte(), d.readByte()]);
    case 1:
      return call(checked(d, 4));
    case 2:
      return isContainer(t) ? call(ints(d, 6)) : null;
    case 3:
    case 36:
    case 37:
    case 42:
      return call([readIntArray(d)]);
    case 4:
      return call([readBoolean(d)]);
    case 5:
    case 6:
    case 7:
    case 9:
      return call(checked(d, 2));
    case 8:
      return call(ints(d, 2));
    case 11:
    case 12:
      if (isLinePanel(t)) return call([readIntArray(d), d.readInt(), d.readInt(), d.readInt()]);
      if (isLabel(t)) return call([d.readUTF(), d.readInt(), d.readInt(), d.readInt()]);
      return null;
    case 13:
    case 14:
      if (t === TYPE_GTEXT_AREA) return call([readIntArray(d), d.readInt(), d.readShort()]);
      if (isLabel(t)) return call([readIntArray(d), d.readInt(), d.readShort(), d.readShort()]);
      return null;
    case 15:
      return t === TYPE_GICON ? call(ints(d, 4)) : readFirstThenFail(d);
    case 16:
      return isLabel(t) ? call(ints(d, 4)) : readFirstThenFail(d);
    case 17:
      return isPixelLabel(t) ? call([d.readByte()]) : null;
    case 18:
      return isLabel(t) ? call([readIntArray(d), readBoolean(d)]) : null;
    case 19:
      if (!isContainer(t)) return null;
      return call([d.readInt(), d.readInt(), readIntArray(d, true), readStringArray(d), readIntArray(d)]);
    case 21:
      return t === TYPE_GGAME_ICON ? call(ints(d, 3)) : readFirstThenFail(d);
    case 22:
      return t === TYPE_GGAME_ICON ? call([d.readInt(), readBoolean(d), readBoolean(d)]) : null;
    case 23:
    case 35:
      return isLabel(t) ? call([d.readInt()]) : null;
    case 24:
    case 25:
      return t === TYPE_GGAME_BAR ? call(ints(d, 3)) : null;
    case 26:
      return t === TYPE_GGAME_BAR ? call(ints(d, 2)) : null;
    case 27:
      return t === TYPE_GTEXT_AREA ? call([d.readUTF(), d.readInt(), d.readInt(), readBoolean(d)]) : null;
    case 28:
    case 34:
      return t === TYPE_GTEXT_AREA ? call([d.readInt()]) : null;
    case 29:
      return isContainer(t) ? call([d.readByte(), ...ints(d, 4)]) : null;
    case 30:
      return t === TYPE_GWINDOW ? call([d.readInt()]) : null;
    case 31:
      return t === TYPE_GICON ? call(ints(d, 5)) : readFirstThenFail(d);
    case 32:
      return isLinePanel(t) ? call([d.readInt()]) : null;
    case 33:
      if (isLabel(t) || isLinePanel(t)) return call([readBoolean(d)]);
      return null;
    case 38:
    case 39:
      return isPixelLabel(t) ? call([readIntArray(d)]) : null;
    case 40:
      return t === TYPE_GIMAGE_NUMBER ? call(ints(d, 3)) : readFirstThenFail(d);
    case 41:
      return t === TYPE_GIMAGE_NUMBER ? call([d.readUTF()]) : null;
    case 43:
    case 44:
      return call([readIntArray(d, true)]);
    case 45:
      return t === TYPE_GSPINNER ? call(ints(d, 4)) : readFirstThenFail(d);
    case 46:
      return t === TYPE_GGAME_BAR ? call(ints(d, 3)) : null;
    case 47:
      return isLabel(t) ? call([d.readInt()]) : null;
    case 48:
      return isLinePanel(t) ? call([readBoolean(d)]) : null;
    default:
      return null; // 10, 20 and unknown codes: Java returns without reading.
  }
}

const KNOWN_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 50, 51, 52, 53]);

export function parseUI(d: DataInputStream): UINode {
  const type = d.readByte();
  const vm = new Int32Array(VM_DATA_SIZE);
  vm[VM_EVENT_TYPE] = -1;
  const nAttr = d.readByte();
  for (let i = 0; i < nAttr; i++) {
    const idx = d.readByte();
    const v = d.readInt();
    if (idx >= 0 && idx < VM_DATA_SIZE) vm[idx] = v;
  }
  const node: UINode = { type, vm, calls: [], children: [] };
  // fromGWidget: an unknown type makes a null widget, whose method calls are all skipped.
  const nCalls = d.readByte();
  for (let i = 0; i < nCalls; i++) {
    if (!KNOWN_TYPES.has(type)) continue;
    const c = parseMethod(type, d);
    if (c) node.calls.push(c);
  }
  const nChildren = d.readByte();
  for (let i = 0; i < nChildren; i++) {
    const child = parseUI(d);
    if (isContainer(type)) node.children.push(child);
  }
  return node;
}

/** UIHandler.loadUIFromXML: widget library (templates for ADDLIB) followed by the UI tree. */
export function parseUIFile(data: Uint8Array): UIFile & { consumed: number } {
  const d = new DataInputStream(data);
  const n = d.readByte();
  const lib: UINode[] = [];
  for (let i = 0; i < n; i++) lib.push(parseUI(d));
  const root = parseUI(d);
  return { lib, root, consumed: d.position };
}
