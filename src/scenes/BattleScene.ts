// GameCanvas stages 30 / 31 for a local battle: load what the battle screen draws, run
// BattleAniEngine each tick, then report the result to the backend (12502), apply the reward and
// go back to the map (stage 20).
import { Monster } from '../game/actor/Monster';
import { MyPet } from '../game/actor/MyPet';
import type { Player } from '../game/actor/Player';
import type { Battle } from '../game/battle/Battle';
import {
  BUFF_IMAGE_SET, BattleAniEngine, TAG_HAVE_MY_PET, SPRITE_BASE_CURSOR, SPRITE_EFF_HIT, SPRITE_EFF_MAGIC_FIELD, SPRITE_UNKNOWN_FIGHTER, type BattleHost,
} from '../game/battle/BattleAniEngine';
import { SPRITE_CURSOR, SPRITE_HLIGHT, UI_AREA_MESSAGE, UI_BATTLE_ORDER } from '../game/battle/BattlePanel';
import { getAssetFS } from '../game/common/Utilities';
import { uiClock } from '../game/gui/GWidget';
import type { Image } from '../game/image/Image';
import { clearImageSetMap, imageSetFiles } from '../game/main/GameView';
import * as GameWorld from '../game/main/GameWorld';
import * as WorldMessage from '../game/main/WorldMessage';
import { GameSprite, clearSpriteCache, preloadSprite } from '../game/sprite/GameSprite';
import { createPetSpriteByIcon, createSpriteByIcon } from '../game/sprite/SpriteIcon';
import { TYPE_ALERT, UIHandler, preloadUI } from '../game/ui/UIHandler';
import { FONT_MEDIUM, type Graphics } from '../midp/Graphics';
import type { InputState } from '../midp/Input';
import { LEFT, TOP } from '../midp/anchor';
import { createLocalBattleResultMsg, readLocalBattleReward, type LocalBattleReward } from '../net/online/BattleMessages';
import type { OnlineSession } from '../net/online/OnlineSession';
import { COLOR_TEXT, SCREEN_HEIGHT, SCREEN_WIDTH, type Scene } from './Scene';

/** Number image sets (damage, heal, MP, crit), the combat-point digits and the portrait frames. */
const BATTLE_IMAGE_SETS = [BUFF_IMAGE_SET, 2000, 2001, 2002, 2003, 238, 216];
const BATTLE_PNGS = ['bo', 'bwin', 'blost', 'ok', 'block', 'miss', 'offset'].map((n) => `common/${n}.png`);
/** Effect sprites every battle may play: item use (1215), crossbow shot (1301). */
const BATTLE_SPRITES = [SPRITE_BASE_CURSOR, SPRITE_EFF_HIT, SPRITE_EFF_MAGIC_FIELD, SPRITE_UNKNOWN_FIGHTER, SPRITE_CURSOR, SPRITE_HLIGHT, 1215, 1301];

export interface BattleSetup {
  battle: Battle;
  me: Player;
  /** Player.icon1..3 for the player's battle sprite. */
  icons: [bigint, bigint, bigint];
  session: OnlineSession | null;
  /** The map as it was, darkened (GameMap.initBattleBuffer). */
  background: Image | null;
  /** Back to the map; the reward (12502 reply) follows when it arrives. */
  onEnd: (reward: Promise<LocalBattleReward | null>) => void;
}

/** Auto fight stays on between battles (GameWorld.TAG_IS_AUTO_FIGHT_FLAG). */
let autoFightFlag = false;

export class BattleScene implements Scene, BattleHost {
  engine: BattleAniEngine | null = null;
  private status = 'Đang vào trận…';
  private ended = false;

  constructor(private readonly setup: BattleSetup) {
    void this.load().catch((e) => {
      this.status = `Lỗi: ${e instanceof Error ? e.message : e}`;
    });
  }

  get autoFight(): boolean {
    return autoFightFlag;
  }
  set autoFight(v: boolean) {
    autoFightFlag = v;
  }

  /** FragmentData.doBattleSpriteRequest: every sprite and image the battle may draw. */
  private async load(): Promise<void> {
    const fs = getAssetFS();
    const { battle } = this.setup;
    const sprites = new Set(BATTLE_SPRITES);
    for (const p of battle.playerList) {
      if (p == null) continue;
      if (p instanceof Monster) {
        sprites.add(Number(p.icon1));
        for (const s of [...(p.monsterAI?.skill1 ?? []), ...(p.monsterAI?.skill2 ?? [])]) {
          if (s != null) [s.anime2, s.anime3].forEach((a) => a > 0 && sprites.add(a));
        }
      }
      for (const s of p.skillList) if (s != null) [s.anime2, s.anime3].forEach((a) => a > 0 && sprites.add(a));
    }
    await preloadUI(UI_BATTLE_ORDER, UI_AREA_MESSAGE, TYPE_ALERT);
    await fs.preload([...BATTLE_PNGS, ...BATTLE_IMAGE_SETS.flatMap(imageSetFiles)]);
    await Promise.all([...sprites].filter((id) => id > 0).map(preloadSprite));
    if (import.meta.env.DEV) (globalThis as { __battleScene?: BattleScene }).__battleScene = this;
    this.engine = await fs.resolve(
      () => new BattleAniEngine(battle, this.setup.me, this, this.setup.background),
      () => {
        clearSpriteCache();
        clearImageSetMap();
      },
    );
  }

  createFighterSprite(p: Player): GameSprite | null {
    if (p instanceof Monster) return GameSprite.createSprite(Number(p.icon1), true);
    if (p instanceof MyPet) return createPetSpriteByIcon(p.icon1, true);
    if (p === this.setup.me) return createSpriteByIcon(...this.setup.icons, true);
    return null;
  }

  /** BattleAniEngine.sendLocalBattleReward → MsgHandler.processLocalBattleReward. */
  sendLocalBattleReward(e: BattleAniEngine): void {
    const { session, me, battle } = this.setup;
    if (session == null) return;
    const msg = createLocalBattleResultMsg({
      startHP: e.startHP, startMP: e.startMP, endHP: me.get(2), endMP: me.get(3),
      seed: battle.seed, groupId: battle.getMonsterGroup()?.groupId ?? -1,
      withPet: e.isTag(TAG_HAVE_MY_PET), plans: e.battlePanel.planVector,
    });
    this.reward = session.request(msg).then(
      (reply) => readLocalBattleReward(reply, me),
      (err) => {
        WorldMessage.addSystemChat(`Lỗi gửi kết quả trận: ${err instanceof Error ? err.message : err}`);
        return null;
      },
    );
  }

  private reward: Promise<LocalBattleReward | null> = Promise.resolve(null);

  /** BattleAniEngine.exit / GameCanvas.doBattle(3): clear battle state, back to the map. */
  exit(e: BattleAniEngine): void {
    if (this.ended) return;
    this.ended = true;
    UIHandler.closeAllUI();
    const me = this.setup.me;
    // The backend revives a beaten player at a tenth of their HP (handlers.local_battle_result).
    if (!e.isWin() && me.get(2) <= 0) me.set(2, Math.max(1, Math.trunc(me.get(29) / 10)));
    for (const p of [me, me.getPet()]) {
      if (p == null) continue;
      p.resetBattleBuffer();
      p.battleSprite = null;
      p.dieSprite = null;
      p.battleEffectSpriteList = [];
      p.battlePlanControlList = [];
      p.checkHPMP();
    }
    GameWorld.setNextBattleTime(Math.max(GameWorld.nextBattleTime, Date.now() + 1200));
    this.setup.onEnd(this.reward);
  }

  update(input: InputState): void {
    if (this.setup.session) {
      this.setup.session.pump();
      this.setup.session.takeUnhandled();
    }
    uiClock.tick++;
    WorldMessage.logic();
    const e = this.engine;
    if (e == null) return;
    let key = input.key;
    let tap: { x: number; y: number } | null = null;
    if (UIHandler.hasUI()) {
      UIHandler.logic(input.key, input.pointers);
      key = 0;
    } else {
      for (const p of input.pointers) if (p.type === 'up') tap = { x: p.x, y: p.y };
    }
    e.battlePanel.tap = tap;
    e.logic(key);
  }

  paint(g: Graphics): void {
    const e = this.engine;
    if (e == null) {
      g.setColor(0);
      g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      g.setColor(COLOR_TEXT);
      g.drawString(this.status, 8, 8, LEFT | TOP);
      return;
    }
    g.setFontSize(FONT_MEDIUM);
    e.paint(g);
    g.setClip(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    WorldMessage.paintBottomUIMsg(g);
    UIHandler.drawAll(g);
    WorldMessage.paintUpUIMsg(g);
  }
}
