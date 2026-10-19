import { afterEach, describe, expect, it, vi } from "vitest";
import { getDraftPool } from "../draft";
import { reduceGame } from "../game-actions";
import { EMPTY_GAME_STATE } from "../types";

/**
 * The two large maps are only playable in development (patch 0.3.0), and Sœur Fantôme is only dealt on a closed map.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadRegistry(production: boolean) {
  vi.stubEnv("PROD", production);
  vi.resetModules();
  return import("./map-registry");
}

describe("les grandes cartes, en préparation hors développement", () => {
  it("en développement, elles se jouent et se tirent au sort comme avant", async () => {
    const registry = await loadRegistry(false);
    expect(registry.isMapAvailable("archipel")).toBe(true);
    expect(registry.isMapAvailable("desert")).toBe(true);
    expect(registry.getDrawableMapIds(8)).toEqual(expect.arrayContaining(["archipel", "desert"]));
    expect(registry.resolveMapChoice("desert")).toBe("desert");
  });

  it("en préprod et en production, elles sont listées mais pas jouables : ni choisies, ni tirées au sort", async () => {
    const registry = await loadRegistry(true);
    // Still listed in the picker, so that players see them coming…
    expect(registry.MAP_CHOICES).toEqual(expect.arrayContaining(["archipel", "desert"]));
    // …but never pickable.
    expect(registry.isChoiceAvailable("archipel")).toBe(false);
    expect(registry.isChoiceAvailable("desert")).toBe(false);
    expect(registry.SELECTABLE_MAP_CHOICES).toEqual(["random", "classic", "luna-park", "banquise"]);
    expect(registry.getDrawableMapIds(8)).toEqual(["classic", "luna-park", "banquise"]);
    // A stale choice remembered from a development build starts the classic board.
    expect(registry.resolveMapChoice("archipel")).toBe("classic");
    for (let draw = 0; draw < 50; draw += 1) {
      expect(["classic", "luna-park", "banquise"]).toContain(registry.resolveMapChoice("random", Math.random, 8));
    }
  });
});

describe("Sœur Fantôme : seulement sur une carte fermée", () => {
  it("n'est jamais dans la pioche d'une carte ouverte, et reste dans celle d'une carte fermée", () => {
    expect(getDraftPool("actif", 4, true)).not.toContain("ghost-sister");
    expect(getDraftPool("actif", 4, false)).toContain("ghost-sister");
    // The passifs are unaffected.
    expect(getDraftPool("passif", 4, true)).toEqual(getDraftPool("passif", 4, false));
  });

  function dealtAcrossSeeds(worldStyle: "boxed" | "open"): Set<string | undefined> {
    const dealt = new Set<string | undefined>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = reduceGame(EMPTY_GAME_STATE, {
        type: "startGame",
        playerNames: ["A", "B", "C", "D", "E", "F", "G", "H"],
        seed,
        mapId: "classic",
        worldStyle,
      });
      for (const player of state.players) dealt.add(player.passiveId);
    }
    return dealt;
  }

  it("une partie sur la version ouverte ne la distribue jamais, la version fermée la distribue", () => {
    expect(dealtAcrossSeeds("open").has("ghost-sister")).toBe(false);
    expect(dealtAcrossSeeds("boxed").has("ghost-sister")).toBe(true);
  });
});
