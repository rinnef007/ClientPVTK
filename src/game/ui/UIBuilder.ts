// Turns parsed .ui data into gui widgets, applying each recorded call the way XmlParse.parseMethod
// invokes the widget setters, and builds UIHandler.loadUIFromXML's library + frame.
import { GameSprite } from '../sprite/GameSprite';
import {
  GContainer,
  GGameBar,
  GGameIcon,
  GImageNumer,
  GIcon,
  GLabel,
  GLinePanel,
  GPixelLabel,
  GPlaceholder,
  GTextArea,
  GWidget,
  GWindow,
  uiScreen,
} from '../gui/GWidget';
import type { UICall, UIFile, UINode } from './XmlParse';

/** Stands in for GameWorld.myPlayer when a GGameIcon shows "my character" (sprite id 0). */
export const uiContext: { myPlayerSprite: GameSprite | null } = { myPlayerSprite: null };

/** Sprite ids that GGameIcons in a file will create (for preloading). */
export function collectSpriteIds(f: UIFile): number[] {
  const ids = new Set<number>();
  const visit = (n: UINode) => {
    for (const c of n.calls) if (c.code === 22 && (c.args[0] as number) > 0) ids.add(c.args[0] as number);
    n.children.forEach(visit);
  };
  f.lib.forEach(visit);
  visit(f.root);
  return [...ids];
}

function create(node: UINode): GWidget {
  const vm = Int32Array.from(node.vm);
  switch (node.type) {
    case 1:
      return new GIcon(vm);
    case 2:
      return new GGameIcon(vm);
    case 3:
      return new GImageNumer(vm);
    case 7:
      return new GGameBar(vm);
    case 4:
      return new GLabel(vm);
    case 5:
      return new GPixelLabel(vm);
    case 50:
      return new GContainer(vm);
    case 51:
      return new GLinePanel(vm);
    case 52:
      return new GTextArea(vm);
    case 53:
      return new GWindow(vm);
    default: {
      const w = new GPlaceholder(vm);
      w.setType(node.type);
      return w;
    }
  }
}

function apply(w: GWidget, c: UICall, lib: UINode[]): void {
  const a = c.args as never[];
  const n = (i: number) => a[i] as unknown as number;
  switch (c.code) {
    case 0:
      w.setBorder(n(0), n(1), n(2), n(3));
      break;
    case 1:
      w.setBounds(n(0), n(1), n(2), n(3));
      break;
    case 2:
      if (w instanceof GContainer) w.setLayoutMode(n(0), n(1), n(2), n(3), n(4), n(5));
      break;
    case 3:
      w.setFocusColorTable(a[0]);
      break;
    case 4:
      w.SetNeedLayout(!(a[0] as unknown as boolean));
      break;
    case 5:
      w.setPos(n(0), n(1));
      break;
    case 6:
      w.setMinSize(n(0), n(1));
      break;
    case 7:
      w.setMaxSize(n(0), n(1));
      break;
    case 8:
      w.setOffsetXY(n(0), n(1));
      break;
    case 9:
      w.setSize(n(0), n(1));
      break;
    case 11:
    case 12:
      if (w instanceof GLinePanel) w.setData(a[0], n(1), n(2), n(3));
      else if (w instanceof GLabel) w.setData(a[0], n(1), n(2), n(3));
      break;
    case 13:
    case 14:
      if (w instanceof GTextArea) w.setData(a[0], n(1), n(2), n(2));
      else if (w instanceof GLabel) w.setBack(a[0], n(1), n(2), n(3));
      break;
    case 16:
      if (w instanceof GLabel) w.setBackground(n(0), n(1), n(2), n(3));
      break;
    case 18:
      if (w instanceof GLabel) w.setLineColorTable(a[0], a[1]);
      break;
    case 15:
      if (w instanceof GIcon) w.setIconData(n(0), n(1));
      break;
    case 19: {
      if (!(w instanceof GContainer)) break;
      const tpl = lib[n(0)];
      const count = n(1);
      const pos = a[2] as unknown as number[];
      const texts = a[3] as unknown as string[];
      const events = a[4] as unknown as number[];
      if (!tpl) break;
      for (let i = 0; i < count; i++) {
        const cl = build(tpl, lib);
        if (cl instanceof GLabel || cl instanceof GTextArea) cl.setText(i < texts.length ? texts[i] : '');
        if (i * 2 + 1 < pos.length) cl.setPos(pos[i * 2], pos[i * 2 + 1]);
        if (i < events.length) cl.setEventType(events[i]);
        w.add(cl);
      }
      break;
    }
    case 17:
      // Java's setFont does not rebuild the PixelString: FONT must precede DATA_LABEL to apply.
      if (w instanceof GPixelLabel) w.setFont(n(0));
      break;
    case 21:
      if (w instanceof GGameIcon) w.setBackground(n(0), n(1), n(2));
      break;
    case 22:
      if (w instanceof GGameIcon) {
        // id 0 = a clone of the player's own sprite; > 0 = that sprite id.
        w.setRotate(a[2] as unknown as boolean);
        const id = n(0);
        const sp = id === 0 ? GameSprite.cloneSprite(uiContext.myPlayerSprite) : id > 0 ? GameSprite.createSprite(id) : null;
        w.setData(sp, a[1] as unknown as boolean);
      }
      break;
    case 23:
      if (w instanceof GLabel) w.borderColor = n(0);
      break;
    case 24:
      if (w instanceof GGameBar) w.setBgColor(n(0), n(1), n(2));
      break;
    case 25:
      if (w instanceof GGameBar) w.setFgColor(n(0), n(1), n(2));
      break;
    case 26:
      if (w instanceof GGameBar) w.setValue(n(0), n(1));
      break;
    case 40:
      if (w instanceof GImageNumer) w.setData(n(0), n(1), n(2));
      break;
    case 41:
      if (w instanceof GImageNumer) w.setNumerString(a[0]);
      break;
    case 46:
      if (w instanceof GGameBar) w.setBarType(n(0), n(1), n(2));
      break;
    case 38:
      if (w instanceof GPixelLabel) w.setPixelColorTable(a[0]);
      break;
    case 39:
      if (w instanceof GPixelLabel) w.setFocusPixelColorTable(a[0]);
      break;
    case 27:
      if (w instanceof GTextArea) {
        w.setText(a[0]);
        w.textColor = n(1);
      }
      break;
    case 32:
      if (w instanceof GLinePanel) w.underLineColor = n(0);
      break;
    case 33:
      if (w instanceof GLinePanel) w.isLeftRightBgColorDisable = a[0];
      else if (w instanceof GLabel) w.setSetting(32, a[0]);
      break;
    case 35:
      if (w instanceof GLabel) w.selectBorderColor = n(0);
      break;
    case 36:
      w.setShadeColorTable(a[0]);
      break;
    case 37:
      w.setFocusShadeColorTable(a[0]);
      break;
    case 42:
      w.setColorTable(a[0]);
      break;
    case 43:
      w.setFragmentTable(a[0]);
      break;
    case 44:
      w.setFocusFragmentTable(a[0]);
      break;
    case 47:
      if (w instanceof GLabel) w.setSetting(n(0), true);
      break;
    // Remaining codes configure widgets whose behaviour is not ported yet (bars, spinners,
    // image numbers, game icons, scroll bars, line-panel corner data, pixel fonts…).
  }
}

export function build(node: UINode, lib: UINode[]): GWidget {
  const w = create(node);
  for (const c of node.calls) apply(w, c, lib);
  for (const child of node.children) {
    const cw = build(child, lib);
    if (w instanceof GContainer) w.add(cw);
  }
  return w;
}

/** UIHandler.createUIFromXML + show(): build, lay out, centre on screen. */
export function buildAndShow(f: UIFile): GWidget {
  const root = build(f.root, f.lib);
  if (root instanceof GContainer) {
    root.setAbs();
    root.layout();
    const x = uiScreen.width > root.getW() ? ((uiScreen.width - root.getW()) / 2) | 0 : 0;
    const y = uiScreen.height > root.getH() ? ((uiScreen.height - root.getH()) / 2) | 0 : 0;
    root.setPos(x, y);
  }
  return root;
}
