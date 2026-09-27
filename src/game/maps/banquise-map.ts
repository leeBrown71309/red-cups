import type { BoardMap } from "./map-types";

/**
 * Frozen lake of the far north, designed for patch 0.1.3 around one rule:
 * a walk that ends on ice slides on, straight ahead, to the next tile.
 * - the lake row 6 · 3 · 4 · 7 · 10 is a launcher: stepping onto the ice from
 *   a bank shoots the pawn across the whole lake in one move, 6 ↔ 10;
 * - the start can leave onto the middle of the lake (4), where the pawn
 *   stops, then slides out to one bank or the other on its next move;
 * - a pawn can only stop on 3 or 7 by stepping on them from the front row
 *   or from the back shop, so a Red Cup there is harder to grab than it looks;
 * - the start bonus is paid through 2 → 0 only, and 2 is red: the lap ends
 *   with a wheel of misfortune;
 * - Hell is a crevasse in the ice, just behind the lake.
 */
export const BANQUISE_MAP: BoardMap = {
  id: "banquise",
  name: "Banquise",
  tagline: "Un lac gelé au cœur du Grand Nord : sur la glace, on glisse tout droit.",
  highlights: [
    "Glace : on glisse jusqu’à la prochaine case sans glace",
    "Traverser tout le lac d’un seul coup",
    "Le bonus du départ passe par une case rouge",
  ],
  themeId: "polar",
  tunnelStyle: "portals",
  tunnelName: "Tunnel",
  nodes: [
    { id: 0, x: 0, z: 6.2, kind: "start", label: "Départ" },
    { id: 1, x: -4.6, z: 6.2, kind: "green", label: "Verte" },
    { id: 2, x: 4.6, z: 6.2, kind: "red", label: "Rouge" },
    { id: 3, x: -4.6, z: 0.6, kind: "green", label: "Verte glacée", ice: true },
    { id: 4, x: 0, z: 0.6, kind: "neutral", label: "Glace", ice: true },
    { id: 5, x: -9.5, z: 6.2, kind: "shop", label: "Boutique" },
    { id: 6, x: -9.5, z: 0.6, kind: "green", label: "Verte" },
    { id: 7, x: 4.6, z: 0.6, kind: "red", label: "Rouge glacée", ice: true },
    { id: 8, x: 0, z: -5.6, kind: "shop", label: "Boutique" },
    { id: 9, x: 9.5, z: -5.6, kind: "red", label: "Rouge" },
    { id: 10, x: 9.5, z: 0.6, kind: "red", label: "Rouge" },
    { id: 11, x: 0, z: -2.2, kind: "hell", label: "Enfer" },
    { id: 12, x: 9.5, z: 6.2, kind: "shop", label: "Boutique" },
    { id: 13, x: -9.5, z: -5.6, kind: "green", label: "Verte" },
  ],
  edges: [
    // Front row: the start leaves left or onto the lake, and the lap ends through 2.
    { from: 0, to: 1, arrow: true },
    { from: 0, to: 4, arrow: true },
    { from: 2, to: 0, arrow: true },
    { from: 5, to: 1 },
    { from: 2, to: 12 },
    // The frozen lake, bank to bank.
    { from: 6, to: 3 },
    { from: 3, to: 4 },
    { from: 4, to: 7 },
    { from: 7, to: 10 },
    // Up and down between the rows.
    { from: 5, to: 6 },
    { from: 1, to: 3 },
    { from: 2, to: 7 },
    { from: 12, to: 10 },
    { from: 6, to: 13 },
    { from: 10, to: 9 },
    // Back row and the shop behind the crevasse.
    { from: 13, to: 8 },
    { from: 8, to: 9 },
    { from: 3, to: 8 },
    { from: 7, to: 8 },
  ],
  initialCupNodeId: 8,
  roadLegend: [
    {
      style: "ice",
      title: "Glace 3 · 4 · 7",
      description:
        "Si ton déplacement s’arrête sur la glace, tu glisses tout droit jusqu’à une case sans glace. " +
        "Arrivé de côté, tu t’arrêtes dessus.",
    },
    {
      style: "arrow",
      title: "Sortie fléchée",
      description: "Sur les cases 0 et 2, tu dois sortir par la flèche. On peut y entrer par n’importe quelle route.",
    },
    { style: "road", title: "Chemin libre", description: "Praticable dans les deux sens." },
  ],
};
