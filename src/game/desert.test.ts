import { describe, expect, it } from "vitest";
import { canDrinkAtWell, drawCupPair, drinkAtWell, getKnownRealCup, planCaravanRide, settleDesert } from "./desert";
import { getNeighbors, resolveBoard } from "./board";
import { getEnergyCapacity } from "./energy";
import { reduceGame } from "./game-actions";
import { getBoardMap, getPlayableMapIds } from "./maps/map-registry";
import { canTargetPlayer } from "./passive-rules";
import { getTurnMoveOptions } from "./rules";
import { getClosedPasses, getFloodedNodeIds, getRoundsUntilStorm, getStormPhase } from "./tide";
import type { GameState, NodeId } from "./types";
import { EMPTY_GAME_STATE, HELL_NODE_ID, THIRST_ENERGY, WELL_PRICE } from "./types";

/**
 * Le Désert des Mirages. Tile numbers of the map: the start is 0, the oases 3 · 9 · 16 · 22, the wells 27 and 33, the
 * passes 37 to 40 (37 joins 5 and 26, 38 joins 12 and 29, 39 joins 18 and 32, 40 joins 24 and 35), Hell 11.
 */

const map = getBoardMap("desert");
const desert = map.desert!;

/** A table where nobody holds a card that changes the rules the test is about (Lambda is no card at all). */
function startDesert(players = 6, seed = 5): GameState {
  const started = reduceGame(EMPTY_GAME_STATE, {
    type: "startGame",
    playerNames: Array.from({ length: players }, (_, index) => `Joueur ${index + 1}`),
    seed,
    mapId: "desert",
  });
  return {
    ...started,
    guardian: null,
    players: started.players.map((player) => ({ ...player, passiveId: "lambda", passifId: null, currency: 2_000 })),
    energyLeft: 3,
  };
}

function place(state: GameState, positions: Record<number, NodeId>): GameState {
  return {
    ...state,
    players: state.players.map((player, index) =>
      positions[index] === undefined ? player : { ...player, position: positions[index] },
    ),
  };
}

describe("the map", () => {
  it("has 41 tiles, Hell on 11, four oases, two wells and four passes", () => {
    expect(map.nodes).toHaveLength(41);
    expect(map.nodes.find((node) => node.id === HELL_NODE_ID)?.kind).toBe("hell");
    expect(desert.oases).toEqual([3, 9, 16, 22]);
    expect(desert.wells).toEqual([27, 33]);
    expect(desert.passes.map((pass) => pass.node)).toEqual([37, 38, 39, 40]);
    expect(map.minPlayers).toBe(6);
    expect(getPlayableMapIds(5)).not.toContain("desert");
    expect(getPlayableMapIds(6)).toContain("desert");
  });

  it("sends everybody on clockwise from an oasis, and pays the lap through the last tile's arrow", () => {
    const board = resolveBoard("desert");
    for (const oasis of desert.oases) {
      const next = desert.outerLoop[(desert.outerLoop.indexOf(oasis) + 1) % desert.outerLoop.length];
      expect(getNeighbors(board, oasis)).toEqual([next]);
    }
    const last = desert.outerLoop[desert.outerLoop.length - 1];
    expect(getNeighbors(board, last)).toEqual([0]);
  });

  it("shuts two passes at a time, the other two in the next phase", () => {
    expect(getClosedPasses(map, 1)).toHaveLength(2);
    expect(getClosedPasses(map, 5)).toHaveLength(2);
    expect(getClosedPasses(map, 1)).not.toEqual(getClosedPasses(map, 5));
    expect(getStormPhase(4)).toBe(0);
    expect(getStormPhase(5)).toBe(1);
    expect([1, 2, 3, 4, 5].map(getRoundsUntilStorm)).toEqual([4, 3, 2, 1, 4]);
    expect(getFloodedNodeIds(map, 1)).toEqual(getClosedPasses(map, 1));
  });
});

describe("the pair of Cups", () => {
  it("opens with a real Cup and a mirage on two different ordinary tiles", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = startDesert(6, seed);
      expect(state.redCupNodeId).not.toBeNull();
      expect(state.mirageNodeId).not.toBeNull();
      expect(state.redCupNodeId).not.toBe(state.mirageNodeId);
      for (const cup of [state.redCupNodeId, state.mirageNodeId]) {
        const kind = map.nodes.find((node) => node.id === cup)?.kind;
        expect(["oasis", "well", "pass", "hell", "start"]).not.toContain(kind);
      }
      expect(state.log.at(-1)?.text).not.toContain(String(state.redCupNodeId));
    }
  });

  it("never draws a new pair on a tile of the old one", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const state = startDesert(6, seed);
      const old = [state.redCupNodeId as NodeId, state.mirageNodeId as NodeId];
      const next = drawCupPair(state, old, null);
      expect(old).not.toContain(next.real);
      expect(old).not.toContain(next.mirage);
      expect(next.real).not.toBe(next.mirage);
    }
  });

  it("dissipates when the mirage is reached: both Cups move, the player goes thirsty, nothing is lost", () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = startDesert(6, seed);
      const mirage = state.mirageNodeId as NodeId;
      const neighbor = getNeighbors(resolveBoard("desert"), mirage, true).find(
        (tile) => tile !== HELL_NODE_ID,
      ) as NodeId;
      const standing = place(state, { 0: neighbor });
      const walked = reduceGame(standing, { type: "movePlayer", destination: mirage, ignoreArrows: false });
      if (walked === standing || walked.cupPairId !== standing.cupPairId + 1) continue;
      checked += 1;
      expect([walked.redCupNodeId, walked.mirageNodeId]).not.toContain(state.redCupNodeId);
      expect([walked.redCupNodeId, walked.mirageNodeId]).not.toContain(mirage);
      expect(walked.thirstyIds).toContain("p1");
      expect(walked.players[0].currency).toBe(standing.players[0].currency);
      expect(walked.players[0].inventory.some((entry) => entry.kind === "red-cup")).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("takes the real Cup, and draws a fresh pair too", () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = startDesert(6, seed);
      const real = state.redCupNodeId as NodeId;
      const neighbor = getNeighbors(resolveBoard("desert"), real, true).find((tile) => tile !== HELL_NODE_ID) as NodeId;
      const standing = place(state, { 0: neighbor });
      const walked = reduceGame(standing, { type: "movePlayer", destination: real, ignoreArrows: false });
      if (walked === standing || walked.cupPairId !== standing.cupPairId + 1) continue;
      checked += 1;
      expect(walked.players[0].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
      expect([walked.redCupNodeId, walked.mirageNodeId]).not.toContain(real);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the thirst", () => {
  it("takes a point of energy from the next turn, and never goes below one", () => {
    const state = startDesert();
    const thirsty = { ...state, thirstyIds: ["p1"] };
    expect(getEnergyCapacity(state.players[0], thirsty)).toBe(
      getEnergyCapacity(state.players[0], state) - THIRST_ENERGY,
    );
    expect(getEnergyCapacity(state.players[0], thirsty)).toBeGreaterThanOrEqual(1);
  });
});

describe("the wells", () => {
  it("sell the knowledge once for each pair, to the player who pays", () => {
    let state = place(startDesert(), { 0: 27 });
    expect(canDrinkAtWell(state)).toBe(true);
    state = drinkAtWell(state);
    expect(state.players[0].currency).toBe(2_000 - WELL_PRICE);
    expect(getKnownRealCup(state, "p1")).toBe(state.redCupNodeId);
    expect(getKnownRealCup(state, "p2")).toBeNull();
    // The journal says that they drank, and nothing else.
    expect(state.log[0].text).toBe("Joueur 1 puise au puits.");
    expect(canDrinkAtWell(state)).toBe(false);
  });

  it("are forgotten once the pair changes", () => {
    const state = drinkAtWell(place(startDesert(), { 0: 27 }));
    expect(getKnownRealCup({ ...state, cupPairId: state.cupPairId + 1 }, "p1")).toBeNull();
  });

  it("need the coins", () => {
    const state = place(startDesert(), { 0: 27 });
    const poor = {
      ...state,
      players: state.players.map((player, index) => (index === 0 ? { ...player, currency: 100 } : player)),
    };
    expect(canDrinkAtWell(poor)).toBe(false);
  });
});

describe("the oases", () => {
  it("hold one traveller, out of reach of every item", () => {
    const state = place(startDesert(), { 0: 3, 1: 4 });
    const ends = (current: GameState) =>
      getTurnMoveOptions(current, current.players[1]).map((path) => path[path.length - 1]);
    // Entering the oasis against its arrow is allowed when nobody holds it, and refused when somebody does.
    expect(ends({ ...place(startDesert(), { 1: 4 }), activePlayerIndex: 1 })).toContain(3);
    expect(ends({ ...state, activePlayerIndex: 1 })).not.toContain(3);
    expect(canTargetPlayer(state, state.players[1], state.players[0])).toBe(false);
    expect(canTargetPlayer(state, state.players[0], state.players[1])).toBe(true);
  });

  it("give a point of energy at the next turn, and push a second arrival back where it came from", () => {
    const resting = place(startDesert(), { 0: 3 });
    const plain = startDesert();
    expect(getEnergyCapacity(resting.players[0], resting)).toBe(getEnergyCapacity(plain.players[0], plain) + 1);
    const before = place(startDesert(), { 0: 3, 1: 4 });
    const settled = settleDesert(before, place(before, { 1: 3 }));
    expect(settled.players[1].position).toBe(4);
    expect(settled.players[0].position).toBe(3);
  });
});

describe("the sandstorm and the caravan", () => {
  it("drops a player off a pass that shuts, on the caravan's loop", () => {
    const shut = getClosedPasses(map, 5).filter((node) => !getClosedPasses(map, 4).includes(node))[0];
    const pass = desert.passes.find((candidate) => candidate.node === shut)!;
    const state: GameState = {
      ...place(startDesert(), { 5: pass.node }),
      round: 4,
      activePlayerIndex: 5,
      turnStage: "turn-end",
    };
    const next = reduceGame(state, { type: "endTurn" });
    expect(next.round).toBe(5);
    expect(next.players[5].position).toBe(pass.outer);
    expect(next.lastDesertEvents.map((event) => event.kind)).toEqual(expect.arrayContaining(["storm", "storm-drop"]));
  });

  it("walks two tiles on at every new round", () => {
    let state = startDesert();
    const start = state.caravanNodeId as NodeId;
    for (let seat = 0; seat < 6; seat += 1)
      state = reduceGame({ ...state, turnStage: "turn-end" }, { type: "endTurn" });
    const at = desert.outerLoop.indexOf(start);
    expect(state.caravanNodeId).toBe(desert.outerLoop[(at + 2) % desert.outerLoop.length]);
  });

  it("takes a rider four tiles along, in place of the walk, with no bonus for the start", () => {
    const state = startDesert();
    const caravan = state.caravanNodeId as NodeId;
    const riding = place(state, { 0: caravan });
    const destination = planCaravanRide(riding);
    expect(destination).toBe(desert.outerLoop[(desert.outerLoop.indexOf(caravan) + 4) % desert.outerLoop.length]);
    const rode = reduceGame(riding, { type: "boardCaravan" });
    expect(rode.players[0].position).toBe(destination);
    expect(rode.lastMovement).toMatchObject({ caravan: true, from: caravan });
    expect(rode.energyLeft).toBe(0);
    expect(planCaravanRide(state)).toBeNull();
  });
});
