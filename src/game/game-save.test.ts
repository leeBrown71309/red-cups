import { describe, expect, it } from "vitest";
import { reduceGame } from "./game-actions";
import { GAME_SAVE_VERSION, isRestorableGame, migrateGameSave, pickGameState } from "./game-save";
import type { GameState } from "./types";
import { EMPTY_GAME_STATE } from "./types";

/**
 * A game saved by the previous version must come back after an update: every
 * key patch 0.1.4 added to the state is filled in when an older save lacks it.
 */
const KEYS_ADDED_BY_PATCH_0_1_4: (keyof GameState)[] = [
  "pendingAdvance",
  "energyLeft",
  "thrownStackId",
  "redGreenTriggers",
  "diceRoll",
  "pendingGambles",
  "gambleResumeStage",
  "theftAttempted",
  "coWinnerId",
  "startingPlayerCount",
  "devilHellTurns",
  "hellPortals",
  "blackCup",
  "doomsday",
  "guardian",
  "turnClock",
  "decisionClock",
  "idleStrikes",
  "rulesVersion",
  "draft",
  "pendingArmWrestle",
  "hostPlayerId",
  "pause",
];

describe("game save upgrade", () => {
  const saved = pickGameState(reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"] }));

  it.each(KEYS_ADDED_BY_PATCH_0_1_4)("restores a save from before %s", (key) => {
    const legacy: Partial<GameState> = { ...saved };
    delete legacy[key];
    const upgraded = migrateGameSave(legacy, GAME_SAVE_VERSION - 1);
    expect(isRestorableGame(upgraded)).toBe(true);
    expect(key in upgraded).toBe(true);
  });

  it("knows every key of the state", () => {
    const tracked = new Set<string>(KEYS_ADDED_BY_PATCH_0_1_4);
    // A key added later must be listed above and filled in by `upgradeSave`.
    const unknown = Object.keys(EMPTY_GAME_STATE).filter(
      (key) => !tracked.has(key) && !(key in KEYS_BEFORE_PATCH_0_1_4),
    );
    expect(unknown).toEqual([]);
  });
});

/** The state's keys as patch 0.1.3 left them. */
const KEYS_BEFORE_PATCH_0_1_4: Record<string, true> = Object.fromEntries(
  [
    "phase",
    "mapId",
    "carouselReversed",
    "turnStage",
    "players",
    "activePlayerIndex",
    "round",
    "redCupNodeId",
    "previousRedCupNodeId",
    "redCupCycle",
    "pendingWheel",
    "pendingDuel",
    "pendingDiscard",
    "pendingChallenge",
    "pendingCupRepositionPlayerId",
    "pendingCupRevealNodeId",
    "pendingCupRepositionResumeStage",
    "pendingCalmDown",
    "pendingReaction",
    "pendingTileWheels",
    "tileWheelResumeStage",
    "duelResumeStage",
    "mudTraps",
    "mudPlacedThisTurn",
    "bulletBill",
    "lastBulletFlight",
    "iceTileNodeId",
    "frozenSlides",
    "lastBlizzard",
    "lastIceFall",
    "ghost",
    "lastGhostEvent",
    "lastTomatoThrow",
    "snowballHits",
    "snowFrozenPlayerIds",
    "lastSnowball",
    "blessingQueue",
    "abandonedPlayers",
    "bootPrice",
    "bootFirstPurchased",
    "bootLastPriceRound",
    "moveDistance",
    "turnActionTaken",
    "winnerId",
    "winReason",
    "lastMovement",
    "log",
    "seededRandom",
  ].map((key) => [key, true]),
);
