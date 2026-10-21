// The screen-stack core of com.hz.ui.UIHandler (Vineflower / jadx decompiles): a UI built from
// ui/<type>.ui with its event-type table, the global list of open UIs (top one gets input and is
// removed once closed), drawAll, and the alert dialog. Per-screen data fillers live in the
// screens/ modules; actions are routed to a listener (UIAction).
import type { Graphics } from '../../midp/Graphics';
import { KEY_DOWN, KEY_UP } from '../../midp/Input';
import { getAssetFS } from '../common/Utilities';
import { isNullText } from '../common/Tool';
import { GContainer, GLinePanel, GTextArea, GWidget, GWindow, GLabel, GPixelLabel, uiScreen } from '../gui/GWidget';
import { backIconFiles, fillAlphaRect, imageSetFiles } from '../main/GameView';
import { preloadSprite } from '../sprite/GameSprite';
import { PIXEL_FONT_SIZES } from '../string/PixelFont';
import { build, collectSpriteIds } from './UIBuilder';
import { UIInput } from './UIInput';
import { collectImageSets } from './UIPreview';
import { parseUIFile, type UIFile } from './XmlParse';

/** UIListener: what a screen does with its actions (UIAction is the default one). */
export interface UIListener {
  processLayerAction(ui: UIHandler, action: number): void;
  processLayerClose(ui: UIHandler): void;
}

/** UIHandler.handleSpecificUIKey: UI types whose close key becomes notifyLayerAction(1). */
const CLOSE_AS_ACTION = new Set([
  2, 3, 62, 63, 66, 67, 103, 104, 7, 14, 21, 37, 44, 52, 54, 74, 79, 88, 92, 101, 106, 117, 130, 151, 160, 173, 205,
  94, 95, 96, 97, 98, 213, 214, 215, 216, 217,
]);

export const STATUS_CATCH_INPUT = 1;
/** Status bit 16 (on by default): a tap outside the frame acts as "back". */
export const STATUS_CLOSE_OUTSIDE = 16;
export const STATUS_CLOSED = 2;

/** Frame system types (GWidget vmData[0] of the root). */
export const FRAME_POPUP = 0;
export const FRAME_FULL_SCREEN = 1;
export const FRAME_HIDE_LAST = 3;

export const TYPE_ALERT = 7;
/** GameText.getText(15). */
export const STR_TIP_TITLE = 'Gợi ý';

const files = new Map<number, UIFile>();

/** Loads ui/<type>.ui and everything its widgets draw (fonts, image sets, sprites). */
export async function preloadUI(...types: number[]): Promise<void> {
  const fs = getAssetFS();
  const need = types.filter((t) => !files.has(t));
  if (need.length === 0) return;
  await fs.preload([...need.map((t) => `ui/${t}.ui`), ...PIXEL_FONT_SIZES.map((n) => `common/${n}.t`), ...backIconFiles()]);
  for (const t of need) {
    const data = fs.get(`ui/${t}.ui`);
    if (!data) continue;
    const f = parseUIFile(data);
    await fs.preload([...collectImageSets(f)].flatMap(imageSetFiles));
    await Promise.all(collectSpriteIds(f).map(preloadSprite));
    files.set(t, f);
  }
}

export function isUILoaded(type: number): boolean {
  return files.has(type);
}

export class UIHandler {
  static uiList: UIHandler[] = [];
  /** UIHandler.updateUI parts (e.g. updateEquipUI), run for every UI after each key. */
  static updateUIHooks: ((ui: UIHandler, key: number, target: GContainer | null) => void)[] = [];
  /** Default listener (UIAction.getUIActionInstance), installed by the action module. */
  static defaultListener: UIListener | null = null;

  subType = 0;
  uiFrame: GContainer | null = null;
  gwidetLib: GWidget[] = [];
  readonly vmGWidgets = new Map<number, GWidget>();
  listener: UIListener | null = null;
  parent: UIHandler | null = null;
  obj: unknown = null;
  input: UIInput | null = null;
  private flagStatus = STATUS_CATCH_INPUT | STATUS_CLOSE_OUTSIDE;

  constructor(readonly type: number) {}

  /** UIHandler.createUIFromXML: the file must have been loaded with preloadUI. */
  static createUIFromXML(type: number): UIHandler {
    const ui = new UIHandler(type);
    const f = files.get(type);
    if (f == null) return ui;
    const reg = (w: GWidget) => ui.addEventGWidget(w);
    ui.gwidetLib = f.lib.map((n) => build(n, f.lib, reg));
    const root = build(f.root, f.lib, reg);
    if (root instanceof GContainer) {
      ui.uiFrame = root;
      ui.input = new UIInput(root);
      ui.input.onAction = () => ui.notifyLayerAction(0);
      // handleSpecificUIKey: these screens get the close key as layer action 1 (their own "back").
      ui.input.onClose = () => (CLOSE_AS_ACTION.has(type) ? ui.notifyLayerAction(1) : ui.notifyLayerClose());
      ui.input.closeOnOutsideTap = () => ui.isStatusFlag(STATUS_CLOSE_OUTSIDE) && ui.getFrameSystemType() !== FRAME_FULL_SCREEN;
      ui.input.afterKey = (key, target) => {
        for (const hook of UIHandler.updateUIHooks) hook(ui, key, target);
        // updateKeyUpDown
        if (key === KEY_UP) ui.notifyLayerAction(4);
        else if (key === KEY_DOWN) ui.notifyLayerAction(5);
      };
    }
    return ui;
  }

  addEventGWidget(w: GWidget | null): void {
    if (w != null && w.getEventType() >= 0) this.vmGWidgets.set(w.getEventType(), w);
  }

  getGWidgetByEventType(ev: number): GWidget | null {
    return this.vmGWidgets.get(ev) ?? null;
  }

  getGWindowByEventType(ev: number): GWindow | null {
    const w = this.getGWidgetByEventType(ev);
    return w instanceof GWindow ? w : null;
  }

  getLibGWidget(i: number): GWidget | null {
    return this.gwidetLib[i] ?? null;
  }

  getFrameContainer(): GContainer | null {
    return this.uiFrame;
  }

  getActionGWidget(): GWidget | null {
    return this.input?.actionGWidget ?? null;
  }

  getOldActionGWidget(): GWidget | null {
    return this.input?.oldGWidget ?? null;
  }

  setActionGWidget(w: GWidget | null): void {
    if (this.input) {
      this.input.oldGWidget = this.input.actionGWidget;
      this.input.actionGWidget = w;
    }
  }

  getType(): number {
    return this.type;
  }

  setSubType(t: number): void {
    this.subType = t;
  }

  getSubType(): number {
    return this.subType;
  }

  setDefaultListener(): void {
    this.listener = UIHandler.defaultListener;
  }

  setStatusFlag(on: boolean, bit: number): void {
    this.flagStatus = on ? this.flagStatus | bit : this.flagStatus & ~bit;
  }

  isStatusFlag(bit: number): boolean {
    return (this.flagStatus & bit) !== 0;
  }

  close(): void {
    this.setStatusFlag(true, STATUS_CLOSED);
  }

  isClosed(): boolean {
    return this.isStatusFlag(STATUS_CLOSED);
  }

  getFrameSystemType(): number {
    return this.uiFrame?.vm[0] ?? 0;
  }

  /** false hides the screens below (system type 3). */
  setShowLastLayer(show: boolean): void {
    if (!show && this.uiFrame) this.uiFrame.vm[0] = FRAME_HIDE_LAST;
  }

  notifyLayerAction(action: number): void {
    this.listener?.processLayerAction(this, action);
  }

  notifyLayerClose(): void {
    this.listener?.processLayerClose(this);
  }

  /** UIHandler.show: lay out and centre on screen. */
  show(): void {
    const f = this.uiFrame;
    if (f == null) return;
    f.setAbs();
    f.layout();
    const x = uiScreen.width > f.getW() ? ((uiScreen.width - f.getW()) / 2) | 0 : 0;
    const y = uiScreen.height > f.getH() ? ((uiScreen.height - f.getH()) / 2) | 0 : 0;
    f.setPos(x, y);
  }

  draw(g: Graphics): void {
    if (this.uiFrame?.isShow()) this.uiFrame.paint(g);
  }

  // --- the UI stack ---

  static addUI(ui: UIHandler | null): void {
    if (ui != null) UIHandler.uiList.push(ui);
  }

  static deleteUI(ui: UIHandler | null): void {
    const i = ui == null ? -1 : UIHandler.uiList.indexOf(ui);
    if (i >= 0) UIHandler.uiList.splice(i, 1);
  }

  static getTopUI(): UIHandler | null {
    return UIHandler.uiList[UIHandler.uiList.length - 1] ?? null;
  }

  static hasUI(): boolean {
    return UIHandler.uiList.length > 0;
  }

  static getUIByType(type: number): UIHandler | null {
    return UIHandler.uiList.find((u) => u.type === type) ?? null;
  }

  static closeUIByType(type: number): void {
    for (let i = UIHandler.uiList.length - 1; i >= 0; i--) if (UIHandler.uiList[i].type === type) UIHandler.uiList.splice(i, 1);
  }

  static closeAllUI(): void {
    UIHandler.uiList.length = 0;
  }

  /** GameView.forcePaintWorld: false while a full-screen UI is open. */
  static isWorldVisible(): boolean {
    return !UIHandler.uiList.some((u) => u.getFrameSystemType() === FRAME_FULL_SCREEN);
  }

  /** UIHandler.logic: the top UI gets the tick's key and pointer events; closed UIs are dropped. */
  static logic(key: number, pointers: { type: 'down' | 'move' | 'up'; x: number; y: number }[]): void {
    const top = UIHandler.getTopUI();
    if (top == null) return;
    if (top.uiFrame == null) top.close();
    if (!top.isClosed() && top.isStatusFlag(STATUS_CATCH_INPUT) && top.input) {
      for (const p of pointers) {
        if (p.type === 'down') top.input.pointerPressed(p.x, p.y);
        else if (p.type === 'move') top.input.pointerDragged(p.x, p.y);
        else top.input.pointerReleased(p.x, p.y);
      }
      if (key !== 0) top.input.handleKey(key);
    }
    if (top.isClosed()) UIHandler.deleteUI(top);
  }

  /**
   * UIHandler.drawAll: each UI in order; one that a full-screen UI right above it hides is
   * replaced by a cleared screen, and the topmost popup darkens what is below it.
   */
  static drawAll(g: Graphics): void {
    const list = UIHandler.uiList;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const ui = list[i];
      const next = list[i + 1];
      const hidden = next != null && (next.getFrameSystemType() === FRAME_FULL_SCREEN || next.getFrameSystemType() === FRAME_HIDE_LAST);
      if (hidden) {
        g.setColor(0);
        g.fillRect(0, 0, uiScreen.width, uiScreen.height);
        continue;
      }
      if (i === 0 && ui.getFrameSystemType() === FRAME_FULL_SCREEN) {
        g.setColor(0);
        g.fillRect(0, 0, uiScreen.width, uiScreen.height);
      }
      if (i === n - 1 && ui.getFrameSystemType() === FRAME_POPUP) {
        fillAlphaRect(g, 0x80000000 | 0, 0, 0, uiScreen.width, uiScreen.height);
      }
      ui.draw(g);
      g.setClip(0, 0, uiScreen.width, uiScreen.height);
    }
  }
}

/**
 * UIHandler.alertMessage: ui/7 with a title label (1), a line panel (2) holding the text area (3)
 * and, when the text overflows, its scroll bar widget (4) from the library.
 */
export function alertMessage(text: string, title: string = STR_TIP_TITLE, anchor = 3, subType = 0, showLast = true): UIHandler | null {
  if (isNullText(text) || !isUILoaded(TYPE_ALERT)) return null;
  const ui = UIHandler.createUIFromXML(TYPE_ALERT);
  ui.setDefaultListener();
  ui.setSubType(subType);
  ui.setShowLastLayer(showLast);
  const frame = ui.getFrameContainer();
  const label = ui.getGWidgetByEventType(1);
  if (title && label instanceof GLabel) label.setText(title);
  const panel = ui.getGWidgetByEventType(2);
  const area = ui.getGWidgetByEventType(3);
  if (frame == null || !(panel instanceof GLinePanel) || !(area instanceof GTextArea)) return null;
  area.anchor = anchor;
  area.setText(text);
  panel.add(area);
  if (area.needScrollBar) {
    const bar = ui.getGWidgetByEventType(4);
    if (bar) panel.add(bar);
  }
  frame.add(panel);
  updateDataToTipInfoUI(ui, 0, false);
  ui.show();
  UIHandler.addUI(ui);
  return ui;
}

/** Pages the tip text area (3) and shows "page/total" in the pixel label (7). */
export function updateDataToTipInfoUI(ui: UIHandler, dir: number, closeAtEnd: boolean, areaEv = 3, pageEv = 7): void {
  const area = ui.getGWidgetByEventType(areaEv);
  if (!(area instanceof GTextArea)) return;
  if (dir > 0) {
    if (closeAtEnd && area.curPage + 1 === area.totalPage) {
      ui.notifyLayerAction(1);
      return;
    }
    area.moveDownPage();
  } else if (dir < 0) {
    area.moveUpPage();
  }
  const page = ui.getGWidgetByEventType(pageEv);
  if (page instanceof GPixelLabel) page.setText(`${area.curPage + 1}/${area.totalPage}`);
}
