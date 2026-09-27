import type { MapThemeId } from "../game/maps/map-types";
import { SCENE_COLORS } from "./palette";

/**
 * Per-map art direction for the 3D scene and the flat board plan. The toy box
 * keeps the original sunny palette; the night fair swaps it for moonlight,
 * neon edges and warm bulbs.
 */
export interface SceneTheme {
  lights: {
    sky: string;
    ground: string;
    ambient: number;
    sun: string;
    sunIntensity: number;
    sunPosition: [number, number, number];
    fill: string;
    fillIntensity: number;
    shadow: string;
    shadowOpacity: number;
  };
  roads: {
    stone: string;
    tunnelStone: string;
    carouselStone: string;
    arrow: string;
    tunnel: string;
    carousel: string;
  };
  /** Night tiles glow along their edge so they read in the dark. */
  neonTiles: boolean;
  /** Flat plan of the How to play screen and the map picker. */
  plan: {
    ground: string;
    border: string;
    road: string;
    ink: string;
    label: string;
  };
}

export const MAP_THEMES: Record<MapThemeId, SceneTheme> = {
  "toy-box": {
    lights: {
      sky: "#fff6e8",
      ground: "#b98d6a",
      ambient: 1.45,
      sun: "#fff0d8",
      sunIntensity: 2.5,
      sunPosition: [-10, 22, 14],
      fill: "#dbe8ff",
      fillIntensity: 0.55,
      shadow: "#7a4a3a",
      shadowOpacity: 0.2,
    },
    roads: {
      stone: SCENE_COLORS.stone,
      tunnelStone: SCENE_COLORS.stoneTunnel,
      carouselStone: SCENE_COLORS.stone,
      arrow: "#ff8f3f",
      tunnel: SCENE_COLORS.chevronTunnel,
      carousel: "#ff4fa3",
    },
    neonTiles: false,
    plan: {
      ground: SCENE_COLORS.grass,
      border: "#e6cba9",
      road: SCENE_COLORS.stone,
      ink: SCENE_COLORS.ink,
      label: "#ffffff",
    },
  },
  "night-fair": {
    lights: {
      sky: "#8d95e8",
      ground: "#1b1f3b",
      ambient: 1.05,
      sun: "#c9d6ff",
      sunIntensity: 1.55,
      sunPosition: [9, 20, 12],
      fill: "#ff9fd1",
      fillIntensity: 0.4,
      shadow: "#05060f",
      shadowOpacity: 0.35,
    },
    roads: {
      stone: "#a7abd8",
      tunnelStone: "#6fd8c9",
      carouselStone: "#7a4fb3",
      arrow: "#ffb020",
      tunnel: "#7dffb2",
      carousel: "#ff6fb8",
    },
    neonTiles: true,
    plan: { ground: "#23284f", border: "#3a3f73", road: "#8a90c8", ink: "#0d1024", label: "#ffffff" },
  },
};

export function getSceneTheme(themeId: MapThemeId): SceneTheme {
  return MAP_THEMES[themeId] ?? MAP_THEMES["toy-box"];
}
