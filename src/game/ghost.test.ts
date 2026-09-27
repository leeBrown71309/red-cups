import { describe, expect, it } from "vitest";
import { canPlayerSendAction } from "./action-permissions";
import { countBaskets, createDuel, drawGhostShots, getDuelModes } from "./duel-setup";
import { reduceGame, type GameAction } from "./game-actions";
import { settleBoard } from "./game-effects";
import { advanceGhost, getNextGhostTile, startGhostDuel } from "./ghost";
import type { GameState, GhostState, MapId, PendingDuel, Player } from "./types";
import {
  BASKET_MAX_SCORE,
  EMPTY_GAME_STATE,
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_ID,
  GHOST_LOOT_COINS,
  HELL_NODE_ID,
} from "./types";

function startOn(mapId: MapId, playerCount = 3, seed = 42): GameState {
  return reduceGame(EMPTY_GAME_STATE, {
    type: "startGame",
    playerNames: Array.from({ length: playerCount }, (_, index) => `J${index + 1}`),
    seed,
    mapId,
  });
}

function withGhostOn(state: GameState, nodeId: number, loot: GhostState["loot"] = { coins: 0, items: [] }): GameState {
  return { ...state, ghost: { nodeId, returnsAtRound: 1, loot, metPlayerIds: [] } };
}

function editPlayer(state: GameState, index: number, changes: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  };
}

/** A duel against the ghost already decided, with the stakes forced. */
function decidedGhostDuel(state: GameState, winnerId: string, stakes: NonNullable<PendingDuel["ghost"]>): GameState {
  const duel = createDuel("p1", GHOST_ID, "coin-flip", "turn-end");
  const ghost = state.ghost && { ...state.ghost, metPlayerIds: ["p1"] };
  return {
    ...state,
    ghost,
    turnStage: "duel",
    pendingDuel: { ...duel, coinWinnerId: winnerId, winnerId, ghost: stakes },
  };
}

const act = (state: GameState, action: GameAction) => reduceGame(state, action);

describe("the Luna Park ghost", () => {
  it("only haunts Luna Park, and waits a round or two before showing up", () => {
    expect(startOn("classic").ghost).toBeNull();
    expect(startOn("banquise").ghost).toBeNull();
    const ghost = startOn("luna-park").ghost;
    expect(ghost?.nodeId).toBeNull();
    expect([2, 3]).toContain(ghost?.returnsAtRound);
  });

  it("appears on a free carousel tile once its round has come", () => {
    const state = startOn("luna-park");
    const due = { ...state, round: state.ghost!.returnsAtRound };
    const appeared = advanceGhost(due);
    expect([1, 2, 3, 4]).toContain(appeared.ghost?.nodeId);
    expect(appeared.lastGhostEvent?.kind).toBe("appear");
    expect(advanceGhost({ ...state, round: 1 }).ghost?.nodeId).toBeNull();
  });

  it("rides one tile on at a time, the way the carousel turns", () => {
    const state = withGhostOn(startOn("luna-park"), 1);
    const next = getNextGhostTile(state, 1);
    const reversed = getNextGhostTile({ ...state, carouselReversed: true }, 1);
    expect([2, 4]).toContain(next);
    expect(reversed).not.toBe(next);
    expect([2, 4]).toContain(reversed);
    expect(getNextGhostTile({ ...state, carouselReversed: true }, next)).toBe(1);

    const moved = advanceGhost(state);
    expect(moved.ghost?.nodeId).toBe(next);
    expect(moved.lastGhostEvent).toMatchObject({ kind: "move", from: 1, to: next });
  });

  it("duels a player it lands on before the tile's wheel", () => {
    let state = withGhostOn(startOn("luna-park"), 3);
    state = editPlayer(state, 1, { position: 3 });
    const settled = settleBoard({ ...state, pendingTileWheels: [{ playerId: "p2", nodeId: 3 }] }, "turn-end");
    expect(settled.turnStage).toBe("duel");
    expect(settled.pendingDuel).toMatchObject({ playerOneId: "p2", playerTwoId: GHOST_ID });
    expect(settled.pendingDuel?.ghost).not.toBeNull();
    expect(settled.pendingTileWheels).toHaveLength(1);
    expect(settled.ghost?.metPlayerIds).toEqual(["p2"]);
  });

  it("only takes what the player has", () => {
    let state = withGhostOn(startOn("luna-park"), 2);
    state = editPlayer(state, 0, { position: 2, currency: 0, inventory: [] });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const duel = startGhostDuel({ ...state, seededRandom: { rngState: attempt, nextId: 0 } }, "p1", "turn-end");
      expect(duel.pendingDuel?.ghost?.penalty).toEqual({ kind: "hell" });
      expect(duel.pendingDuel?.ghost?.reward).toEqual({
        kind: "coins",
        amount: GHOST_EMPTY_LOOT_REWARD,
        fromLoot: false,
      });
    }
  });

  it("keeps the coins it steals as loot", () => {
    let state = withGhostOn(startOn("luna-park"), 2, { coins: 100, items: [] });
    state = editPlayer(state, 0, { position: 2, currency: 1_000 });
    const decided = decidedGhostDuel(state, GHOST_ID, {
      penalty: { kind: "coins", amount: 300 },
      reward: { kind: "coins", amount: 100, fromLoot: true },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: GHOST_ID });
    expect(after.players[0].currency).toBe(700);
    expect(after.ghost?.loot.coins).toBe(400);
    expect(after.ghost?.nodeId).toBe(2);
    expect(after.pendingDuel).toBeNull();
  });

  it("keeps the item it steals as loot, not in the bin", () => {
    let state = withGhostOn(startOn("luna-park"), 2);
    state = editPlayer(state, 0, { position: 2, inventory: [{ id: "boot-1", kind: "item", itemId: "boot" }] });
    const decided = decidedGhostDuel(state, GHOST_ID, {
      penalty: { kind: "item", entryId: "boot-1", itemId: "boot" },
      reward: { kind: "coins", amount: GHOST_EMPTY_LOOT_REWARD, fromLoot: false },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: GHOST_ID });
    expect(after.players[0].inventory).toEqual([]);
    expect(after.ghost?.loot.items).toEqual([{ id: "boot-1", itemId: "boot" }]);
  });

  it("slaps a player off to Hell", () => {
    let state = withGhostOn(startOn("luna-park"), 4);
    state = editPlayer(state, 0, { position: 4 });
    const decided = decidedGhostDuel(state, GHOST_ID, {
      penalty: { kind: "hell" },
      reward: { kind: "coins", amount: GHOST_EMPTY_LOOT_REWARD, fromLoot: false },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: GHOST_ID });
    expect(after.players[0].position).toBe(HELL_NODE_ID);
    expect(after.lastMovement).toMatchObject({ playerId: "p1", from: 4, path: [HELL_NODE_ID], flungByGhost: true });
    expect(after.lastGhostEvent).toMatchObject({ kind: "fling", playerId: "p1" });
  });

  it("pays 300 coins when beaten with an empty loot, then goes away for a while", () => {
    let state = withGhostOn(startOn("luna-park"), 1);
    state = editPlayer(state, 0, { position: 1, currency: 500 });
    const decided = decidedGhostDuel(state, "p1", {
      penalty: { kind: "hell" },
      reward: { kind: "coins", amount: GHOST_EMPTY_LOOT_REWARD, fromLoot: false },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: "p1" });
    expect(after.players[0].currency).toBe(500 + GHOST_EMPTY_LOOT_REWARD);
    expect(after.ghost?.nodeId).toBeNull();
    expect(after.ghost?.returnsAtRound).toBe(state.round + GHOST_COOLDOWN_ROUNDS);
    expect(after.lastGhostEvent?.kind).toBe("vanish");
  });

  it("gives back 200 of the coins it stole, the rest stays for the next winner", () => {
    let state = withGhostOn(startOn("luna-park"), 1, { coins: 600, items: [] });
    state = editPlayer(state, 1, { position: 1, currency: 0 });
    const reward = startGhostDuel(state, "p2", "turn-end").pendingDuel?.ghost?.reward;
    expect(reward).toEqual({ kind: "coins", amount: GHOST_LOOT_COINS, fromLoot: true });

    const decided = decidedGhostDuel(editPlayer(state, 0, { position: 1 }), "p1", {
      penalty: { kind: "hell" },
      reward: { kind: "coins", amount: GHOST_LOOT_COINS, fromLoot: true },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: "p1" });
    expect(after.ghost?.loot.coins).toBe(600 - GHOST_LOOT_COINS);
  });

  it("hands a stolen item to whoever beats it, making room in a full bag", () => {
    let state = withGhostOn(startOn("luna-park"), 1, { coins: 0, items: [{ id: "rope-1", itemId: "rope" }] });
    const fullBag = ["mud", "boot", "helmet", "eraser"].map((itemId, index) => ({
      id: `own-${index}`,
      kind: "item" as const,
      itemId: itemId as "mud",
    }));
    state = editPlayer(state, 0, { position: 1, inventory: fullBag });
    const decided = decidedGhostDuel(state, "p1", {
      penalty: { kind: "hell" },
      reward: { kind: "item", entryId: "rope-1", itemId: "rope" },
    });
    const after = act(decided, { type: "resolveDuel", winnerId: "p1" });
    expect(after.ghost?.loot.items).toEqual([]);
    expect(after.pendingDiscard).toMatchObject({ playerId: "p1", reason: "loot", itemId: "rope" });

    const kept = act(after, { type: "discardInventoryEntry", entryId: "own-0" });
    expect(kept.players[0].inventory.map((entry) => entry.kind === "item" && entry.itemId)).toContain("rope");
    expect(kept.pendingDiscard).toBeNull();
  });

  it("plays its own rock-paper-scissors hand once the player chose", () => {
    let state = withGhostOn(startOn("luna-park"), 1);
    const duel = createDuel("p1", GHOST_ID, "rock-paper-scissors", "turn-end");
    state = {
      ...state,
      turnStage: "duel",
      pendingDuel: {
        ...duel,
        ghost: { penalty: { kind: "hell" }, reward: { kind: "coins", amount: 300, fromLoot: false } },
      },
    };
    const after = act(state, { type: "pickDuelHand", playerId: "p1", choice: "rock" });
    const played = after.pendingDuel?.winnerId !== null || after.pendingDuel?.rpsTies === 1;
    expect(played).toBe(true);
    expect(canPlayerSendAction(state, { type: "pickDuelHand", playerId: GHOST_ID, choice: "rock" }, GHOST_ID)).toBe(
      false,
    );
  });
});

describe("the Basket duel", () => {
  it("joins the other mini-games on every map", () => {
    expect(getDuelModes(false)).toContain("basket");
    expect(getDuelModes(true)).toEqual(
      expect.arrayContaining(["coin-flip", "rock-paper-scissors", "player-vote", "basket"]),
    );
  });

  it("gives the ghost an imperfect round: misses, streaks and a varying score", () => {
    const rounds = Array.from({ length: 300 }, () => drawGhostShots());
    const scores = rounds.map(countBaskets);
    // A flawless round can happen, like for anybody on a lucky day, but only rarely.
    const flawless = rounds.filter((shots) => shots.every((shot) => shot.made)).length;
    expect(flawless).toBeLessThan(rounds.length * 0.03);
    expect(Math.min(...scores)).toBeLessThan(4);
    expect(Math.max(...scores)).toBeGreaterThan(9);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    expect(average).toBeGreaterThan(5);
    expect(average).toBeLessThan(8);
  });

  function basketDuel(playerTwoId = "p2"): GameState {
    const state = startOn("classic", 3);
    return { ...state, turnStage: "duel", pendingDuel: createDuel("p1", playerTwoId, "basket", "turn-end") };
  }

  it("lets each player shoot in turn, then crowns the best score", () => {
    let state = basketDuel();
    expect(act(state, { type: "startBasketRound", playerId: "p2" })).toBe(state);
    state = act(state, { type: "startBasketRound", playerId: "p1" });
    expect(state.pendingDuel?.basket?.shooterId).toBe("p1");
    expect(act(state, { type: "submitBasketScore", playerId: "p2", score: 9 })).toBe(state);
    state = act(state, { type: "submitBasketScore", playerId: "p1", score: 5 });
    expect(state.pendingDuel?.winnerId).toBeNull();
    state = act(state, { type: "startBasketRound", playerId: "p2" });
    state = act(state, { type: "submitBasketScore", playerId: "p2", score: 7 });
    expect(state.pendingDuel?.winnerId).toBe("p2");
    expect(state.pendingDuel?.basket?.scores).toEqual({ p1: 5, p2: 7 });
  });

  it("settles a tie with a coin and never believes an impossible score", () => {
    let state = basketDuel();
    state = act(state, { type: "startBasketRound", playerId: "p1" });
    state = act(state, { type: "submitBasketScore", playerId: "p1", score: 999 });
    expect(state.pendingDuel?.basket?.scores.p1).toBe(BASKET_MAX_SCORE);
    state = act(state, { type: "startBasketRound", playerId: "p2" });
    state = act(state, { type: "submitBasketScore", playerId: "p2", score: BASKET_MAX_SCORE });
    expect(state.pendingDuel?.basket?.tieBroken).toBe(true);
    expect(["p1", "p2"]).toContain(state.pendingDuel?.winnerId);
  });

  it("scores the ghost's drawn shots against the player's", () => {
    let state = withGhostOn(startOn("luna-park"), 1);
    const shots = [
      { atMs: 800, made: true },
      { atMs: 2_000, made: false },
      { atMs: 3_100, made: true },
    ];
    const duel = createDuel("p1", GHOST_ID, "basket", "turn-end");
    state = {
      ...state,
      turnStage: "duel",
      pendingDuel: {
        ...duel,
        basket: { ...duel.basket!, ghostShots: shots },
        ghost: { penalty: { kind: "hell" }, reward: { kind: "coins", amount: 300, fromLoot: false } },
      },
    };
    state = act(state, { type: "startBasketRound", playerId: "p1" });
    const won = act(state, { type: "submitBasketScore", playerId: "p1", score: 3 });
    expect(won.pendingDuel?.basket?.scores).toEqual({ p1: 3, [GHOST_ID]: 2 });
    expect(won.pendingDuel?.winnerId).toBe("p1");
    expect(act(state, { type: "submitBasketScore", playerId: "p1", score: 1 }).pendingDuel?.winnerId).toBe(GHOST_ID);
  });

  it("only takes a player's own round from their own device", () => {
    const state = act(basketDuel(), { type: "startBasketRound", playerId: "p1" });
    const submit: GameAction = { type: "submitBasketScore", playerId: "p1", score: 4 };
    expect(canPlayerSendAction(state, submit, "p1")).toBe(true);
    expect(canPlayerSendAction(state, submit, "p2")).toBe(false);
    expect(canPlayerSendAction(state, { ...submit, playerId: "p3" }, "p3")).toBe(false);
  });
});
