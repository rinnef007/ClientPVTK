// The setting part of com.hz.main.GameStore (jadx decompile): Java keeps the option bits in the
// phone's record store (RMS, readSystem / saveSystem) and sends the display bits 18..30 to the
// server at login (getLoginSetting). Here the record store is the browser's localStorage; it can
// be missing or blocked (private mode, previews), so every access is guarded and the game works
// without it.
import type { Player } from '../actor/Player';
import * as GameWorld from './GameWorld';

const KEY = 'pvtk.gameSetting';
export let gameSetting = 0;

export function getGameSetting(): number {
  return gameSetting;
}

export function setGameSetting(v: number): void {
  gameSetting = v;
}

/** GameStore.readSystem (the setting value only). */
export function readSystem(): void {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v != null && /^-?\d+$/.test(v)) gameSetting = Number(v) | 0;
  } catch {
    // storage unavailable: keep the default
  }
}

/** GameStore.saveSystem (the setting value only). */
export function saveSystem(): void {
  try {
    globalThis.localStorage?.setItem(KEY, String(gameSetting));
  } catch {
    // storage unavailable: the setting lasts for this session only
  }
}

/** GameStore.saveSetting: the player's current setting becomes the stored one. */
export function saveSetting(): void {
  const p = GameWorld.myPlayer;
  if (p == null) return;
  gameSetting = p.setting;
  saveSystem();
}

/** GameStore.getLoginSetting: bits 18..30 (display and performance options) of the stored value. */
export function getLoginSetting(): number {
  let v = 0;
  for (let i = 18; i <= 30; i++) if ((gameSetting & (1 << i)) !== 0) v |= 1 << i;
  return v;
}

/**
 * Login: Java sends getLoginSetting (bits 18..30) and the server answers with the player's whole
 * setting, keeping the other bits (team, apprentice, chat…) itself. With no server, the whole
 * stored value stands in for that answer.
 */
export function applyLoginSetting(p: Player): void {
  readSystem();
  p.setting = gameSetting;
}
