import { describe, expect, it } from "vitest";
import { chooseWheelResult } from "./catalog";
import { earnsStartBonus, getNeighbors } from "./board";
import { canAddItem, countRedCups, findLegalPath, getInventoryCapacity, getOpenInventorySlots } from "./rules";
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
    hellTurns: 0,
    noThanksReadyRound: 1,
    ...overrides,
  };
}

describe("board movement rules", () => {
  it("forces the exit of an arrow tile but lets players walk into it against the arrow", () => {
    expect(getNeighbors(3)).toEqual([6]);
    expect(getNeighbors(6)).toContain(3);
    expect(getNeighbors(3, true).sort((left, right) => left - right)).toEqual([4, 6, 7]);
  });

  it("returns a legal two-step path for a boot move", () => {
    const player = makePlayer();
    expect(findLegalPath(player, 5, 2)).toEqual([2, 5]);
  });

  it("leaves the start only upwards or leftwards", () => {
    expect(getNeighbors(0).sort()).toEqual([2, 4]);
    expect(getNeighbors(8)).toEqual([0]);
    expect(getNeighbors(2)).not.toContain(0);
    expect(getNeighbors(4)).toContain(0);
  });

  it("pays the start bonus only when entering the start from 8", () => {
    expect(earnsStartBonus(8, [0])).toBe(true);
    expect(earnsStartBonus(10, [8, 0])).toBe(true);
    expect(earnsStartBonus(4, [0])).toBe(false);
    expect(earnsStartBonus(4, [0, 2])).toBe(false);
    expect(earnsStartBonus(2, [0])).toBe(false);
    expect(earnsStartBonus(0, [2])).toBe(false);
  });

  it("takes the wrap-around tunnel from 7 to 1 only", () => {
    expect(getNeighbors(7)).toContain(1);
    expect(getNeighbors(1)).not.toContain(7);
    expect(getNeighbors(1, true)).toContain(7);
  });

  it("never offers Hell as a normal destination", () => {
    for (let nodeId = 0; nodeId <= 10; nodeId += 1) {
      expect(getNeighbors(nodeId, true)).not.toContain(11);
    }
  });
});

describe("board transcription", () => {
  // Written down independently from BOARD_EDGES, from slide 1 and the author's reading of its arrows:
  // an arrow tile must be left through its arrow, any other road is free in both directions.
  const EXPECTED_EXITS: Record<number, number[]> = {
    0: [2, 4],
    1: [10],
    2: [5],
    3: [6],
    4: [0, 3, 7, 9],
    5: [2, 9],
    6: [1, 3],
    7: [1, 3, 4],
    8: [0],
    9: [4],
    10: [1, 8],
  };

  it.each(Object.entries(EXPECTED_EXITS))("lets a player leave tile %s only towards %j", (nodeId, exits) => {
    expect(getNeighbors(Number(nodeId)).sort((left, right) => left - right)).toEqual(exits);
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
    expect(chooseWheelResult("fortune", 0.45).id).toBe("gain-300");
    expect(chooseWheelResult("fortune", 0.999).id).toBe("escape");
  });
});
