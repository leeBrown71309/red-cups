import { describe, expect, it } from "vitest";
import { getBoardMap } from "../game/maps/map-registry";
import { BASE_SOUNDTRACK, pickSoundtrackTheme } from "./soundtrack-theme";

describe("soundtrack", () => {
  it("plays the game's music in the menus", () => {
    expect(pickSoundtrackTheme(null, null)).toBe(BASE_SOUNDTRACK);
  });

  it("plays the music of the map on show in a picker, and the game's for a draw", () => {
    expect(pickSoundtrackTheme("banquise", null)).toBe(getBoardMap("banquise").themeId);
    expect(pickSoundtrackTheme("luna-park", "banquise")).toBe(getBoardMap("luna-park").themeId);
    expect(pickSoundtrackTheme("random", "banquise")).toBe(BASE_SOUNDTRACK);
  });

  it("plays the music of the map being played once no picker is open", () => {
    expect(pickSoundtrackTheme(null, "luna-park")).toBe(getBoardMap("luna-park").themeId);
    expect(BASE_SOUNDTRACK).not.toBe(getBoardMap("banquise").themeId);
  });
});
