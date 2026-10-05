import { describe, expect, it } from "vitest";
import { getActionActorIds } from "./action-permissions";
import { reduceGame } from "./game-actions";
import { canKickPlayer } from "./kick";
import { buildOnlineGame } from "../net/room-protocol";

/** The host sends a player away (patch 0.1.5). */

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
  return reduceGame(onlineTable(count), { type: "expireClock" }, { now: 1_000 + 61_000 });
}

describe("kicking a player", () => {
  it("is the host's alone, and never of themselves", () => {
    const state = playingTable();
    expect(canKickPlayer(state, "p1", "p2")).toBe(true);
    expect(canKickPlayer(state, "p2", "p3")).toBe(false);
    expect(canKickPlayer(state, "p1", "p1")).toBe(false);
    expect(getActionActorIds(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" })).toEqual(["p1"]);
    expect(getActionActorIds(state, { type: "kickPlayer", hostId: "p2", playerId: "p3" })).toEqual([]);
  });

  it("removes the player from a game under way, like somebody who left", () => {
    const state = playingTable();
    const next = reduceGame(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" });
    expect(next.players.map((player) => player.id)).toEqual(["p1", "p3"]);
    expect(next.abandonedPlayers.map((player) => player.id)).toEqual(["p2"]);
    expect(next.log[0].text).toContain("exclu");
  });

  it("waits for the table to be at rest", () => {
    const busy = { ...playingTable(), turnStage: "duel" as const };
    expect(canKickPlayer(busy, "p1", "p2")).toBe(false);
    expect(reduceGame(busy, { type: "kickPlayer", hostId: "p1", playerId: "p2" })).toBe(busy);
  });

  it("empties a seat during the draft, and closes the draft when the rest had picked", () => {
    const draft = onlineTable();
    expect(draft.phase).toBe("draft");
    const [firstCard] = draft.draft!.offers.p1;
    const [secondCard] = draft.draft!.offers.p3;
    let state = reduceGame(draft, { type: "pickPassive", playerId: "p1", passiveId: firstCard }, { now: 2_000 });
    state = reduceGame(state, { type: "pickPassive", playerId: "p3", passiveId: secondCard }, { now: 2_000 });
    expect(state.phase).toBe("draft");
    const next = reduceGame(state, { type: "kickPlayer", hostId: "p1", playerId: "p2" }, { now: 3_000 });
    expect(next.players.map((player) => player.id)).toEqual(["p1", "p3"]);
    expect(next.phase).toBe("playing");
  });
});
