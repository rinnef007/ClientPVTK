// Local battle messages of client 1.2.0 (jadx decompile): 12501 tells the server a local battle
// started (MsgHandler.createEnterLocalBattle), 12502 reports its result
// (BattleAniEngine.sendLocalBattleReward) and brings the reward back
// (MsgHandler.processLocalBattleReward / parseBattleNormalReward).
import type { Player } from '../../game/actor/Player';
import { PlayerBag } from '../../game/actor/Item';
import { PowerString } from '../../game/string/PowerString';
import { Message } from '../Message';
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

/** MsgHandler.processLocalBattleReward: money, levels, kills (missions), items. Pet rewards and escorts are not ported. */
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
    if (m.getBoolean()) throw new Error('parsePetReward chưa được port');
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
