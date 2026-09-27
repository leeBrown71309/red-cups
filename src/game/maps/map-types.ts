import type { BoardEdge, BoardNode, MapId, NodeId } from "../types";

/** Art direction of a map: the scene, the flat plan and the lobby card all follow it. */
export type MapThemeId = "toy-box" | "night-fair" | "polar";

/**
 * How a tunnel is drawn. The classic tunnel leaves through one side of the
 * tray and comes back through the other; the ghost train dives into a
 * haunted house beside each of its two tiles.
 */
export type TunnelStyle = "wrap-around" | "portals";

/** One line of the road legend in the How to play screen. */
export interface RoadLegendEntry {
  style: "arrow" | "road" | "tunnel" | "carousel" | "ice";
  title: string;
  description: string;
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
  roadLegend: RoadLegendEntry[];
}
