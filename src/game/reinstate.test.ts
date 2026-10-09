import { describe, expect, it } from "vitest";
import { getActionActorIds } from "./action-permissions";
import { reduceGame } from "./game-actions";
import { canReinstatePlayer } from "./reinstate";
import { buildOnlineGame } from "../net/room-protocol";

/** A player the host sent away comes back once the host accepted their request. */

function onlineTable(count = 3) {
  const players = Array.from({ length: count }, (_, index) => ({
    userId: `u${index}`,
    seat: index,
    name: `Joueur ${index + 1}`,
    avatar: index,
    absent: false,
  }));
  return buildOnlineGame(players, 7, "classic", 1_000, "u0").state;
}

function playingTable(count = 3) {
  const second = reduceGame(onlineTable(count), { type: "expireClock" }, { now: 1_000 + 61_000 });
  return reduceGame(second, { type: "expireClock" }, { now: 1_000 + 61_000 + 61_000 });
}

describe("reinstating a kicked player", () => {
  it("brings back, last at the table, a player kicked from a game under way, with what they held", () => {
    const state = playingTable();
    const kicked = reduceGame(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" });
    const before = kicked.abandonedPlayers[0];
    expect(canReinstatePlayer(kicked, "p2")).toBe(true);

    const back = reduceGame(kicked, { type: "reinstatePlayer", playerId: "p2" });
    expect(back.players.map((player) => player.id)).toEqual(["p1", "p3", "p2"]);
    expect(back.abandonedPlayers).toEqual([]);
    expect(back.players[2]).toMatchObject({ currency: before.currency, passiveId: before.passiveId });
    expect(back.players[back.activePlayerIndex].id).toBe(kicked.players[kicked.activePlayerIndex].id);
  });

  it("is sent by the player themselves, and only for somebody who was sent away", () => {
    const state = playingTable();
    const kicked = reduceGame(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" });
    expect(getActionActorIds(kicked, { type: "reinstatePlayer", playerId: "p2" })).toEqual(["p2"]);
    expect(getActionActorIds(kicked, { type: "reinstatePlayer", playerId: "p3" })).toEqual([]);
    expect(reduceGame(kicked, { type: "reinstatePlayer", playerId: "p3" })).toBe(kicked);
  });

  it("waits for the table to be at rest", () => {
    const state = playingTable();
    const kicked = reduceGame(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" });
    expect(canReinstatePlayer({ ...kicked, turnStage: "wheel-result" }, "p2")).toBe(false);
  });

  it("sits a player kicked during the draft down again with fresh offers", () => {
    const draft = onlineTable();
    const kicked = reduceGame(draft, { type: "kickPlayer", hostId: "p1", playerId: "p2" });
    expect(kicked.players.map((player) => player.id)).toEqual(["p1", "p3"]);
    const back = reduceGame(kicked, { type: "reinstatePlayer", playerId: "p2" });
    expect(back.players.map((player) => player.id)).toEqual(["p1", "p3", "p2"]);
    expect(back.draft?.offers.p2?.length).toBeGreaterThan(0);
  });
});
