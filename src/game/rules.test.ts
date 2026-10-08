import { describe, expect, it } from "vitest";
import { chooseWheelResult } from "./catalog";
import { earnsStartBonus, getNeighbors, resolveBoard } from "./board";
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
    knockedOut: false,
    hellTurns: 0,
    noThanksReadyRound: 1,
    previousNodeId: null,
    ...overrides,
  };
}

const classic = resolveBoard("classic");

describe("board movement rules", () => {
  it("forces the exit of an arrow tile but lets players walk into it against the arrow", () => {
    expect(getNeighbors(classic, 3)).toEqual([6]);
    expect(getNeighbors(classic, 6)).toContain(3);
    expect(getNeighbors(classic, 3, true).sort((left, right) => left - right)).toEqual([4, 6, 7]);
  });

  it("returns a legal two-step path for a boot move", () => {
    const player = makePlayer();
    expect(findLegalPath(classic, player, 5, 2)).toEqual([2, 5]);
  });

  it("leaves the start only upwards or leftwards", () => {
    expect(getNeighbors(classic, 0).sort()).toEqual([2, 4]);
    expect(getNeighbors(classic, 8)).toEqual([0]);
    expect(getNeighbors(classic, 2)).not.toContain(0);
    expect(getNeighbors(classic, 4)).toContain(0);
  });

  it("pays the start bonus only when entering the start from 8", () => {
    expect(earnsStartBonus(classic, 8, [0])).toBe(true);
    expect(earnsStartBonus(classic, 10, [8, 0])).toBe(true);
    expect(earnsStartBonus(classic, 4, [0])).toBe(false);
    expect(earnsStartBonus(classic, 4, [0, 2])).toBe(false);
    expect(earnsStartBonus(classic, 2, [0])).toBe(false);
    expect(earnsStartBonus(classic, 0, [2])).toBe(false);
  });

  it("takes the wrap-around tunnel from 7 to 1 only", () => {
    expect(getNeighbors(classic, 7)).toContain(1);
    expect(getNeighbors(classic, 1)).not.toContain(7);
    expect(getNeighbors(classic, 1, true)).toContain(7);
  });

  it("never offers Hell as a normal destination", () => {
    for (let nodeId = 0; nodeId <= 10; nodeId += 1) {
      expect(getNeighbors(classic, nodeId, true)).not.toContain(11);
    }
  });
});

describe("board transcription", () => {
  // Written down independently from the classic map data, from slide 1 and the author's reading of its arrows:
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
    expect(getNeighbors(classic, Number(nodeId)).sort((left, right) => left - right)).toEqual(exits);
  });
});

describe("inventory rules", () => {
  it("counts Red Cups as inventory entries in a bag of four", () => {
    const player = makePlayer({
      inventory: [
        { id: "cup-1", kind: "red-cup" },
        { id: "item-1", kind: "item", itemId: "rope" },
      ],
    });

    expect(countRedCups(player)).toBe(1);
    expect(getInventoryCapacity(player)).toBe(4);
    expect(getOpenInventorySlots(player)).toBe(2);
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
    // Fortune and misfortune: eight equal wedges.
    expect(chooseWheelResult("fortune", 0).id).toBe("gain-100");
    expect(chooseWheelResult("fortune", 0.45).id).toBe("gain-400");
    expect(chooseWheelResult("fortune", 0.999).id).toBe("go-to-start");
    expect(chooseWheelResult("misfortune", 0.999).id).toBe("skip-turn");
    // Hell keeps its weights: two wedges of −100 out of nine.
    expect(chooseWheelResult("hell", 2 / 9 - 0.001).id).toBe("lose-100");
    expect(chooseWheelResult("hell", 2 / 9 + 0.001).id).toBe("lose-200");
  });
});
