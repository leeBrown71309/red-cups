import * as THREE from "three";
import { getBoardNode, resolveBoard, type Board } from "../game/board";
import { OPEN_NODE_POSITIONS } from "../game/maps/open-layouts";
import { resolveWorldStyle } from "../game/maps/world-style";
import type { BoardMap } from "../game/maps/map-types";
import type { BoardEdge, BoardNode, MapId, NodeId, WorldStyle } from "../game/types";
import { HELL_NODE_ID, START_NODE_ID } from "../game/types";
import { getMapLayoutConfig, type MapLayoutConfig } from "./map-layouts";
import { TILE_RADIUS } from "./models/tile-model";
import { createRandom } from "./scene-kit";

export const RIM_THICKNESS = 1.1;
export const RIM_HEIGHT = 0.8;
/** Without a tray, the camera may step back a little further to take in the landscape. */
const OPEN_ZOOM_OUT_FACTOR = 1.3;

/** How a plain road bends away from the straight line between its two tiles, in world units across the road. */
interface RoadBend {
  /** The bow: the whole road leans this far to one side at its middle. */
  bow: number;
  /** A gentle wave on top of the bow: its size, its number of half-turns and where it starts. */
  wave: number;
  turns: number;
  phase: number;
  /** A rock sits on the straight line, and the road goes round it. */
  rock: { x: number; z: number; scale: number } | null;
}

const BEND_SAMPLES_PER_UNIT = 2.5;
/** Roads shorter than this stay straight: there is no room to bend them. */
const MIN_BENDABLE_LENGTH = 2.6;

/** How far a bend leans from the straight road at `progress` along it: nothing and no slope at either tile. */
function bendOffset(bend: RoadBend, progress: number): number {
  const envelope = Math.sin(Math.PI * progress) ** 2;
  return envelope * (bend.bow + bend.wave * Math.sin(Math.PI * bend.turns * 2 * progress + bend.phase));
}

export interface TunnelLayout {
  entrance: THREE.Vector3;
  exit: THREE.Vector3;
}

export interface RoadSegment {
  edge: BoardEdge;
  start: THREE.Vector3;
  end: THREE.Vector3;
  /**
   * A road that runs one way, from start to end: a tunnel or the carousel.
   * An arrow tile's forced exit is not one: the arrow is drawn on its tile.
   */
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
  /** Multiplies the furthest zoom-out the camera allows. */
  zoomOutFactor: number;
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
  /** No tray round the board: the large maps always, the first ones in their open version. */
  readonly openWorld: boolean;
  /** Plain roads wind between their tiles, round the odd rock: the maps that ask for it, in the open world. */
  readonly windingRoads: boolean;
  private readonly bends = new Map<string, RoadBend>();
  /** Spots the scenery has taken (a snowman, a pole, a tent): what is placed after keeps clear of them. */
  private readonly reserved: { x: number; z: number; radius: number }[] = [];

  constructor(mapId: MapId, worldStyle: WorldStyle = "boxed") {
    const base = getMapLayoutConfig(mapId);
    const style = resolveWorldStyle(mapId, worldStyle);
    this.openWorld = base.openWorld ?? style === "open";
    // In the open version a map stands its tiles further apart (same tiles, same roads): the scene's own copy of the
    // board moves them, the rules never look at where they stand.
    const positions = style === "open" ? OPEN_NODE_POSITIONS[mapId] : undefined;
    const board = resolveBoard(mapId, false);
    this.board = positions
      ? { ...board, nodes: board.nodes.map((node) => ({ ...node, ...positions[node.id] })) }
      : board;
    this.config = style === "open" && base.open ? { ...base, ...base.open } : base;
    this.windingRoads = this.openWorld && this.config.windingRoads === true;
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
      zoomOutFactor: this.config.zoomOutFactor ?? (this.openWorld ? OPEN_ZOOM_OUT_FACTOR : 1),
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
      const directed = tunnel || carousel;

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

  /** The bend of the plain road joining `a` and `b`, worked out once: the same for both directions. */
  private getBend(a: NodeId, b: NodeId): RoadBend | null {
    if (!this.windingRoads) return null;
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const key = `${low}-${high}`;
    const known = this.bends.get(key);
    if (known) return known;
    const from = this.getNode(low);
    const to = this.getNode(high);
    const edge = this.map.edges.find(
      (candidate) => Math.min(candidate.from, candidate.to) === low && Math.max(candidate.from, candidate.to) === high,
    );
    const length = from && to ? Math.hypot(to.x - from.x, to.z - from.z) : 0;
    const none: RoadBend = { bow: 0, wave: 0, turns: 1, phase: 0, rock: null };
    // A road onto the ice stays straight: pawns slide along it.
    const straight = from?.ice === true || to?.ice === true;
    if (
      !from ||
      !to ||
      !edge ||
      straight ||
      edge.kind === "tunnel" ||
      edge.kind === "carousel" ||
      length < MIN_BENDABLE_LENGTH
    ) {
      this.bends.set(key, none);
      return none;
    }
    const random = createRandom(low * 131 + high * 17 + 5);
    const sign = random() < 0.5 ? -1 : 1;
    // Some roads go round a rock sitting right on their line; the others just wind a little.
    const detour = length > 3.4 && random() < 0.45;
    let bend: RoadBend = detour
      ? {
          bow: sign * (0.85 + random() * 0.3),
          wave: 0,
          turns: 1,
          phase: 0,
          rock: { x: 0, z: 0, scale: 0.9 + random() * 0.4 },
        }
      : {
          bow: sign * (0.2 + random() * 0.35),
          wave: (random() < 0.5 ? -1 : 1) * (0.15 + random() * 0.3),
          turns: random() < 0.5 ? 1 : 2,
          phase: random() * Math.PI * 2,
          rock: null,
        };
    // Other tiles must stay clear of the road: flatten the bend until it does.
    for (let attempt = 0; attempt < 5 && !this.bendClearsTiles(from, to, bend, low, high); attempt += 1) {
      bend = { ...bend, bow: bend.bow * 0.6, wave: bend.wave * 0.6, rock: bend.rock && attempt < 3 ? bend.rock : null };
    }
    if (bend.rock) {
      const side = this.sideOf(from, to);
      const lean = Math.sign(bend.bow);
      // The rock sits on the straight line, a hair towards the side the road does not lean to.
      bend.rock = {
        ...bend.rock,
        x: (from.x + to.x) / 2 - side.x * lean * 0.12,
        z: (from.z + to.z) / 2 - side.z * lean * 0.12,
      };
    }
    this.bends.set(key, bend);
    return bend;
  }

  private sideOf(from: BoardNode, to: BoardNode): { x: number; z: number } {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    return { x: -(to.z - from.z) / length, z: (to.x - from.x) / length };
  }

  private bendClearsTiles(from: BoardNode, to: BoardNode, bend: RoadBend, low: NodeId, high: NodeId): boolean {
    const side = this.sideOf(from, to);
    const steps = 18;
    for (let step = 1; step < steps; step += 1) {
      const s = step / steps;
      const offset = bendOffset(bend, s);
      const x = from.x + (to.x - from.x) * s + side.x * offset;
      const z = from.z + (to.z - from.z) * s + side.z * offset;
      for (const node of this.board.nodes) {
        if (node.id === low || node.id === high) continue;
        if (Math.hypot(node.x - x, node.z - z) < TILE_RADIUS + 0.7) return false;
      }
    }
    return true;
  }

  /**
   * Where a hop from `a` to `b` is pushed sideways at `progress` (0 at `a`, 1 at `b`), so a pawn follows the winding
   * road instead of flying over the straight line. Zero for a straight road.
   */
  getRoadBend(a: NodeId, b: NodeId, progress: number): THREE.Vector3 {
    const bend = this.getBend(a, b);
    const from = this.getNode(Math.min(a, b));
    const to = this.getNode(Math.max(a, b));
    if (!bend || !from || !to) return new THREE.Vector3();
    const side = this.sideOf(from, to);
    const offset = bendOffset(bend, a < b ? progress : 1 - progress);
    return new THREE.Vector3(side.x * offset, 0, side.z * offset);
  }

  /** The points of a road segment, bent when roads wind, otherwise just its two ends. */
  getRoadPoints(segment: RoadSegment): THREE.Vector3[] {
    const { start, end } = segment;
    if (!this.windingRoads || segment.directed) return [start.clone(), end.clone()];
    const count = Math.max(6, Math.ceil(start.distanceTo(end) * BEND_SAMPLES_PER_UNIT));
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= count; step += 1) {
      const progress = step / count;
      points.push(
        start
          .clone()
          .lerp(end, progress)
          .add(this.getRoadBend(segment.edge.from, segment.edge.to, progress)),
      );
    }
    return points;
  }

  /** The rocks the roads go round. */
  getRoadRocks(): { x: number; z: number; scale: number }[] {
    if (!this.windingRoads) return [];
    const rocks: { x: number; z: number; scale: number }[] = [];
    for (const edge of this.map.edges) {
      const bend = this.getBend(edge.from, edge.to);
      if (bend?.rock) rocks.push(bend.rock);
    }
    return rocks;
  }

  /** Marks a spot as taken by a piece of scenery, so nothing placed later stands in it. */
  reserve(x: number, z: number, radius: number): void {
    this.reserved.push({ x, z, radius });
  }

  getReserved(): readonly { x: number; z: number; radius: number }[] {
    return this.reserved;
  }

  /** Exclusion zones used to keep decorations away from gameplay elements. */
  isAreaFree(x: number, z: number, margin: number): boolean {
    if (Math.abs(x) > this.halfWidth - 0.6 - margin || Math.abs(z) > this.halfDepth - 0.6 - margin) return false;
    return this.isClearOfBoard(x, z, margin);
  }

  /** Whether nothing of the game stands at (x, z): tiles, stalls, the pond, portals, roads. The old tray edge is ignored. */
  isClearOfBoard(x: number, z: number, margin: number): boolean {
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

    for (const zone of this.config.clearZones) {
      if (Math.abs(x - zone.x) < zone.halfWidth + margin && Math.abs(z - zone.z) < zone.halfDepth + margin)
        return false;
    }

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
      const points = this.getRoadPoints(segment);
      for (let index = 1; index < points.length; index += 1) {
        new THREE.Line3(points[index - 1], points[index]).closestPointToPoint(point, true, closest);
        if (closest.distanceTo(point) < 0.85 + margin) return false;
      }
    }

    for (const rock of this.getRoadRocks()) {
      if (Math.hypot(rock.x - x, rock.z - z) < 0.9 + margin) return false;
    }

    for (const taken of this.reserved) {
      if (Math.hypot(taken.x - x, taken.z - z) < taken.radius + margin) return false;
    }

    return true;
  }
}
