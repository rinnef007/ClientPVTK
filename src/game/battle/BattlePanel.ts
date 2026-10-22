// com.hz.battle.BattlePanel and TargetSelectPanel (1.2.0, jadx / Vineflower decompiles): the order
// bar (ui/100) — attack, skill, item, info, auto fight, escape — the skill / item lists (ui/15),
// the target cursor and highlight, the plans (Battle.setPlan) of the player and their pet, and
// the round start when every plan is in (or the plan time ran out). Chat, watched battles and the
// remote-battle parts are not ported.
import type { Player } from '../actor/Player';
import type { Item } from '../actor/Item';
import { DataOutputStream } from '../common/DataStream';
import { rectIn } from '../common/Tool';
import { getBufferBitValue, getBufferType } from '../core/DefineBattle';
import { Skill, getBufferString } from '../core/Skill';
import { GLabel, GTextArea, type GWidget } from '../gui/GWidget';
import { drawBorderString, drawSimpleBorderString } from '../main/GameView';
import { GameSprite } from '../sprite/GameSprite';
import { PowerString } from '../string/PowerString';
import { UIHandler, alertMessage, type UIListener } from '../ui/UIHandler';
import { WorldHud, type HudPlayerInfo } from '../ui/WorldHud';
import type { Graphics } from '../../midp/Graphics';
import { KEY_FIRE, KEY_SOFT_LEFT } from '../../midp/Input';
import { SCREEN_H, SCREEN_W } from './AnimationControl';
import { PLAN_ATTACK, PLAN_ESCAPE, PLAN_NONE, PLAN_USE_ITEM, PLAN_USE_SKILL, getPetOwnerPos, getPositionSide, isLeftSide, isSameSide, type Battle } from './Battle';
import { TAG_ALL_END, TAG_HAVE_MY_PET, TAG_IS_AUTO_FIGHT, TAG_PET_ORDER, getBufferImageIndex, type BattleAniEngine } from './BattleAniEngine';
import { Monster } from '../actor/Monster';
import { EFFECT_DIE_DELAY, EFFECT_REBORN } from './Battle';
import { TYPE_BATTLE_ESCAPE, TYPE_BATTLE_SKILL, TYPE_BATTLE_TARGET_EFFECT, type Control } from '../main/Control';

export const UI_BATTLE_ORDER = 100;
export const UI_AREA_MESSAGE = 15;
export const SPRITE_CURSOR = 1209;
export const SPRITE_HLIGHT = 1212;

export const ORDER_NONE = -1;
export const ORDER_ATTACK = 1;
export const ORDER_SKILL = 2;
export const ORDER_ITEM = 3;
export const ORDER_AUTO = 4;
export const ORDER_INFO = 5;
export const ORDER_ESCAPE = 6;

/** ui/100 event types. */
const EV_ATTACK = 2;
const EV_SKILL = 3;
const EV_ITEM = 4;
const EV_AUTO = 6;
const EV_ESCAPE = 7;
const EV_INFO = 10;
const EV_SKIP_ANIME = 932;
const EV_PET_AUTO = 934;
const EV_PET_HAND = 940;
const EV_QUIT_SEE = 959;
const EV_CANCEL_AUTO = 11319;

/** Player.setting bit: the pet fights on its own. */
const SETTING_PET_AUTO = 1024;

const COLOR_BAR_BORDER = 15917285;

/** BattlePanel.drawBattleBar: a 30×7 HP bar. */
export function drawBattleBar(g: Graphics, x: number, y: number, color: number, v: number, max: number): void {
  g.setColor(COLOR_BAR_BORDER);
  g.fillRect(x, y, 30, 7);
  g.setColor(4063534);
  g.fillRect(x + 1, y + 1, 28, 5);
  let w = max > 0 ? Math.trunc((26 * v) / max) : 0;
  if (v > 0 && w === 0) w = 1;
  g.setColor(9519695);
  g.fillRect(x + 2, y + 2, 26, 3);
  g.setColor(color);
  g.fillRect(x + 2, y + 2, Math.max(0, Math.min(26, w)), 3);
}

/** BattlePanel.getBufferdescInfo: a status with its icon, green when good, red when bad. */
export function getBufferdescInfo(icon: number, status: number): string {
  const s = PowerString.makeIconString(10, icon);
  const color = getBufferType(status) === 25 ? 0x00ff00 : 0xff0000;
  return s + PowerString.makeColorString(`(${getBufferString(status)})`, color);
}

/** TargetSelectPanel: the cursor over a target for an order and the positions it would hit. */
export class TargetSelectPanel {
  private targetPos: number[] | null = null;
  private finished = false;
  selectItem: Item | null = null;
  selectSkill: Skill | null = null;

  constructor(private readonly panel: BattlePanel, private readonly areaType: number) {}

  getTargetPos(): number[] | null {
    return this.targetPos;
  }
  isFinshSelect(): boolean {
    return this.finished;
  }
  setFinshSelect(v: boolean): void {
    this.finished = v;
  }

  /** The last cursor if it still fits, else the best spot (Battle.searchAICursor). */
  init(): void {
    if (this.initCursor(this.panel.getCursor(), true) === 1) return;
    const p = this.panel.getOrderPlayer();
    this.initCursor(p != null ? this.panel.battle.searchAICursor(p, this.areaType) : 0, false);
  }

  initCursor(pos: number, mustBeValid: boolean): number {
    const p = this.panel.getOrderPlayer();
    if (p == null) return -1;
    let area: number[] | null;
    if (this.areaType === 35) {
      const owner = getPetOwnerPos(p);
      area = owner >= 0 ? [owner] : null;
    } else {
      area = this.panel.battle.getSelectArea(p.position, pos, this.areaType);
    }
    const ok = this.isCursorEnable(area);
    if (mustBeValid && !ok) return -1;
    this.panel.setCursorEnable(ok);
    this.panel.setCursor(pos);
    this.targetPos = area;
    return 1;
  }

  private isCursorEnable(area: number[] | null): boolean {
    if (area == null) return false;
    const order = this.panel.getOrderIndex();
    const b = this.panel.battle;
    let n = 0;
    for (const pos of area) {
      const t = b.getPlayerByPos(pos);
      if (t == null) continue;
      if (this.selectItem != null && order === ORDER_ITEM) {
        if (t.isDead() && !this.selectItem.isRebornItem()) continue;
      } else if (this.selectSkill != null && order === ORDER_SKILL) {
        if (!Skill.isCanUse(this.panel.getOrderPlayer(), this.selectSkill) || t.isBattleStatus(1n) || (t.isDead() && !this.selectSkill.isRebornSkill())) continue;
      } else if (order === ORDER_ATTACK) {
        if (!b.isValidBattlePlayer(t) || t.position === this.panel.getOrderPlayer()?.position) continue;
      } else if (order === ORDER_INFO && !b.isValidBattlePlayer(t)) {
        continue;
      }
      n++;
    }
    return n > 0;
  }

  /** A second tap on the cursor confirms it; another target moves it. */
  dealCursorLogic(pos: number): void {
    if (this.panel.getCursor() === pos) {
      if (this.panel.isCursorEnable()) this.setFinshSelect(true);
      return;
    }
    this.initCursor(pos, false);
  }

  /** TargetSelectPanel.handlerMouse: the fighter whose box holds the tap. */
  handlerMouse(x: number, y: number): void {
    const e = this.panel.engine;
    for (let pos = 0; pos < 34; pos++) {
      const px = e.getPosition(pos, 0);
      const py = e.getPosition(pos, 1);
      const w = (isLeftSide(pos) ? e.getPosData(2) : e.getPosData(3)) + 30;
      const h = isLeftSide(pos) ? e.getPosData(0) : e.getPosData(1);
      if (rectIn(px - (w >> 1), py - h, w, h, x, y)) {
        this.dealCursorLogic(pos);
        return;
      }
    }
  }

  /** TargetSelectPanel.moveKeyCursor: up / down a column, left / right across columns and sides. */
  moveKeyCursor(dir: number): void {
    const b = this.panel.battle;
    const cur = this.panel.getCursor();
    const side = getPositionSide(cur);
    let base = side === 1 ? 0 : 20;
    const rows = side === 1 ? b.getRowLeft() : b.getRowRight();
    let row = (cur - base) >> 1;
    let col = (cur - base) % 2;
    if (dir === 0) {
      row = row - 1 < 0 ? rows - 1 : row - 1;
    } else if (dir === 1) {
      row = row + 1 < rows ? row + 1 : 0;
    } else if (dir === 2 && --col < 0) {
      if (side === 1) {
        base = 20;
        if (row >= b.getRowRight()) row = b.getRowRight() - 1;
      } else {
        base = 0;
        if (row >= b.getRowLeft()) row = b.getRowLeft() - 1;
      }
      col = 1;
    } else if (dir === 3 && ++col >= 2) {
      if (side === 1) {
        base = 20;
        if (row >= b.getRowRight()) row = b.getRowRight() - 1;
      } else {
        base = 0;
        if (row >= b.getRowLeft()) row = b.getRowLeft() - 1;
      }
      col = 0;
    }
    this.dealCursorLogic(row * 2 + col + base);
  }
}

export class BattlePanel implements UIListener {
  readonly battle: Battle;
  private cursor = 0;
  private readonly cursorSprite: GameSprite | null;
  private readonly hlightSprite: GameSprite | null;
  readonly orderPanelUI: UIHandler;
  private readonly hud: WorldHud | null;
  private orderPet: Player | null = null;
  readonly orderPlayer: Player;
  private petSelectItem: Item | null = null;
  private petSelectSkill: Skill | null = null;
  private selectItem: Item | null = null;
  private selectSkill: Skill | null = null;
  private targetSelectPanel: TargetSelectPanel | null = null;
  /** The plans sent this battle (reported with the result). */
  readonly planVector: Uint8Array[] = [];
  private orderIndex = ORDER_NONE;
  private petOrderIndex = ORDER_NONE;
  private orderInit = false;
  private cursorEnable = true;

  constructor(readonly engine: BattleAniEngine) {
    this.battle = engine.getBattle();
    this.orderPlayer = engine.me;
    this.cursorSprite = GameSprite.createSprite(SPRITE_CURSOR, true);
    this.hlightSprite = GameSprite.createSprite(SPRITE_HLIGHT, true);
    this.setCursorEnable(true);
    this.orderPanelUI = UIHandler.createUIFromXML(UI_BATTLE_ORDER);
    this.orderPanelUI.listener = this;
    this.orderPanelUI.show();
    this.hud = this.orderPanelUI.uiFrame ? WorldHud.wrap(this.orderPanelUI) : null;
    for (const ev of [EV_QUIT_SEE, EV_PET_AUTO, EV_PET_HAND, EV_SKIP_ANIME, 948]) this.orderPanelUI.getGWidgetByEventType(ev)?.setShow(false);
    this.updateAutoFightText();
  }

  // ---- state ----

  private isPetRound(): boolean {
    return this.engine.isTag(TAG_PET_ORDER);
  }

  private setPetRound(on: boolean): void {
    this.engine.setTag(TAG_PET_ORDER, on);
    for (const ev of [EV_ITEM, EV_AUTO, EV_ESCAPE]) this.orderPanelUI.getGWidgetByEventType(ev)?.setShow(!on);
  }

  setOrderPet(p: Player): void {
    this.orderPet = p;
    this.checkPetGWidgetShow();
  }

  getOrderPlayer(): Player | null {
    return this.isPetRound() ? this.orderPet : this.orderPlayer;
  }

  getOrderIndex(): number {
    return this.isPetRound() ? this.petOrderIndex : this.orderIndex;
  }

  private setOrderIndex(i: number): void {
    if (this.isPetRound()) this.petOrderIndex = i;
    else this.orderIndex = i;
  }

  private getSelectSkill(): Skill | null {
    return this.isPetRound() ? this.petSelectSkill : this.selectSkill;
  }
  private setSelectSkill(s: Skill | null): void {
    if (this.isPetRound()) this.petSelectSkill = s;
    else this.selectSkill = s;
  }
  private getSelectItem(): Item | null {
    return this.isPetRound() ? this.petSelectItem : this.selectItem;
  }
  private setSelectItem(i: Item | null): void {
    if (this.isPetRound()) this.petSelectItem = i;
    else this.selectItem = i;
  }

  getCursor(): number {
    return this.cursor;
  }
  setCursor(c: number): void {
    this.cursor = c;
  }
  isCursorEnable(): boolean {
    return this.cursorEnable;
  }
  setCursorEnable(on: boolean): void {
    this.cursorEnable = on;
    this.cursorSprite?.setCurAnimation(on ? 0 : 3, -1);
  }

  private isPetAuto(): boolean {
    return (this.orderPlayer.setting & SETTING_PET_AUTO) !== 0;
  }

  private checkPetGWidgetShow(): void {
    const has = this.engine.isTag(TAG_HAVE_MY_PET);
    const auto = this.isPetAuto();
    this.orderPanelUI.getGWidgetByEventType(EV_PET_AUTO)?.setShow(has && !auto);
    this.orderPanelUI.getGWidgetByEventType(EV_PET_HAND)?.setShow(has && auto);
  }

  private updateAutoFightText(): void {
    this.orderPanelUI.getGWidgetByEventType(EV_CANCEL_AUTO)?.setShow(this.engine.isTag(TAG_IS_AUTO_FIGHT));
  }

  private checkSkipAnimeGWidgetShow(on: boolean): void {
    this.orderPanelUI.getGWidgetByEventType(EV_SKIP_ANIME)?.setShow(on);
    this.updateAutoFightText();
  }

  /** UIHandler.updateWorldPlayerInfoUI(orderPanelUI, kind, withPet): 2 = the animated bar values. */
  updateBattlePlayerInfo(kind: number, withPet: boolean): void {
    if (this.hud == null) return;
    const p = this.orderPlayer;
    const pet = withPet ? this.orderPet : null;
    const shown = (q: Player, id: number) => (kind === 0 ? q.get(id) : q.get(id === 2 ? 91 : 92));
    const info: HudPlayerInfo = {
      level: p.get(106), hp: shown(p, 2), maxHp: p.get(29), mp: shown(p, 3), maxMp: p.get(30), exp: p.get(0), maxExp: p.get(1),
      combatPoint: p.combatPoint, value118: p.get(118), headSprite: null, level2: p.level2,
      pet: pet == null ? null : {
        level: pet.get(106), hp: shown(pet, 2), maxHp: pet.get(29), mp: shown(pet, 3), maxMp: pet.get(30), exp: pet.get(0), maxExp: pet.get(1),
        petIcon: (pet as { petHeadIcon?: number }).petHeadIcon ?? 0,
      },
    };
    this.hud.updateWorldPlayerInfoUI(info, kind !== 2);
  }

  private updatePlayerHpMpInfo(): void {
    for (const p of [this.orderPlayer, this.orderPet]) {
      if (p == null) continue;
      p.set(91, p.get(2));
      p.set(92, p.get(3));
    }
    this.engine.updateBattlePlayerInfo(1);
  }

  closeAllUI(): void {
    UIHandler.closeAllUI();
  }

  // ---- plans ----

  /** BattlePanel.getBattlePlanData: kind, then target (and skill id / item slot). */
  private getBattlePlanData(kind: number, skillId = -1): Uint8Array | null {
    const out = new DataOutputStream();
    out.writeByte(kind);
    if (kind === PLAN_ATTACK) {
      out.writeByte(this.getCursor());
    } else if (kind === PLAN_USE_SKILL) {
      out.writeByte(this.getCursor());
      const id = skillId > 0 ? skillId : this.getSelectSkill()?.id;
      if (id == null) return null;
      out.writeShort(id);
    } else if (kind === PLAN_USE_ITEM) {
      const it = this.getSelectItem();
      if (it == null) return null;
      out.writeByte(this.getCursor());
      out.writeByte(it.slotPos);
    }
    return out.toByteArray();
  }

  private addPlan(pos: number, plan: Uint8Array | null): void {
    if (plan == null) return;
    this.battle.setPlan(pos, plan);
    this.planVector.push(plan);
  }

  /** Local battles: ready when the player (and pet) have plans. */
  private isReady(): boolean {
    if (this.battle.getPlanData(this.orderPlayer.position) == null) return false;
    if (this.engine.isTag(TAG_HAVE_MY_PET) && (this.orderPet == null || this.battle.getPlanData(this.orderPet.position) == null)) return false;
    return true;
  }

  /** The pet's auto-cast skill as its plan (Player.autoSkillID_Initiative). */
  private isUseSkillInitiative(p: Player | null): boolean {
    if (p == null) return false;
    const s = p.getSkillByID(p.autoSkillID_Initiative);
    if (s == null || !Skill.isCanUse(p, s)) return false;
    const old = this.getCursor();
    this.setCursor(this.battle.searchAICursor(p, s.area, true));
    this.addPlan(p.position, this.getBattlePlanData(PLAN_USE_SKILL, s.id));
    this.setCursor(old);
    return true;
  }

  /** BattlePanel.selectAutoFightTarget: the first living enemy. */
  private selectAutoFightTarget(p: Player): number {
    const [from, to] = isLeftSide(p.position) ? [20, 34] : [0, this.battle.getLeftPosNum()];
    for (let i = from; i < to; i++) if (this.battle.isValidBattlePlayer(this.battle.getPlayerByPos(i))) return i;
    return from;
  }

  private doAutoFight(): void {
    if (!this.engine.isTag(TAG_ALL_END)) return;
    const me = this.orderPlayer;
    if (!this.battle.isValidBattlePlayer(me)) return;
    if (this.battle.getPlanData(me.position) == null && !this.isUseSkillInitiative(me)) {
      this.setCursor(this.selectAutoFightTarget(me));
      this.addPlan(me.position, this.getBattlePlanData(PLAN_ATTACK));
    }
    const pet = this.orderPet;
    if (this.engine.isTag(TAG_HAVE_MY_PET) && pet != null && this.battle.getPlanData(pet.position) == null && !this.isUseSkillInitiative(pet)) {
      this.addPlan(pet.position, this.getBattlePlanData(PLAN_NONE));
    }
    this.updatePlayerHpMpInfo();
    this.doPlanData();
  }

  /** Runs the round once every plan is in. */
  private doPlanData(): void {
    this.cleanTargetSelect();
    if (this.isReady()) {
      this.setPetRound(false);
      this.battle.logicRound();
      this.engine.makeBattleAni();
      this.battle.clearPlan(this.orderPlayer.position);
      if (this.orderPet != null) this.battle.clearPlan(this.orderPet.position);
    }
    UIHandler.closeAllUI();
    this.orderInit = false;
  }

  /** BattlePanel.doOrderAction: the order's plan; then the pet's turn (or its auto plan). */
  private doOrderAction(order: number): void {
    const p = this.getOrderPlayer();
    if (p == null) return;
    let plan: Uint8Array | null = null;
    if (order === ORDER_ATTACK) plan = this.getBattlePlanData(PLAN_ATTACK);
    else if (order === ORDER_SKILL) plan = this.getBattlePlanData(PLAN_USE_SKILL);
    else if (order === ORDER_ITEM) plan = this.getBattlePlanData(PLAN_USE_ITEM);
    else if (order === ORDER_ESCAPE) plan = this.getBattlePlanData(PLAN_ESCAPE);
    this.addPlan(p.position, plan);
    if (!this.isPetRound() && this.orderPet != null) {
      if (order === ORDER_ESCAPE || this.isPetAuto() || !this.battle.isValidBattlePlayer(this.orderPet)) {
        if (!this.isUseSkillInitiative(this.orderPet)) this.addPlan(this.orderPet.position, this.getBattlePlanData(PLAN_NONE));
      } else {
        this.setPetRound(true);
      }
    }
    this.doPlanData();
  }

  /** BattlePanel.initRoundStartOrder: at a round start, the attack order with its target cursor. */
  private initRoundStartOrder(): void {
    if (this.orderInit) return;
    this.orderInit = true;
    this.checkSkipAnimeGWidgetShow(false);
    if (this.engine.isTag(TAG_IS_AUTO_FIGHT)) {
      this.doAutoFight();
      return;
    }
    this.updatePlayerHpMpInfo();
    if (!this.battle.isValidBattlePlayer(this.orderPlayer) && this.battle.isValidBattlePlayer(this.orderPet)) {
      if (this.battle.getPlanData(this.orderPlayer.position) == null) this.addPlan(this.orderPlayer.position, this.getBattlePlanData(PLAN_NONE));
      this.setPetRound(true);
    }
    const order = this.getOrderIndex();
    if (order === ORDER_NONE || order === ORDER_ITEM) {
      this.initAttackOrder();
      return;
    }
    this.targetSelectPanel = this.getTargetSelectPanel();
    if (!this.isCursorEnable()) this.initAttackOrder();
  }

  private initAttackOrder(): void {
    const p = this.getOrderPlayer();
    if (p == null) return;
    this.setCursor(p.position >= 20 ? 0 : 20);
    this.changeOrder(ORDER_ATTACK);
  }

  private changeOrder(order: number): void {
    this.setOrderIndex(order);
    this.cleanTargetSelect();
    if (order === ORDER_ATTACK || order === ORDER_INFO) this.targetSelectPanel = this.getTargetSelectPanel();
    else if (order === ORDER_SKILL) this.initSkillListPanel();
    else if (order === ORDER_ITEM) this.initItemListPanel();
  }

  private getTargetSelectPanel(): TargetSelectPanel | null {
    const order = this.getOrderIndex();
    let t: TargetSelectPanel | null = null;
    if (order === ORDER_ATTACK || order === ORDER_INFO) {
      t = new TargetSelectPanel(this, 0);
    } else if (order === ORDER_SKILL) {
      const s = this.getSelectSkill();
      if (s == null) return null;
      t = new TargetSelectPanel(this, s.area);
      t.selectSkill = s;
    } else if (order === ORDER_ITEM) {
      const it = this.getSelectItem();
      if (it == null) return null;
      t = new TargetSelectPanel(this, it.area);
      t.selectItem = it;
    }
    if (t != null) {
      t.init();
      UIHandler.closeAllUI();
    }
    return t;
  }

  cleanTargetSelect(): void {
    this.setCursorEnable(true);
    this.targetSelectPanel = null;
  }

  // ---- skill / item lists (ui/15) ----

  /** UIHandler.createAreaMessageWin: a list (window 2, rows from the library label) and a text area (1). */
  private createListWin(desc: string, names: string[], objs: (Skill | Item)[]): void {
    const ui = UIHandler.createUIFromXML(UI_AREA_MESSAGE);
    if (ui.uiFrame == null) return;
    ui.listener = this;
    ui.obj = objs;
    const win = ui.getGWindowByEventType(2);
    const tpl = ui.gwidetLib.find((w) => w.getEventType() === 3) ?? null;
    if (win != null && tpl != null) {
      names.forEach((n, i) => {
        const row = tpl.getClone();
        if (row instanceof GLabel) row.setText(n);
        row.setObj(objs[i]);
        win.add(row);
      });
      win.setFirstFocus();
    }
    const area = ui.getGWidgetByEventType(1);
    if (area instanceof GTextArea) area.setText(desc);
    ui.setShowLastLayer(false);
    ui.show();
    UIHandler.addUI(ui);
  }

  private initSkillListPanel(): void {
    const p = this.getOrderPlayer();
    if (p == null) return;
    const list = p.skillList.filter((s) => s != null && s.type === 3);
    if (list.length === 0) {
      alertMessage('Không có kĩ năng chủ động!', 'Gợi ý');
      return;
    }
    const names = list.map((s) => {
      const why: string[] = [];
      const n = `${s.name}(Lv ${s.level})`;
      return Skill.isCanUse(p, s, why) ? n : `${n}(${why.join('')})`;
    });
    this.createListWin(list[0].getDesc(SCREEN_W - 60), names, list);
  }

  private initItemListPanel(): void {
    const bag = this.orderPlayer.bag;
    const list = bag?.getCanUseItemList(2) ?? [];
    if (list.length === 0) {
      alertMessage('Không có vật phẩm có thể dùng trong chiến đấu!', 'Không có vật phẩm có thể dùng');
      return;
    }
    this.createListWin(list[0].getDesc(), list.map((it) => `${it.name} x${it.quantity}`), list);
  }

  /** BattlePanel.processInfoList: a new focus shows its description; picking it again selects it. */
  private processInfoList(ui: UIHandler, action: number): void {
    const win = ui.getGWindowByEventType(2);
    if (win == null) return;
    const w = ui.getActionGWidget();
    const target: GWidget | null = w != null && w.parent === win ? w : win.focusWidget;
    const o = target?.getObj() as Skill | Item | null;
    if (o == null) return;
    const idx = win.children.indexOf(target!);
    if (action === 4 || action === 5 || (action === 0 && idx !== win.focusIndex)) {
      if (target !== win.focusWidget) win.setFocus(target);
      win.oldFocusIndex = win.focusIndex;
      const area = ui.getGWidgetByEventType(1);
      if (area instanceof GTextArea) area.setText(o instanceof Skill ? o.getDesc(SCREEN_W - 60) : o.getDesc());
      if (action !== 0) return;
    }
    if (action !== 0) return;
    if (o instanceof Skill) {
      const why: string[] = [];
      if (!Skill.isCanUse(this.getOrderPlayer(), o, why)) {
        alertMessage(why.join(''), 'Gợi ý');
        return;
      }
      this.setSelectSkill(o);
    } else {
      this.setSelectItem(o);
    }
    this.targetSelectPanel = this.getTargetSelectPanel();
    ui.close();
  }

  processLayerAction(ui: UIHandler, action: number): void {
    if (ui.type === UI_AREA_MESSAGE) this.processInfoList(ui, action);
    else if (ui.type === UI_BATTLE_ORDER && action === 0) {
      const w = ui.getActionGWidget();
      if (w == null) return;
      UIHandler.closeAllUI();
      this.doMenuAction(w.getEventType());
    }
  }

  processLayerClose(ui: UIHandler): void {
    ui.close();
  }

  /** BattlePanel.doMenuAction: an order bar button. */
  private doMenuAction(ev: number): boolean {
    if (!this.engine.isTag(TAG_ALL_END) && ev !== EV_SKIP_ANIME && ev !== EV_CANCEL_AUTO) return false;
    switch (ev) {
      case EV_ATTACK:
        if (this.getOrderIndex() === ORDER_ATTACK && this.isCursorEnable() && this.targetSelectPanel != null) {
          this.targetSelectPanel.setFinshSelect(true);
          return true;
        }
        this.changeOrder(ORDER_ATTACK);
        return true;
      case EV_SKILL:
        this.changeOrder(ORDER_SKILL);
        return true;
      case EV_ITEM:
        if (this.isPetRound()) {
          alertMessage('Trân thú không thể dùng vật phẩm!');
          return false;
        }
        this.changeOrder(ORDER_ITEM);
        return true;
      case EV_INFO:
        this.changeOrder(ORDER_INFO);
        return true;
      case EV_AUTO:
        if (!this.engine.isTag(TAG_IS_AUTO_FIGHT)) {
          this.engine.setTag(TAG_IS_AUTO_FIGHT, true);
          this.engine.setAutoFight(true);
          this.updateAutoFightText();
          this.doAutoFight();
        }
        return true;
      case EV_ESCAPE:
        if (this.isPetRound()) {
          alertMessage('Trân thú không thể chủ động bỏ chạy!');
          return false;
        }
        this.doOrderAction(ORDER_ESCAPE);
        this.setOrderIndex(ORDER_NONE);
        return true;
      case EV_SKIP_ANIME:
        this.engine.closePlayerAnimation();
        this.checkSkipAnimeGWidgetShow(false);
        return true;
      case EV_PET_AUTO:
      case EV_PET_HAND:
        this.doChangePetAutoHand();
        return true;
      case EV_CANCEL_AUTO:
        if (this.engine.isTag(TAG_IS_AUTO_FIGHT)) {
          this.engine.setTag(TAG_IS_AUTO_FIGHT, false);
          this.engine.setAutoFight(false);
          this.updateAutoFightText();
        }
        return true;
      default:
        return false;
    }
  }

  private doChangePetAutoHand(): void {
    const auto = this.isPetAuto();
    this.orderPlayer.setting = auto ? this.orderPlayer.setting & ~SETTING_PET_AUTO : this.orderPlayer.setting | SETTING_PET_AUTO;
    this.checkPetGWidgetShow();
    if (this.isPetRound() && this.isPetAuto() && this.orderPet != null && this.engine.isTag(TAG_ALL_END)) {
      if (!this.isUseSkillInitiative(this.orderPet)) this.addPlan(this.orderPet.position, this.getBattlePlanData(PLAN_NONE));
      this.doPlanData();
    }
  }

  /** BattlePanel.getSequenceList: the round's controls grouped into steps shown one after another. */
  getSequenceList(): Control[][] {
    const out: Control[][] = [];
    let group: Control[] | null = null;
    let last = 0;
    for (const c of this.battle.resultControlList) {
      if (c == null) continue;
      const pos = c.byte0;
      if (c.type === TYPE_BATTLE_SKILL || c.type === TYPE_BATTLE_ESCAPE) {
        if (!isSameSide(last, pos)) {
          group = [];
          out.push(group);
        }
      } else if (c.type === TYPE_BATTLE_TARGET_EFFECT && (c.counter & (EFFECT_REBORN | EFFECT_DIE_DELAY)) !== 0) {
        group = [];
        out.push(group);
      }
      if (group == null) {
        group = [];
        out.push(group);
      }
      group.push(c);
      last = pos;
    }
    this.cleanTargetSelect();
    UIHandler.closeAllUI();
    this.orderInit = false;
    this.setPetRound(false);
    this.checkSkipAnimeGWidgetShow(true);
    return out;
  }

  // ---- input ----

  /** Order-bar buttons first, then the target cursor. */
  private handlerMouse(tap: { x: number; y: number } | null): void {
    if (tap == null) return;
    const frame = this.orderPanelUI.getFrameContainer();
    const w = frame?.searchPressGWidget(tap.x, tap.y) ?? null;
    if (w != null) {
      this.orderPanelUI.setActionGWidget(w);
      this.orderPanelUI.notifyLayerAction(0);
      return;
    }
    this.targetSelectPanel?.handlerMouse(tap.x, tap.y);
  }

  private handleKey(key: number): void {
    const t = this.targetSelectPanel;
    if (t == null) return;
    if (key === KEY_SOFT_LEFT) return;
    if (key === 50) t.moveKeyCursor(0);
    else if (key === 56) t.moveKeyCursor(1);
    else if (key === 52) t.moveKeyCursor(2);
    else if (key === 54) t.moveKeyCursor(3);
    else if (key === 53 || key === KEY_FIRE) t.dealCursorLogic(this.getCursor());
  }

  private logicTargetSelect(): void {
    this.cursorSprite?.action();
    this.hlightSprite?.action();
    const t = this.targetSelectPanel;
    if (t == null || !t.isFinshSelect()) return;
    if (this.getOrderIndex() === ORDER_INFO) {
      const p = this.battle.getPlayerByPos(t.getTargetPos()?.[0] ?? -1);
      if (p != null) alertMessage(this.getPlayerDesc(p), 'Thông tin nhân vật ');
      t.setFinshSelect(false);
    } else {
      this.doOrderAction(this.getOrderIndex());
    }
  }

  tap: { x: number; y: number } | null = null;

  /** While the round plays: the skip / cancel-auto buttons. */
  logicAnimePlaying(_key: number): void {
    this.handlerMouse(this.tap);
  }

  /** Waiting for orders: auto plans when the time ran out, else the cursor and buttons. */
  logic(key: number): void {
    if (this.battle.getPlanTime() <= 0) {
      if (this.battle.getPlanData(this.orderPlayer.position) == null) this.addPlan(this.orderPlayer.position, this.getBattlePlanData(PLAN_NONE));
      if (this.engine.isTag(TAG_HAVE_MY_PET) && this.orderPet != null && this.battle.getPlanData(this.orderPet.position) == null) {
        this.addPlan(this.orderPet.position, this.getBattlePlanData(PLAN_NONE));
      }
      this.updatePlayerHpMpInfo();
      this.doPlanData();
      return;
    }
    this.initRoundStartOrder();
    this.handlerMouse(this.tap);
    this.handleKey(key);
    this.logicTargetSelect();
  }

  // ---- drawing ----

  paint(g: Graphics): void {
    this.orderPanelUI.draw(g);
    this.drawCursor(g);
  }

  drawHLights(g: Graphics): void {
    const pos = this.targetSelectPanel?.getTargetPos();
    if (pos == null || this.hlightSprite == null) return;
    for (const p of pos) this.hlightSprite.draw(g, this.engine.getPosition(p, 0), this.engine.getPosition(p, 1) - 3);
  }

  private drawCursor(g: Graphics): void {
    if (this.targetSelectPanel == null) return;
    const c = this.getCursor();
    const x = this.engine.getPosition(c, 0);
    const y = this.engine.getPosition(c, 1);
    this.cursorSprite?.draw(g, x, y - 50);
    const order = this.getOrderIndex();
    if (order === ORDER_INFO) {
      for (let i = 0; i < this.battle.playerList.length; i++) this.drawCurMsg(g, i, this.engine.getPosition(i, 0), this.engine.getPosition(i, 1), i === c, true);
      return;
    }
    this.drawCurMsg(g, c, x, y, true, false);
    const bar = this.orderPanelUI.getGWidgetByEventType(1);
    const ty = SCREEN_H - (bar != null ? bar.getH() : 60);
    let text: string | null = null;
    if (order === ORDER_ATTACK) text = 'Công thường';
    else if (order === ORDER_SKILL) text = `Kĩ năng-${this.getSelectSkill()?.name ?? ''}`;
    else if (order === ORDER_ITEM) text = `Vật phẩm-${this.getSelectItem()?.name ?? ''}`;
    if (text != null) drawSimpleBorderString(g, 2824454, 16556291, text, SCREEN_W, ty, 40);
  }

  /** BattlePanel.drawCurMsg: the HP bar (and status icons) and the name under a fighter. */
  private drawCurMsg(g: Graphics, pos: number, x: number, y: number, name: boolean, buffs: boolean): void {
    const p = this.battle.getPlayerByPos(pos);
    if (p == null || p.isBattleStatus(1n)) return;
    let bx = x - 15;
    const by = y - 3;
    if (p.get(2) > 0) {
      drawBattleBar(g, bx, by, 16765737, p.get(2), p.get(29));
      const set = this.engine.buffSet;
      if (buffs && set != null) {
        let good = 0;
        let bad = 0;
        for (let i = 1; i <= 32; i++) {
          if (i === 25 || i === 26 || !p.isBattleStatus(getBufferBitValue(i))) continue;
          if (getBufferType(i) === 25) good++;
          else bad++;
        }
        const fy = by - set.getFrameHeight(0) - 1;
        if (good > 0) {
          set.drawFrame(g, 20, x - 8, fy, 0, 33);
          bx += set.getFrameWidth(20);
        }
        if (bad > 0) set.drawFrame(g, 21, bx + 7, fy, 0, 33);
      }
    }
    if (name) drawBorderString(g, 30320, 13757398, p.getName(), x, y + 2, 17);
  }

  /** BattlePanel.getPlayerDesc: name, level, HP / MP, shield charges and statuses. */
  getPlayerDesc(p: Player): string {
    let s = `${p.getName()}(Lv ${p.get(106)})\n`;
    s += `HP: ${p.get(2)}/${p.get(29)}  MP: ${p.get(3)}/${p.get(30)}\n`;
    s += `Hộ thuẫn miễn thương:${p.keepout_atk_time}\n`;
    let now = '';
    let born = '';
    for (let i = 1; i <= 32; i++) {
      if (i === 25 || i === 26 || !p.isBattleStatus(getBufferBitValue(i))) continue;
      // (As in the decompiled client, only a monster's statuses are listed.)
      if (!(p instanceof Monster)) continue;
      const line = `${getBufferdescInfo(getBufferImageIndex(i), i)}\n`;
      if (p.bornStatus !== 0n && p.isBornStatus(getBufferBitValue(i))) born += line;
      else now += line;
    }
    if (now.trim()) s += `Trạng thái \n${now}`;
    if (born.trim()) s += `Trạng thái bẩm sinh \n${born}`;
    return s;
  }
}
