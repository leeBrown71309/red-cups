import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";
import { readStorage, removeStorage, writeStorage } from "../utils/safe-local-storage";
import type { GameState } from "./types";
import { EMPTY_GAME_STATE } from "./types";

export const GAME_SAVE_KEY = "red-cups-save";
/** Bump when GameState changes shape: older saves are then dropped instead of crashing. */
export const GAME_SAVE_VERSION = 4;

const GAME_STATE_KEYS = Object.keys(EMPTY_GAME_STATE) as (keyof GameState)[];

export function pickGameState(source: GameState): GameState {
  return Object.fromEntries(GAME_STATE_KEYS.map((key) => [key, source[key]])) as unknown as GameState;
}

/** A save is only worth restoring while a game is actually being played. */
export function isRestorableGame(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.phase === "playing" &&
    Array.isArray(candidate.players) &&
    candidate.players.length >= 2 &&
    typeof candidate.activePlayerIndex === "number" &&
    typeof candidate.turnStage === "string" &&
    GAME_STATE_KEYS.every((key) => key in candidate)
  );
}

/**
 * Writes the running game on every change and deletes it once the game is
 * over or abandoned, so the browser never piles up stale saves.
 */
const gameSaveStorage: PersistStorage<GameState> = {
  getItem: (name) => {
    const raw = readStorage(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StorageValue<GameState>;
    } catch {
      removeStorage(name);
      return null;
    }
  },
  setItem: (name, value) => {
    if (value.state.phase !== "playing") {
      removeStorage(name);
      return;
    }
    writeStorage(name, JSON.stringify(value));
  },
  removeItem: (name) => removeStorage(name),
};

/**
 * Upgrades a save written by an older version when the change is additive,
 * so a game in progress survives an update. Anything older is dropped.
 */
export function migrateGameSave(persisted: unknown, version: number): GameState {
  if (version === 3 && isRestorableGame(persisted)) {
    // Version 4 added the Hell countdown: nobody has served any turn of it yet.
    return { ...persisted, players: persisted.players.map((player) => ({ ...player, hellTurns: 0 })) };
  }
  return { ...EMPTY_GAME_STATE };
}

export function createGameSaveOptions<Store extends GameState>(): PersistOptions<Store, GameState> {
  return {
    name: GAME_SAVE_KEY,
    version: GAME_SAVE_VERSION,
    storage: gameSaveStorage,
    partialize: (store) => pickGameState(store),
    migrate: migrateGameSave,
    merge: (persisted, current) => (isRestorableGame(persisted) ? { ...current, ...persisted } : current),
  };
}
