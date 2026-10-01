import type { BoardMap } from "./map-types";

/**
 * Night fair board, designed for patch 0.1.3 so the table does not replay the
 * classic loop:
 * - a carousel of four tiles turns around Hell, one way only, and flips its
 *   direction at every new Red Cup; each of its tiles is a crossroads with a
 *   spoke to the outer ring;
 * - only 8 → 0 pays the start bonus, so the flip decides who loops fast
 *   (0-1-4-7-6-8-0 in six steps one way, eight the other);
 * - the ghost train (7 → 12) crosses to the opposite corner to chase a Cup
 *   without shortening the loop: entering 0 from 12 pays nothing;
 * - tile 8 can only be reached from 6, a choke point for mud, and the first
 *   Cup waits there, as far from the start as the board allows: seven steps
 *   at first, five once the carousel has flipped;
 * - a ghost roams the whole board, drifting or teleporting at every turn
 *   change; meeting it means a duel for its loot (see `src/game/ghost.ts`).
 */
export const LUNA_PARK_MAP: BoardMap = {
  id: "luna-park",
  name: "Luna Park",
  tagline: "Une fête foraine de nuit, un manège maudit autour de l’Enfer.",
  highlights: [
    "Carrousel à sens unique qui s’inverse à chaque Red Cup",
    "Quatre carrefours autour de l’Enfer",
    "Train fantôme 7 → 12 d’un coin à l’autre",
    "Un fantôme voleur rôde et se téléporte",
  ],
  themeId: "night-fair",
  tunnelStyle: "portals",
  tunnelName: "Train fantôme",
  nodes: [
    { id: 0, x: 0, z: 6.2, kind: "start", label: "Départ" },
    { id: 1, x: 0, z: 2.6, kind: "green", label: "Verte" },
    { id: 2, x: 4.2, z: 0, kind: "red", label: "Rouge" },
    { id: 3, x: 0, z: -2.6, kind: "green", label: "Verte" },
    { id: 4, x: -4.2, z: 0, kind: "red", label: "Rouge" },
    { id: 5, x: 0, z: -6.2, kind: "shop", label: "Boutique" },
    { id: 6, x: -9.5, z: 0, kind: "green", label: "Verte" },
    { id: 7, x: -9.5, z: -6.2, kind: "red", label: "Rouge" },
    { id: 8, x: -9.5, z: 6.2, kind: "shop", label: "Boutique" },
    { id: 9, x: 9.5, z: -6.2, kind: "neutral", label: "Neutre" },
    { id: 10, x: 9.5, z: 0, kind: "green", label: "Verte" },
    { id: 11, x: 0, z: 0, kind: "hell", label: "Enfer" },
    { id: 12, x: 9.5, z: 6.2, kind: "shop", label: "Boutique" },
  ],
  edges: [
    // Carousel, starting direction 1 → 2 → 3 → 4 → 1.
    { from: 1, to: 2, kind: "carousel" },
    { from: 2, to: 3, kind: "carousel" },
    { from: 3, to: 4, kind: "carousel" },
    { from: 4, to: 1, kind: "carousel" },
    // Spokes from the carousel to the outer ring.
    { from: 0, to: 1, arrow: true },
    { from: 2, to: 10 },
    { from: 5, to: 3, arrow: true },
    { from: 4, to: 7 },
    // Outer ring.
    { from: 0, to: 12, arrow: true },
    { from: 12, to: 10 },
    { from: 10, to: 9 },
    { from: 9, to: 5 },
    { from: 5, to: 7 },
    { from: 7, to: 6 },
    { from: 6, to: 8 },
    { from: 8, to: 0, arrow: true },
    { from: 7, to: 12, kind: "tunnel" },
  ],
  initialCupNodeId: 8,
  haunted: true,
  roadLegend: [
    {
      style: "arrow",
      title: "Sortie fléchée",
      description:
        "Sur les cases 0, 5 et 8, tu dois sortir par la flèche. On peut y entrer par n’importe quelle route.",
    },
    { style: "road", title: "Chemin libre", description: "Praticable dans les deux sens." },
    {
      style: "carousel",
      title: "Carrousel 1 · 2 · 3 · 4",
      description: "À sens unique autour de l’Enfer, il change de sens à chaque nouvelle Red Cup.",
    },
    {
      style: "tunnel",
      title: "Train fantôme 7 → 12",
      description: "Un seul pas, à sens unique, d’un coin à l’autre. Entrer au Départ depuis 12 ne rapporte rien.",
    },
  ],
};
