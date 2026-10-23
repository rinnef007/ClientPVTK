// Port of com.hz.main.WorldMap (jadx decompile): the world map stage (GameCanvas stage 60) opened
// by the HUD's "Map" button. /common/wm.png is drawn with a dot per region; a tap (or keys
// 2/4/6/8) selects the nearest region, and selecting it again asks the server for its maps
// (doGetMapList → ui/109 → enter, ui/15). The panel ui/110 holds the close button and the chat
// area. The region list (positions and names) comes from the server (doEnterWorldMap); offline
// the regions below are placed by hand over the names printed on wm.png, so the positions are
// estimates. Selecting a region a second time shows the offline notice.
import type { Graphics } from '../../midp/Graphics';
import { getOffsetValue, rectIn } from '../common/Tool';
import { drawGameImage, readPNGFile } from '../common/Utilities';
import { isMotion } from '../gui/GWidget';
import type { Image } from '../image/Image';
import { UIHandler, alertMessage, preloadUI, type UIListener } from '../ui/UIHandler';
import { GContainer, GLabel, GTextArea, GWindow, type GWidget } from '../gui/GWidget';
import * as GameWorld from './GameWorld';
import { online } from '../../net/online/Online';
import {
  createWorldMapEnterMsg, createWorldMapListMsg, createWorldMapMsg, readWorldMap, readWorldMapEnter, readWorldMapList,
  type WorldMapEntry,
} from '../../net/online/WorldMapMessages';
import { STR_NEED_SERVER, registerScreen } from '../ui/UIAction';
import { getImageSet } from './GameView';
import * as WorldMessage from './WorldMessage';

export const TYPE_WORLD_MAP_PANEL = 110;
export const TYPE_WORLD_MAP_LIST = 109;
const TYPE_AREA_MESSAGE = 15;
const EVENT_WORLD_MAP_WINDOW = 10902;
const EVENT_WORLD_MAP_LIB = 10903;
const EVENT_WORLD_MAP_INFO = 10904;
const EVENT_WORLD_MAP_NAME = 10905;
const EVENT_WORLD_MAP_TITLE = 10906;
const STR_BACK = 'Trở về'; // GameText 4
/** GameText.TI_ENTER (157): its text is not in the decompile; "Vào" is the web port's guess. */
const STR_ENTER = 'Vào';
export const WORLD_MAP_FILES = ['common/wm.png'];
const DRAG_MIN_DISTANCE = 30;
const SCREEN_W = 320;
const SCREEN_H = 480;
const KEY_SOFT_RIGHT = -7;
const KEY_SOFT_LEFT = -6;

/** ObjectData.createWorldMapPosObject: id, x, y, name, status (1 = event, 2 = done). */
interface MapPos {
  id: number;
  x: number;
  y: number;
  name: string;
  status: number;
}

/** Offline stand-in for the server's list: the names printed on wm.png, positions estimated. */
const DEMO_REGIONS: [string, number, number][] = [
  ['Đồng Tuyết Vọng', 62, 70], ['Rừng Viễn Cổ', 155, 76], ['Maya', 258, 50], ['Thành Thái Dương', 160, 120],
  ['Di Tích Thánh Vực', 84, 154], ['Núi Nguyệt Nha', 252, 166], ['Cổng Làng', 140, 200], ['Rừng Tinh Linh', 74, 242],
  ['Thục Sơn', 194, 254], ['Tân Nguyệt Trấn', 124, 314], ['Từ Cấm Thành', 246, 326], ['Thành Phố Tuyết', 42, 358],
  ['Núi Tử Vân', 124, 378], ['Sa Mạc Thất Hồn', 254, 396],
];

/** Tool.entropy: ease towards the target by 2/5 of the gap each tick. */
function entropy(cur: number, target: number): number {
  if (cur === target) return cur;
  const next = ((cur * 3 + target * 2) / 5) | 0;
  return next !== cur ? next : target;
}

/** Tool.sumValue: cur + d clamped to [min, max]. */
const sumValue = (cur: number, d: number, min: number, max: number) => Math.min(max, Math.max(min, cur + d));

export class WorldMap implements UIListener {
  private static worldMap: WorldMap | null = null;
  /** GameWorld.changeStage(20): set by the scene to leave the world map. */
  static onExit: () => void = () => {};

  private readonly mapList: MapPos[];
  private curSelectMap: MapPos | null = null;
  private readonly img: Image | null = readPNGFile('/common/wm.png');
  private readonly mapWidth = 320;
  private readonly mapHeight = 480;
  private offsetX = 0;
  private offsetY = 0;
  private targetOffsetX = 0;
  private targetOffsetY = 0;
  private readonly offsetXMax: number;
  private readonly offsetYMax: number;
  private pressX = 0;
  private pressY = 0;
  private dragDistance = 0;
  /** Frame of set 11 for regions with an event. */
  private readonly haveEventSign = 2;
  private readonly panelUI: UIHandler;

  private constructor(list: MapPos[]) {
    this.mapList = list;
    this.panelUI = UIHandler.createUIFromXML(TYPE_WORLD_MAP_PANEL);
    this.panelUI.listener = this;
    this.panelUI.show();
    WorldMessage.initWorldShowLocation((ev) => this.panelUI.getGWidgetByEventType(ev), false);
    this.updateCamera(this.mapWidth >> 1, this.mapHeight >> 1, true);
    this.offsetXMax = SCREEN_W - this.mapWidth;
    this.offsetYMax = SCREEN_H - this.mapHeight;
  }

  static isActive(): boolean {
    return WorldMap.worldMap != null;
  }

  /** WorldMap.doEnterWorldMap: the server sends the regions (10521); offline the demo list. */
  static async doEnterWorldMap(): Promise<void> {
    const s = online.session;
    if (s == null) {
      WorldMap.worldMap = new WorldMap(DEMO_REGIONS.map(([name, x, y], i) => ({ id: i + 1, x, y, name, status: 0 })));
      return;
    }
    try {
      const regions = readWorldMap(await s.request(createWorldMapMsg()));
      await preloadUI(TYPE_WORLD_MAP_LIST, TYPE_AREA_MESSAGE);
      WorldMap.worldMap = new WorldMap(regions);
    } catch (e) {
      alertMessage(e instanceof Error ? e.message : String(e));
    }
  }

  static clean(): void {
    WorldMap.worldMap = null;
  }

  static logic(key: number, pointers: { type: 'down' | 'move' | 'up'; x: number; y: number }[]): void {
    WorldMap.worldMap?.logicMap(key, pointers);
  }

  static paint(g: Graphics): void {
    WorldMap.worldMap?.paintMap(g);
  }

  private exit(): void {
    WorldMap.clean();
    WorldMap.onExit();
  }

  private handleKey(key: number): void {
    if (key === KEY_SOFT_RIGHT) return this.exit();
    const x = this.curSelectMap?.x ?? this.mapWidth >> 1;
    const y = this.curSelectMap?.y ?? this.mapHeight >> 1;
    if (key === KEY_SOFT_LEFT) this.checkMapSelect(x, y, null);
    else if (key === 50) this.checkMapSelect(x, y - 50, this.curSelectMap);
    else if (key === 56) this.checkMapSelect(x, y + 50, this.curSelectMap);
    else if (key === 52) this.checkMapSelect(x - 50, y, this.curSelectMap);
    else if (key === 54) this.checkMapSelect(x + 50, y, this.curSelectMap);
  }

  /** The nearest region (Manhattan distance; a tap must be within 80) other than `skip`. */
  private checkMapSelect(x: number, y: number, skip: MapPos | null, tap = false): void {
    if (!rectIn(0, 0, this.mapWidth, this.mapHeight, x, y)) return;
    let best: MapPos | null = null;
    let bestD = 9999;
    for (const m of this.mapList) {
      if (m === skip) continue;
      const d = Math.abs(m.x - x) + Math.abs(m.y - y);
      if ((!tap || d < 80) && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (best == null) return;
    if (tap) this.curSelectMap = best;
    if (this.curSelectMap === best) this.doGetMapList();
    else this.curSelectMap = best;
    if (this.curSelectMap) this.updateCamera(this.curSelectMap.x, this.curSelectMap.y, tap);
  }

  /** doGetMapList: the region's maps from the server (10522) in ui/109. */
  private doGetMapList(): void {
    const region = this.curSelectMap;
    if (region == null) return;
    const s = online.session;
    if (s == null) {
      alertMessage(STR_NEED_SERVER, region.name);
      return;
    }
    void s.request(createWorldMapListMsg(region.id)).then(
      (r) => this.createMapListUI(region.name, readWorldMapList(r)),
      (e) => alertMessage(e instanceof Error ? e.message : String(e)),
    );
  }

  /** createMapListUI / updateMapListUI: the title, then a row (library 10903) per map. */
  private createMapListUI(title: string, list: WorldMapEntry[]): void {
    const ui = UIHandler.createUIFromXML(TYPE_WORLD_MAP_LIST);
    ui.listener = this;
    const label = ui.getGWidgetByEventType(EVENT_WORLD_MAP_TITLE);
    if (label instanceof GLabel) label.setText(title);
    const win = ui.getGWidgetByEventType(EVENT_WORLD_MAP_WINDOW);
    const tpl = ui.gwidetLib.find((w) => w.getEventType() === EVENT_WORLD_MAP_LIB) ?? ui.getGWidgetByEventType(EVENT_WORLD_MAP_LIB);
    if (win instanceof GWindow && tpl instanceof GContainer) {
      for (const o of list) {
        const row = tpl.getClone();
        const name = row instanceof GContainer ? row.getJavaChildByEvent(EVENT_WORLD_MAP_NAME) : null;
        if (name instanceof GLabel) {
          name.setText(o.name);
          if (o.status === 1) name.setIconValue(this.haveEventSign, 1024);
        }
        row.setObj(o);
        win.add(row);
      }
      if (win.focusWidget == null) win.setFirstFocus();
    }
    ui.show();
    UIHandler.addUI(ui);
  }

  /** processMapList: a row (10903) or its info (10904) shows the map's description. */
  private processMapList(ui: UIHandler, action: number): void {
    if (action !== 0) return;
    const win = ui.getGWidgetByEventType(EVENT_WORLD_MAP_WINDOW);
    if (!(win instanceof GWindow)) return;
    const w = ui.getActionGWidget();
    let row: GWidget | null = w;
    while (row != null && row.parent !== win) row = row.parent;
    const o = (row ?? win.focusWidget)?.getObj() as WorldMapEntry | null;
    const ev = w?.getEventType();
    if (o == null || (ev !== EVENT_WORLD_MAP_LIB && ev !== EVENT_WORLD_MAP_INFO)) return;
    this.doViewMapData(ui, o);
  }

  /** doViewMapData: the description (and the teleport stone notice), "Trở về" / enter (ui/15). */
  private doViewMapData(parent: UIHandler, o: WorldMapEntry): void {
    let text = o.desc;
    if (o.needStone === 1) text += '\n/cFFFF00(Cần đá dịch chuyển)/p';
    const ui = UIHandler.createUIFromXML(TYPE_AREA_MESSAGE);
    ui.listener = this;
    ui.parent = parent;
    const win = ui.getGWindowByEventType(2);
    const tpl = ui.gwidetLib.find((x) => x.getEventType() === 3) ?? null;
    if (win != null && tpl != null) {
      win.setObj(o);
      for (const t of [STR_BACK, STR_ENTER]) {
        const b = tpl.getClone();
        if (b instanceof GLabel) b.setText(t);
        win.add(b);
      }
      win.setFirstFocus();
    }
    const area = ui.getGWidgetByEventType(1);
    if (area instanceof GTextArea) area.setText(text);
    ui.show();
    UIHandler.addUI(ui);
  }

  /** processInfoList: "Vào" enters the map (doJumpMap). */
  private processInfoList(ui: UIHandler, action: number): void {
    if (action !== 0) return;
    const win = ui.getGWindowByEventType(2);
    const w = ui.getActionGWidget();
    const label = w != null && w.parent === win ? w : win?.focusWidget;
    const o = win?.getObj() as WorldMapEntry | null;
    if (!(label instanceof GLabel) || o == null) return;
    ui.close();
    if (label.getText() === STR_ENTER) this.doJumpMap(o);
  }

  /**
   * WorldMap.doJumpMap: 10523; a used teleport stone leaves the bag, then the blocks build the new
   * map (the scene's map change, which also leaves the world map).
   */
  private doJumpMap(o: WorldMapEntry): void {
    const s = online.session;
    if (s == null) return;
    GameWorld.changeMapWith(async () => {
      const r = readWorldMapEnter(await s.request(createWorldMapEnterMsg(o.id)));
      const bag = GameWorld.myPlayer?.bag;
      if (r.usedItem != null && bag != null) bag.removeBagItemByPos(r.usedItem.slot, 1);
      WorldMap.clean();
      WorldMap.onExit();
      return r.blocks;
    });
  }

  private updateCamera(x: number, y: number, now: boolean): void {
    this.targetOffsetX = getOffsetValue(x, this.mapWidth, SCREEN_W, SCREEN_W >> 1);
    this.targetOffsetY = getOffsetValue(y, this.mapHeight, SCREEN_H, SCREEN_H >> 1);
    if (now) {
      this.offsetX = this.targetOffsetX;
      this.offsetY = this.targetOffsetY;
    }
  }

  /** The panel takes taps first; 998 leaves. */
  private handlerPanelMouseReleased(x: number, y: number): boolean {
    const w = this.panelUI.getFrameContainer()?.searchPressGWidget(x, y) ?? null;
    if (w == null) return false;
    this.panelUI.setActionGWidget(w);
    if (w.getEventType() === 998) {
      this.handleKey(KEY_SOFT_RIGHT);
      return true;
    }
    this.panelUI.notifyLayerAction(0);
    return true;
  }

  private logicMap(key: number, pointers: { type: 'down' | 'move' | 'up'; x: number; y: number }[]): void {
    if (key !== 0) this.handleKey(key);
    if (WorldMap.worldMap !== this) return;
    for (const p of pointers) {
      if (p.type === 'down') {
        this.pressX = p.x;
        this.pressY = p.y;
        this.dragDistance = 0;
      } else if (p.type === 'move') {
        const dx = p.x - this.pressX;
        const dy = p.y - this.pressY;
        this.dragDistance += Math.abs(dx) + Math.abs(dy);
        if (this.offsetXMax < 0) this.offsetX = this.targetOffsetX = sumValue(this.offsetX, dx, this.offsetXMax, 0);
        if (this.offsetYMax < 0) this.offsetY = this.targetOffsetY = sumValue(this.offsetY, dy, this.offsetYMax, 0);
        this.pressX = p.x;
        this.pressY = p.y;
      } else if (this.dragDistance < DRAG_MIN_DISTANCE && !this.handlerPanelMouseReleased(p.x, p.y)) {
        this.checkMapSelect(p.x - this.offsetX, p.y - this.offsetY, null, true);
      }
      if (WorldMap.worldMap !== this) return;
    }
    this.offsetX = entropy(this.offsetX, this.targetOffsetX);
    this.offsetY = entropy(this.offsetY, this.targetOffsetY);
  }

  private paintMap(g: Graphics): void {
    g.setColor(0);
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawGameImage(g, this.img, this.offsetX, this.offsetY, 20);
    this.drawMapObject(g);
    this.panelUI.draw(g);
  }

  /** A yellow dot per region; the selected one blinks green; "(Xong)" / the event sign by status. */
  private drawMapObject(g: Graphics): void {
    const motion = isMotion();
    for (const m of this.mapList) {
      const x = m.x + this.offsetX;
      const y = m.y + this.offsetY;
      g.setColor(16762368);
      g.fillArc(x - 4, y - 4, 8, 8, 0, 360);
      if (m === this.curSelectMap && motion === 1) {
        g.setColor(65488);
        g.fillArc(x - 5, y - 5, 10, 10, 0, 360);
      }
      if (m.status === 1) getImageSet(11)?.drawFrame(g, this.haveEventSign, x, y - 6 - motion, 0, 33);
      else if (m.status === 2) {
        g.setColor(10551283);
        g.drawString('(Xong)', x, y - 4, 33);
      }
    }
  }

  /** The map list (109), the enter dialog (15); processMapPanel (110) is empty in Java. */
  processLayerAction(ui: UIHandler, action: number): void {
    if (ui.getType() === TYPE_AREA_MESSAGE) this.processInfoList(ui, action);
    else if (ui.getType() === TYPE_WORLD_MAP_LIST) this.processMapList(ui, action);
  }

  processLayerClose(ui: UIHandler): void {
    ui.close();
  }
}

/** HUD "Map" (11281): WorldMap.doEnterWorldMap. */
registerScreen('worldMap', {
  uiTypes: [TYPE_WORLD_MAP_PANEL],
  open: () => void WorldMap.doEnterWorldMap(),
});
