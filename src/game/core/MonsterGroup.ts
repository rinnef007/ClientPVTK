// com.hz.core.MonsterGroup (1.2.0, Vineflower decompile): the monsters of one local battle by
// position (10, or 20 with flag 1) and up to 4 allied NPC fighters (flag 2), from the 10503 world
// data (block 2048). getLocalBattlePlayerList lines them up with the player (25) and pet (24).
import { Monster } from '../actor/Monster';
import type { Player } from '../actor/Player';
import type { Message } from '../../net/Message';

export const FLAG_MONSTER_20 = 1;
export const FLAG_HAVE_NPC = 2;
export const MY_POS = 25;
export const MY_PET_POS = 24;

export class MonsterGroup {
  groupId = 0;
  type = 0;
  nextBattleGroupID = 0;
  flag = 0;
  monsters: number[] = new Array(20).fill(0);
  npcs: number[] = new Array(4).fill(0);

  static fromBytes(m: Message): MonsterGroup {
    const g = new MonsterGroup();
    g.groupId = m.getShort() & 0xffff;
    g.type = m.getByte();
    g.nextBattleGroupID = m.getShort() & 0xffff;
    g.flag = m.getByte();
    const n = g.isFlag(FLAG_MONSTER_20) ? 20 : 10;
    for (let i = 0; i < n; i++) g.monsters[i] = m.getShort();
    if (g.isFlag(FLAG_HAVE_NPC)) for (let i = 0; i < 4; i++) g.npcs[i] = m.getShort();
    return g;
  }

  isFlag(f: number): boolean {
    return (f & this.flag) !== 0;
  }

  /** MonsterGroup.setGroupMonsterDataToBattle: a full-HP copy of each monster at its index. */
  setGroupMonsterDataToBattle(list: (Player | null)[], getMonster: (id: number) => Monster | null): void {
    for (let i = 0; i < this.monsters.length && i < list.length; i++) {
      const id = this.monsters[i];
      if (id <= 0) continue;
      const src = getMonster(id);
      if (src == null) continue;
      const o = src.getClone();
      o.resumeHPMP();
      o.position = i;
      list[i] = o;
    }
  }

  /**
   * MonsterGroup.getLocalBattlePlayerList: monsters on the left, the player at 25, the pet at 24,
   * allied NPCs at 23 / 22 / 27 / 26. (Mercenaries are not ported.)
   */
  static getLocalBattlePlayerList(me: Player | null, g: MonsterGroup | null, getMonster: (id: number) => Monster | null): (Player | null)[] | null {
    if (me == null || g == null) return null;
    const list: (Player | null)[] = new Array(34).fill(null);
    g.setGroupMonsterDataToBattle(list, getMonster);
    me.position = MY_POS;
    list[MY_POS] = me;
    const pet = me.getPet();
    if (pet != null && pet.get(2) > 0) {
      pet.position = MY_PET_POS;
      list[MY_PET_POS] = pet;
    }
    for (let i = 0; i < g.npcs.length; i++) {
      const id = g.npcs[i];
      const src = id > 0 ? getMonster(id) : null;
      if (src == null) continue;
      const pos = (i >= 2 ? 27 : 23) - (i & 1);
      const o = src.getClone();
      o.resumeHPMP();
      o.position = pos;
      list[pos] = o;
    }
    return list;
  }
}
