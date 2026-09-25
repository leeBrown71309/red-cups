import { WHEEL_RESULTS } from "../../game/catalog";
import type { BoardNode, DuelMode, WheelId, WheelOutcomeId } from "../../game/types";
import { TILE_COLORS } from "../../theme/palette";

const currencyFormatter = new Intl.NumberFormat("fr-FR");

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export const WHEEL_TITLES: Record<WheelId, string> = {
  misfortune: "Roue du malheur",
  fortune: "Roue du bonheur",
  hell: "Roue de l’Enfer",
};

export const WHEEL_THEMES: Record<WheelId, { segments: string[]; rim: string; hub: string }> = {
  misfortune: { segments: ["#6d4f96", "#4b3566", "#8a6bb5", "#3e2d57"], rim: "#2f2140", hub: "#ffd166" },
  fortune: { segments: ["#ffc94d", "#5cc46a", "#4fa5f2", "#ff8fb1", "#ff9f43"], rim: "#e09a22", hub: "#ffffff" },
  hell: { segments: ["#8e5bd9", "#c86bff", "#5e3a99", "#e8453c"], rim: "#3d2654", hub: "#ffc94d" },
};

/** Short labels that fit on a wheel wedge; the full label is shown on the result card. */
const OUTCOME_SHORT_LABELS: Record<WheelOutcomeId, string> = {
  "lose-100": "−100",
  "lose-200": "−200",
  "lose-400": "−400",
  "lose-item": "Perd objet",
  "skip-turn": "Passe",
  "go-to-hell": "Enfer",
  "spin-fortune": "Bonheur !",
  nothing: "Rien",
  "gain-100": "+100",
  "gain-200": "+200",
  "gain-300": "+300",
  "gain-400": "+400",
  "gain-500": "+500",
  "free-item": "Objet",
  challenge: "Duel",
  escape: "Libre !",
  "hell-skip": "Passe",
};

const POSITIVE_OUTCOMES: WheelOutcomeId[] = [
  "gain-100",
  "gain-200",
  "gain-300",
  "gain-400",
  "gain-500",
  "free-item",
  "escape",
  "spin-fortune",
  "nothing",
];

export function isPositiveOutcome(outcome: WheelOutcomeId): boolean {
  return POSITIVE_OUTCOMES.includes(outcome);
}

export interface WheelSegment {
  outcomeId: WheelOutcomeId;
  label: string;
  color: string;
}

/**
 * Expands weighted results into equal wedges, spreading duplicates around
 * the wheel like a real carnival wheel instead of one oversized wedge.
 */
export function getWheelSegments(wheelId: WheelId): WheelSegment[] {
  const theme = WHEEL_THEMES[wheelId];
  const toSegment = (outcomeId: WheelOutcomeId) => ({ outcomeId, label: OUTCOME_SHORT_LABELS[outcomeId] });
  const ordered = WHEEL_RESULTS[wheelId].map((result) => toSegment(result.id));
  const extras = WHEEL_RESULTS[wheelId].flatMap((result) =>
    Array.from({ length: result.weight - 1 }, () => toSegment(result.id)),
  );

  for (const extra of extras) {
    const firstIndex = ordered.findIndex((segment) => segment.outcomeId === extra.outcomeId);
    const opposite = ((firstIndex + Math.ceil(ordered.length / 2)) % ordered.length) + 1;
    ordered.splice(opposite, 0, extra);
  }

  const colors = theme.segments;
  return ordered.map((segment, index) => {
    let colorIndex = index % colors.length;
    // Avoid two identical neighbours where the wheel wraps around.
    if (index === ordered.length - 1 && colorIndex === 0) colorIndex = Math.min(1, colors.length - 1) + 1;
    return { ...segment, color: colors[colorIndex % colors.length] };
  });
}

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  "coin-flip": "Pile ou face",
  "rock-paper-scissors": "Pierre · Feuille · Ciseaux",
  "player-vote": "Vote de la table",
};

export interface TileLegendEntry {
  kind: BoardNode["kind"];
  title: string;
  description: string;
  color: string;
}

export const TILE_LEGEND: TileLegendEntry[] = [
  {
    kind: "start",
    title: "Départ · case 0",
    description: "Y passer rapporte 200 pièces.",
    color: TILE_COLORS.start.top,
  },
  { kind: "shop", title: "Boutique", description: "S’arrêter dessus ouvre le shop.", color: TILE_COLORS.shop.top },
  {
    kind: "green",
    title: "Case verte",
    description: "S’y arrêter lance la roue du bonheur (et +100 avec Red light, Green light).",
    color: TILE_COLORS.green.top,
  },
  {
    kind: "red",
    title: "Case rouge",
    description: "S’y arrêter lance la roue du malheur (et −100 avec Red light, Green light).",
    color: TILE_COLORS.red.top,
  },
  { kind: "neutral", title: "Case neutre", description: "Aucun effet particulier.", color: TILE_COLORS.neutral.top },
  {
    kind: "hell",
    title: "Enfer · case 11",
    description: "On y est envoyé, on n’y marche pas.",
    color: TILE_COLORS.hell.top,
  },
];
