import type { BoardNode } from "../game/types";

/**
 * Single source of truth for the art direction colours, shared by the
 * Three.js scene (numbers) and the React HUD (CSS strings).
 */
export const TILE_COLORS: Record<BoardNode["kind"], { top: string; side: string }> = {
  start: { top: "#ffc94d", side: "#e09a22" },
  shop: { top: "#4fa5f2", side: "#2f78c4" },
  red: { top: "#f2594f", side: "#c43a35" },
  green: { top: "#5cc46a", side: "#3a9a4a" },
  neutral: { top: "#c9c1b6", side: "#9d948a" },
  hell: { top: "#8e5bd9", side: "#5e3a99" },
};

export const SCENE_COLORS = {
  ink: "#3a2530",
  grass: "#9ad77e",
  grassDeep: "#79c265",
  trayRim: "#f8e9d4",
  trayRimShade: "#ecd3b3",
  trayBase: "#e2c29c",
  stone: "#f3e2bf",
  stoneTunnel: "#b7c4d8",
  chevron: "#ffffff",
  chevronTunnel: "#7fe3ff",
  tunnelGlow: "#6fd8ff",
  trunk: "#a8784f",
  leaves: ["#7ccf6e", "#5fbf62", "#9adf7a", "#6cc56e"],
  rock: ["#d8cfc3", "#c7bcaf", "#e4dccf"],
  flowers: ["#fff4f4", "#ffd166", "#ff9fb2", "#b8a6ff", "#8fd3ff"],
  lava: "#c86bff",
  hellRock: "#5a3c78",
  cupRed: "#e8453c",
  cupInner: "#fff4ec",
  mud: "#8a5a3c",
  wood: "#c98e5a",
  awningStripe: "#ffffff",
  highlight: "#fff3b0",
} as const;

export function toHexNumber(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16);
}
