import { describe, expect, it } from "vitest";
import { reduceGame } from "../game-actions";
import { EMPTY_GAME_STATE } from "../types";
import { OPEN_NODE_POSITIONS, moveNodes } from "./open-layouts";
import { getBoardMap } from "./map-registry";
import { hasOpenVersion, resolveWorldStyle } from "./world-style";

describe("the open version of a map", () => {
  it("exists for the three first maps only", () => {
    for (const mapId of ["classic", "luna-park", "banquise"] as const) expect(hasOpenVersion(mapId)).toBe(true);
    expect(hasOpenVersion("archipel")).toBe(false);
    expect(resolveWorldStyle("archipel", "open")).toBe("boxed");
    expect(resolveWorldStyle("classic", "open")).toBe("open");
    expect(resolveWorldStyle("classic", undefined)).toBe("boxed");
  });

  it("is carried by the game, fixed by its start, and refused where there is none", () => {
    const start = (mapId: "classic" | "archipel", worldStyle?: "open" | "boxed") =>
      reduceGame(EMPTY_GAME_STATE, {
        type: "startGame",
        playerNames: ["A", "B", "C", "D", "E", "F"],
        mapId,
        worldStyle,
      });
    expect(start("classic", "open").worldStyle).toBe("open");
    expect(start("classic").worldStyle).toBe("boxed");
    expect(start("archipel", "open").worldStyle).toBe("boxed");
  });

  it.each(["classic", "luna-park", "banquise"] as const)("keeps every tile of %s, only elsewhere", (mapId) => {
    const map = getBoardMap(mapId);
    const positions = OPEN_NODE_POSITIONS[mapId] ?? {};
    expect(
      Object.keys(positions)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(map.nodes.map((node) => node.id).sort((a, b) => a - b));
    expect(moveNodes(mapId, map.nodes, "boxed")).toBe(map.nodes);
    const moved = moveNodes(mapId, map.nodes, "open");
    expect(moved.map((node) => node.id)).toEqual(map.nodes.map((node) => node.id));
    // No two tiles stand closer than a tile and a half, and the plan is not the original grid.
    for (const [index, node] of moved.entries()) {
      for (const other of moved.slice(index + 1)) {
        expect(Math.hypot(node.x - other.x, node.z - other.z)).toBeGreaterThan(3);
      }
    }
    expect(moved.some((node, index) => node.x !== map.nodes[index].x || node.z !== map.nodes[index].z)).toBe(true);
  });
});
