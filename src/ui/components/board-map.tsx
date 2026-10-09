import { useMemo } from "react";
import { getBoardNode, resolveBoard } from "../../game/board";
import type { MapId, NodeId } from "../../game/types";
import { getSceneTheme } from "../../theme/map-themes";
import { SCENE_COLORS, TILE_COLORS } from "../../theme/palette";

const WIDTH = 640;
const MARGIN_X = 58;
const MARGIN_Y = 46;
/** The flat plan is slightly squashed vertically, like the 3D board seen from the camera. */
const VERTICAL_SQUASH = 0.91;
const TILE_RADIUS = 21;

interface Point {
  x: number;
  y: number;
}

/** Chevron drawn from explicit geometry, so its direction never depends on marker quirks. */
function ArrowHead({ from, to, at, color, ink }: { from: Point; to: Point; at: number; color: string; ink: string }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const normal = { x: -direction.y, y: direction.x };
  const center = { x: from.x + (to.x - from.x) * at, y: from.y + (to.y - from.y) * at };
  const tip = { x: center.x + direction.x * 7, y: center.y + direction.y * 7 };
  const back = { x: center.x - direction.x * 6, y: center.y - direction.y * 6 };
  const points = [
    `${back.x + normal.x * 9},${back.y + normal.y * 9}`,
    `${tip.x},${tip.y}`,
    `${back.x - normal.x * 9},${back.y - normal.y * 9}`,
  ].join(" ");
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points={points} stroke={ink} strokeWidth="9" />
      <polyline points={points} stroke={color} strokeWidth="4.5" />
    </g>
  );
}

/** A block arrow sticking out of a tile's circle towards its forced exit, its base hidden under the tile. */
function getTileArrowPoints(center: Point, direction: Point, radius: number): string {
  const normal = { x: -direction.y, y: direction.x };
  const at = (along: number, side: number) =>
    `${center.x + direction.x * along + normal.x * side},${center.y + direction.y * along + normal.y * side}`;
  const base = radius - 8;
  const neck = radius + 6;
  const tip = radius + 18;
  return [at(base, 6), at(neck, 6), at(neck, 12), at(tip, 0), at(neck, -12), at(neck, -6), at(base, -6)].join(" ");
}

/**
 * A tile and its arrows, drawn as one shape: the arrows' outlines go under
 * the tile, their fill over its edge, so each arrow grows out of the tile.
 */
function ArrowedTile({
  center,
  radius,
  directions,
  fill,
  ink,
}: {
  center: Point;
  radius: number;
  directions: Point[];
  fill: string;
  ink: string;
}) {
  const arrows = directions.map((direction) => getTileArrowPoints(center, direction, radius));
  return (
    <g strokeLinejoin="round">
      {arrows.map((points) => (
        <polygon key={`outline-${points}`} points={points} fill={fill} stroke={ink} strokeWidth="3" />
      ))}
      <circle cx={center.x} cy={center.y} r={radius} fill={fill} stroke={ink} strokeWidth="3" />
      {arrows.map((points) => (
        <polygon key={`fill-${points}`} points={points} fill={fill} />
      ))}
    </g>
  );
}

/** The legend's sample of an arrow tile. */
export function TileArrowSwatch() {
  return (
    <svg className="legend-arrow-tile" viewBox="0 0 54 26" aria-hidden="true">
      <ArrowedTile
        center={{ x: 14, y: 13 }}
        radius={9}
        directions={[{ x: 1, y: 0 }]}
        fill={TILE_COLORS.start.top}
        ink={SCENE_COLORS.ink}
      />
    </svg>
  );
}

/** Scales the map's coordinates into the SVG, keeping every map at the same width. */
function createProjection(nodes: { x: number; z: number }[]) {
  const xs = nodes.map((node) => node.x);
  const zs = nodes.map((node) => node.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const spanX = Math.max(1, Math.max(...xs) - minX);
  const spanZ = Math.max(1, Math.max(...zs) - minZ);
  const scale = (WIDTH - MARGIN_X * 2) / spanX;
  const height = Math.round(MARGIN_Y * 2 + spanZ * scale * VERTICAL_SQUASH);
  const project = (x: number, z: number): Point => ({
    x: MARGIN_X + (x - minX) * scale,
    y: MARGIN_Y + ((z - minZ) / spanZ) * (height - MARGIN_Y * 2),
  });
  // A large map packs its tiles tighter: they shrink so that two neighbours never touch.
  let closest = Number.POSITIVE_INFINITY;
  nodes.forEach((node, index) => {
    const a = project(node.x, node.z);
    for (const other of nodes.slice(index + 1)) {
      const b = project(other.x, other.z);
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    }
  });
  const tileRadius = Math.min(TILE_RADIUS, Math.max(10, closest * 0.4));
  return { height, project, tileRadius };
}

/** A quadratic curve bowed to one side, so the ghost train does not cross the middle of the plan. */
function bowedPath(start: Point, end: Point, bend: number): { d: string; control: Point } {
  const control = {
    x: (start.x + end.x) / 2 + (end.y - start.y) * bend,
    y: (start.y + end.y) / 2 - (end.x - start.x) * bend,
  };
  return { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, control };
}

interface BoardMapProps {
  mapId: MapId;
  /** Luna Park: draw the carousel the way it currently turns. */
  carouselReversed?: boolean;
  /** Banquise: the blizzard's temporary ice tile, drawn like the permanent ice. */
  iceTileNodeId?: NodeId | null;
  highlightNodeId?: NodeId;
}

/**
 * Flat plan of a board. An arrow tile grows an arrow towards its forced exit,
 * the dashed road is the tunnel (wrapping around the classic board, the ghost
 * train at Luna Park) and the pink ring is the carousel with its current
 * direction.
 */
export function BoardMap({ mapId, carouselReversed = false, iceTileNodeId = null, highlightNodeId }: BoardMapProps) {
  const board = resolveBoard(mapId, carouselReversed, iceTileNodeId);
  const theme = getSceneTheme(board.map.themeId);
  const { plan, roads } = theme;
  const { height, project, tileRadius } = useMemo(() => createProjection(board.nodes), [board.nodes]);
  const tidal = board.map.tidal;
  const islandDiscs = useMemo(
    () =>
      (tidal?.islands ?? []).map((tiles) => {
        const points = tiles.flatMap((nodeId) => {
          const node = getBoardNode(board, nodeId);
          return node ? [project(node.x, node.z)] : [];
        });
        const centre = {
          x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
        };
        const reach = Math.max(...points.map((point) => Math.hypot(point.x - centre.x, point.y - centre.y)));
        return { centre, radius: reach + tileRadius * 1.7 };
      }),
    [board, project, tidal, tileRadius],
  );
  const tunnelStroke = {
    stroke: roads.tunnel,
    strokeWidth: 5,
    strokeDasharray: "8 7",
    strokeLinecap: "round",
    fill: "none",
  } as const;

  return (
    <svg
      className="board-map"
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`Plan du plateau ${board.map.name}`}
    >
      <rect
        x="6"
        y="6"
        width={WIDTH - 12}
        height={height - 12}
        rx="26"
        fill={plan.ground}
        stroke={plan.border}
        strokeWidth="8"
      />

      {islandDiscs.map((disc) => (
        <circle
          key={`${disc.centre.x}-${disc.centre.y}`}
          cx={disc.centre.x}
          cy={disc.centre.y}
          r={disc.radius}
          fill="#f3e3b0"
          stroke="#d9c186"
          strokeWidth="4"
        />
      ))}

      {board.edges.map((edge) => {
        const from = getBoardNode(board, edge.from);
        const to = getBoardNode(board, edge.to);
        if (!from || !to) return null;
        const start = project(from.x, from.z);
        const end = project(to.x, to.z);
        const key = `${edge.from}-${edge.to}`;

        if (edge.kind === "tunnel" && board.map.tunnelStyle === "wrap-around") {
          const leftExit = { x: 14, y: start.y };
          const rightEntry = { x: WIDTH - 14, y: end.y };
          return (
            <g key={key}>
              <line x1={start.x} y1={start.y} x2={leftExit.x} y2={leftExit.y} {...tunnelStroke} />
              <line x1={rightEntry.x} y1={rightEntry.y} x2={end.x} y2={end.y} {...tunnelStroke} />
              <ArrowHead from={start} to={leftExit} at={0.55} color={roads.tunnel} ink={plan.ink} />
              <ArrowHead from={rightEntry} to={end} at={0.45} color={roads.tunnel} ink={plan.ink} />
            </g>
          );
        }

        if (edge.kind === "tunnel") {
          const { d, control } = bowedPath(start, end, 0.32);
          // The chevron sits on the curve's last stretch, pointing towards the exit tile.
          return (
            <g key={key}>
              <path d={d} {...tunnelStroke} />
              <ArrowHead from={control} to={end} at={0.72} color={roads.tunnel} ink={plan.ink} />
            </g>
          );
        }

        if (edge.kind === "carousel") {
          return (
            <g key={key}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={roads.carousel}
                strokeWidth="8"
                strokeLinecap="round"
              />
              <ArrowHead from={start} to={end} at={0.5} color="#ffffff" ink={plan.ink} />
            </g>
          );
        }

        const onWater = from.kind === "causeway" || to.kind === "causeway";
        return (
          <g key={key}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={plan.road}
              strokeWidth={onWater ? 11 : 9}
              strokeLinecap="round"
            />
            {onWater && (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#a89a80"
                strokeWidth="3"
                strokeDasharray="2 7"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}

      {board.nodes.map((node) => {
        const center = project(node.x, node.z);
        const colors = TILE_COLORS[node.kind];
        const highlighted = node.id === highlightNodeId;
        const radius =
          node.kind === "start"
            ? tileRadius + 4
            : node.kind === "hell" && theme.neonTiles
              ? tileRadius + 8
              : node.kind === "hell" && tidal
                ? tileRadius * 1.9
                : tileRadius;
        const arrowDirections = board.edges
          .filter((edge) => edge.arrow && edge.from === node.id)
          .flatMap((edge) => {
            const target = getBoardNode(board, edge.to);
            if (!target) return [];
            const end = project(target.x, target.z);
            const length = Math.hypot(end.x - center.x, end.y - center.y) || 1;
            return [{ x: (end.x - center.x) / length, y: (end.y - center.y) / length }];
          });
        return (
          <g key={node.id}>
            {highlighted && (
              <circle cx={center.x} cy={center.y} r={TILE_RADIUS + 8} fill="none" stroke="#ffffff" strokeWidth="4" />
            )}
            {node.ice && (
              <circle
                cx={center.x}
                cy={center.y}
                r={TILE_RADIUS + 6}
                fill="#dff6ff"
                stroke="#7fc8ee"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
            )}
            {theme.neonTiles && (
              <circle
                cx={center.x}
                cy={center.y}
                r={TILE_RADIUS + 5}
                fill="none"
                stroke={colors.top}
                strokeWidth="3"
                opacity="0.55"
              />
            )}
            <ArrowedTile
              center={center}
              radius={radius}
              directions={arrowDirections}
              fill={colors.top}
              ink={plan.ink}
            />
            <text
              className="board-map__label"
              x={center.x}
              y={center.y + radius * 0.34}
              textAnchor="middle"
              fill={plan.label}
              style={tileRadius < TILE_RADIUS ? { fontSize: `${Math.round(tileRadius * 1.05)}px` } : undefined}
            >
              {node.kind === "hell" ? (tidal ? "🌀" : "☻") : node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
