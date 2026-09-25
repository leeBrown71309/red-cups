import { describe, expect, it } from "vitest";
import { chooseWheelResult } from "./catalog";
import { getNeighbors } from "./board";
import {
  canAddItem,
  chooseRandom,
  countRedCups,
  findLegalPath,
  getInventoryCapacity,
  getOpenInventorySlots,
} from "./rules";
import type { Player } from "./types";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Player 1",
    color: "#f16a53",
    position: 0,
    currency: 2_000,
    inventory: [],
    passiveId: "built-like-a-tank",
    skippedTurns: 0,
    noThanksUsedCycle: -1,
    ...overrides,
  };
}

describe("board movement rules", () => {
  it("allows movement along a one-way edge only in its arrow direction", () => {
    expect(getNeighbors(3)).toContain(6);
    expect(getNeighbors(6)).not.toContain(3);
    expect(getNeighbors(6, true)).toContain(3);
  });

  it("returns a legal two-step path for a boot move", () => {
    const player = makePlayer();
    expect(findLegalPath(player, 2, 2)).toEqual([5, 2]);
  });
});

describe("inventory rules", () => {
  it("counts Red Cups as inventory entries and applies Penta capacity", () => {
    const player = makePlayer({
      passiveId: "penta",
      inventory: [
        { id: "cup-1", kind: "red-cup" },
        { id: "item-1", kind: "item", itemId: "rope" },
      ],
    });

    expect(countRedCups(player)).toBe(1);
    expect(getInventoryCapacity(player)).toBe(5);
    expect(getOpenInventorySlots(player)).toBe(3);
  });

  it("blocks a third copy of an item and a second Gomme", () => {
    const player = makePlayer({
      inventory: [
        { id: "rope-1", kind: "item", itemId: "rope" },
        { id: "rope-2", kind: "item", itemId: "rope" },
      ],
    });

    expect(canAddItem(player, "rope")).toBe(false);
    expect(canAddItem(player, "eraser")).toBe(true);

    player.inventory.push({ id: "gum-1", kind: "item", itemId: "eraser" });
    expect(canAddItem(player, "eraser")).toBe(false);
  });
});

describe("random event selection", () => {
  it("selects wheel results according to weighted ranges", () => {
    expect(chooseWheelResult("fortune", 0).id).toBe("gain-100");
    expect(chooseWheelResult("fortune", 0.5).id).toBe("gain-300");
    expect(chooseWheelResult("fortune", 0.999).id).toBe("escape");
  });

  it("selects a valid random candidate at both range boundaries", () => {
    expect(chooseRandom(["first", "second"], 0)).toBe("first");
    expect(chooseRandom(["first", "second"], 1)).toBe("second");
    expect(chooseRandom([], 0)).toBeUndefined();
  });
});
