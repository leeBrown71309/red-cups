import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";
import { readStorage, removeStorage, writeStorage } from "../utils/safe-local-storage";
import type { GameState } from "./types";
import { EMPTY_GAME_STATE, FIRST_ROUND } from "./types";

export const GAME_SAVE_KEY = "red-cups-save";
/** Bump when GameState changes shape, and teach `upgradeSave` the new fields. */
export const GAME_SAVE_VERSION = 6;

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
    // An online game lives in its room; saving it here would clobber a local game.
    if (value.state.seededRandom) return;
    if (value.state.phase !== "playing") {
      removeStorage(name);
      return;
    }
    writeStorage(name, JSON.stringify(value));
  },
  removeItem: (name) => removeStorage(name),
};

/** Saves from before this version do not have the shape the upgrade below expects. */
const OLDEST_UPGRADABLE_VERSION = 3;

type SaveRecord = Record<string, unknown>;

/**
 * Fills in what later versions added, as it stands at the start of a game.
 * Version 4 added the Hell countdown; version 5 (patch 0.1.1) the mud turn
 * flag, Bullet Bill's flight, the Tour de Bénédiction, abandons and the Non
 * merci cooldown, which replaces the once-per-Cup rule. Version 6 moved duels
 * into the engine (hands, votes, decided winner) and added the online seed.
 */
function upgradeSave(save: SaveRecord): SaveRecord {
  const players = Array.isArray(save.players) ? (save.players as SaveRecord[]) : [];
  const duel = save.pendingDuel as SaveRecord | null | undefined;
  return {
    ...save,
    seededRandom: save.seededRandom ?? null,
    pendingDuel: duel
      ? {
          rpsChoices: {},
          rpsTiedRound: null,
          rpsTies: 0,
          votes: {},
          voteTieBroken: false,
          winnerId: null,
          ...duel,
        }
      : null,
    mudPlacedThisTurn: save.mudPlacedThisTurn ?? false,
    lastBulletFlight: save.lastBulletFlight ?? null,
    blessingQueue: save.blessingQueue ?? [],
    abandonedPlayers: save.abandonedPlayers ?? [],
    winReason: save.winReason ?? null,
    players: players.map(({ noThanksUsedCycle: _replaced, ...player }) => ({
      ...player,
      hellTurns: player.hellTurns ?? 0,
      noThanksReadyRound: player.noThanksReadyRound ?? FIRST_ROUND,
    })),
  };
}

/**
 * Upgrades a save written by an older version when the change is additive,
 * so a game in progress survives an update. Anything older is dropped.
 */
export function migrateGameSave(persisted: unknown, version: number): GameState {
  if (version < OLDEST_UPGRADABLE_VERSION || !persisted || typeof persisted !== "object") {
    return { ...EMPTY_GAME_STATE };
  }
  const upgraded = upgradeSave(persisted as SaveRecord);
  return isRestorableGame(upgraded) ? upgraded : { ...EMPTY_GAME_STATE };
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
