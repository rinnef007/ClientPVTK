// The screen-independent part of com.hz.ui.UIHandler's input handling (handleKey,
// handlerMousePressed/Dragged/Released): key routing to the container that catches each
// direction, focus by tap, drag scrolling and scroll-bar taps. What an action *does* is decided
// per screen by UIAction/UIHandler listeners (not ported); here it is reported to `onAction`.
// Not ported: key/pointer auto-repeat, close-on-tap-outside (flag 16) and the per-screen
// special cases in handlerMouseReleased.
import { KEY_DOWN, KEY_FIRE, KEY_LEFT, KEY_RIGHT, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_UP } from '../../midp/Input';
import {
  GContainer,
  GScrollBar,
  GWidget,
  GWindow,
  SETTING_KEY_DOWN,
  SETTING_KEY_LEFT,
  SETTING_KEY_RIGHT,
  SETTING_KEY_UP,
} from '../gui/GWidget';

/** Event type of the generic "close" button. */
export const EVENT_CLOSE = 998;

const HOT_KEYS = new Set([35, 42, 48, 49, 51, 55, 57]);

/** UIHandler.setWindowFoucsGWidget: focus the widget in its window, and that window in its parent. */
export function setWindowFocusGWidget(w: GWidget | null): void {
  if (w == null || !w.isEnableFocus()) return;
  const p = w.parent;
  if (p == null) return;
  if (p instanceof GWindow) p.setFocus(w);
  setWindowFocusGWidget(p);
}

export class UIInput {
  actionGWidget: GWidget | null = null;
  oldGWidget: GWidget | null = null;
  /** Called for "fire" (key 5 / soft-left / a tap) with the widget acted on. */
  onAction: (w: GWidget | null) => void = () => {};
  /** Called for "back" (soft-right or a close button). */
  onClose: () => void = () => {};
  /** UIHandler.handlerMouseReleased: whether a tap outside the frame closes the UI. */
  closeOnOutsideTap: () => boolean = () => false;
  /** UIHandler.updateUI: runs after every handled key with the container that took it. */
  afterKey: (key: number, target: GContainer | null) => void = () => {};

  private dragGContainer: GContainer | null = null;
  private dragScrollBar = false;
  private pressX = 0;
  private pressY = 0;
  private dragDistance = 0;

  constructor(readonly frame: GContainer) {}

  private setActionGWidget(w: GWidget | null): void {
    this.oldGWidget = this.actionGWidget;
    this.actionGWidget = w;
  }

  handleKey(key: number): void {
    let target: GContainer | null = null;
    if (key === KEY_SOFT_RIGHT) {
      this.onClose();
    } else if (key === KEY_SOFT_LEFT || key === KEY_FIRE) {
      this.onAction(this.actionGWidget);
    } else if (HOT_KEYS.has(key)) {
      target = this.frame.getCatchKeyContainer(true, 0);
      if (target != null) {
        target.hotKeyPress(key);
        this.onAction(this.actionGWidget);
      }
    } else {
      const route: Record<number, [number, (c: GContainer) => void]> = {
        [KEY_UP]: [SETTING_KEY_UP, (c) => c.keyPressUp()],
        [KEY_LEFT]: [SETTING_KEY_LEFT, (c) => c.keyPressLeft()],
        [KEY_RIGHT]: [SETTING_KEY_RIGHT, (c) => c.keyPressRight()],
        [KEY_DOWN]: [SETTING_KEY_DOWN, (c) => c.keyPressDown()],
      };
      const r = route[key];
      if (r == null) return;
      target = this.frame.getCatchKeyContainer(false, r[0]);
      if (target != null) r[1](target);
    }
    if (target instanceof GWindow) this.setActionGWidget(target.focusWidget);
    this.afterKey(key, target);
  }

  pointerPressed(x: number, y: number): void {
    this.dragGContainer = null;
    this.dragScrollBar = false;
    const w = this.frame.searchDragGWidget(x, y);
    if (w instanceof GContainer) {
      this.dragGContainer = w;
    } else if (w instanceof GScrollBar) {
      this.dragGContainer = w.parent;
      this.dragScrollBar = true;
    }
    this.pressX = x;
    this.pressY = y;
    this.dragDistance = 0;
  }

  /** Drags move the content with the finger; dragging the bar itself moves it the other way, scaled. */
  pointerDragged(x: number, y: number): void {
    let dy = y - this.pressY;
    const dist = Math.abs(dy) + Math.abs(x - this.pressX);
    this.pressX = x;
    this.pressY = y;
    const c = this.dragGContainer;
    if (c == null) return;
    this.dragDistance += dist;
    const sb = c.gsb;
    if (sb != null) {
      const track = sb.getH() - 30;
      if (track > 0) dy = ((dy * sb.getTotalDis()) / track) | 0;
    }
    if (this.dragScrollBar) dy = -dy;
    c.pointerDrag(0, dy);
  }

  pointerReleased(x: number, y: number): void {
    const w = this.frame.searchPressGWidget(x, y);
    this.setActionGWidget(w);
    if (w == null) {
      // A short tap outside the frame closes it (status 16, not full-screen frames).
      const f = this.frame;
      const inside = x >= f.getXX() && x < f.getXX() + f.getW() && y >= f.getYY() && y < f.getYY() + f.getH();
      if (this.dragDistance < 30 && !inside && this.closeOnOutsideTap()) this.handleKey(KEY_SOFT_RIGHT);
      return;
    }
    if (w instanceof GScrollBar) {
      if (this.dragDistance > 10 || w.parent == null) return;
      if (w.isRectInTop(x, y)) w.parent.moveDown();
      else w.parent.moveUp();
      return;
    }
    if (this.dragDistance >= 30) return;
    setWindowFocusGWidget(w);
    if (w.getEventType() === EVENT_CLOSE) this.handleKey(KEY_SOFT_RIGHT);
    else this.handleKey(KEY_FIRE);
  }
}
