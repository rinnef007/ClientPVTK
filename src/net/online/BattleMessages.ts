// Local battle messages of client 1.2.0 (jadx decompile): 12501 tells the server a local battle
// started (MsgHandler.createEnterLocalBattle), 12502 reports its result
// (BattleAniEngine.sendLocalBattleReward) and brings the reward back
// (MsgHandler.processLocalBattleReward / parseBattleNormalReward).
import type { Player } from '../../game/actor/Player';
import { PlayerBag } from '../../game/actor/Item';
import { PowerString } from '../../game/string/PowerString';
import { Message } from '../Message';
import { readSkill } from './EnterGame';
import { readAddItems, readNpcStatus, readUpLevel } from './MissionMessages';

export const MSG_ENTER_LOCAL_BATTLE = 12501;
export const MSG_LOCAL_BATTLE_RESULT = 12502;

export function createEnterLocalBattleMsg(): Message {
  return new Message(MSG_ENTER_LOCAL_BATTLE);
}

export interface LocalBattleReport {
  startHP: number;
  startMP: number;
  endHP: number;
  endMP: number;
  seed: number;
  groupId: number;
  /** The player had their pet in the fight (plans then come in pairs). */
  withPet: boolean;
  plans: Uint8Array[];
}

/** BattleAniEngine.sendLocalBattleReward. */
export function createLocalBattleResultMsg(r: LocalBattleReport): Message {
  const m = new Message(MSG_LOCAL_BATTLE_RESULT);
  m.putInt(r.startHP);
  m.putInt(r.startMP);
  m.putInt(r.endHP);
  m.putInt(r.endMP);
  m.putShort(r.seed);
  m.putShort(r.groupId);
  m.putBoolean(r.withPet);
  const n = r.withPet ? r.plans.length >> 1 : r.plans.length;
  m.putByte(n);
  for (let i = 0; i < r.plans.length; ) {
    m.putBytes(r.plans[i++]);
    if (r.withPet) m.putBytes(i < r.plans.length ? r.plans[i++] : null);
  }
  return m;
}

export interface LocalBattleReward {
  /** Status 2: a won fight with its reward. */
  won: boolean;
  /** The reward text (GameCanvas.battleRewardMessage). */
  text: string;
  /** Mission NPC signs to update (processMissionNPCStatus). */
  npcSigns: [number, number][];
  /** The medicine buffer ran out (Player.power = -1). */
  powerEnded: boolean;
  /** The server asks for a base world refresh. */
  refresh: boolean;
}

/** MsgHandler.parsePetReward: the pet's exp, then levels with grow level, stats, exp and new skills. */
export function readPetReward(m: Message, pet: Player | null): string {
  let text = '';
  const exp = m.getInt();
  if (exp > 0) text += `${PowerString.makeColorString('Exp trân thú+', 16776960)}${exp}\n`;
  pet?.addValue(0, exp);
  const levels = m.getByte();
  if (levels <= 0) return text;
  const sp = m.getShort();
  const grow = m.getByte();
  if (grow > 0) text += `${PowerString.makeColorString('Cấp trưởng thành trân thú+', 16776960)}${grow}\n`;
  const stats = grow > 0 ? [m.getShort(), m.getShort(), m.getShort(), m.getShort(), m.getShort()] : [0, 0, 0, 0, 0];
  const newExp = m.getInt();
  const newExpMax = m.getInt();
  const cp = m.getByte();
  const skills = [];
  for (let n = m.getByte(); n > 0; n--) skills.push(readSkill(m));
  if (pet != null) {
    pet.addValue(106, levels);
    pet.level += levels;
    pet.addValue(5, sp);
    pet.addValue(83, grow);
    stats.forEach((v, i) => pet.addValue(6 + i, v));
    pet.addValue(5001, newExp);
    pet.addValue(5002, newExpMax);
    (pet as { cp?: number }).cp = cp;
    for (const s of skills) pet.learnSkill(s);
    pet.resumeHPMP();
  }
  return text;
}

/** MsgHandler.processLocalBattleReward: money, levels, kills (missions), items. Escort rewards are not ported. */
export function readLocalBattleReward(m: Message, p: Player): LocalBattleReward {
  const status = m.getByte();
  if (status < 0) throw new Error(m.getString());
  let text = '';
  let npcSigns: [number, number][] = [];
  if (status === 2) {
    const money = m.getInt();
    if (money > 0) {
      p.addValue(13, money);
      text += `${PowerString.makeColorString('Đồng ', 16776960)}${money}    `;
    }
    text += readUpLevel(m, p);
    const bagFull = m.getBoolean();
    if (m.getBoolean()) text += readPetReward(m, p.getPet());
    const n = m.getByte();
    if (n > 0) {
      const ids: number[] = [];
      const counts: number[] = [];
      let total = 0;
      for (let i = 0; i < n; i++) {
        ids.push(m.getShort());
        const c = m.getByte();
        counts.push(c);
        total += c;
      }
      const lines: string[] = [];
      p.updateAllKillMission(ids, counts, lines);
      text += lines.join('');
      if (total > 0) p.addValue(18, total);
    }
    if (m.getBoolean()) throw new Error('Phần thưởng hộ tống chưa được port');
    text += readAddItems(m, p.bag ?? (p.bag = new PlayerBag()));
    if (bagFull) text += `${PowerString.makeColorString('Túi đã đầy', 16711680)}\n`;
    npcSigns = readNpcStatus(m);
  }
  const powerEnded = !m.getBoolean();
  m.getByte(); // processMyMercenaryCheck: no mercenaries
  const refresh = m.getBoolean();
  if (!m.getBoolean()) p.countrypowerValue = 0;
  return { won: status === 2, text, npcSigns, powerEnded, refresh };
}
