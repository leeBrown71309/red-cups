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

/** Patch 0.1.6 added the Meneur de jeu's choice of mini-game. */
const KEYS_ADDED_BY_PATCH_0_1_6: (keyof GameState)[] = ["pendingDuelChoice", "barriers"];

/** Patch 0.2.3 added the tunnels of la Taupe, the pentagrams of le Mage noir and the last deed of the new Cups Power. */
const KEYS_ADDED_BY_PATCH_0_2_3: (keyof GameState)[] = ["moleTunnels", "blackMarks", "lastPowerEvent"];

describe("game save upgrade", () => {
  const saved = pickGameState(reduceGame(EMPTY_GAME_STATE, { type: "startGame", playerNames: ["A", "B"] }));

  it.each([...KEYS_ADDED_BY_PATCH_0_1_4, ...KEYS_ADDED_BY_PATCH_0_1_6, ...KEYS_ADDED_BY_PATCH_0_2_3])(
    "restores a save from before %s",
    (key) => {
      const legacy: Partial<GameState> = { ...saved };
      delete legacy[key];
      const upgraded = migrateGameSave(legacy, GAME_SAVE_VERSION - 1);
      expect(isRestorableGame(upgraded)).toBe(true);
      expect(key in upgraded).toBe(true);
    },
  );

  it("restores a game saved before the Barrière took its final shape, with no barriers", () => {
    const legacy = { ...saved, barrier: { ownerId: "p1", a: 0, b: 1 } } as Record<string, unknown>;
    delete legacy.barriers;
    const upgraded = migrateGameSave(legacy, 23);
    expect(upgraded.barriers).toEqual([]);
  });

  it("knows every key of the state", () => {
    const tracked = new Set<string>([
      ...KEYS_ADDED_BY_PATCH_0_1_4,
      ...KEYS_ADDED_BY_PATCH_0_1_6,
      ...KEYS_ADDED_BY_PATCH_0_2_3,
    ]);
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
    "ferryQuayId",
    "lastArchipelEvents",
    "mirageNodeId",
    "pendingMirageRevealNodeId",
    "cupPairId",
    "wellKnowledge",
    "thirstyIds",
    "caravanNodeId",
    "lastDesertEvents",
    "lastGambleResult",
    "queuedWheels",
    "ghost",
    "lastGhostEvent",
    "lastCupRoll",
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
