import { describe, expect, it } from "vitest";
import type { GameLogEntry } from "../game/types";
import { canSeeBagOf, getVisibleCards, readLogEntry } from "./visibility";

/** Online, the others' bags and actifs stay private (patch 0.1.6). */

const player = { id: "p2", passiveId: "greedy" as const, passifId: "thief" as const };

describe("what a viewer sees of the others", () => {
  it("shows everything at a local table, where nobody is the viewer", () => {
    expect(getVisibleCards(player, null, "playing")).toEqual({ actif: "greedy", passif: "thief" });
    expect(canSeeBagOf(null, "p2")).toBe(true);
  });

  it("hides another player's actif and bag online, but not their passif", () => {
    expect(getVisibleCards(player, "p1", "playing")).toEqual({ actif: null, passif: "thief" });
    expect(canSeeBagOf("p1", "p2")).toBe(false);
  });

  it("shows a player their own cards and bag", () => {
    expect(getVisibleCards(player, "p2", "playing")).toEqual({ actif: "greedy", passif: "thief" });
    expect(canSeeBagOf("p2", "p2")).toBe(true);
  });

  it("keeps le diable public, and shows every card once the game is over", () => {
    expect(getVisibleCards({ ...player, passiveId: "devil" }, "p1", "playing").actif).toBe("devil");
    expect(getVisibleCards(player, "p1", "finished").actif).toBe("greedy");
  });

  it("reads the public version of a bag line, except to its owner and at a local table", () => {
    const entry: GameLogEntry = {
      id: "l1",
      text: "Léa achète Hollow Purple pour 600 pièces.",
      tone: "good",
      secret: { ownerId: "p2", publicText: "Léa achète un objet." },
    };
    expect(readLogEntry(entry, "p1")).toBe("Léa achète un objet.");
    expect(readLogEntry(entry, "p2")).toBe(entry.text);
    expect(readLogEntry(entry, null)).toBe(entry.text);
    expect(readLogEntry({ id: "l2", text: "Tour de Léa.", tone: "event" }, "p1")).toBe("Tour de Léa.");
  });
});
