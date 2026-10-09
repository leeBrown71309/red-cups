import { describe, expect, it } from "vitest";
import { resolveBoard } from "../../game/board";
import { WHEEL_RESULTS } from "../../game/catalog";
import { EMPTY_GAME_STATE, type GameState, type Player, type WheelId } from "../../game/types";
import { GLIDE_MS, HOP_MS, TUNNEL_EXTRA_MS, WOBBLE_MS, estimateMovementMs } from "../../theme/timing";
import { WHEEL_THEMES, getWheelSegments } from "./game-display";
import { getEnergyTone } from "../components/energy-meter";
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
    knockedOut: false,
    hellTurns: 0,
    noThanksReadyRound: 1,
    previousNodeId: null,
    ...overrides,
  };
}

function makeState(player: Player, overrides: Partial<GameState> = {}): GameState {
  return { ...EMPTY_GAME_STATE, phase: "playing", turnStage: "move", players: [player], ...overrides };
}

describe("energy gauge", () => {
  it("is blue while full, orange at two points, red at the last one", () => {
    expect([3, 2, 1, 0].map(getEnergyTone)).toEqual(["full", "mid", "low", "empty"]);
  });
});

describe("wheel segments", () => {
  it.each<WheelId>(["misfortune", "fortune", "hell"])("gives every %s outcome one wedge per weight", (wheelId) => {
    const segments = getWheelSegments(wheelId);
    const totalWeight = WHEEL_RESULTS[wheelId].reduce((sum, result) => sum + result.weight, 0);
    expect(segments).toHaveLength(totalWeight);

    for (const result of WHEEL_RESULTS[wheelId]) {
      expect(segments.filter((segment) => segment.outcomeId === result.id)).toHaveLength(result.weight);
    }
  });

  it("paints the wedge leading to the wheel of misfortune in its purple", () => {
    const wedge = getWheelSegments("fortune").find((segment) => segment.outcomeId === "spin-misfortune");
    expect(WHEEL_THEMES.misfortune.segments).toContain(wedge?.color);
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
    const classic = resolveBoard("classic");
    expect(estimateMovementMs(classic, { from: 4, path: [7] })).toBe(HOP_MS);
    expect(estimateMovementMs(classic, { from: 7, path: [1] })).toBe(HOP_MS * 2 + TUNNEL_EXTRA_MS);
    expect(estimateMovementMs(resolveBoard("luna-park"), { from: 7, path: [12] })).toBe(HOP_MS * 2 + TUNNEL_EXTRA_MS);
  });

  it("adds the wobble and the glide of every tile slid on ice", () => {
    const banquise = resolveBoard("banquise");
    expect(estimateMovementMs(banquise, { from: 1, path: [3, 6], slideStart: 1 })).toBe(HOP_MS + WOBBLE_MS + GLIDE_MS);
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

  it("has no button for the items that act on their own", () => {
    const player = makePlayer({ passiveId: "devil" });
    const state = makeState(player);
    for (const itemId of ["helmet", "hell-touch", "shield"] as const) {
      expect(getItemAvailability(itemId, state, player)).toMatchObject({ usable: false, kind: "passive" });
    }
  });

  it("lets a turn throw Tomates from a single stack", () => {
    const player = makePlayer({
      inventory: [
        { id: "first", kind: "item", itemId: "tomato", count: 3 },
        { id: "second", kind: "item", itemId: "tomato", count: 5 },
      ],
    });
    const state = makeState(player, { thrownStackId: "first" });
    expect(getItemAvailability("tomato", state, player, "first").usable).toBe(true);
    expect(getItemAvailability("tomato", state, player, "second")).toMatchObject({
      usable: false,
      reason: "Une seule pile de Tomates par tour.",
    });
    expect(getPurchaseStatus("tomato", state, player).canBuy).toBe(true);
    const fullStack = makePlayer({ inventory: [{ id: "first", kind: "item", itemId: "tomato", count: 5 }] });
    expect(getPurchaseStatus("tomato", makeState(fullStack), fullStack).reason).toBe("Une seule pile");

    // Tomato Enjoyer throws from every stack.
    const enjoyer = { ...player, passiveId: "tomato-enjoyer" as const };
    expect(
      getItemAvailability("tomato", makeState(enjoyer, { thrownStackId: "first" }), enjoyer, "second").usable,
    ).toBe(true);
  });

  it("only offers the water bottle in Hell", () => {
    const player = makePlayer();
    expect(getItemAvailability("water-bottle", makeState(player), player).usable).toBe(false);

    const damned = makePlayer({ position: 11 });
    expect(getItemAvailability("water-bottle", makeState(damned, { turnStage: "hell" }), damned).usable).toBe(true);
  });
});
