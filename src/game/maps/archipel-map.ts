import type { BoardEdge, BoardNode, NodeId } from "../types";
import { HELL_NODE_ID } from "../types";
import type { BoardMap, CausewayConfig, CausewayOpening } from "./map-types";

/**
 * L'Archipel des Marées (patch 0.2.4): five islands of six tiles in a ring, tied together by five causeways of two
 * tiles that the tide drowns, a ferry that goes round the quays, whirlpools that throw a player to another island.
 * Six to eight players, 41 tiles (40 and Hell, the Maelström, in the middle of the ring, numbered 11 as on every map).
 *
 * Every island is a loop of six tiles, in this order: Quay (where the causeway of the previous island comes in), the
 * inner tile (the short way across), Exit (where the causeway to the next island starts) and three outer tiles
 * O1 · O2 · O3 on the long way round. The ring goes Port → Perles → Phare → Épaves → Corail → Port.
 *
 * Tides: the tide turns every two rounds. The Port's causeway is a dyke that never drowns; the Perles–Phare and
 * Épaves–Corail ones are drowned at high tide, the Phare–Épaves and Corail–Port ones at low tide. No tide drowns two
 * neighbouring causeways, so every island can always be left by one of them.
 */

interface IslandSpec {
  name: string;
  /** Tile ids by role. */
  quay: NodeId;
  inner: NodeId;
  exit: NodeId;
  outer: [NodeId, NodeId, NodeId];
  kinds: {
    inner: BoardNode["kind"];
    exit: BoardNode["kind"];
    outer: [BoardNode["kind"], BoardNode["kind"], BoardNode["kind"]];
  };
}

/**
 * The tiles are numbered island after island, then the causeways; Hell is tile 11 on every map, so the numbers from
 * 11 on are pushed one up to leave its place free.
 */
function tileId(plainId: NodeId): NodeId {
  return plainId >= HELL_NODE_ID ? plainId + 1 : plainId;
}

const PLAIN_ISLANDS: IslandSpec[] = [
  {
    name: "Île du Port",
    quay: 1,
    inner: 0,
    exit: 2,
    outer: [3, 4, 5],
    kinds: { inner: "start", exit: "neutral", outer: ["green", "shop", "red"] },
  },
  {
    name: "Île aux Perles",
    quay: 6,
    inner: 7,
    exit: 8,
    outer: [9, 10, 11],
    kinds: { inner: "green", exit: "red", outer: ["whirlpool", "shop", "neutral"] },
  },
  {
    name: "Île du Phare",
    quay: 12,
    inner: 13,
    exit: 14,
    outer: [15, 16, 17],
    kinds: { inner: "neutral", exit: "green", outer: ["red", "shop", "neutral"] },
  },
  {
    name: "Île des Épaves",
    quay: 18,
    inner: 19,
    exit: 20,
    outer: [21, 22, 23],
    kinds: { inner: "red", exit: "green", outer: ["red", "whirlpool", "green"] },
  },
  {
    name: "Île Corail",
    quay: 24,
    inner: 25,
    exit: 26,
    outer: [27, 28, 29],
    kinds: { inner: "green", exit: "neutral", outer: ["red", "shop", "neutral"] },
  },
];

const ISLANDS: IslandSpec[] = PLAIN_ISLANDS.map((island) => ({
  ...island,
  quay: tileId(island.quay),
  inner: tileId(island.inner),
  exit: tileId(island.exit),
  outer: island.outer.map(tileId) as IslandSpec["outer"],
}));

const KIND_LABELS: Record<BoardNode["kind"], string> = {
  start: "Départ",
  shop: "Boutique",
  red: "Rouge",
  green: "Verte",
  neutral: "Neutre",
  hell: "Maelström",
  quay: "Quai",
  causeway: "Chaussée",
  whirlpool: "Tourbillon",
  well: "Puits",
  oasis: "Oasis",
  pass: "Passe",
};

/** Causeway `k` joins the exit of island `k` to the quay of the next island; its tiles are 30 + 2k and 31 + 2k. */
const CAUSEWAY_FIRST_ID = tileId(30);
const OPENINGS: CausewayOpening[] = ["always", "low", "high", "low", "high"];

/** Centres of the islands on an ellipse, the Port at the front of the table, the ring turning to the right. */
const RING_RADIUS = { x: 25, z: 18.5 };
/** The ring sits a little behind the middle of the tray so the board is centred (the Port reaches further out). */
const RING_CENTRE_Z = -2.1;
/** The six tiles of an island sit on a circle of this radius. */
const ISLAND_RADIUS = 4.4;

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function islandCentre(index: number): { x: number; z: number } {
  const angle = Math.PI / 2 - (index * 2 * Math.PI) / ISLANDS.length;
  return { x: RING_RADIUS.x * Math.cos(angle), z: RING_CENTRE_Z + RING_RADIUS.z * Math.sin(angle) };
}

/** Angle, seen from `from`, of the point `to`. */
function bearing(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

/** Smallest signed difference between two angles. */
function angleGap(from: number, to: number): number {
  let gap = to - from;
  while (gap > Math.PI) gap -= 2 * Math.PI;
  while (gap < -Math.PI) gap += 2 * Math.PI;
  return gap;
}

function buildNodes(): BoardNode[] {
  const nodes: BoardNode[] = [];
  const place = (id: NodeId, kind: BoardNode["kind"], x: number, z: number) =>
    nodes.push({ id, x: rounded(x), z: rounded(z), kind, label: KIND_LABELS[kind] });

  const quayPoints: { x: number; z: number }[] = [];
  const exitPoints: { x: number; z: number }[] = [];

  ISLANDS.forEach((island, index) => {
    const centre = islandCentre(index);
    const previous = islandCentre((index + ISLANDS.length - 1) % ISLANDS.length);
    const next = islandCentre((index + 1) % ISLANDS.length);
    const towardQuay = bearing(centre, previous);
    const towardExit = bearing(centre, next);
    // The inner tile sits on the short arc between the quay and the exit, the outer ones share the long arc.
    const shortGap = angleGap(towardQuay, towardExit);
    const inner = towardQuay + shortGap / 2;
    const longGap = shortGap > 0 ? 2 * Math.PI - shortGap : -2 * Math.PI - shortGap;
    const at = (angle: number) => ({
      x: centre.x + ISLAND_RADIUS * Math.cos(angle),
      z: centre.z + ISLAND_RADIUS * Math.sin(angle),
    });

    const quayPoint = at(towardQuay);
    const exitPoint = at(towardExit);
    quayPoints.push(quayPoint);
    exitPoints.push(exitPoint);
    place(island.quay, "quay", quayPoint.x, quayPoint.z);
    place(island.exit, island.kinds.exit, exitPoint.x, exitPoint.z);
    const innerPoint = at(inner);
    place(island.inner, island.kinds.inner, innerPoint.x, innerPoint.z);
    // From the exit, round the long way back to the quay.
    island.outer.forEach((id, step) => {
      const point = at(towardExit + (longGap * (step + 1)) / (island.outer.length + 1));
      place(id, island.kinds.outer[step], point.x, point.z);
    });
  });

  // The two tiles of each causeway, a third and two thirds of the way from one island's exit to the next quay.
  ISLANDS.forEach((_, index) => {
    const from = exitPoints[index];
    const to = quayPoints[(index + 1) % ISLANDS.length];
    for (const [step, fraction] of [1 / 3, 2 / 3].entries()) {
      place(
        CAUSEWAY_FIRST_ID + index * 2 + step,
        "causeway",
        from.x + (to.x - from.x) * fraction,
        from.z + (to.z - from.z) * fraction,
      );
    }
  });

  place(HELL_NODE_ID, "hell", 0, RING_CENTRE_Z);
  return nodes.sort((a, b) => a.id - b.id);
}

function buildEdges(): BoardEdge[] {
  const edges: BoardEdge[] = [];
  ISLANDS.forEach((island, index) => {
    const [first, second, third] = island.outer;
    // The loop of the island: quay, inner tile, exit, then the long way round. The Port's quay leads straight onto
    // the start: the only road that closes the lap and pays the start bonus.
    edges.push(
      { from: island.quay, to: island.inner, ...(index === 0 ? { arrow: true } : {}) },
      { from: island.inner, to: island.exit },
      { from: island.exit, to: first },
      { from: first, to: second },
      { from: second, to: third },
      { from: third, to: island.quay },
    );
    // The causeway to the next island.
    const causewayFirst = CAUSEWAY_FIRST_ID + index * 2;
    const nextQuay = ISLANDS[(index + 1) % ISLANDS.length].quay;
    edges.push(
      { from: island.exit, to: causewayFirst },
      { from: causewayFirst, to: causewayFirst + 1 },
      { from: causewayFirst + 1, to: nextQuay },
    );
  });
  return edges;
}

const CAUSEWAYS: CausewayConfig[] = ISLANDS.map((_, index) => ({
  nodes: [CAUSEWAY_FIRST_ID + index * 2, CAUSEWAY_FIRST_ID + index * 2 + 1],
  opensAt: OPENINGS[index],
  quayId: ISLANDS[(index + 1) % ISLANDS.length].quay,
}));

export const ARCHIPEL_MAP: BoardMap = {
  id: "archipel",
  name: "Archipel des Marées",
  tagline: "Cinq îles, des chaussées que la mer avale, un bac et des tourbillons : à six joueurs au moins.",
  highlights: [
    "Marée : les chaussées se noient et se découvrent tous les 2 tours",
    "Bac : il fait le tour des Quais, un Quai à la fois",
    "Quai : une seule place, le second arrivé est repoussé",
    "Tourbillon : aspire vers le Quai d’une autre île",
  ],
  themeId: "lagoon",
  tunnelStyle: "wrap-around",
  tunnelName: "Tunnel",
  minPlayers: 6,
  nodes: buildNodes(),
  edges: buildEdges(),
  // The first Red Cup waits on the shop of the Perles island: six steps from the start, past a causeway that never drowns.
  initialCupNodeId: 10,
  tidal: {
    causeways: CAUSEWAYS,
    ferryQuays: ISLANDS.map((island) => island.quay),
    islands: ISLANDS.map((island) => [island.quay, island.inner, island.exit, ...island.outer]),
    islandNames: ISLANDS.map((island) => island.name),
  },
  roadLegend: [
    {
      style: "causeway",
      title: "Chaussée",
      description:
        "Deux cases entre deux îles. La marée la noie un tour sur deux : on ne la franchit plus, et qui s’y trouve est déposé sur le Quai voisin.",
    },
    {
      style: "quay",
      title: "Quai",
      description:
        "Une seule place. Un second joueur qui y arrive est repoussé là d’où il venait, et celui qui tient le Quai gagne 50 pièces.",
    },
    {
      style: "ferry",
      title: "Bac",
      description:
        "Il passe d’un Quai au suivant à chaque tour de table. Sur son Quai, prends-le à la place de ta marche : tu arrives au Quai suivant.",
    },
    {
      style: "whirlpool",
      title: "Tourbillon",
      description: "Arrivé dessus, tu es aspiré vers le Quai d’une autre île, tirée au hasard. Ni roue ni boutique.",
    },
    {
      style: "arrow",
      title: "Quai du Port",
      description: "Depuis le Quai du Port, on repart par le Départ : c’est la route qui paie les 200 du tour complet.",
    },
  ],
};
