import { LEFT, TOP } from '../midp/anchor';
import { FONT_MEDIUM, FONT_SMALL, type Graphics } from '../midp/Graphics';
import { KEY_FIRE, KEY_POUND, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_STAR, type InputState } from '../midp/Input';
import { NPC } from '../game/actor/NPC';
import { Player } from '../game/actor/Player';
import { Model, TYPE_PLAYER } from '../game/actor/Model';
import { Control } from '../game/main/Control';
import * as GameWorld from '../game/main/GameWorld';
import * as WorldPanel from '../game/main/WorldPanel';
import { GameMap, TAG_FORCE_PAINT, TAG_MAP_IMG_OFF } from '../game/map/GameMap';
import { TEST_MAP_SPRITES, buildTestMap } from '../game/map/TestMap';
import { TILE } from '../game/map/TileLayer';
import { GameSprite, preloadSprite, resolveSprite } from '../game/sprite/GameSprite';
import { DEFAULT_APPEARANCE, SPRITE_MAN_HEAD, createHeadSpriteByIcon, createSpriteByIcon, encodeIcons, type Appearance } from '../game/sprite/SpriteIcon';
import { getAssetFS } from '../game/common/Utilities';
import { imageSetFiles } from '../game/main/GameView';
import { isMotion, uiClock, uiFont, uiScreen } from '../game/gui/GWidget';
import { TYPE_ALERT, UIHandler, preloadUI } from '../game/ui/UIHandler';
import '../game/ui/screens';
import { setOnQuitGame } from '../game/ui/UIAction';
import { EVENT_ALL_INFO_SMALL_MAP, UI_WORLD_PANEL, WorldHud, petIconFiles, type HudPetInfo } from '../game/ui/WorldHud';
import { MyPet } from '../game/actor/MyPet';
import * as WorldMessage from '../game/main/WorldMessage';
import { fillDemoPlayer } from '../game/demo/DemoData';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_MP, ATTR_MP_MAX } from '../game/actor/Player';
import { msgEnv } from '../game/core/PowerMsg';
import { CHANNEL_AREA, CHANNEL_SYSTEM, CHANNEL_TEAM, CHANNEL_WORLD, ChatMsg, addChatMsg, clearChatHistory } from '../game/main/ChatMsg';
import { currentAppearance } from './DressingRoomScene';
import { MenuScene } from './MenuScene';
import { COLOR_TEXT, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { SOFTKEY_H, initUIEnvironment, softKeyAt } from './ui';

const HUD_H = 20;
/** Image sets the HUD code uses beyond those named in ui/211: mini map marks, small digits, combat digits. */
const HUD_EXTRA_SETS = [4, 1002, 238, 216];
/** Made-up numbers for the HUD: there is no server to send the real player data. */
function hudPet(p: Player | null): HudPetInfo | null {
  if (!(p instanceof MyPet)) return null;
  return {
    level: p.getLevel(), hp: p.get(ATTR_HP), maxHp: p.get(ATTR_HP_MAX), mp: p.get(ATTR_MP), maxMp: p.get(ATTR_MP_MAX),
    exp: p.get(ATTR_EXP), maxExp: p.get(ATTR_EXP_MAX), petIcon: p.petHeadIcon,
  };
}

/** Portrait of the demo pet (common/PetIcon/tx_501.png). */
const DEMO_PET_HEAD = 501;
/** Made-up chat lines (channel, sender, female, text) standing in for server chat messages. */
const DEMO_CHAT: [number, string, boolean, string][] = [
  [CHANNEL_WORLD, 'KiếmKhách', false, 'Có ai đi phụ bản không?'],
  [CHANNEL_SYSTEM, '', false, 'Đây là bản đồ thử offline, tin nhắn là dữ liệu giả.'],
  [CHANNEL_AREA, 'TiểuLinh', true, 'Chào mọi người /cff0000~/p'],
  [CHANNEL_TEAM, 'ĐạiHiệp', false, 'Gặp nhau ở chỗ xe ngựa nhé.'],
];
/** The NPC that carries the demo quest (shown with "!" and the radar mark on the mini map). */
const QUEST_NPC = 1;
/** GameSprite.SPRITE_POINTER_EFFECT: the ripple shown where the player taps. */
const SPRITE_POINTER_EFFECT = 1216;
const PET_SPRITES = [501, 505, 509];

/** Other players' outfits (the server would send these as icon longs). */
const OTHER_PLAYERS: Partial<Appearance>[] = [
  { sex: 1, hair: 3, hairColor: 1, top: 3, topColor: 2, bottom: 2, weaponL: 33 },
  { sex: 0, hair: 5, top: 7, topColor: 1, bottom: 3, helmet: 2, weaponL: 1, back: 2 },
];

async function dressedSprite(a: Appearance): Promise<GameSprite | null> {
  const [i1, i2, i3] = encodeIcons(a);
  const s = await resolveSprite(() => createSpriteByIcon(i1, i2, i3, false));
  const parts = [...(s?.fragmentFiles ?? []), ...(s?.cloakSprite?.fragmentFiles ?? [])];
  await Promise.all(parts.map((f) => f?.gameImage?.getImage()?.ready));
  return s;
}

/**
 * Walkable test map driven by the ported movement code: the local player through
 * WorldPanel.handleKey (held keys with wall sliding, or tap-to-walk via GameMap.findPath),
 * other players through server-style MoveTo controls (GameWorld.searchPath), and NPCs through
 * NPC.createMoveControl wandering. Tick order follows GameCanvas.
 */
export class MapScene implements Scene {
  private map: GameMap | null = null;
  private status = 'Đang tải bản đồ…';
  private showGrid = false;
  private others: Model[] = [];
  private nextServerMove = 0;
  private pointerFx: { sprite: GameSprite; x: number; y: number } | null = null;
  private pointerTemplate: GameSprite | null = null;
  private hud: WorldHud | null = null;
  private showHud = true;

  constructor(private readonly ctx: Context) {
    void this.load();
  }

  /** UIHandler.createUIFromXML(211) with everything it draws preloaded. */
  private async loadHud(): Promise<WorldHud | null> {
    const fs = getAssetFS();
    await preloadUI(UI_WORLD_PANEL, TYPE_ALERT);
    await fs.preload([...HUD_EXTRA_SETS.flatMap(imageSetFiles), ...petIconFiles(DEMO_PET_HEAD)]);
    await Promise.all([SPRITE_MAN_HEAD, SPRITE_MAN_HEAD + 1].map(preloadSprite));
    initUIEnvironment();
    return WorldHud.create();
  }

  private async load(): Promise<void> {
    const map = GameMap.loadMap(buildTestMap());
    if (!map) {
      this.status = 'Lỗi đọc dữ liệu bản đồ';
      return;
    }
    await Promise.all([...TEST_MAP_SPRITES, SPRITE_POINTER_EFFECT, ...PET_SPRITES].map(preloadSprite));
    const mySprite = await dressedSprite(currentAppearance);
    if (!mySprite) {
      this.status = 'Không dựng được nhân vật';
      return;
    }
    const hud = await this.loadHud();
    map.initGameMapData(SCREEN_WIDTH, SCREEN_HEIGHT, hud ? 0 : HUD_H, 0);
    map.loadMapPalette();
    map.getPlayerLayer()?.createMapSprites();
    await map.whenImagesReady();

    const me = new Player();
    me.id = 1;
    me.name = 'Bạn';
    me.setPosition(20, 17);
    me.setPlayerSprite(mySprite);
    me.setAnimationByDir(false);
    fillDemoPlayer(me);

    const others: Model[] = [];
    for (let i = 0; i < OTHER_PLAYERS.length; i++) {
      const s = await dressedSprite({ ...DEFAULT_APPEARANCE, ...OTHER_PLAYERS[i] });
      const m = new Model(TYPE_PLAYER);
      m.id = 100 + i;
      // Demo list data (the server sends these in the real game).
      m.name = i === 0 ? 'TiểuLinh' : 'KiếmKhách';
      m.level = i === 0 ? 31 : 27;
      m.job = i === 0 ? 4 : 1;
      m.setPosition(i === 0 ? 12 : 30, i === 0 ? 14 : 15);
      m.setPlayerSprite(s);
      m.setAnimationByDir(false);
      others.push(m);
    }

    const npcs: NPC[] = [];
    const spots: [number, number][] = [[8, 6], [32, 22], [14, 24]];
    for (let i = 0; i < spots.length; i++) {
      const n = new NPC();
      n.id = 200 + i;
      n.setSource(spots[i][0], spots[i][1], 3, 2);
      n.setPlayerSprite(GameSprite.createSprite(PET_SPRITES[i % PET_SPRITES.length]));
      n.setAnimationByDir(false);
      npcs.push(n);
    }
    npcs[QUEST_NPC].icon2 = 1; // quest available
    await Promise.all(
      npcs.flatMap((n) => (n.getPlayerSprite()?.fragmentFiles ?? []).map((f) => f?.gameImage?.getImage()?.ready)),
    );
    this.pointerTemplate = GameSprite.createSprite(SPRITE_POINTER_EFFECT);

    GameWorld.setGameMap(map);
    GameWorld.setMyPlayer(me);
    GameWorld.otherModels.clear();
    for (const o of others) GameWorld.otherModels.set(o.getId(), o);
    GameWorld.setNpcList(npcs);
    WorldPanel.clearMyMove();

    map.models = [me, ...others, ...npcs];
    map.camera = me;
    map.init();
    if (hud) {
      const [icon1] = encodeIcons(currentAppearance);
      hud.updateWorldPlayerInfoUI({
        level: me.getLevel(),
        hp: me.get(ATTR_HP),
        maxHp: me.get(ATTR_HP_MAX),
        mp: me.get(ATTR_MP),
        maxMp: me.get(ATTR_MP_MAX),
        exp: me.get(ATTR_EXP),
        maxExp: me.get(ATTR_EXP_MAX),
        combatPoint: me.combatPoint,
        value118: 0,
        level2: me.level2,
        pet: hudPet(me.getPet()),
        headSprite: await resolveSprite(() => createHeadSpriteByIcon(icon1)),
      });
      const mini = hud.get(EVENT_ALL_INFO_SMALL_MAP);
      GameMap.initSmallMapWidth(mini, SCREEN_WIDTH, map);
      Object.assign(msgEnv, { width: uiScreen.width, height: uiScreen.height, font: uiFont });
      WorldMessage.clearAll();
      clearChatHistory();
      WorldMessage.initWorldShowLocation((ev) => hud.get(ev), true);
      WorldMessage.initWorldShowLocation((ev) => hud.get(ev), false);
      WorldMessage.addNoticeMsg('Chào mừng đến bản đồ thử (offline). Mọi số liệu và tin nhắn ở đây đều là dữ liệu giả.');
      WorldMessage.addPointMsg('Nhiệm vụ: nói chuyện với NPC có dấu ! (xem chấm nhấp nháy trên bản đồ nhỏ).');
    }
    const quest = npcs[QUEST_NPC];
    Object.assign(GameWorld.missionRadar, { mapId: map.getMapID(), gx: quest.sourceGx, gy: quest.sourceGy });
    GameWorld.setMotion(isMotion);
    setOnQuitGame(() => this.leave());
    this.hud = hud;
    this.others = others;
    this.map = map;
  }

  update(input: InputState): void {
    // UIHandler.logic: an open screen takes the keys and taps; the world keeps running behind it.
    const uiOpen = UIHandler.hasUI();
    if (uiOpen) UIHandler.logic(input.key, input.pointers);
    const key = uiOpen ? 0 : input.key;
    const holding = uiOpen ? 0 : input.holding;
    const pointers = uiOpen ? [] : input.pointers;
    if (key === KEY_SOFT_RIGHT) return this.leave();
    if (key === KEY_SOFT_LEFT) this.map?.setTag(TAG_MAP_IMG_OFF, !this.map.isTag(TAG_MAP_IMG_OFF));
    if (key === KEY_FIRE) this.showGrid = !this.showGrid;
    if (key === KEY_STAR) this.showHud = !this.showHud;
    uiClock.tick++;
    WorldMessage.logic();
    if (this.hud && uiClock.tick % 80 === 0) {
      const [ch, who, female, text] = DEMO_CHAT[(uiClock.tick / 80) % DEMO_CHAT.length];
      const m = new ChatMsg(ch, ch === CHANNEL_SYSTEM ? -1 : 9, who, text, 0);
      if (female) m.flag |= 16;
      addChatMsg(m);
    }
    // Full repaint of the back buffer, e.g. to compare against the incremental scroll path.
    if (key === KEY_POUND) this.map?.setTag(TAG_FORCE_PAINT, true);

    // GameCanvas.pointerReleased → pointReleasedFlag; taps on the HUD or soft keys are not moves.
    let released: [number, number] | null = null;
    const hud = this.showHud ? this.hud : null;
    for (const p of pointers) {
      if (p.type !== 'up') continue;
      if (hud) {
        // WorldPanel.handleWorldPanelMouse: HUD widgets take the tap before the world does.
        if (!hud.handleWorldPanelMouse(p.x, p.y)) released = [p.x, p.y];
        continue;
      }
      if (softKeyAt(p.x, p.y) === KEY_SOFT_RIGHT) return this.leave();
      if (p.y > HUD_H && p.y < SCREEN_HEIGHT - SOFTKEY_H) released = [p.x, p.y];
    }

    const map = this.map;
    const me = GameWorld.myPlayer;
    if (!map || !me) return;
    this.simulateServerMoves(map);

    // GameCanvas world tick.
    GameWorld.logicOtherModels();
    me.logicPlayer();
    if (GameWorld.logicNPCs()) {
      WorldPanel.clearMyMove();
    } else {
      WorldPanel.handleKey(holding, released);
      map.setCameraToPlayer(me);
    }
    if (released && this.pointerTemplate) {
      this.pointerFx = { sprite: GameSprite.cloneSprite(this.pointerTemplate)!, x: released[0], y: released[1] };
      this.pointerFx.sprite.setCurAnimation(0, 1);
    }
    this.pointerFx?.sprite.action();
  }

  /** Stand-in for the server: now and then tell another player to walk somewhere (MoveTo). */
  private simulateServerMoves(map: GameMap): void {
    if (Date.now() < this.nextServerMove) return;
    this.nextServerMove = Date.now() + 2500;
    for (const o of this.others) {
      if (!o.isControlListEmpty()) continue;
      for (let tries = 0; tries < 20; tries++) {
        const gx = 2 + Math.floor(Math.random() * (map.mapColumns - 4));
        const gy = 3 + Math.floor(Math.random() * (map.mapRows - 6));
        if (map.isCanPass(gx, gy) && GameWorld.searchPath(o.getGx(), o.getGy(), gx, gy, false).length > 0) {
          o.addControl(Control.createMoveTo(o.getId(), gx, gy));
          break;
        }
      }
    }
  }

  private leave(): void {
    GameWorld.setMyPlayer(null);
    GameWorld.setNpcList([]);
    GameWorld.missionRadar.mapId = -1;
    UIHandler.closeAllUI();
    WorldMessage.clearAll();
    clearChatHistory();
    GameWorld.otherModels.clear();
    this.ctx.go(new MenuScene(this.ctx));
  }

  paint(g: Graphics): void {
    g.setColor(0);
    g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const map = this.map;
    const me = GameWorld.myPlayer;
    if (!map || !me) {
      g.setColor(COLOR_TEXT);
      g.drawString(this.status, 8, 8, LEFT | TOP);
      return;
    }
    const hud = this.showHud ? this.hud : null;
    map.draw(g, hud != null);
    if (this.showGrid) this.drawCollision(g, map);
    const fx = this.pointerFx;
    if (fx && fx.sprite.getCurAnimationLoopTime() !== 0) fx.sprite.draw(g, fx.x, fx.y);
    if (hud) {
      g.setFontSize(FONT_MEDIUM);
      hud.root.paint(g);
      g.setClip(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      // GameCanvas.paint: world (with HUD), bottom chat, dialogs, then notices/prompts on top.
      WorldMessage.paintBottomUIMsg(g);
      g.setFontSize(FONT_MEDIUM);
      UIHandler.drawAll(g);
      WorldMessage.paintUpUIMsg(g);
      return;
    }
    g.setColor(0x10141c);
    g.fillRect(0, 0, SCREEN_WIDTH, HUD_H);
    g.setFontSize(FONT_SMALL);
    g.setColor(COLOR_TEXT);
    g.drawString(`Ô (${me.getGx()},${me.getGy()}) · chạm để đi · Enter lưới · * HUD · Esc thoát`, 4, 3, LEFT | TOP);
  }

  private drawCollision(g: Graphics, map: GameMap): void {
    for (let gy = map.mapStartGy; gy <= map.mapEndGy; gy++) {
      for (let gx = map.mapStartGx; gx <= map.mapEndGx; gx++) {
        const x = gx * TILE + map.offsetLeftX;
        const y = gy * TILE + map.offsetTopY;
        g.setColor(map.isCanPass(gx, gy) ? 0x3a5a3a : 0xc04040);
        g.drawRect(x, y, TILE - 1, TILE - 1);
      }
    }
  }
}
