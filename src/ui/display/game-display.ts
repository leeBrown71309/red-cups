import { getStartBonusNodeIds, resolveBoard } from "../../game/board";
import { getWheelResults } from "../../game/catalog";
import type { BoardNode, DuelMode, MapId, NodeId, Player, WheelId, WheelOutcomeId } from "../../game/types";
import { HELL_NODE_ID, START_BONUS, START_NODE_ID } from "../../game/types";
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
  "lose-300": "−300",
  "lose-400": "−400",
  "lose-item": "Perd objet",
  "skip-turn": "Passe",
  "go-to-hell": "Enfer",
  "go-back": "Retour",
  "spin-fortune": "Bonheur !",
  "spin-misfortune": "Malheur…",
  "gain-100": "+100",
  "gain-200": "+200",
  "gain-300": "+300",
  "gain-400": "+400",
  "advance-one": "+1 case",
  "free-item": "Objet",
  "go-to-start": "Départ",
  challenge: "Duel",
  escape: "Libre !",
  "hell-skip": "Passe",
  nothing: "Rien",
};

const POSITIVE_OUTCOMES: WheelOutcomeId[] = [
  "gain-100",
  "gain-200",
  "gain-300",
  "gain-400",
  "advance-one",
  "free-item",
  "go-to-start",
  "escape",
  "spin-fortune",
];

export function isPositiveOutcome(outcome: WheelOutcomeId): boolean {
  return POSITIVE_OUTCOMES.includes(outcome);
}

export interface WheelSegment {
  outcomeId: WheelOutcomeId;
  label: string;
  color: string;
}

/** Wedges painted in another wheel's colours, so the table sees at a glance where they lead. */
const WEDGE_COLOR_OVERRIDES: Partial<Record<WheelOutcomeId, string>> = {
  "spin-misfortune": WHEEL_THEMES.misfortune.segments[0],
};

/**
 * Expands weighted results into equal wedges, spreading duplicates around
 * the wheel like a real carnival wheel instead of one oversized wedge.
 * L'Ange-Gardien's wheel of misfortune has its own two wedges.
 */
export function getWheelSegments(wheelId: WheelId, player?: Pick<Player, "passiveId">): WheelSegment[] {
  const theme = WHEEL_THEMES[wheelId];
  const results = getWheelResults(wheelId, player);
  const toSegment = (outcomeId: WheelOutcomeId) => ({ outcomeId, label: OUTCOME_SHORT_LABELS[outcomeId] });
  const ordered = results.map((result) => toSegment(result.id));
  const extras = results.flatMap((result) => Array.from({ length: result.weight - 1 }, () => toSegment(result.id)));

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
    const color = WEDGE_COLOR_OVERRIDES[segment.outcomeId] ?? colors[colorIndex % colors.length];
    return { ...segment, color };
  });
}

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  "coin-flip": "Pile ou face",
  "rock-paper-scissors": "Pierre · Feuille · Ciseaux",
  "player-vote": "Vote de la table",
  basket: "Basket",
};

export interface TileLegendEntry {
  kind: BoardNode["kind"];
  title: string;
  description: string;
  color: string;
}

function joinTileNumbers(nodeIds: NodeId[]): string {
  return nodeIds.length <= 1 ? String(nodeIds[0] ?? "") : `${nodeIds.slice(0, -1).join(", ")} ou ${nodeIds.at(-1)}`;
}

/** Legend of the tile colours, with the tile numbers of the given map. */
export function getTileLegend(mapId: MapId): TileLegendEntry[] {
  const board = resolveBoard(mapId);
  const bonusTiles = joinTileNumbers(getStartBonusNodeIds(board));
  const entries: TileLegendEntry[] = [
    {
      kind: "start",
      title: `Départ · case ${START_NODE_ID}`,
      description:
        `Y entrer depuis la case ${bonusTiles}, dans le sens de la flèche, rapporte ${START_BONUS} pièces. ` +
        `Sortir de l’Enfer vers le Départ aussi.`,
      color: TILE_COLORS.start.top,
    },
    {
      kind: "shop",
      title: "Boutique",
      description: "S’y arrêter en marchant ouvre la boutique. Téléporté ou replacé, non.",
      color: TILE_COLORS.shop.top,
    },
    {
      kind: "green",
      title: "Case verte",
      description:
        "S’y arrêter lance la roue du bonheur. Red light, Green light : +100 pour chaque case verte traversée en marchant.",
      color: TILE_COLORS.green.top,
    },
    {
      kind: "red",
      title: "Case rouge",
      description:
        "S’y arrêter lance la roue du malheur. Red light, Green light : −100 pour chaque case rouge traversée en marchant.",
      color: TILE_COLORS.red.top,
    },
    { kind: "neutral", title: "Case neutre", description: "Aucun effet particulier.", color: TILE_COLORS.neutral.top },
    {
      kind: "hell",
      title: `Enfer · case ${HELL_NODE_ID}`,
      description: "On y est envoyé, on n’y marche jamais. Deux joueurs en Enfer : duel.",
      color: TILE_COLORS.hell.top,
    },
  ];
  return entries.filter((entry) => board.nodes.some((node) => node.kind === entry.kind));
}
