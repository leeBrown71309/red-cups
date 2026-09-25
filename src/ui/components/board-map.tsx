import { BOARD_EDGES, BOARD_NODES, getBoardNode } from "../../game/board";
import type { NodeId } from "../../game/types";
import { TILE_COLORS } from "../../theme/palette";

const WIDTH = 640;
const HEIGHT = 360;
const MARGIN_X = 58;
const MARGIN_Y = 46;
const TILE_RADIUS = 21;
const INK = "#3a2530";

function project(x: number, z: number): { x: number; y: number } {
  return {
    x: MARGIN_X + ((x + 8) / 16) * (WIDTH - MARGIN_X * 2),
    y: MARGIN_Y + ((z + 4.5) / 9) * (HEIGHT - MARGIN_Y * 2),
  };
}

interface Point {
  x: number;
  y: number;
}

const TUNNEL_STROKE = { stroke: "#35c6f4", strokeWidth: 5, strokeDasharray: "8 7", strokeLinecap: "round" } as const;

/** Chevron drawn from explicit geometry, so its direction never depends on marker quirks. */
function ArrowHead({ from, to, at, color }: { from: Point; to: Point; at: number; color: string }) {
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
      <polyline points={points} stroke={INK} strokeWidth="9" />
      <polyline points={points} stroke={color} strokeWidth="4.5" />
    </g>
  );
}

/**
 * Flat map of the board, faithful to the original slide: arrows show forced
 * directions, the dashed road is the tunnel that wraps from 7 to 1.
 */
export function BoardMap({ highlightNodeId }: { highlightNodeId?: NodeId }) {
  return (
    <svg className="board-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Plan du plateau">
      <rect
        x="6"
        y="6"
        width={WIDTH - 12}
        height={HEIGHT - 12}
        rx="26"
        fill="#9ad77e"
        stroke="#e6cba9"
        strokeWidth="8"
      />

      {BOARD_EDGES.map((edge) => {
        const from = getBoardNode(edge.from);
        const to = getBoardNode(edge.to);
        if (!from || !to) return null;
        const start = project(from.x, from.z);
        const end = project(to.x, to.z);

        if (edge.kind === "tunnel") {
          const leftExit = { x: 14, y: start.y };
          const rightEntry = { x: WIDTH - 14, y: end.y };
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line x1={start.x} y1={start.y} x2={leftExit.x} y2={leftExit.y} {...TUNNEL_STROKE} />
              <line x1={rightEntry.x} y1={rightEntry.y} x2={end.x} y2={end.y} {...TUNNEL_STROKE} />
              <ArrowHead from={start} to={leftExit} at={0.55} color="#35c6f4" />
              <ArrowHead from={rightEntry} to={end} at={0.45} color="#35c6f4" />
            </g>
          );
        }

        return (
          <g key={`${edge.from}-${edge.to}`}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#f3e2bf"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {edge.oneWay && (
              <>
                <ArrowHead from={start} to={end} at={0.42} color="#ff8f3f" />
                <ArrowHead from={start} to={end} at={0.66} color="#ff8f3f" />
              </>
            )}
          </g>
        );
      })}

      {BOARD_NODES.map((node) => {
        const center = project(node.x, node.z);
        const colors = TILE_COLORS[node.kind];
        const highlighted = node.id === highlightNodeId;
        return (
          <g key={node.id}>
            {highlighted && (
              <circle cx={center.x} cy={center.y} r={TILE_RADIUS + 8} fill="none" stroke="#ffffff" strokeWidth="4" />
            )}
            <circle
              cx={center.x}
              cy={center.y}
              r={node.kind === "start" ? TILE_RADIUS + 4 : TILE_RADIUS}
              fill={colors.top}
              stroke={INK}
              strokeWidth="3"
            />
            <text className="board-map__label" x={center.x} y={center.y + 7} textAnchor="middle">
              {node.kind === "hell" ? "☻" : node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
