import type { WheelId } from "../../game/types";
import { WHEEL_THEMES, type WheelSegment } from "../display/game-display";

const RADIUS = 150;
const INK = "#3a2530";

function polar(angleDegrees: number, radius: number): { x: number; y: number } {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
}

function wedgePath(startAngle: number, endAngle: number): string {
  const start = polar(startAngle, RADIUS);
  const end = polar(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M0 0 L${start.x} ${start.y} A${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

interface WheelDialProps {
  wheelId: WheelId;
  segments: WheelSegment[];
  rotation: number;
  /** Rotation the wheel will stop at; labels are oriented to be readable there. */
  restRotation: number;
  highlightIndex: number | null;
}

/** Carnival wheel. Segment 0 starts at 12 o'clock and wedges run clockwise. */
export function WheelDial({ wheelId, segments, rotation, restRotation, highlightIndex }: WheelDialProps) {
  const theme = WHEEL_THEMES[wheelId];
  const segmentAngle = 360 / segments.length;
  const bulbs = segments.length * 2;

  return (
    <svg className="wheel-dial" viewBox="-175 -185 350 360" role="img" aria-label="Roue">
      <circle r={RADIUS + 18} fill={theme.rim} stroke={INK} strokeWidth="6" />
      {Array.from({ length: bulbs }, (_, index) => {
        const point = polar((index / bulbs) * 360, RADIUS + 9);
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4.5"
            className={`wheel-dial__bulb ${index % 2 === 0 ? "is-even" : ""}`}
          />
        );
      })}
      <g transform={`rotate(${rotation})`}>
        {segments.map((segment, index) => {
          const start = index * segmentAngle;
          const middle = start + segmentAngle / 2;
          // Radial labels pointing left once the wheel stops would read upside down, so they are flipped.
          const restAngle = ((middle - 90 + restRotation) * Math.PI) / 180;
          const flip = Math.cos(restAngle) < 0 ? " rotate(180)" : "";
          return (
            <g key={index}>
              <path
                d={wedgePath(start, start + segmentAngle)}
                fill={segment.color}
                stroke={INK}
                strokeWidth="3"
                className={highlightIndex === index ? "wheel-dial__wedge is-winner" : "wheel-dial__wedge"}
              />
              <text
                className="wheel-dial__label"
                transform={`rotate(${middle - 90}) translate(${RADIUS * 0.6} 0)${flip}`}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {segment.label}
              </text>
            </g>
          );
        })}
      </g>
      <circle r="30" fill={theme.hub} stroke={INK} strokeWidth="5" />
      <circle r="11" fill={INK} opacity="0.85" />
      <path d="M-18 -178 L18 -178 L0 -142 Z" fill="#e8453c" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}
