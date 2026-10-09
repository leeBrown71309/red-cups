import type { BoardEdge, BoardNode, NodeId } from "../types";
import { HELL_NODE_ID } from "../types";
import type { BoardMap, PassConfig } from "./map-types";

/**
 * Le Désert des Mirages (patch 0.2.4): a great caravan loop of 24 tiles round a massif of dunes crossed by a shorter
 * loop of 12, joined by four passes the sandstorms shut in turn. Six to eight players, 41 tiles (40 and Hell, the
 * Quicksand, in the middle, numbered 11 as on every map). Two Red Cups lie on the sand at all times: a real one and a
 * mirage, and nobody knows which is which.
 *
 * Outer loop (plain numbers 0-23, clockwise from the start in the south): the start, four oases (3, 9, 15, 21: the
 * shops, one traveller at a time, their arrow sending everybody on clockwise) and the tiles between. Inner loop (24-35):
 * two wells (26, 32) and the dunes' tiles. Passes (36-39): 36 joins 5 and 25, 37 joins 11 and 28, 38 joins 17 and 31,
 * 39 joins 23 and 34. Every plain number from 11 on is pushed one up in the real ids, to leave tile 11 to Hell.
 */

function tileId(plainId: NodeId): NodeId {
  return plainId >= HELL_NODE_ID ? plainId + 1 : plainId;
}

const OUTER_COUNT = 24;
const INNER_COUNT = 12;
const OASES = [3, 9, 15, 21];
const WELLS = [26, 32];
/** The passes: [pass, outer tile, inner tile], plain numbers. */
const PASS_PLAN: [number, number, number][] = [
  [36, 5, 25],
  [37, 11, 28],
  [38, 17, 31],
  [39, 23, 34],
];

/** The outer loop is an ellipse, the dunes' loop a smaller one; the world is wide and the roads are far apart. */
const OUTER_RADIUS = { x: 30, z: 21 };
const INNER_RADIUS = { x: 14, z: 10 };
/** The tray size is unused (an open world), but the camera frames and the decoration keep off this much. */
const DEGREES = Math.PI / 180;

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Points on the ellipse, measured clockwise from the south seen from above (z grows towards the camera). */
function onEllipse(radius: { x: number; z: number }, degrees: number): { x: number; z: number } {
  const angle = (90 + degrees) * DEGREES;
  return { x: radius.x * Math.cos(angle), z: radius.z * Math.sin(angle) };
}

const KIND_LABELS: Record<BoardNode["kind"], string> = {
  start: "Départ",
  shop: "Boutique",
  red: "Rouge",
  green: "Verte",
  neutral: "Neutre",
  hell: "Sable mouvant",
  quay: "Quai",
  causeway: "Chaussée",
  whirlpool: "Tourbillon",
  well: "Puits",
  oasis: "Oasis",
  pass: "Passe",
};

/** The colours of the plain tiles, handed round so that neighbours are never alike. */
const FILLERS: BoardNode["kind"][] = ["green", "red", "neutral", "green", "red"];

function buildNodes(): BoardNode[] {
  const nodes: BoardNode[] = [];
  const add = (plainId: number, kind: BoardNode["kind"], point: { x: number; z: number }) =>
    nodes.push({ id: tileId(plainId), x: rounded(point.x), z: rounded(point.z), kind, label: KIND_LABELS[kind] });

  let filler = 0;
  const nextFiller = () => FILLERS[filler++ % FILLERS.length];

  for (let index = 0; index < OUTER_COUNT; index += 1) {
    const kind: BoardNode["kind"] = index === 0 ? "start" : OASES.includes(index) ? "oasis" : nextFiller();
    add(index, kind, onEllipse(OUTER_RADIUS, (index * 360) / OUTER_COUNT));
  }
  // The dunes' loop, turned so that each pass runs straight from an outer tile to an inner one.
  for (let index = 0; index < INNER_COUNT; index += 1) {
    const plain = OUTER_COUNT + index;
    const kind: BoardNode["kind"] = WELLS.includes(plain) ? "well" : nextFiller();
    add(plain, kind, onEllipse(INNER_RADIUS, 45 + (index * 360) / INNER_COUNT));
  }
  for (const [pass, outer, inner] of PASS_PLAN) {
    const a = nodes.find((node) => node.id === tileId(outer));
    const b = nodes.find((node) => node.id === tileId(inner));
    if (!a || !b) continue;
    add(pass, "pass", { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
  }
  nodes.push({ id: HELL_NODE_ID, x: 0, z: 0, kind: "hell", label: KIND_LABELS.hell });
  return nodes.sort((a, b) => a.id - b.id);
}

function buildEdges(): BoardEdge[] {
  const edges: BoardEdge[] = [];
  // The caravan loop: two ways round, but an oasis can only be left clockwise, and so can the last tile before the
  // start, whose arrow is the road that pays the lap.
  for (let index = 0; index < OUTER_COUNT; index += 1) {
    const next = (index + 1) % OUTER_COUNT;
    const arrow = OASES.includes(index) || next === 0;
    edges.push({ from: tileId(index), to: tileId(next), ...(arrow ? { arrow: true } : {}) });
  }
  for (let index = 0; index < INNER_COUNT; index += 1) {
    edges.push({ from: tileId(OUTER_COUNT + index), to: tileId(OUTER_COUNT + ((index + 1) % INNER_COUNT)) });
  }
  for (const [pass, outer, inner] of PASS_PLAN) {
    edges.push({ from: tileId(outer), to: tileId(pass) }, { from: tileId(pass), to: tileId(inner) });
  }
  return edges;
}

const PASSES: PassConfig[] = PASS_PLAN.map(([pass, outer, inner]) => ({
  node: tileId(pass),
  outer: tileId(outer),
  inner: tileId(inner),
}));

export const DESERT_MAP: BoardMap = {
  id: "desert",
  name: "Désert des Mirages",
  tagline: "Deux Red Cups sur le sable : une vraie, un mirage. Six joueurs au moins, et la soif au bout du doute.",
  highlights: [
    "Mirage : une des deux Red Cups n’existe pas, et les deux changent de place à chaque prise",
    "Puits : 300 pièces pour savoir, en secret, laquelle est la vraie",
    "Oasis : une place, hors de portée des objets, +1 énergie",
    "Caravane et tempêtes de sable : un chariot qui avance, des passes qui se ferment",
  ],
  themeId: "dunes",
  tunnelStyle: "wrap-around",
  tunnelName: "Tunnel",
  minPlayers: 6,
  nodes: buildNodes(),
  edges: buildEdges(),
  // The real Cup of the first pair is drawn when the game opens (see `placeCupPair`); this is only a fallback.
  initialCupNodeId: tileId(7),
  desert: {
    outerLoop: Array.from({ length: OUTER_COUNT }, (_, index) => tileId(index)),
    passes: PASSES,
    // Rounds 1-4: the passes 37 and 39 are shut; rounds 5-8: 36 and 38; and so on.
    stormPhases: [
      [tileId(37), tileId(39)],
      [tileId(36), tileId(38)],
    ],
    wells: WELLS.map(tileId),
    oases: OASES.map(tileId),
    caravanStart: tileId(2),
  },
  roadLegend: [
    {
      style: "oasis",
      title: "Oasis",
      description:
        "Une boutique, une seule place : hors de portée des objets, et +1 énergie à ton tour suivant. Un second joueur qui y arrive est repoussé. La flèche te renvoie dans le sens de la caravane.",
    },
    {
      style: "well",
      title: "Puits",
      description:
        "Pour 300 pièces, tu apprends en secret laquelle des deux Red Cups est la vraie. Une fois par paire de Cups.",
    },
    {
      style: "pass",
      title: "Passe",
      description:
        "Elle relie la grande boucle aux dunes. Une tempête de sable ferme deux passes sur quatre, toutes les 4 tours.",
    },
    {
      style: "caravan",
      title: "Caravane",
      description:
        "Elle avance de 2 cases à chaque tour de table sur la grande boucle. Monte à sa case à la place de ta marche : elle t’emporte de 4 cases.",
    },
    {
      style: "arrow",
      title: "Case fléchée",
      description:
        "Oasis et dernière case avant le Départ : on les quitte dans le sens de la caravane. La flèche vers le Départ paie les 200.",
    },
  ],
};
