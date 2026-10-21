import { afterEach, describe, expect, it } from 'vitest';
import { Player } from '../src/game/actor/Player';
import * as GameStore from '../src/game/main/GameStore';
import * as GameWorld from '../src/game/main/GameWorld';

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

afterEach(() => {
  store.clear();
  delete (globalThis as { localStorage?: unknown }).localStorage;
  GameStore.setGameSetting(0);
});

describe('GameStore setting', () => {
  it('saves the player setting and applies it at the next login', () => {
    (globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
    const me = new Player();
    me.setting = (1 << 20) | (1 << 2);
    GameWorld.setMyPlayer(me);
    GameStore.saveSetting();
    GameStore.setGameSetting(0);
    const next = new Player();
    GameStore.applyLoginSetting(next);
    expect(next.setting).toBe((1 << 20) | (1 << 2));
    expect(GameStore.getLoginSetting()).toBe(1 << 20);
  });

  it('works without storage', () => {
    const me = new Player();
    me.setting = 5;
    GameWorld.setMyPlayer(me);
    expect(() => GameStore.saveSetting()).not.toThrow();
    const next = new Player();
    GameStore.setGameSetting(0);
    GameStore.applyLoginSetting(next);
    expect(next.setting).toBe(0);
  });

  it('survives a storage that throws', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => GameStore.saveSystem()).not.toThrow();
    expect(() => GameStore.readSystem()).not.toThrow();
  });
});
