import type { BoardMap } from "./map-types";

/**
 * Board transcribed from slide 1 of the original presentation.
 * Coordinates follow the slide grid: five columns (x) and three rows (z),
 * with the camera looking from the bottom edge of the slide.
 *
 * Arrows are drawn on tiles 0, 1, 2, 3, 8 and 9 and point along one of their
 * roads. Standing on such a tile, a player must leave through its arrow;
 * every other road stays usable in both directions, so a player may walk into
 * an arrow tile against its arrow (6 → 3) but then has to follow the arrow out
 * (3 → 6). Rule confirmed by the game's author.
 * The grey road leaving tile 7 through the left border and entering tile 1
 * from the right border is a one-way wrap-around tunnel.
 */
export const CLASSIC_MAP: BoardMap = {
  id: "classic",
  name: "Coffre à jouets",
  tagline: "Le plateau d’origine : une grande boucle fléchée sous le soleil.",
  highlights: [
    "Presque toutes les cases imposent leur sortie",
    "Tunnel 7 → 1 d’un bord à l’autre",
    "Bonus du départ en bouclant 8 → 0",
  ],
  themeId: "toy-box",
  tunnelStyle: "wrap-around",
  tunnelName: "Tunnel",
  nodes: [
    { id: 0, x: 0, z: 0, kind: "start", label: "Départ" },
    { id: 1, x: 8, z: 4.5, kind: "green", label: "Verte" },
    { id: 2, x: 0, z: -4.5, kind: "neutral", label: "Neutre" },
    { id: 3, x: 0, z: 4.5, kind: "shop", label: "Boutique" },
    { id: 4, x: -8, z: 0, kind: "red", label: "Rouge" },
    { id: 5, x: -4, z: -4.5, kind: "green", label: "Verte" },
    { id: 6, x: 4, z: 4.5, kind: "red", label: "Rouge" },
    { id: 7, x: -8, z: 4.5, kind: "green", label: "Verte" },
    { id: 8, x: 8, z: -4.5, kind: "shop", label: "Boutique" },
    { id: 9, x: -8, z: -4.5, kind: "shop", label: "Boutique" },
    { id: 10, x: 8, z: 0, kind: "red", label: "Rouge" },
    { id: 11, x: 4, z: 0.3, kind: "hell", label: "Enfer" },
  ],
  edges: [
    { from: 9, to: 5 },
    { from: 2, to: 5, arrow: true },
    { from: 0, to: 2, arrow: true },
    { from: 8, to: 0, arrow: true },
    { from: 9, to: 4, arrow: true },
    { from: 0, to: 4, arrow: true },
    { from: 4, to: 7 },
    { from: 4, to: 3 },
    { from: 7, to: 3 },
    { from: 3, to: 6, arrow: true },
    { from: 6, to: 1 },
    { from: 1, to: 10, arrow: true },
    { from: 10, to: 8 },
    { from: 7, to: 1, kind: "tunnel" },
  ],
  initialCupNodeId: 8,
  roadLegend: [
    {
      style: "arrow",
      title: "Case fléchée",
      description:
        "La flèche sort de la case : arrêté dessus, tu repars par la route qu’elle montre. On peut y entrer par n’importe quelle route.",
    },
    { style: "road", title: "Chemin libre", description: "Praticable dans les deux sens." },
    {
      style: "tunnel",
      title: "Tunnel 7 → 1",
      description: "Sors par la gauche, réapparais à droite. Un seul pas, à sens unique.",
    },
  ],
};
