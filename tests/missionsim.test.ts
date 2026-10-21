import { describe, expect, it } from 'vitest';
import { NPC } from '../src/game/actor/NPC';
import { BAG_START, Item, PlayerBag } from '../src/game/actor/Item';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_LEVEL, ATTR_MONEY2, ATTR_MONEY3, Player } from '../src/game/actor/Player';
import { CONDITION_HAVE_ITEM, Condition, Mission, STATUS_ACCEPT, STATUS_DOING, STATUS_NOT_READY, STATUS_SUBMIT } from '../src/game/core/Mission';
import { simAcceptMission, simDeleteMission, simRefreshNpcSigns, simSubmitMission } from '../src/game/main/MissionServer';

const MAP = 7;

function npc(id: number): NPC {
  const n = new NPC();
  n.id = id;
  return n;
}

function mission(id: number, fields: Partial<Mission>): Mission {
  return Object.assign(new Mission(id), { mapId: MAP, npcId: 1, level: 1 }, fields);
}

function player(level = 10): Player {
  const p = new Player();
  p.set(ATTR_LEVEL, level);
  p.set(ATTR_EXP_MAX, 1000);
  return p;
}

describe('Mission status (Mission.getMissionStatus / isVisibleAndSubmit / missionStatus bits)', () => {
  it('gives the four statuses', () => {
    const p = player();
    const easy = mission(1, {});
    const hard = mission(2, { level: 50 });
    expect(easy.getMissionStatus(p)).toBe(STATUS_ACCEPT);
    expect(hard.getMissionStatus(p)).toBe(STATUS_NOT_READY);
    const doing = mission(3, {});
    doing.submitCondition = [new Condition(2, 'Sói', 10, 4)];
    p.addMission(doing);
    p.addMission(easy);
    expect(doing.getMissionStatus(p)).toBe(STATUS_DOING);
    expect(easy.getMissionStatus(p)).toBe(STATUS_SUBMIT);
  });

  it('is handed in only to its NPC on its map', () => {
    const m = mission(1, { npcId: 5 });
    expect(m.isVisibleAndSubmit(npc(5), MAP)).toBe(true);
    expect(m.isVisibleAndSubmit(npc(6), MAP)).toBe(false);
    expect(m.isVisibleAndSubmit(npc(5), MAP + 1)).toBe(false);
  });

  it('keeps a bit per finished mission', () => {
    const p = player();
    expect(Mission.isMissionFinish(p, 9004)).toBe(false);
    Mission.setMissionStatus(p, 9004, true);
    expect(Mission.isMissionFinish(p, 9004)).toBe(true);
    expect(Mission.isMissionFinish(p, 9005)).toBe(false);
    Mission.setMissionStatus(p, 9004, false);
    expect(Mission.isMissionFinish(p, 9004)).toBe(false);
  });
});

describe('MissionServer (local simulation)', () => {
  it('accepts only offered, acceptable, new missions', () => {
    const p = player();
    const giver = npc(1);
    const m = mission(1, {});
    expect(simAcceptMission(p, giver, m)).not.toBeNull(); // not offered by this NPC
    giver.missions = [m, mission(2, { level: 50 })];
    expect(simAcceptMission(p, giver, giver.missions[1])).not.toBeNull();
    expect(simAcceptMission(p, giver, m)).toBeNull();
    expect(p.getMissionById(1)).toBe(m);
    expect(simAcceptMission(p, giver, m)).not.toBeNull(); // already taken
  });

  it('hands in: rewards, finish bit, items taken, level-up past the max', () => {
    const p = player();
    p.bag = new PlayerBag();
    const stone = Object.assign(new Item(), { id: 77, quantity: 5 });
    p.bag.setItem(BAG_START, stone);
    p.set(ATTR_EXP, 900);
    const m = mission(1, { exp: 300, money2: 4, money3: 20 });
    m.submitCondition = [new Condition(CONDITION_HAVE_ITEM, 'Đá', 3, 0, 77)];
    p.addMission(m);
    expect(simSubmitMission(p, npc(2), m, MAP)).toBeNull(); // wrong NPC
    const text = simSubmitMission(p, npc(1), m, MAP);
    expect(text).toContain('Lá4');
    expect(text).toContain('Bạc20');
    expect(text).toContain('Exp 300');
    expect(p.getMissionById(1)).toBeNull();
    expect(Mission.isMissionFinish(p, 1)).toBe(true);
    expect([p.get(ATTR_MONEY2), p.get(ATTR_MONEY3)]).toEqual([4, 20]);
    expect(p.bag.getItemNumByIdInBag(77)).toBe(2);
    // 900 + 300 passes 1000: one level, 200 left over, the simulated max grows ×1.2.
    expect(p.getLevel()).toBe(11);
    expect([p.get(ATTR_EXP), p.get(ATTR_EXP_MAX)]).toEqual([200, 1200]);
  });

  it('refuses to hand in unfinished missions and gives up taken ones', () => {
    const p = player();
    const m = mission(1, {});
    m.submitCondition = [new Condition(2, 'Sói', 10, 4)];
    p.addMission(m);
    expect(simSubmitMission(p, npc(1), m, MAP)).toBeNull();
    expect(simDeleteMission(p, m)).toBe(true);
    expect(p.getMissionById(1)).toBeNull();
    expect(simDeleteMission(p, m)).toBe(false);
  });

  it('sets NPC signs from the best status (inferred rule)', () => {
    const p = player();
    const giver = npc(1);
    const other = npc(2);
    const idle = npc(3);
    giver.missions = [mission(1, { npcId: 2 })];
    simRefreshNpcSigns(p, [giver, other, idle], MAP);
    expect([giver.getSign(), other.getSign(), idle.getSign()]).toEqual([STATUS_ACCEPT + 1, 0, 0]);
    expect(simAcceptMission(p, giver, giver.missions[0])).toBeNull();
    simRefreshNpcSigns(p, [giver, other, idle], MAP);
    expect([giver.getSign(), other.getSign()]).toEqual([0, STATUS_SUBMIT + 1]);
  });
});
