// The yes/no box (ui/14): UIHandler.createTwiceSureUI / waitForTwiceSureUI and
// UIAction.processTwiceSureLayer (Vineflower decompile). Java blocks in a nested game loop until the
// box closes and returns its sub type (10 yes, 20 no); here the caller passes a callback instead.
import { GLabel, GTextArea } from '../../gui/GWidget';
import { isNullText } from '../../common/Tool';
import { UIHandler } from '../UIHandler';
import { registerScreen } from '../UIAction';

export const TYPE_TWICE_SURE = 14;
export const SURE_YES = 10;
export const SURE_NO = 20;
const STR_AGREE = 'Đồng ý'; // GameText 23
const STR_BACK = 'Trở về'; // GameText 4
/** Sub type while the box waits for an answer. */
const SUB_WAITING = 1;

const callbacks = new WeakMap<UIHandler, (result: number) => void>();

/** Title (4), text (1, with its anchor), the two buttons (2 yes, 3 no). */
export function createTwiceSureUI(title: string, text: string, anchor = 3, yes: string | null = null, no: string | null = null): UIHandler {
  const ui = UIHandler.createUIFromXML(TYPE_TWICE_SURE);
  ui.setDefaultListener();
  const area = ui.getGWidgetByEventType(1);
  if (area instanceof GTextArea) {
    area.anchor = anchor;
    area.setText(text);
  }
  const ok = ui.getGWidgetByEventType(2);
  if (ok instanceof GLabel && !isNullText(yes)) ok.setText(yes!);
  const back = ui.getGWidgetByEventType(3);
  if (back instanceof GLabel && !isNullText(no)) back.setText(no!);
  const head = ui.getGWidgetByEventType(4);
  if (head instanceof GLabel && !isNullText(title)) head.setText(title);
  ui.show();
  UIHandler.addUI(ui);
  return ui;
}

/** waitForTwiceSureUI: `onResult` gets SURE_YES or SURE_NO once the box closes. */
export function waitForTwiceSureUI(title: string, text: string, onResult: (result: number) => void, anchor = 3, yes = STR_AGREE, no = STR_BACK): void {
  const ui = createTwiceSureUI(title, text, anchor, yes, no);
  ui.setSubType(SUB_WAITING);
  callbacks.set(ui, onResult);
}

/** Convenience: runs `onYes` only when the answer is yes. */
export function confirm(title: string, text: string, onYes: () => void, anchor = 3): void {
  waitForTwiceSureUI(title, text, (r) => r === SURE_YES && onYes(), anchor);
}

function finish(ui: UIHandler, result: number): void {
  ui.close();
  ui.setSubType(result);
  const cb = callbacks.get(ui);
  callbacks.delete(ui);
  cb?.(result);
}

/** processTwiceSureLayer (sub type 1): button 2 is yes, 3 no; the close key is no. */
function processTwiceSureLayer(ui: UIHandler, action: number): void {
  if (ui.getSubType() !== SUB_WAITING) {
    if (action === 1) ui.close();
    return;
  }
  if (action === 1) return finish(ui, SURE_NO);
  if (action !== 0) return;
  const ev = ui.getActionGWidget()?.getEventType();
  if (ev === 2) finish(ui, SURE_YES);
  else if (ev === 3 || ev === 998) finish(ui, SURE_NO);
}

registerScreen('twiceSure', {
  uiTypes: [TYPE_TWICE_SURE],
  open: () => {},
  processLayerAction: processTwiceSureLayer,
});
