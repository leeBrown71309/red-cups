import { describe, expect, it } from "vitest";
import { planFerryRide, settleArchipel } from "./archipel";
import { getNeighbors, getShortestPath, resolveBoard } from "./board";
import { reduceGame } from "./game-actions";
import { getBoardMap, getPlayableMapIds, resolveMapChoice } from "./maps/map-registry";
import { getTurnMoveOptions } from "./rules";
import { getFloodedNodeIds, getNextFerryQuay, getRoundsUntilTideTurns, getTideLevel } from "./tide";
import type { GameState, NodeId } from "./types";
import { EMPTY_GAME_STATE, HELL_NODE_ID, QUAY_HOLDER_REWARD, START_BONUS, START_NODE_ID } from "./types";

/**
 * L'Archipel des Marées: the tide, the ferry, the quays, the whirlpools. The tile numbers are those of the map:
 * Port 0-5 (start 0, quay 1), Perles 6-10 and 12 (quay 6, shop 10), Phare 13-18 (quay 13), Épaves 19-24, Corail 25-30,
 * causeways 31-40 (31-32 the dyke, 33-34 and 37-38 open at low tide, 35-36 and 39-40 at high tide), Hell 11.
 */

const map = getBoardMap("archipel");
const QUAYS = map.tidal?.ferryQuays ?? [];

/** A table where nobody holds a card that changes the rules the test is about (Lambda is no card at all). */
function startArchipel(players = 6, seed = 5): GameState {
  const started = reduceGame(EMPTY_GAME_STATE, {
    type: "startGame",
    playerNames: Array.from({ length: players }, (_, index) => `Joueur ${index + 1}`),
    seed,
    mapId: "archipel",
  });
  return {
    ...started,
    guardian: null,
    players: started.players.map((player) => ({ ...player, passiveId: "lambda", passifId: null, currency: 2_000 })),
    energyLeft: 3,
  };
}

/** The state with the players on the given tiles, by seat. */
function place(state: GameState, positions: Record<number, NodeId>): GameState {
  return {
    ...state,
    players: state.players.map((player, index) =>
      positions[index] === undefined ? player : { ...player, position: positions[index] },
    ),
  };
}

describe("the tide", () => {
  it("turns every two rounds, low tide first", () => {
    expect([1, 2, 3, 4, 5, 6].map(getTideLevel)).toEqual(["low", "low", "high", "high", "low", "low"]);
    expect([1, 2, 3, 4].map(getRoundsUntilTideTurns)).toEqual([2, 1, 2, 1]);
  });

  it("drowns the high-tide causeways at low tide and the low-tide ones at high tide, never the dyke", () => {
    expect(getFloodedNodeIds(map, 1)).toEqual([35, 36, 39, 40]);
    expect(getFloodedNodeIds(map, 3)).toEqual([33, 34, 37, 38]);
    expect(getFloodedNodeIds(map, 1)).not.toContain(31);
    expect(getFloodedNodeIds(map, 3)).not.toContain(32);
  });

  it("never closes both causeways of an island", () => {
    const tidal = map.tidal!;
    for (const round of [1, 3]) {
      const flooded = new Set(getFloodedNodeIds(map, round));
      for (const tiles of tidal.islands) {
        const exits = tidal.causeways.filter((causeway) => {
          const first = causeway.nodes[0];
          const touches = map.edges.some(
            (edge) =>
              (tiles.includes(edge.from) && edge.to === first) || (tiles.includes(edge.to) && edge.from === first),
          );
          const last = causeway.nodes[1];
          const touchesEnd = map.edges.some(
            (edge) =>
              (tiles.includes(edge.from) && edge.to === last) || (tiles.includes(edge.to) && edge.from === last),
          );
          return (touches || touchesEnd) && !flooded.has(first);
        });
        expect(exits.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("closes the roads onto a drowned causeway, for every walker", () => {
    const high = resolveBoard("archipel", false, null, [], getFloodedNodeIds(map, 3));
    expect(getNeighbors(high, 8)).not.toContain(33);
    expect(getNeighbors(high, 8, true)).not.toContain(33);
    // Perles and Phare are only joined by the causeway the tide has drowned, and no other road leads round in time.
    expect(getShortestPath(high, 8, 13, true)).toBeNull();
    const low = resolveBoard("archipel", false, null, [], getFloodedNodeIds(map, 1));
    expect(getNeighbors(low, 8)).toContain(33);
    expect(getShortestPath(low, 8, 13, true)).not.toBeNull();
  });

  it("drops a player the water finds on a causeway onto the quay it led to, when the round turns", () => {
    let state = startArchipel();
    // The last player of round 2, standing on a causeway that is open at low tide only.
    state = { ...place(state, { 5: 33 }), round: 2, activePlayerIndex: 5, turnStage: "turn-end" };
    const next = reduceGame(state, { type: "endTurn" });
    expect(next.round).toBe(3);
    expect(next.players[5].position).toBe(13);
    expect(next.lastArchipelEvents.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["tide", "ferry-moved", "flood-drop"]),
    );
  });

  it("sets the dropped player on the island's inner tile when the quay is held", () => {
    let state = startArchipel();
    state = { ...place(state, { 5: 33, 0: 13 }), round: 2, activePlayerIndex: 5, turnStage: "turn-end" };
    const next = reduceGame(state, { type: "endTurn" });
    expect(next.players[5].position).toBe(14);
    expect(next.players[0].position).toBe(13);
  });
});

describe("the ferry", () => {
  it("moors at the next quay at every new round, round and round", () => {
    expect(QUAYS).toEqual([1, 6, 13, 19, 25]);
    expect(getNextFerryQuay(map, 25)).toBe(1);
    let state = startArchipel(6);
    expect(state.ferryQuayId).toBe(1);
    for (let round = 1; round <= 6; round += 1) {
      for (let seat = 0; seat < 6; seat += 1) {
        state = reduceGame({ ...state, turnStage: "turn-end" }, { type: "endTurn" });
      }
    }
    expect(state.round).toBe(7);
    // Six rounds on, the circuit of five quays is one quay further.
    expect(state.ferryQuayId).toBe(6);
  });

  it("takes a player on its quay to the next one in place of the walk, and ends their turn", () => {
    let state = startArchipel();
    state = place(state, { 0: 1 });
    expect(planFerryRide(state)).toBe(6);
    const crossed = reduceGame(state, { type: "boardFerry" });
    expect(crossed.players[0].position).toBe(6);
    expect(crossed.lastMovement).toMatchObject({ ferry: true, from: 1, path: [6] });
    expect(crossed.turnStage).toBe("turn-end");
    expect(crossed.energyLeft).toBe(0);
    // The ferry stays moored until the next round; nothing paid for the Départ it passed by.
    expect(crossed.ferryQuayId).toBe(1);
    expect(crossed.players[0].currency).toBe(state.players[0].currency);
  });

  it("refuses the crossing away from its quay, or when the next quay is held", () => {
    const state = startArchipel();
    expect(planFerryRide(state)).toBeNull();
    const held = place(state, { 0: 1, 1: 6 });
    expect(planFerryRide(held)).toBeNull();
    expect(reduceGame(held, { type: "boardFerry" })).toBe(held);
  });
});

describe("the quays", () => {
  it("do not let a walk end on a quay somebody holds", () => {
    const state = place(startArchipel(), { 0: 7, 1: 6 });
    const ends = (current: GameState) =>
      getTurnMoveOptions(current, current.players[0]).map((path) => path[path.length - 1]);
    expect(ends(place(state, { 1: 9 }))).toContain(6);
    expect(ends(state)).not.toContain(6);
    const walks = reduceGame(state, { type: "movePlayer", destination: 6, ignoreArrows: false });
    expect(walks.players[0].position).toBe(7);
  });

  it("push a second player back where they came from and pay the one who holds the quay", () => {
    const before = place(startArchipel(), { 1: 6 });
    const crowded = place(before, { 0: 6 });
    const settled = settleArchipel(place(before, { 0: 7 }), crowded);
    expect(settled.players[0].position).toBe(7);
    expect(settled.players[1].position).toBe(6);
    expect(settled.players[1].currency).toBe(before.players[1].currency + QUAY_HOLDER_REWARD);
    expect(settled.lastArchipelEvents.at(-1)).toMatchObject({ kind: "quay-bump", quayId: 6, holderId: "p2" });
  });
});

describe("the whirlpools", () => {
  it("draw whoever arrives to the quay of another island", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const before = startArchipel(6, seed);
      const after = place(before, { 0: 9 });
      const settled = settleArchipel(before, after);
      const landing = settled.players[0].position;
      expect(QUAYS.filter((quay) => quay !== 6)).toContain(landing);
      expect(settled.lastArchipelEvents.at(-1)).toMatchObject({ kind: "whirlpool", from: 9, to: landing });
    }
  });
});

describe("the Red Cup", () => {
  it("comes back on another island, never on a quay, a causeway or a whirlpool", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let state = startArchipel(6, seed);
      // The first Cup waits on tile 10, the shop of the Perles; the player on tile 12 is a step away.
      state = place(state, { 0: 12 });
      const taken = reduceGame(state, { type: "movePlayer", destination: 10, ignoreArrows: false });
      expect(taken.redCupNodeId).not.toBeNull();
      const cupNodeId = taken.redCupNodeId as NodeId;
      const kind = map.nodes.find((node) => node.id === cupNodeId)?.kind;
      expect(["quay", "causeway", "whirlpool", "hell", "start"]).not.toContain(kind);
      const islandOf = (nodeId: NodeId) => map.tidal!.islands.findIndex((tiles) => tiles.includes(nodeId));
      expect(islandOf(cupNodeId)).not.toBe(islandOf(10));
    }
  });
});

describe("the table", () => {
  it("needs six players", () => {
    expect(map.minPlayers).toBe(6);
    expect(startArchipel(5).phase).toBe("setup");
    expect(startArchipel(6).phase).toBe("playing");
    expect(startArchipel(8).phase).toBe("playing");
  });

  it("is drawn by a random pick only for a table that is big enough", () => {
    expect(getPlayableMapIds(5)).not.toContain("archipel");
    expect(getPlayableMapIds(6)).toContain("archipel");
    expect(resolveMapChoice("random", () => 0.999, 4)).not.toBe("archipel");
    // The draw only picks among the maps a table of that size may play (the last of them for a roll near 1).
    expect(getPlayableMapIds(7)).toContain(resolveMapChoice("random", () => 0.999, 7));
    expect(resolveMapChoice("random", () => 0, 7)).toBe(getPlayableMapIds(7)[0]);
  });

  it("keeps Hell on tile 11 and the start on tile 0, like every map", () => {
    expect(map.nodes.find((node) => node.id === HELL_NODE_ID)?.kind).toBe("hell");
    expect(map.nodes.find((node) => node.id === START_NODE_ID)?.kind).toBe("start");
    expect(map.nodes).toHaveLength(41);
  });

  it("pays the start bonus when the Port's quay leads onto the start", () => {
    const state = place(startArchipel(), { 0: 1 });
    const moved = reduceGame(state, { type: "movePlayer", destination: START_NODE_ID, ignoreArrows: false });
    expect(moved.players[0].currency).toBe(state.players[0].currency + START_BONUS);
  });

  it("keeps its tiles far enough apart to stand on", () => {
    let closest = Number.POSITIVE_INFINITY;
    for (const a of map.nodes) {
      for (const b of map.nodes.filter((other) => other.id > a.id)) {
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    expect(closest).toBeGreaterThan(2.5);
  });
});
