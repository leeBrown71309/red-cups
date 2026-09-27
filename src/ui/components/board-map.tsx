import { useMemo } from "react";
import { getBoardNode, resolveBoard } from "../../game/board";
import type { MapId, NodeId } from "../../game/types";
import { getSceneTheme } from "../../theme/map-themes";
import { TILE_COLORS } from "../../theme/palette";

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
  return { height, project };
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
 * Flat plan of a board. Arrows show forced directions, the dashed road is the
 * tunnel (wrapping around the classic board, the ghost train at Luna Park)
 * and the pink ring is the carousel with its current direction.
 */
export function BoardMap({ mapId, carouselReversed = false, iceTileNodeId = null, highlightNodeId }: BoardMapProps) {
  const board = resolveBoard(mapId, carouselReversed, iceTileNodeId);
  const theme = getSceneTheme(board.map.themeId);
  const { plan, roads } = theme;
  const { height, project } = useMemo(() => createProjection(board.nodes), [board.nodes]);
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

        return (
          <g key={key}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={plan.road}
              strokeWidth="9"
              strokeLinecap="round"
            />
            {edge.arrow && (
              <>
                <ArrowHead from={start} to={end} at={0.2} color={roads.arrow} ink={plan.ink} />
                <ArrowHead from={start} to={end} at={0.38} color={roads.arrow} ink={plan.ink} />
              </>
            )}
          </g>
        );
      })}

      {board.nodes.map((node) => {
        const center = project(node.x, node.z);
        const colors = TILE_COLORS[node.kind];
        const highlighted = node.id === highlightNodeId;
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
            <circle
              cx={center.x}
              cy={center.y}
              r={
                node.kind === "start"
                  ? TILE_RADIUS + 4
                  : node.kind === "hell" && theme.neonTiles
                    ? TILE_RADIUS + 8
                    : TILE_RADIUS
              }
              fill={colors.top}
              stroke={plan.ink}
              strokeWidth="3"
            />
            <text className="board-map__label" x={center.x} y={center.y + 7} textAnchor="middle" fill={plan.label}>
              {node.kind === "hell" ? "☻" : node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
