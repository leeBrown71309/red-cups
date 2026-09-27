import type { BoardMap } from "./map-types";

/**
 * Frozen lake of the far north, reworked in patch 0.1.3 so neither side of
 * the board is the "safe" one. Both halves mirror each other; the choice is
 * between a long sure road and a short gamble on the ice:
 * - the outer ring (0 · 1 · 5 · 6 · 13 · 8 and 0 · 2 · 12 · 10 · 9 · 8) reaches
 *   the Red Cup on 8 in five moves, past a red bank on either side;
 * - the ice tiles 3 and 7 are two moves away: arriving on ice slides the pawn
 *   on, at random, along one of the tile's other roads (to the front, to a
 *   red bank, to the jackpot in the middle or straight to the shop 8);
 * - the middle tile 4 is green and can only be reached by sliding; its arrow
 *   4 → 0 is the only road that pays the start bonus;
 * - a blizzard lays a third, temporary ice tile every two rounds, anywhere on
 *   the board, the start included;
 * - once a Red Cup was taken, the penguins throw a snowball at somebody at
 *   every turn change: three hits and the target freezes, losing a turn;
 * - Hell is a crevasse in the ice, just behind the lake.
 */
export const BANQUISE_MAP: BoardMap = {
  id: "banquise",
  name: "Banquise",
  tagline: "Un lac gelé au cœur du Grand Nord : sur la glace, on glisse au hasard.",
  highlights: [
    "Glace : on glisse au hasard vers une autre route",
    "Tombée de glace sur la route de la Red Cup",
    "Blizzard : une glace de plus, déplacée tous les 2 tours",
    "Boules de neige des pingouins après la 1ʳᵉ Red Cup",
  ],
  themeId: "polar",
  tunnelStyle: "portals",
  tunnelName: "Tunnel",
  nodes: [
    { id: 0, x: 0, z: 6.2, kind: "start", label: "Départ" },
    { id: 1, x: -4.6, z: 6.2, kind: "green", label: "Verte" },
    { id: 2, x: 4.6, z: 6.2, kind: "green", label: "Verte" },
    { id: 3, x: -4.6, z: 0.6, kind: "neutral", label: "Glace", ice: true },
    { id: 4, x: 0, z: 0.6, kind: "green", label: "Verte" },
    { id: 5, x: -9.5, z: 6.2, kind: "shop", label: "Boutique" },
    { id: 6, x: -9.5, z: 0.6, kind: "red", label: "Rouge" },
    { id: 7, x: 4.6, z: 0.6, kind: "neutral", label: "Glace", ice: true },
    { id: 8, x: 0, z: -5.6, kind: "shop", label: "Boutique" },
    { id: 9, x: 9.5, z: -5.6, kind: "neutral", label: "Neutre" },
    { id: 10, x: 9.5, z: 0.6, kind: "red", label: "Rouge" },
    { id: 11, x: 0, z: -2.2, kind: "hell", label: "Enfer" },
    { id: 12, x: 9.5, z: 6.2, kind: "shop", label: "Boutique" },
    { id: 13, x: -9.5, z: -5.6, kind: "neutral", label: "Neutre" },
  ],
  edges: [
    // The start leaves left or right; only the jackpot in the middle leads back into it.
    { from: 0, to: 1, arrow: true },
    { from: 0, to: 2, arrow: true },
    { from: 4, to: 0, arrow: true },
    // Outer ring, mirrored on both sides.
    { from: 5, to: 1 },
    { from: 5, to: 6 },
    { from: 6, to: 13 },
    { from: 13, to: 8 },
    { from: 8, to: 9 },
    { from: 9, to: 10 },
    { from: 10, to: 12 },
    { from: 12, to: 2 },
    // The frozen lake, bank to bank.
    { from: 6, to: 3 },
    { from: 3, to: 4 },
    { from: 4, to: 7 },
    { from: 7, to: 10 },
    // Onto the ice from the front row and from the shop behind the crevasse.
    { from: 1, to: 3 },
    { from: 2, to: 7 },
    { from: 3, to: 8 },
    { from: 7, to: 8 },
  ],
  initialCupNodeId: 8,
  blizzardEveryRounds: 2,
  snowballs: true,
  roadLegend: [
    {
      style: "ice",
      title: "Glace 3 · 7 + blizzard",
      description:
        "Arrivé sur la glace, tu glisses au hasard vers l’une de ses autres routes (imposée s’il n’y en a " +
        "qu’une). Vers la Red Cup, la glace peut te tomber dessus : tu restes pris un tour.",
    },
    {
      style: "arrow",
      title: "Sortie fléchée",
      description: "Sur les cases 0 et 4, tu dois sortir par la flèche. Seule la route 4 → 0 paie les 200 du départ.",
    },
    { style: "road", title: "Chemin libre", description: "Praticable dans les deux sens." },
  ],
};
