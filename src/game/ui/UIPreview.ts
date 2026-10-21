// PRELIMINARY renderer for parsed .ui trees, used by the UI viewer while the gui widget classes
// (GContainer layout, GLabel, GTextArea, …) are being ported. What is faithful: the panel
// drawing itself (GameView.drawFrameBox with each widget's colour/shade/fragment tables, like
// GLabel.paint/GLinePanel.paint), label colours and border strings, and ADDLIB cloning
// (GContainer.batchAdd). What is NOT yet faithful: positions come from x/y relative to the
// parent instead of GContainer's layout modes, text uses the system font instead of the .t
// pixel fonts, and icons/bars/scroll bars/spinners are drawn as simple placeholders.
import { BOTTOM, HCENTER, LEFT, RIGHT, TOP, VCENTER } from '../../midp/anchor';
import type { Graphics } from '../../midp/Graphics';
import { drawBorderString, drawFrameBox, getImageSet } from '../main/GameView';
import {
  TYPE_GGAME_BAR,
  TYPE_GICON,
  TYPE_GIMAGE_NUMBER,
  TYPE_GLABEL,
  TYPE_GPIXEL_LABEL,
  TYPE_GTEXT_AREA,
  VM_EVENT_TYPE,
  VM_H,
  VM_W,
  VM_X,
  VM_Y,
  type UIFile,
  type UINode,
} from './XmlParse';

export interface PreviewWidget {
  type: number;
  x: number;
  y: number;
  w: number;
  h: number;
  eventType: number;
  colorTable: number[] | null;
  shadeColorTable: number[] | null;
  fragmentTable: number[] | null;
  text: string | null;
  textColor: number;
  borderColor: number;
  anchor: number;
  iconSet: number;
  iconFrame: number;
  children: PreviewWidget[];
}

const isLabelType = (t: number) => t === TYPE_GLABEL || t === TYPE_GPIXEL_LABEL || t === TYPE_GICON;

/** Applies a node's recorded method calls in order (setBounds, setPos, colour tables, data…). */
export function buildPreview(node: UINode, lib: UINode[]): PreviewWidget {
  const vm = node.vm;
  const w: PreviewWidget = {
    type: node.type,
    x: vm[VM_X],
    y: vm[VM_Y],
    w: vm[VM_W],
    h: vm[VM_H],
    eventType: vm[VM_EVENT_TYPE],
    colorTable: null,
    shadeColorTable: null,
    fragmentTable: null,
    text: null,
    textColor: 0xffffff,
    borderColor: -1,
    anchor: 20,
    iconSet: -1,
    iconFrame: -1,
    children: [],
  };
  const extra: PreviewWidget[] = [];
  for (const c of node.calls) {
    const a = c.args;
    switch (c.code) {
      case 1:
        [w.x, w.y, w.w, w.h] = a as number[];
        break;
      case 5:
        [w.x, w.y] = a as number[];
        break;
      case 9:
        [w.w, w.h] = a as number[];
        break;
      case 42:
        w.colorTable = a[0] as number[];
        break;
      case 36:
        w.shadeColorTable = a[0] as number[];
        break;
      case 43:
        w.fragmentTable = a[0] as number[];
        break;
      case 12:
        if (isLabelType(node.type)) {
          w.text = a[0] as string;
          w.textColor = a[1] as number;
          w.anchor = a[3] as number;
        }
        break;
      case 27:
        w.text = a[0] as string;
        w.textColor = a[1] as number;
        break;
      case 23:
        w.borderColor = a[0] as number;
        break;
      case 15:
        w.iconSet = a[0] as number;
        w.iconFrame = a[1] as number;
        break;
      case 19: {
        // batchAdd(lib[a0], count, positions, texts, eventTypes)
        const [libId, count, pos, texts, events] = a as [number, number, number[], string[], number[]];
        const tpl = lib[libId];
        if (!tpl) break;
        for (let i = 0; i < count; i++) {
          const cw = buildPreview(tpl, lib);
          if (isLabelType(cw.type) || cw.type === TYPE_GTEXT_AREA) cw.text = i < texts.length ? texts[i] : '';
          if (i * 2 + 1 < pos.length) {
            cw.x = pos[i * 2];
            cw.y = pos[i * 2 + 1];
          }
          if (i < events.length) cw.eventType = events[i];
          extra.push(cw);
        }
        break;
      }
    }
  }
  w.children = [...node.children.map((n) => buildPreview(n, lib)), ...extra];
  return w;
}

export function buildPreviewFile(f: UIFile): PreviewWidget {
  return buildPreview(f.root, f.lib);
}

/** Every image-set id the tree refers to (for preloading). */
export function collectImageSets(f: UIFile): Set<number> {
  const ids = new Set<number>();
  const visit = (n: UINode) => {
    for (const c of n.calls) {
      const a = c.args;
      if ([13, 14, 15, 16, 21, 31, 40, 45].includes(c.code) && typeof a[0] === 'number') ids.add(a[0] as number);
      if ((c.code === 13 || c.code === 14 || c.code === 11) && Array.isArray(a[0]) && typeof a[1] === 'number') ids.add(a[1] as number);
      if (c.code === 43 || c.code === 44) {
        const t = a[0] as number[];
        for (let i = 0; i + 5 < t.length; i += 6) ids.add(t[i]);
      }
      if (c.code === 42 || c.code === 3) for (const v of a[0] as number[]) if (v < 0 && v > -10000) ids.add(-v);
    }
    n.children.forEach(visit);
  };
  f.lib.forEach(visit);
  visit(f.root);
  return ids;
}

function anchorPoint(w: PreviewWidget, ax: number, ay: number): [number, number] {
  let x = ax;
  let y = ay;
  if (w.anchor & HCENTER) x += w.w >> 1;
  else if (w.anchor & RIGHT) x += w.w;
  if (w.anchor & VCENTER) y += w.h >> 1;
  else if (w.anchor & BOTTOM) y += w.h;
  return [x, y];
}

export function drawPreview(g: Graphics, w: PreviewWidget, px: number, py: number, highlight: number): void {
  const ax = px + w.x;
  const ay = py + w.y;
  if (w.colorTable) drawFrameBox(g, ax, ay, w.w, w.h, w.colorTable, w.shadeColorTable, w.fragmentTable, null, -1, -1);
  if (w.type === TYPE_GICON && w.iconSet >= 0) getImageSet(w.iconSet)?.drawHVFrame(g, w.iconFrame, ax + (w.w >> 1), ay + (w.h >> 1));
  if (w.type === TYPE_GGAME_BAR || w.type === TYPE_GIMAGE_NUMBER) {
    g.setColor(0x80406080);
    g.fillRect(ax, ay, w.w, Math.max(2, w.h));
  }
  if (w.text) {
    const [tx, ty] = anchorPoint(w, ax, ay);
    const anchor = (w.anchor & (HCENTER | RIGHT | LEFT)) | (w.anchor & VCENTER ? VCENTER : w.anchor & BOTTOM ? BOTTOM : TOP);
    if (w.borderColor !== -1) drawBorderString(g, w.borderColor, w.textColor, w.text, tx, ty, anchor);
    else {
      g.setColor(w.textColor);
      g.drawString(w.text, tx, ty, anchor);
    }
  }
  if (highlight >= 0 && w.eventType === highlight) {
    g.setColor(0xffff00);
    g.drawRect(ax, ay, w.w - 1, w.h - 1);
  }
  for (const c of w.children) drawPreview(g, c, ax, ay, highlight);
}
