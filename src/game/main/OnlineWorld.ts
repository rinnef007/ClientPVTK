// Builds the world from the user's backend: the map of the enter-game reply (MsgHandler.parseMapData),
// the player's own data (Player.fromBytes values, bag and skills) and the map's NPCs
// (NPC.fromBytes → NPC.init / initSprite). The parts of the Java client these values would feed
// that are not ported yet (pet, missions, formations…) are left empty.
import { NPC } from '../actor/NPC';
import { PlayerBag } from '../actor/Item';
import {
  ATTR_EXP, ATTR_EXP_MAX, ATTR_HP, ATTR_LEVEL, ATTR_MONEY1, ATTR_MONEY2, ATTR_MONEY3, ATTR_MP, Player,
} from '../actor/Player';
import { Mission } from '../core/Mission';
import { GameMap } from '../map/GameMap';
import { GameSprite, preloadSprite, resolveSprite } from '../sprite/GameSprite';
import { createPetSpriteByIcon, createSpriteByIcon } from '../sprite/SpriteIcon';
import { TYPE_PET, type Model } from '../actor/Model';
import type { OtherPlayerData } from '../../net/online/OtherPlayers';
import type { EnterGameData, PetDetail, PlayerDetail } from '../../net/online/EnterGame';
import { MyPet } from '../actor/MyPet';
import { gunzip, type NpcData } from '../../net/online/WorldData';

const ATTR_SKILL_POINTS = 5;

/** parseMapData: inflate if gzip, GameMap.loadMap, then the id and name from the reply. */
export async function buildOnlineMap(enter: Pick<EnterGameData, 'mapBytes' | 'mapId' | 'mapName'>): Promise<GameMap | null> {
  if (enter.mapBytes == null || enter.mapBytes.length === 0) return null;
  const map = GameMap.loadMap(await gunzip(enter.mapBytes));
  if (map == null) return null;
  map.setMapID(enter.mapId);
  map.name = enter.mapName;
  return map;
}

/**
 * Player.fromBytes values onto the web Player; the totals (max HP / MP, attack, defence…) then come
 * from Player.get's formulas (`formulas`), as in the game.
 */
export function applyPlayerDetail(p: Player, d: PlayerDetail, enter: EnterGameData): void {
  p.id = d.id;
  p.name = d.name;
  p.title = d.title;
  p.job = d.job;
  p.race = d.race;
  p.level2 = d.level2;
  p.exp2 = d.exp2;
  p.expMax2 = d.expMax2;
  p.setting = d.setting;
  p.countryName = d.countryName;
  [p.str, p.con, p.agi, p.ilt, p.wis] = [d.str, d.con, d.agi, d.ilt, d.wis];
  p.set(ATTR_LEVEL, d.level);
  p.set(ATTR_EXP, d.exp);
  p.set(ATTR_EXP_MAX, d.expMax);
  p.formulas = true;
  p.set(ATTR_HP, d.hp);
  p.set(ATTR_MP, d.mp);
  p.set(4, d.cp);
  p.itemSetData = d.itemSetData;
  p.power = d.power;
  p.powerValue = d.powerValue;
  p.titleInfos = d.titleInfos;
  p.countrypowerValue = d.countrypowerValue;
  p.set(ATTR_MONEY1, d.money1);
  p.set(ATTR_MONEY2, d.money2);
  p.set(ATTR_MONEY3, d.money3);
  p.set(ATTR_SKILL_POINTS, d.sp);
  Object.assign(p, {
    Pkwincount: d.Pkwincount, Pklosecount: d.Pklosecount, masterFlag: d.masterFlag, partnerName: d.partnerName,
    helpCountry: d.helpCountry, lovePlayer: d.lovePlayer, arenaPoint: d.arenaPoint, skyarenaPoint: d.skyarenaPoint,
    combatPoint: d.combatPoint, vipLevel: d.vipLevel, vipLevel2: d.vipLevel2, enchantValue: d.enchantValue,
    autoSkillID: d.autoSkillID, autoSkillID_Initiative: d.autoSkillID_Initiative,
  });
  // PlayerBag.initBagItem: each item into its slot.
  const bag = new PlayerBag();
  for (const it of enter.items) bag.setItem(it.slotPos, it);
  p.bag = bag;
  p.skillList = enter.skills;
  if (enter.missionStatus) p.missionStatus.set(enter.missionStatus.subarray(0, p.missionStatus.length));
  // processDataPlayerMission: the missions in progress.
  p.missionList = [];
  for (const blob of enter.missions) p.addMission(Mission.fromBytes(blob));
  p.setPosition(enter.gx, enter.gy);
  p.setPet(buildOnlinePet(p, enter.pet));
}

/** MyPet.fromBytesMyPlayer: the player's active pet with its battle values (formulas on). */
export function buildOnlinePet(owner: Player, d: PetDetail | null): MyPet | null {
  if (d == null) return null;
  const pet = new MyPet(owner);
  Object.assign(pet, {
    id: d.id, name: d.name, level: d.level, icon1: d.icon1, str: d.str, con: d.con, agi: d.agi, ilt: d.ilt, wis: d.wis,
    grow: d.grow, compre: d.compre, cp: d.cp, growLevel: d.growLevel, petHitrate: d.petHitrate, atkType: d.atkType,
    atkMin: d.atkMin, atkMax: d.atkMax, petAtkTime: d.petAtkTime, job: d.job, grade: d.grade, autoSkillID: d.autoSkillID,
    autoSkillID_Initiative: d.autoSkillID_Initiative, skillList: d.skills, vipLevel: d.vipLevel, bornStatus: d.bornStatus,
    petHeadIcon: d.headIcon, ageTime: Date.now() + Number(d.ageLeft),
  });
  pet.formulas = true;
  pet.set(ATTR_LEVEL, d.level);
  pet.set(ATTR_EXP, d.exp);
  pet.set(ATTR_EXP_MAX, d.expMax);
  pet.set(ATTR_HP, d.hp);
  pet.set(ATTR_MP, d.mp);
  pet.set(ATTR_SKILL_POINTS, d.sp);
  return pet;
}

/** NPC.loadNPC + init + initSprite: one NPC per entry, its sprite from icon1. */
export async function buildOnlineNpcs(list: NpcData[]): Promise<NPC[]> {
  await Promise.all([...new Set(list.map((d) => d.icon1).filter((id) => id > 0))].map(preloadSprite));
  return list.map((d) => {
    const n = new NPC();
    n.id = d.id;
    n.name = d.name;
    n.npcType = d.npcType;
    n.status = d.status;
    n.setSign(d.sign);
    n.talkDetail = d.talkDetail || null;
    n.topic = d.topic;
    n.shopID = d.shopID;
    n.battleID = d.battleID;
    n.comeOutTime = d.comeOutTime;
    n.jumpMap = d.jumpMap;
    n.menuBattle = d.menuBattle;
    n.menuShop = d.menuShop;
    n.menuTeacher = d.menuTeacher;
    n.teacherId = d.teacherId;
    n.setSource(d.gx, d.gy, d.rangeX, d.rangeY);
    n.setVisible((d.status & 1) !== 0);
    n.setEnable((d.status & 2) !== 0);
    n.setDir(d.dir);
    if (d.icon1 > 0) n.setPlayerSprite(GameSprite.createSprite(d.icon1));
    n.setAnimationByDir(false);
    return n;
  });
}

/**
 * processDataPlayerListBase → Model: another player with its look, title, mode and pet. The sprites
 * load afterwards (Worker works 32 / 64 in Java): `ready` resolves once they are set.
 */
export function buildOtherPlayer(d: OtherPlayerData): { model: Player; ready: Promise<void> } {
  const p = new Player();
  Object.assign(p, {
    id: d.id, name: d.name, title: d.title, level: d.level, level2: d.level2, setting: d.setting, mode: d.mode,
    shopName: d.shopName, shopType: d.shopType, remark: d.remark, vipLevel: d.vipLevel, vipLevel2: d.vipLevel2,
    countryName: d.countryName, enchantValue: d.enchantValue,
  });
  p.setPosition(d.gx, d.gy);
  let pet: Player | null = null;
  if (d.pet != null) {
    pet = new Player(TYPE_PET);
    pet.id = d.pet.id;
    pet.name = d.pet.name;
    p.setPet(pet);
    p.initFollowPos();
  }
  const ready = (async () => {
    const s = await resolveSprite(() => createSpriteByIcon(d.icon1, d.icon2, d.icon3, false));
    if (s != null) {
      p.setPlayerSprite(s);
      p.setAnimationByDir(false);
    }
    if (pet != null && d.pet != null) {
      const icon = d.pet.icon1;
      const ps = await resolveSprite(() => createPetSpriteByIcon(icon, false));
      if (ps != null) {
        pet.setPlayerSprite(ps);
        pet.setAnimationByDir(false);
      }
    }
  })().catch(() => {
    // A look that cannot be built leaves the player without a sprite (not drawn).
  });
  return { model: p, ready };
}

/** processDataTeamMsg: leaders and members of the teams on the map (Model.addMember). */
export function applyTeams(teams: [number, number[]][], getModel: (id: number) => Model | null): void {
  for (const [leaderId, members] of teams) {
    const leader = getModel(leaderId);
    if (leader == null) continue;
    leader.teamRole = 1;
    leader.leaderID = leaderId;
    for (const id of members) {
      const m = getModel(id);
      if (m == null || m === leader) continue;
      m.teamRole = 2;
      m.leaderID = leaderId;
    }
  }
}
