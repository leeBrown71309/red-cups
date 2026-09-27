import * as THREE from "three";
import { getBoardNode, resolveBoard, type Board } from "../game/board";
import type { BoardMap } from "../game/maps/map-types";
import type { BoardEdge, BoardNode, MapId, NodeId } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { getMapLayoutConfig, type MapLayoutConfig } from "./map-layouts";

export const RIM_THICKNESS = 1.1;
export const RIM_HEIGHT = 0.8;

export interface TunnelLayout {
  entrance: THREE.Vector3;
  exit: THREE.Vector3;
}

export interface RoadSegment {
  edge: BoardEdge;
  start: THREE.Vector3;
  end: THREE.Vector3;
  /** Direction of travel for one-way roads, from start to end. */
  directed: boolean;
  tunnel: boolean;
  /** Carousel roads flip their direction during the game. */
  carousel: boolean;
}

/** Room the camera keeps around the tray, and how far it may pan. */
export interface CameraBounds {
  halfWidth: number;
  halfDepth: number;
  panX: number;
  panZ: number;
}

/**
 * Scene geometry of one map: tile positions, tunnel ends, road segments and
 * the areas decorations must keep clear. Built once per board world; roads
 * are laid out in the map's starting direction, the carousel flip only turns
 * its chevrons around.
 */
export class BoardLayout {
  readonly board: Board;
  readonly config: MapLayoutConfig;
  private segments: RoadSegment[] | null = null;

  constructor(mapId: MapId) {
    this.board = resolveBoard(mapId, false);
    this.config = getMapLayoutConfig(mapId);
  }

  get map(): BoardMap {
    return this.board.map;
  }

  get halfWidth(): number {
    return this.config.groundWidth / 2;
  }

  get halfDepth(): number {
    return this.config.groundDepth / 2;
  }

  get cameraBounds(): CameraBounds {
    return {
      halfWidth: this.halfWidth + 1.7,
      halfDepth: this.halfDepth + 1.8,
      panX: this.halfWidth - 0.7,
      panZ: this.halfDepth - 0.3,
    };
  }

  getNode(nodeId: NodeId): BoardNode | undefined {
    return getBoardNode(this.board, nodeId);
  }

  getNodePosition(nodeId: NodeId): THREE.Vector3 {
    const node = this.getNode(nodeId);
    return new THREE.Vector3(node?.x ?? 0, 0, node?.z ?? 0);
  }

  /**
   * Where a tunnel swallows and spits out the pawns. The classic tunnel cuts
   * through the side walls of the tray; the ghost train dives into a portal
   * beside each of its tiles, on the side away from the centre of the board.
   */
  getTunnelLayout(edge: BoardEdge): TunnelLayout {
    const from = this.getNodePosition(edge.from);
    const to = this.getNodePosition(edge.to);

    if (this.map.tunnelStyle === "portals") {
      const outward = (point: THREE.Vector3) =>
        point.clone().addScaledVector(point.clone().setY(0).normalize(), this.config.portalReach);
      return { entrance: outward(from), exit: outward(to) };
    }

    const entranceSide = from.x < 0 ? -1 : 1;
    return {
      entrance: new THREE.Vector3(entranceSide * (this.halfWidth - 0.05), 0, from.z),
      exit: new THREE.Vector3(-entranceSide * (this.halfWidth - 0.05), 0, to.z),
    };
  }

  /**
   * Visual segments for every board edge. A tunnel becomes two segments: from
   * its first tile to its entrance, and from its exit to its second tile.
   */
  getRoadSegments(): RoadSegment[] {
    this.segments ??= this.map.edges.flatMap((edge): RoadSegment[] => {
      const start = this.getNodePosition(edge.from);
      const end = this.getNodePosition(edge.to);
      const tunnel = edge.kind === "tunnel";
      const carousel = edge.kind === "carousel";
      const directed = edge.arrow === true || tunnel || carousel;

      if (tunnel) {
        const layout = this.getTunnelLayout(edge);
        return [
          { edge, start, end: layout.entrance, directed, tunnel, carousel },
          { edge, start: layout.exit, end, directed, tunnel, carousel },
        ];
      }
      return [{ edge, start, end, directed, tunnel, carousel }];
    });
    return this.segments;
  }

  /** Exclusion zones used to keep decorations away from gameplay elements. */
  isAreaFree(x: number, z: number, margin: number): boolean {
    if (Math.abs(x) > this.halfWidth - 0.6 - margin || Math.abs(z) > this.halfDepth - 0.6 - margin) return false;

    for (const node of this.board.nodes) {
      const clearance = node.id === HELL_NODE_ID ? this.config.hellClearance : node.id === START_NODE_ID ? 2.2 : 1.8;
      if (Math.hypot(node.x - x, node.z - z) < clearance + margin) return false;
    }

    for (const [nodeId, placement] of Object.entries(this.config.shopStalls)) {
      const node = this.getNode(Number(nodeId));
      if (!node) continue;
      if (Math.hypot(node.x + placement.x - x, node.z + placement.z - z) < 1.3 + margin) return false;
    }

    const pond = this.config.pond;
    if (pond && Math.hypot(pond.x - x, pond.z - z) < pond.radius + 0.3 + margin) return false;

    for (const edge of this.map.edges) {
      if (edge.kind !== "tunnel" || this.map.tunnelStyle !== "portals") continue;
      const { entrance, exit } = this.getTunnelLayout(edge);
      for (const portal of [entrance, exit]) {
        if (Math.hypot(portal.x - x, portal.z - z) < 1.6 + margin) return false;
      }
    }

    const point = new THREE.Vector3(x, 0, z);
    const closest = new THREE.Vector3();
    for (const segment of this.getRoadSegments()) {
      new THREE.Line3(segment.start, segment.end).closestPointToPoint(point, true, closest);
      if (closest.distanceTo(point) < 0.85 + margin) return false;
    }

    return true;
  }
}
