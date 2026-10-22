import { LEFT, TOP } from '../midp/anchor';
import { FONT_MEDIUM, FONT_SMALL, type Graphics } from '../midp/Graphics';
import { KEY_FIRE, KEY_NUM0, KEY_POUND, KEY_SOFT_LEFT, KEY_SOFT_RIGHT, KEY_STAR, type InputState } from '../midp/Input';
import { NPC, NPC_TYPE_SHOP } from '../game/actor/NPC';
import { Player } from '../game/actor/Player';
import { Model, TYPE_PET } from '../game/actor/Model';
import { Control } from '../game/main/Control';
import * as GameStore from '../game/main/GameStore';
import * as GameWorld from '../game/main/GameWorld';
import { MAP_MODEL_IMAGES } from '../game/main/MapModels';
import { WORLD_MAP_FILES, WorldMap } from '../game/main/WorldMap';
import { SPRITE_LEVUP_UP, SPRITE_MYPLAYER_POS, drawMyPlayerEffect, initMyPlayerEffect } from '../game/main/MyPlayerEffect';
import { processUpLevelMsg } from '../game/main/LevelUp';
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
import { DEMO_SHOP_ID, fillDemoPlayer, makeDemoNpcMissions, makeDemoShopGoods } from '../game/demo/DemoData';
import { setDemoShop } from '../game/main/ShopServer';
import { TYPE_SHOP_ITEM } from '../game/ui/screens/shop';
import { TYPE_TWICE_SURE } from '../game/ui/screens/twiceSure';
import { simRefreshNpcSigns } from '../game/main/MissionServer';
import { TYPE_MISSION, doNpc, setOnMissionReward } from '../game/ui/screens/mission';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_HP_MAX, ATTR_MP, ATTR_MP_MAX } from '../game/actor/Player';
import { msgEnv } from '../game/core/PowerMsg';
import { CHANNEL_AREA, CHANNEL_SYSTEM, CHANNEL_TEAM, CHANNEL_WORLD, ChatMsg, addChatMsg, clearChatHistory } from '../game/main/ChatMsg';
import { currentAppearance } from './DressingRoomScene';
import { MenuScene } from './MenuScene';
import { COLOR_TEXT, SCREEN_HEIGHT, SCREEN_WIDTH, type Context, type Scene } from './Scene';
import { SOFTKEY_H, initUIEnvironment, softKeyAt } from './ui';

const HUD_H = 20;
/** Image sets the HUD code uses beyond those named in ui/211: mini map marks, small digits, combat digits. */
/** Plus set 3: the mission status signs of the NPC dialog buttons. */
const HUD_EXTRA_SETS = [4, 1002, 238, 216, 3];
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
    // Opened straight from the world by NPC.doNpc: the NPC dialog (46), the shop (42), yes/no (14).
    await preloadUI(UI_WORLD_PANEL, TYPE_ALERT, TYPE_MISSION, TYPE_SHOP_ITEM, TYPE_TWICE_SURE);
    await fs.preload([...HUD_EXTRA_SETS.flatMap(imageSetFiles), ...petIconFiles(DEMO_PET_HEAD), ...MAP_MODEL_IMAGES, ...WORLD_MAP_FILES]);
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
    await Promise.all([...TEST_MAP_SPRITES, SPRITE_POINTER_EFFECT, SPRITE_LEVUP_UP, SPRITE_MYPLAYER_POS, ...PET_SPRITES].map(preloadSprite));
    initMyPlayerEffect();
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
    GameStore.applyLoginSetting(me);
    me.initFollowPos();
    me.getPet()?.setAnimationByDir(false);

    const others: Model[] = [];
    for (let i = 0; i < OTHER_PLAYERS.length; i++) {
      const s = await dressedSprite({ ...DEFAULT_APPEARANCE, ...OTHER_PLAYERS[i] });
      const m = new Player();
      m.id = 100 + i;
      // Demo list data (the server sends these in the real game).
      m.name = i === 0 ? 'TiểuLinh' : 'KiếmKhách';
      m.level = i === 0 ? 31 : 27;
      m.job = i === 0 ? 4 : 1;
      m.setPosition(i === 0 ? 12 : 30, i === 0 ? 14 : 15);
      m.setPlayerSprite(s);
      m.setAnimationByDir(false);
      // A made-up pet following them (pets come with the player's data from the server).
      const pet = new Player(TYPE_PET);
      pet.name = `Pet demo của ${m.name}`;
      pet.setPlayerSprite(GameSprite.createSprite(PET_SPRITES[(i + 1) % PET_SPRITES.length]));
      pet.setAnimationByDir(false);
      m.setPet(pet);
      m.initFollowPos();
      others.push(m);
    }

    const npcs: NPC[] = [];
    const spots: [number, number][] = [[8, 6], [32, 22], [14, 24]];
    for (let i = 0; i < spots.length; i++) {
      const n = new NPC();
      n.id = 200 + i;
      n.name = `NPC demo ${i + 1}`; // made-up names (NPC data comes from the server)
      n.setSource(spots[i][0], spots[i][1], 3, 2);
      n.setPlayerSprite(GameSprite.createSprite(PET_SPRITES[i % PET_SPRITES.length]));
      n.setAnimationByDir(false);
      npcs.push(n);
    }
    // Made-up quest data (from the server in the game): the demo missions are given and taken back
    // on this map; NPC 2 is the quest giver, NPC 1 the elder of the letter chain.
    const demo = makeDemoNpcMissions(map.getMapID());
    for (const m of me.missionList) if (m != null) m.mapId = map.getMapID();
    npcs[QUEST_NPC].missions = demo.quest;
    npcs[QUEST_NPC].talkDetail = 'Chào lữ khách! Ta có vài việc cần nhờ. (lời thoại giả)';
    npcs[0].missions = demo.elder;
    npcs[0].talkDetail = 'Ta là trưởng thôn (NPC giả).';
    // NPC 3 keeps the made-up shop (ShopServer answers its goods, buying and selling).
    Object.assign(npcs[2], { npcType: NPC_TYPE_SHOP, topic: 'Cửa hàng tạp hóa (demo)', shopID: [DEMO_SHOP_ID] });
    npcs[2].talkDetail = 'Hàng tốt giá rẻ đây! (lời thoại giả)';
    setDemoShop(DEMO_SHOP_ID, makeDemoShopGoods);
    await Promise.all(
      npcs.flatMap((n) => (n.getPlayerSprite()?.fragmentFiles ?? []).map((f) => f?.gameImage?.getImage()?.ready)),
    );
    this.pointerTemplate = GameSprite.createSprite(SPRITE_POINTER_EFFECT);

    GameWorld.setGameMap(map);
    GameWorld.setMyPlayer(me);
    GameWorld.otherModels.clear();
    for (const o of others) GameWorld.otherModels.set(o.getId(), o);
    GameWorld.setNpcList(npcs);
    simRefreshNpcSigns(me, npcs, map.getMapID());
    GameWorld.setDoNpc(doNpc);
    setOnMissionReward((p) => this.refreshHud(p));
    WorldPanel.clearMyMove();

    map.models = [me, ...others, ...npcs];
    map.camera = me;
    map.init();
    if (hud) {
      const [icon1] = encodeIcons(currentAppearance);
      this.headSprite = await resolveSprite(() => createHeadSpriteByIcon(icon1));
      this.hud = hud;
      this.refreshHud(me);
      const mini = hud.get(EVENT_ALL_INFO_SMALL_MAP);
      GameMap.initSmallMapWidth(mini, SCREEN_WIDTH, map);
      Object.assign(msgEnv, { width: uiScreen.width, height: uiScreen.height, font: uiFont });
      WorldMessage.clearAll();
      clearChatHistory();
      WorldMessage.initWorldShowLocation((ev) => hud.get(ev), true);
      WorldMessage.initWorldShowLocation((ev) => hud.get(ev), false);
      // Leaving the world map (stage 60) returns to the world stage with the HUD's chat area.
      WorldMap.onExit = () => WorldMessage.initWorldShowLocation((ev) => hud.get(ev), false);
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

  private headSprite: ReturnType<typeof createHeadSpriteByIcon> = null;

  /** UIHandler.updateWorldPlayerInfoUI: the HUD's player and pet panels from the player. */
  private refreshHud(me: Player): void {
    this.hud?.updateWorldPlayerInfoUI({
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
      headSprite: this.headSprite,
    });
  }

  /**
   * Dev key 0: stand-in for the server's level-up message (MsgHandler.processUpLevelMsg) with
   * made-up numbers: enough exp for one level, 5 skill points, 5 attribute points.
   */
  private simulateLevelUp(me: Player): void {
    const text = processUpLevelMsg(me, {
      exp: me.get(ATTR_EXP_MAX) - me.get(ATTR_EXP),
      levels: 1,
      newExp: 0,
      newExpMax: Math.round(me.get(ATTR_EXP_MAX) * 1.2),
      skillPoints: 5,
      attrPoints: 5,
    });
    WorldMessage.addPromptMsg(text);
    this.refreshHud(me);
  }

  update(input: InputState): void {
    // Stage 60 (world map): the map and its dialogs take the input; the world does not run.
    if (WorldMap.isActive()) {
      uiClock.tick++;
      WorldMessage.logic();
      if (UIHandler.hasUI()) UIHandler.logic(input.key, input.pointers);
      else WorldMap.logic(input.key, input.pointers);
      return;
    }
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
    if (key === KEY_NUM0 && GameWorld.myPlayer) this.simulateLevelUp(GameWorld.myPlayer);
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
    WorldMap.clean();
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
    if (WorldMap.isActive()) {
      g.setFontSize(FONT_MEDIUM);
      WorldMap.paint(g);
      g.setClip(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      WorldMessage.paintBottomUIMsg(g);
      UIHandler.drawAll(g);
      WorldMessage.paintUpUIMsg(g);
      return;
    }
    const hud = this.showHud ? this.hud : null;
    map.draw(g, hud != null);
    // GameCanvas world paint: the player's marker and level-up effect, then the HUD.
    if (hud) drawMyPlayerEffect(g, me, map.offsetLeftX, map.offsetTopY);
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
