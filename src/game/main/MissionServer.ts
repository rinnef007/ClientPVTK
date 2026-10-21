// Offline stand-in for the server side of NPC missions. In the game, accepting (14502), handing in
// (14503) and giving up (14504) are requests whose answers the client applies: Mission.doAcceptMissionMsg
// / doSubmitMissionMsg / doDeleteMissionMsg, MsgHandler.processMissionReward (finish bit, money,
// MsgHandler.processUpLevelMsg, items) and processMissionNPCStatus (NPC signs). Here the "answer" is
// made up locally from the mission's own fields, so it is only a simulation:
// - the checks (level, accept conditions, goals met, NPC and map) are the client's own checks;
// - the rewards are the mission's listed exp / Lá / Bạc; "have item" goals take the items away;
// - a level-up when exp passes the max uses a made-up exp curve (×1.2 per level, 5 + 5 points),
//   like the dev key 0 in MapScene — the real curve and points come from the server;
// - NPC signs are inferred from the mission status (sign = status + 1, matching the frame order of
//   sets 3 and 11), not from server data.
import { CONDITION_HAVE_ITEM, Mission, STATUS_ACCEPT, STATUS_DOING, STATUS_SUBMIT, type MissionNpc } from '../core/Mission';
import type { NPC } from '../actor/NPC';
import { ATTR_EXP, ATTR_EXP_MAX, ATTR_MONEY2, ATTR_MONEY3, type Player } from '../actor/Player';
import { PowerString } from '../string/PowerString';
import { processUpLevelMsg } from './LevelUp';

/** The made-up level curve of the simulation. */
const SIM_EXP_GROWTH = 1.2;
const SIM_SKILL_POINTS = 5;
const SIM_ATTR_POINTS = 5;

/** Accept (server checks), or the error text the server would send. */
export function simAcceptMission(p: Player, npc: NPC, m: Mission): string | null {
  if (p.getMissionById(m.getId()) != null) return 'Đã nhận nhiệm vụ này rồi.';
  if (Mission.isMissionFinish(p, m.getId())) return 'Nhiệm vụ này đã hoàn thành.';
  if (!m.isCanAccept(p)) return 'Chưa đạt điều kiện nhận.';
  if (npc.getMissonById(m.getId()) == null) return 'NPC này không giao nhiệm vụ đó.';
  if (!p.addMission(m)) return 'Danh sách nhiệm vụ đã đầy.';
  return null;
}

export function simDeleteMission(p: Player, m: Mission): boolean {
  if (p.getMissionById(m.getId()) == null) return false;
  p.deleteMission(m);
  return true;
}

/**
 * Hand in: the server's checks, then processMissionReward's effects. Returns the reward text
 * (shown with WorldMessage.addPointMsg in Java), or null when the server would refuse.
 */
export function simSubmitMission(p: Player, npc: MissionNpc, m: Mission, curMap: number): string | null {
  if (p.getMissionById(m.getId()) == null || !m.isComplete(p) || !m.isVisibleAndSubmit(npc, curMap)) return null;
  for (const c of m.submitCondition ?? []) {
    if (c.type === CONDITION_HAVE_ITEM) p.bag?.removeItemsById(c.itemId, c.need);
  }
  p.submitMission(m);
  Mission.setMissionStatus(p, m.getId(), true);
  let s = '';
  if (m.money2 > 0) {
    p.addValue(ATTR_MONEY2, m.money2);
    s += PowerString.makeColorString(`Lá${m.money2} `, 16776960);
  }
  if (m.money3 > 0) {
    p.addValue(ATTR_MONEY3, m.money3);
    s += PowerString.makeColorString(`Bạc${m.money3} `, 16776960);
  }
  return s + simExp(p, m.exp);
}

/** processUpLevelMsg with numbers the simulation makes up when the exp passes the max. */
function simExp(p: Player, exp: number): string {
  if (exp <= 0) return '';
  let cur = p.get(ATTR_EXP) + exp;
  let max = p.get(ATTR_EXP_MAX);
  let levels = 0;
  while (max > 0 && cur >= max && p.getLevel() + levels < 120) {
    cur -= max;
    max = Math.round(max * SIM_EXP_GROWTH);
    levels++;
  }
  if (levels === 0) return processUpLevelMsg(p, { exp, levels: 0, newExp: 0, newExpMax: 0, skillPoints: 0, attrPoints: 0 });
  return processUpLevelMsg(p, {
    exp,
    levels,
    newExp: cur,
    newExpMax: max,
    skillPoints: SIM_SKILL_POINTS * levels,
    attrPoints: SIM_ATTR_POINTS * levels,
  });
}

/**
 * processMissionNPCStatus stand-in: each NPC's sign from the best status among the missions it
 * takes back or offers (hand in, then accept, then in progress); none → no sign.
 */
export function simRefreshNpcSigns(p: Player, npcs: NPC[], curMap: number): void {
  const rank = [STATUS_SUBMIT, STATUS_ACCEPT, STATUS_DOING];
  for (const npc of npcs) {
    const statuses: number[] = [];
    for (const m of p.missionList) if (m != null && m.isVisibleAndSubmit(npc, curMap)) statuses.push(m.getMissionStatus(p));
    for (const m of npc.missions) {
      if (p.getMissionById(m.getId()) == null && !Mission.isMissionFinish(p, m.getId())) statuses.push(m.getMissionStatus(p));
    }
    const best = rank.find((r) => statuses.includes(r));
    npc.setSign(best == null ? 0 : best + 1);
  }
}
