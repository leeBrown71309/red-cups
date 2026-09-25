import { describe, expect, it } from "vitest";
import { WHEEL_RESULTS } from "../../game/catalog";
import { EMPTY_GAME_STATE, type GameState, type Player, type WheelId } from "../../game/types";
import { HOP_MS, TUNNEL_EXTRA_MS, estimateMovementMs } from "../../theme/timing";
import { getWheelSegments } from "./game-display";
import { getItemAvailability, getPurchaseStatus } from "./item-availability";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Ada",
    color: "#f16a53",
    position: 0,
    currency: 2_000,
    inventory: [],
    passiveId: "built-like-a-tank",
    skippedTurns: 0,
    hellTurns: 0,
    noThanksUsedCycle: -1,
    ...overrides,
  };
}

function makeState(player: Player, overrides: Partial<GameState> = {}): GameState {
  return { ...EMPTY_GAME_STATE, phase: "playing", turnStage: "move", players: [player], ...overrides };
}

describe("wheel segments", () => {
  it.each<WheelId>(["misfortune", "fortune", "hell"])("gives every %s outcome one wedge per weight", (wheelId) => {
    const segments = getWheelSegments(wheelId);
    const totalWeight = WHEEL_RESULTS[wheelId].reduce((sum, result) => sum + result.weight, 0);
    expect(segments).toHaveLength(totalWeight);

    for (const result of WHEEL_RESULTS[wheelId]) {
      expect(segments.filter((segment) => segment.outcomeId === result.id)).toHaveLength(result.weight);
    }
  });

  it.each<WheelId>(["misfortune", "fortune", "hell"])("never puts two identical %s wedges side by side", (wheelId) => {
    const segments = getWheelSegments(wheelId);
    segments.forEach((segment, index) => {
      const next = segments[(index + 1) % segments.length];
      expect(next.outcomeId === segment.outcomeId && next.color === segment.color).toBe(false);
    });
  });
});

describe("movement timing", () => {
  it("adds the tunnel detour to the hop animation", () => {
    expect(estimateMovementMs(4, [7])).toBe(HOP_MS);
    expect(estimateMovementMs(7, [1])).toBe(HOP_MS * 2 + TUNNEL_EXTRA_MS);
  });
});

describe("shop and bag explanations", () => {
  it("explains why an item cannot be bought", () => {
    const poor = makePlayer({ currency: 50 });
    expect(getPurchaseStatus("boot", makeState(poor), poor)).toEqual({
      price: 100,
      canBuy: false,
      reason: "Trop cher",
    });

    const fullBag = makePlayer({
      inventory: Array.from({ length: 4 }, (_, index) => ({ id: `cup-${index}`, kind: "red-cup" as const })),
    });
    expect(getPurchaseStatus("rope", makeState(fullBag), fullBag).reason).toBe("Sac plein");

    const withEraser = makePlayer({ inventory: [{ id: "gum", kind: "item", itemId: "eraser" }] });
    expect(getPurchaseStatus("eraser", makeState(withEraser), withEraser).reason).toBe("Une seule Gomme");
  });

  it("only offers the water bottle in Hell", () => {
    const player = makePlayer();
    expect(getItemAvailability("water-bottle", makeState(player), player).usable).toBe(false);

    const damned = makePlayer({ position: 11 });
    expect(getItemAvailability("water-bottle", makeState(damned, { turnStage: "hell" }), damned).usable).toBe(true);
  });
});
