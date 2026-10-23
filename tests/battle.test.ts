import { describe, expect, it } from 'vitest';
import { Monster } from '../src/game/actor/Monster';
import { Player } from '../src/game/actor/Player';
import { Item, PlayerBag } from '../src/game/actor/Item';
import { Battle, PLAN_ATTACK, PLAN_ESCAPE, PLAN_USE_ITEM, RESULT_LEFT_WIN, RESULT_RIGHT_WIN } from '../src/game/battle/Battle';
import { processBattlePower } from '../src/game/battle/BattlePower';
import { MonsterGroup } from '../src/game/core/MonsterGroup';
import { getBufferBitValue } from '../src/game/core/DefineBattle';

function hero(): Player {
  const p = new Player();
  p.name = 'Hero';
  p.formulas = true;
  [p.str, p.con, p.agi, p.ilt, p.wis] = [5, 5, 5, 5, 5];
  p.set(106, 1);
  p.resumeHPMP();
  return p;
}

function cat(): Monster {
  const m = new Monster();
  Object.assign(m, { id: 1, name: 'Mèo', level: 1, hpMax: 60, speed: 40, atkMin: 3, atkMax: 5, atk_time: 1, dodge: 5, atk_str: 1, atk_agi: 1, def_str: 2, def_agi: 2, def_magic: 2, hitrate: 90, hitMagic: 90, critical: 5 });
  m.set(106, 1);
  return m;
}

function battleOf(p: Player, m: Monster, seed = 7): Battle {
  const g = new MonsterGroup();
  g.groupId = 1;
  g.monsters[0] = m.id;
  const list = MonsterGroup.getLocalBattlePlayerList(p, g, () => m)!;
  return Battle.createLocalBattle(seed, list, g);
}

describe('Battle (local)', () => {
  it('a level 1 player has 147 HP (Player.get(29), as the backend)', () => {
    expect(hero().get(29)).toBe(147);
  });

  it('places monsters left and the player at 25; same seed → same fight', () => {
    const run = () => {
      const p = hero();
      const b = battleOf(p, cat());
      expect(b.getPlayerByPos(25)).toBe(p);
      expect(b.getPlayerByPos(0)).toBeInstanceOf(Monster);
      const log: number[] = [];
      while (!b.isBattleFinish()) {
        b.setPlan(25, new Uint8Array([PLAN_ATTACK, 0]));
        b.logicRound();
        log.push(b.getPlayerByPos(0)!.get(2), p.get(2));
      }
      return { log, result: b.result, rounds: b.round };
    };
    const a = run();
    expect(run()).toEqual(a);
    expect([RESULT_LEFT_WIN, RESULT_RIGHT_WIN]).toContain(a.result);
    expect(a.rounds).toBeLessThanOrEqual(30);
  });

  it('a medicine (power 49) heals the target up to its max', () => {
    const p = hero();
    const bag = new PlayerBag();
    const it = new Item();
    Object.assign(it, { id: 9, name: 'Thuốc', type: 27, power1: 49, powerValue1: 50, quantity: 2, area: 20 });
    bag.setItem(30, it);
    p.bag = bag;
    const b = battleOf(p, cat());
    p.set(2, 100);
    b.setPlan(25, new Uint8Array([PLAN_USE_ITEM, 25, 30]));
    b.logicRound();
    // healed by 50 (capped at 147), then maybe hit by the cat this round
    expect(p.get(2)).toBeGreaterThan(100);
    expect(bag.getItem(30)!.quantity).toBe(1);
  });

  it('escaping marks the player gone and the monsters win', () => {
    const p = hero();
    const b = battleOf(p, cat());
    b.setPlan(25, new Uint8Array([PLAN_ESCAPE]));
    b.logicRound();
    expect(p.isBattleStatus(1n)).toBe(true);
    expect(b.result).toBe(RESULT_LEFT_WIN);
  });

  it('a status buffer (poison 1, HP −10 for 3 rounds) ticks and ends', () => {
    const p = hero();
    const b = battleOf(p, cat());
    processBattlePower(b, p, null, null, 49, -10, 1, 3, 0, []);
    expect(p.get(2)).toBe(137);
    expect(p.isBattleStatus(getBufferBitValue(1))).toBe(true);
    p.runBufferList(true);
    p.runBufferList(true);
    expect(p.get(2)).toBe(117);
    p.runBufferList(false);
    expect(p.isBattleStatus(getBufferBitValue(1))).toBe(false);
    expect(p.battleBufferList?.length ?? 0).toBe(0);
  });

  it('an attribute buffer is taken back when it ends', () => {
    const p = hero();
    const b = battleOf(p, cat());
    const atk = p.get(36);
    processBattlePower(b, p, null, null, 58, 25, 11, 2, 0, []);
    expect(p.get(36)).toBe(atk + 25);
    p.runBufferList(true);
    p.runBufferList(false);
    expect(p.get(36)).toBe(atk);
  });
});

import { Message } from '../src/net/Message';
import { MyPet } from '../src/game/actor/MyPet';
import { Mission, Condition, CONDITION_KILL_MONSTER } from '../src/game/core/Mission';
import { readLocalBattleReward } from '../src/net/online/BattleMessages';

function reply(type: number, write: (m: Message) => void): Message {
  const w = new Message(type, 4096);
  write(w);
  return new Message(type, w.payload());
}

describe('12502 local battle reward', () => {
  it('reads money, exp, kills (missions) and the trailing flags as the backend writes them', () => {
    const p = hero();
    p.set(1, 400);
    const m = new Mission(9001);
    m.submitCondition = [new Condition(CONDITION_KILL_MONSTER, 'Mèo Hoang', 3, 1, 1)];
    p.addMission(m);
    const r = reply(12502, (w) => {
      w.putByte(2);
      w.putInt(15); // money
      w.putInt(120); w.putByte(0); // exp, no level gained
      w.putInt(0); w.putByte(0); // god exp, levels
      w.putBoolean(false); w.putBoolean(false); // bag full, pet reward
      w.putByte(1); w.putShort(1); w.putByte(1); // kills: monster 1 ×1
      w.putBoolean(false); // escort
      w.putByte(0); // items
      w.putByte(0); // npc signs
      w.putBoolean(true); w.putByte(0); w.putBoolean(false); w.putBoolean(true);
    });
    const out = readLocalBattleReward(r, p);
    expect(out.won).toBe(true);
    expect(p.get(13)).toBe(15);
    expect(p.get(0)).toBe(120);
    expect(m.submitCondition[0].done).toBe(2);
    expect(out.powerEnded).toBe(false);
  });
});

describe('MyPet.get', () => {
  it('HP max = con×6.5 + str×3 + 100 + (level−1)×20', () => {
    const pet = new MyPet(hero());
    pet.formulas = true;
    [pet.str, pet.con] = [5, 5];
    pet.set(106, 3);
    expect(pet.get(29)).toBe(32 + 15 + 100 + 40);
  });
});

import { readPetReward } from '../src/net/online/BattleMessages';

describe('parsePetReward', () => {
  it('adds the exp, then a level with grow level, stats and the new exp', () => {
    const owner = hero();
    const pet = new MyPet(owner);
    pet.formulas = true;
    [pet.str, pet.con, pet.agi, pet.ilt, pet.wis] = [5, 5, 5, 5, 5];
    pet.set(106, 1);
    pet.set(1, 100);
    const r = reply(12502, (w) => {
      w.putInt(120);
      w.putByte(1); // levels
      w.putShort(2); // skill points
      w.putByte(1); // grow level
      for (let i = 0; i < 5; i++) w.putShort(1);
      w.putInt(20);
      w.putInt(200);
      w.putByte(3); // cp
      w.putByte(0); // new skills
    });
    const text = readPetReward(r, pet);
    expect(text).toContain('120');
    expect(pet.get(106)).toBe(2);
    expect([pet.str, pet.wis, pet.growLevel]).toEqual([6, 6, 1]);
    expect([pet.get(0), pet.get(1)]).toEqual([20, 200]);
    expect(pet.get(2)).toBe(pet.get(29));
  });
});
