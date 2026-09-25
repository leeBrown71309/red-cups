import type { PlayerColor } from "../game/types";
import { PLAYER_COLORS } from "../game/types";

/**
 * Each seat gets an accessory on top of its colour so players stay
 * recognisable on a shared screen, even for colour-blind viewers.
 */
export type AccessoryId = "party-hat" | "sprout" | "bow" | "antenna" | "horns" | "cat-ears" | "beanie" | "halo";

export const SEAT_ACCESSORIES: AccessoryId[] = [
  "party-hat",
  "sprout",
  "bow",
  "antenna",
  "horns",
  "cat-ears",
  "beanie",
  "halo",
];

export interface PlayerLook {
  color: PlayerColor;
  deep: string;
  accessory: AccessoryId;
}

export function getSeatIndex(color: PlayerColor): number {
  return Math.max(0, PLAYER_COLORS.indexOf(color));
}

export function getPlayerLook(color: PlayerColor): PlayerLook {
  return {
    color,
    deep: shadeColor(color, -0.28),
    accessory: SEAT_ACCESSORIES[getSeatIndex(color)] ?? "party-hat",
  };
}

/** Darkens (negative amount) or lightens (positive amount) a hex colour. */
export function shadeColor(color: string, amount: number): string {
  const value = Number.parseInt(color.replace("#", ""), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
