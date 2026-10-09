import type { BoardEdge, BoardNode, MapId, NodeId } from "../types";

/** Art direction of a map: the scene, the flat plan and the lobby card all follow it. */
export type MapThemeId = "toy-box" | "night-fair" | "polar" | "lagoon" | "dunes";

/**
 * How a tunnel is drawn. The classic tunnel leaves through one side of the
 * tray and comes back through the other; the ghost train dives into a
 * haunted house beside each of its two tiles.
 */
export type TunnelStyle = "wrap-around" | "portals";

/** One line of the road legend in the How to play screen. */
export interface RoadLegendEntry {
  style:
    | "arrow"
    | "road"
    | "tunnel"
    | "carousel"
    | "ice"
    | "causeway"
    | "quay"
    | "whirlpool"
    | "ferry"
    | "pass"
    | "well"
    | "oasis"
    | "caravan";
  title: string;
  description: string;
}

/** When a causeway stands out of the water: always, at low tide only, or at high tide only. */
export type CausewayOpening = "always" | "low" | "high";

/** Archipel des Marées: one causeway, the two tiles that make it up, and the quay it leads to. */
export interface CausewayConfig {
  nodes: [NodeId, NodeId];
  opensAt: CausewayOpening;
  /** The quay a player caught by the rising water is set down on. */
  quayId: NodeId;
}

/** Archipel des Marées: the tide, the ferry between the quays. */
export interface TidalConfig {
  causeways: CausewayConfig[];
  /** The ferry's circuit, in the order it moors. */
  ferryQuays: NodeId[];
  /** The tiles of each island, quay first then the inner tile: the second one is where a player lands when the quay is taken. */
  islands: NodeId[][];
  /** Name of each island, in the same order. */
  islandNames: string[];
}

/** Désert des Mirages: a pass between the caravan loop and the dunes' loop, and the tile it drops a player on when it shuts. */
export interface PassConfig {
  node: NodeId;
  outer: NodeId;
  inner: NodeId;
}

/** Désert des Mirages: the outer loop the caravan runs along, the passes the sandstorms shut, the wells. */
export interface DesertConfig {
  /** The caravan's loop, in the order it walks (clockwise). */
  outerLoop: NodeId[];
  passes: PassConfig[];
  /** The passes shut during each phase of the storm cycle; the phases alternate every `STORM_ROUNDS` rounds. */
  stormPhases: NodeId[][];
  wells: NodeId[];
  oases: NodeId[];
  /** Where the caravan stands when the game opens. */
  caravanStart: NodeId;
}

export interface BoardMap {
  id: MapId;
  name: string;
  /** One sentence shown under the name on the map picker. */
  tagline: string;
  /** What makes the map play differently, listed on the map picker. */
  highlights: string[];
  themeId: MapThemeId;
  tunnelStyle: TunnelStyle;
  /** Name of the tunnel in texts, e.g. "Tunnel" or "Train fantôme". */
  tunnelName: string;
  nodes: BoardNode[];
  /** Carousel roads are listed in their starting direction. */
  edges: BoardEdge[];
  initialCupNodeId: NodeId;
  /** Banquise: a blizzard moves the temporary ice tile at the start of every this many rounds. */
  blizzardEveryRounds?: number;
  /** Banquise: once a Red Cup was taken, the penguins throw snowballs (see `src/game/snowballs.ts`). */
  snowballs?: boolean;
  /** Luna Park: a ghost roams the whole board (see `src/game/ghost.ts`). */
  haunted?: boolean;
  /** Archipel des Marées: tide, causeways, ferry and islands. */
  tidal?: TidalConfig;
  /** Désert des Mirages: the loops, the passes, the wells, the oases, the caravan. Two Red Cups, one a mirage. */
  desert?: DesertConfig;
  /** Fewest players this map can be played with: the picker greys it out below, the engine refuses to start. */
  minPlayers?: number;
  roadLegend: RoadLegendEntry[];
}
