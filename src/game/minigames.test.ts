import { afterEach, describe, expect, it, vi } from "vitest";
import { canPlayerSendAction } from "./action-permissions";
import { getHandValue } from "./blackjack";
import { createDuel } from "./duel-setup";
import { withPassives } from "./forced-passives";
import { useGameStore } from "./store";
import type { PassiveId, Player, PlayingCard } from "./types";
import { GHOST_ID, HELL_NODE_ID } from "./types";

/** The mini-games of patch 0.1.4: Blackjack duels and Baraqué's arm wrestle (classic board). */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, passives));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();
const playerId = (index: number) => store().players[index].id;
const card = (rank: number): PlayingCard => ({ rank, suit: 0 });

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

/** A Blackjack duel in Hell with hands and a deck chosen by the test. */
function blackjackDuel(hands: [number[], number[]], deck: number[], secondId?: string): void {
  const first = playerId(0);
  const second = secondId ?? playerId(1);
  const duel = createDuel(first, second, "blackjack", "turn-end");
  editPlayer(0, { position: HELL_NODE_ID });
  editPlayer(1, { position: HELL_NODE_ID });
  useGameStore.setState({
    turnStage: "duel",
    pendingDuel: {
      ...duel,
      blackjack: {
        deck: deck.map(card),
        hands: { [first]: hands[0].map(card), [second]: hands[1].map(card) },
        turnId: first,
        tieBroken: false,
      },
    },
  });
}

describe("Blackjack", () => {
  it("counts aces as 11 or 1, faces as 10", () => {
    expect(getHandValue([card(1), card(13)])).toBe(21);
    expect(getHandValue([card(1), card(1), card(9)])).toBe(21);
    expect(getHandValue([card(13), card(12), card(5)])).toBe(25);
  });

  it("plays each hand in turn: the closer to 21 without going over wins", () => {
    startTable(["lambda", "lambda"]);
    blackjackDuel(
      [
        [10, 6],
        [10, 7],
      ],
      [4, 9],
    );
    // Only the duellist whose turn it is may draw.
    expect(canPlayerSendAction(store(), { type: "blackjackHit", playerId: playerId(1) }, playerId(1))).toBe(false);
    store().blackjackHit(playerId(0));
    expect(getHandValue(store().pendingDuel!.blackjack!.hands[playerId(0)]!)).toBe(20);
    store().blackjackStand(playerId(0));
    expect(store().pendingDuel?.blackjack?.turnId).toBe(playerId(1));
    // 17 + 9: over 21.
    store().blackjackHit(playerId(1));
    expect(store().pendingDuel?.winnerId).toBe(playerId(0));
  });

  it("settles equal hands with a coin", () => {
    startTable(["lambda", "lambda"]);
    blackjackDuel(
      [
        [10, 8],
        [9, 9],
      ],
      [],
    );
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    store().blackjackStand(playerId(0));
    store().blackjackStand(playerId(1));
    expect(store().pendingDuel).toMatchObject({ winnerId: playerId(1), blackjack: { tieBroken: true } });
  });

  it("lets the ghost play as a dealer: it draws below 17", () => {
    startTable(["lambda", "lambda"]);
    blackjackDuel(
      [
        [10, 9],
        [10, 2],
      ],
      [3, 2, 10],
      GHOST_ID,
    );
    store().blackjackStand(playerId(0));
    const ghostHand = store().pendingDuel!.blackjack!.hands[GHOST_ID]!;
    // 12, then 15, then 17: it stops there, and 19 beats it.
    expect(getHandValue(ghostHand)).toBe(17);
    expect(store().pendingDuel?.winnerId).toBe(playerId(0));
  });
});

describe("arm wrestle", () => {
  function monopolyOnTank(attackerTile: number, tankTile: number): void {
    startTable(["lambda", "built-like-a-tank"]);
    editPlayer(0, { position: attackerTile, inventory: [{ id: "monopoly", kind: "item", itemId: "monopoly-man" }] });
    editPlayer(1, { position: tankTile });
    store().useItem("monopoly", playerId(1));
  }

  it("opens when the Monopoly Man aims at Baraqué, and the stronger pull wins", () => {
    monopolyOnTank(2, 9);
    expect(store().turnStage).toBe("arm-wrestle");
    expect(canPlayerSendAction(store(), { type: "submitArmTaps", playerId: playerId(0), taps: 3 }, playerId(1))).toBe(
      false,
    );
    store().submitArmTaps(playerId(0), 60);
    store().submitArmTaps(playerId(1), 40);
    expect(store().players.map((player) => player.position)).toEqual([9, 2]);
    expect(store()).toMatchObject({ turnStage: "move", pendingArmWrestle: null });
  });

  it("counts Baraqué's taps 1.2 times: no swap when they pull harder", () => {
    monopolyOnTank(2, 9);
    store().submitArmTaps(playerId(0), 50);
    store().submitArmTaps(playerId(1), 42);
    expect(store().players.map((player) => player.position)).toEqual([2, 9]);
  });

  it("on a draw, the attacker steps closer and Baraqué steps back (Q20)", () => {
    // 0 → 4 → 9: one tile between them.
    monopolyOnTank(0, 9);
    store().submitArmTaps(playerId(0), 60);
    store().submitArmTaps(playerId(1), 50);
    const [attacker, tank] = store().players;
    expect(attacker.position).toBe(4);
    expect(tank.position).toBe(5);
  });

  it("on a draw side by side, only Baraqué steps back", () => {
    monopolyOnTank(0, 2);
    store().submitArmTaps(playerId(0), 60);
    store().submitArmTaps(playerId(1), 50);
    expect(store().players.map((player) => player.position)).toEqual([0, 5]);
  });
});
