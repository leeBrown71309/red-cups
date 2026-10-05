import { describe, expect, it } from "vitest";
import { getActionActorIds } from "./action-permissions";
import { CARD_KINDS } from "./cards";
import { reduceGame, type GameAction } from "./game-actions";
import { buildOnlineGame } from "../net/room-protocol";
import { PLAYER_COLORS } from "./types";

/** Sitting down after the kickoff (patch 0.1.5). */

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

const joinAction = (index: number): GameAction => ({
  type: "joinLatePlayer",
  playerId: `p${index + 1}`,
  name: "Tom",
  color: PLAYER_COLORS[index],
});

describe("joining late", () => {
  it("deals the newcomer cards nobody else holds during the draft", () => {
    const state = onlineTable();
    expect(state.phase).toBe("draft");
    const next = reduceGame(state, joinAction(3), { now: 2_000 });
    expect(next.players.map((player) => player.id)).toEqual(["p1", "p2", "p3", "p4"]);
    const offer = next.draft!.offers.p4;
    const others = Object.entries(next.draft!.offers)
      .filter(([id]) => id !== "p4")
      .flatMap(([, cards]) => cards);
    expect(offer.length).toBeGreaterThan(0);
    expect(offer.some((card) => others.includes(card))).toBe(false);
  });

  it("gives a free passive, never a public role, once the game runs", () => {
    let state = onlineTable();
    state = reduceGame(state, { type: "expireClock" }, { now: 1_000 + 61_000 });
    state = reduceGame(state, { type: "expireClock" }, { now: 1_000 + 61_000 + 61_000 });
    expect(state.phase).toBe("playing");
    const next = reduceGame(state, joinAction(3), { now: 70_000 });
    const newcomer = next.players[3];
    expect(["devil", "guardian-angel"]).not.toContain(newcomer.passiveId);
    expect(CARD_KINDS[newcomer.passiveId]).toBe("actif");
    expect(newcomer.passifId && CARD_KINDS[newcomer.passifId]).toBe("passif");
    expect(state.players.map((player) => player.passiveId)).not.toContain(newcomer.passiveId);
    expect(newcomer.position).toBe(0);
  });

  it("only lets the newcomer's own seat send it, and not after the first round", () => {
    const state = onlineTable();
    expect(getActionActorIds(state, joinAction(3))).toEqual(["p4"]);
    expect(reduceGame({ ...state, round: 2 }, joinAction(3))).toEqual({ ...state, round: 2 });
    expect(getActionActorIds({ ...state, round: 2 }, joinAction(3))).toEqual([]);
  });

  it("refuses a ninth player and a seat already taken", () => {
    const full = onlineTable(8);
    expect(reduceGame(full, joinAction(8))).toBe(full);
    const state = onlineTable();
    expect(reduceGame(state, joinAction(1))).toBe(state);
  });
});
