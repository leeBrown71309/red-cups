import type { PersistOptions, PersistStorage, StorageValue } from "zustand/middleware";
import { readStorage, removeStorage, writeStorage } from "../utils/safe-local-storage";
import type { GameState, GhostState } from "./types";
import { isMapId } from "./maps/map-registry";
import { BASE_ENERGY, EMPTY_GAME_STATE, FIRST_ROUND } from "./types";

export const GAME_SAVE_KEY = "red-cups-save";
/** Bump when GameState changes shape, and teach `upgradeSave` the new fields. */
export const GAME_SAVE_VERSION = 15;

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

/** Patch 0.1.4 renamed two passives and removed two, whose holders become Lambda. */
const REPLACED_PASSIVES: Record<string, string> = {
  delinquent: "corrupter",
  troll: "goblin",
  penta: "lambda",
  "im-cups": "lambda",
};

/**
 * Patch 0.1.4: Non merci no longer holds a move, and Calme-toi now sets a list
 * of players down; a save caught in the old windows resumes as it stands.
 */
function upgradePassiveWindows(save: SaveRecord): SaveRecord {
  const reaction = save.pendingReaction as { action?: { type?: string }; resumeStage?: string } | null | undefined;
  const calmDown = save.pendingCalmDown as SaveRecord | null | undefined;
  const heldMove = reaction?.action?.type === "move";
  return {
    ...(heldMove ? { pendingReaction: null, turnStage: reaction.resumeStage ?? "move" } : {}),
    ...(calmDown && !Array.isArray(calmDown.targetIds)
      ? {
          pendingCalmDown: {
            passivePlayerId: calmDown.passivePlayerId,
            targetIds: [calmDown.collectorId],
            resumeStage: calmDown.resumeStage,
          },
        }
      : {}),
  };
}

/**
 * Fills in what later versions added, as it stands at the start of a game.
 * Version 4 added the Hell countdown; version 5 (patch 0.1.1) the mud turn
 * flag, Bullet Bill's flight, the Tour de Bénédiction, abandons and the Non
 * merci cooldown, which replaces the once-per-Cup rule. Version 6 moved duels
 * into the engine (hands, votes, decided winner) and added the online seed.
 * Version 7 (patch 0.1.3) added the board choice: older games were classic.
 * Version 8 added the Banquise ice: temporary tile, frozen players, blizzards.
 * Version 9 added the Basket duel and the Luna Park ghost, which a game saved
 * before shows a round later. Version 10 added the Tomate's last throw,
 * version 11 the Banquise snowballs. Version 12 (patch 0.1.4) added each
 * player's previous tile and the step forward of the wheel of fortune,
 * version 13 the energy of the turn (a game saved before goes on with a
 * full gauge) and the Tomate stack thrown from this turn. Version 14 reworked
 * the passives: renamed and removed ones, Red light, Green light's count,
 * Non merci and Calme-toi. Version 15 added the Roller's die.
 */
function upgradeSave(save: SaveRecord): SaveRecord {
  const players = Array.isArray(save.players) ? (save.players as SaveRecord[]) : [];
  const duel = save.pendingDuel as SaveRecord | null | undefined;
  return {
    ...save,
    mapId: isMapId(save.mapId) ? save.mapId : EMPTY_GAME_STATE.mapId,
    carouselReversed: save.carouselReversed === true,
    iceTileNodeId: save.iceTileNodeId ?? null,
    frozenSlides: save.frozenSlides ?? [],
    lastBlizzard: save.lastBlizzard ?? null,
    lastIceFall: save.lastIceFall ?? null,
    ghost: save.ghost ?? (save.mapId === "luna-park" ? createAbsentGhost(Number(save.round) || FIRST_ROUND) : null),
    lastGhostEvent: save.lastGhostEvent ?? null,
    lastTomatoThrow: save.lastTomatoThrow ?? null,
    snowballHits: save.snowballHits ?? {},
    snowFrozenPlayerIds: save.snowFrozenPlayerIds ?? [],
    lastSnowball: save.lastSnowball ?? null,
    seededRandom: save.seededRandom ?? null,
    pendingDuel: duel
      ? {
          rpsChoices: {},
          rpsTiedRound: null,
          rpsTies: 0,
          votes: {},
          voteTieBroken: false,
          winnerId: null,
          basket: null,
          ghost: null,
          ...duel,
        }
      : null,
    mudPlacedThisTurn: save.mudPlacedThisTurn ?? false,
    thrownStackId: save.thrownStackId ?? null,
    diceRoll: save.diceRoll ?? null,
    lastBulletFlight: save.lastBulletFlight ?? null,
    blessingQueue: save.blessingQueue ?? [],
    abandonedPlayers: save.abandonedPlayers ?? [],
    winReason: save.winReason ?? null,
    pendingAdvance: save.pendingAdvance ?? null,
    energyLeft: save.energyLeft ?? BASE_ENERGY,
    redGreenTriggers: save.redGreenTriggers ?? { green: 0, red: 0 },
    ...upgradePassiveWindows(save),
    players: players.map(({ noThanksUsedCycle: _replaced, ...player }) => ({
      ...player,
      passiveId: REPLACED_PASSIVES[String(player.passiveId)] ?? player.passiveId,
      hellTurns: player.hellTurns ?? 0,
      noThanksReadyRound: player.noThanksReadyRound ?? FIRST_ROUND,
      previousNodeId: player.previousNodeId ?? null,
    })),
  };
}

function createAbsentGhost(round: number): GhostState {
  return { nodeId: null, returnsAtRound: round + 1, loot: { coins: 0, items: [] }, metPlayerIds: [] };
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
