import { useId, type CSSProperties } from "react";
import type { PassiveId } from "../../game/types";
import { PassiveIcon } from "../icons/passive-icon";
import { CARD_DESIGNS, type CardDesign } from "./card-design";
import { CORNER_SPOTS, FRAME_PATHS, GLYPHS, SHAPE_PATHS, type GlyphId, type ShapeId } from "./card-ornaments";
import { CARD_PATTERNS } from "./card-patterns";

/**
 * The drawings of a card, all on the same 200 × 300 sheet so that the face and the back are built alike: the texture,
 * the frame, the glyphs in the corners, and the back with its medallion.
 */

const INK = "#3a2530";

/** The CSS variables a card's face and plaque read their colours from. */
export function getCardStyle(passiveId: PassiveId): CSSProperties {
  const { palette } = CARD_DESIGNS[passiveId];
  return {
    "--card-accent": palette.accent,
    "--card-deep": palette.deep,
    "--card-mid": palette.mid,
    "--card-hi": palette.hi,
    "--card-paper": palette.paper,
  } as CSSProperties;
}

/** The card's texture over its whole sheet. */
export function CardTexture({ design, bare = false }: { design: CardDesign; bare?: boolean }) {
  const uid = `tex${useId().replace(/:/g, "")}`;
  const pattern = CARD_PATTERNS[design.pattern];
  return (
    <svg
      className="card-art__layer"
      viewBox="0 0 200 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {"full" in pattern ? (
        pattern.full(design.palette)
      ) : (
        <>
          <defs>
            <pattern id={uid} width={pattern.w} height={pattern.h} patternUnits="userSpaceOnUse">
              {pattern.draw(design.palette)}
            </pattern>
          </defs>
          {!bare && <rect width="200" height="300" fill={design.palette.deep} />}
          <rect width="200" height="300" fill={`url(#${uid})`} />
        </>
      )}
    </svg>
  );
}

/** The frame of a card: its border lines, in the card's own style. */
function FrameLines({ design, stroke, width = 3 }: { design: CardDesign; stroke: string; width?: number }) {
  const paths = FRAME_PATHS[design.frame];
  return (
    <g fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round">
      {paths.map((d, index) => (
        <path
          key={index}
          d={d}
          strokeDasharray={design.frame === "stitch" ? "7 6" : undefined}
          opacity={index === 0 ? 1 : 0.7}
        />
      ))}
    </g>
  );
}

function Glyph({
  id,
  x,
  y,
  size,
  fill,
  rotate = 0,
}: {
  id: GlyphId;
  x: number;
  y: number;
  size: number;
  fill: string;
  rotate?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 24}) translate(-12 -12)`}
      fill={fill}
      stroke={INK}
      strokeWidth={1.2 / (size / 24)}
      strokeLinejoin="round"
    >
      {GLYPHS[id]}
    </g>
  );
}

/** The corner glyphs of a card, the lower pair turned upside down like the pips of a playing card. */
function CornerGlyphs({ design, size, fill }: { design: CardDesign; size: number; fill: string }) {
  return (
    <>
      {CORNER_SPOTS.map((spot, index) => (
        <Glyph
          key={index}
          id={design.glyph}
          x={spot.x}
          y={spot.y}
          size={size}
          fill={fill}
          rotate={index > 1 ? 180 : 0}
        />
      ))}
    </>
  );
}

/** What stands behind a face: a faint texture and the frame, with the glyphs in the corners. */
export function CardFaceDecor({ passiveId }: { passiveId: PassiveId }) {
  const design = CARD_DESIGNS[passiveId];
  const { palette } = design;
  return (
    <span className="card-art card-art--face" aria-hidden="true">
      <span className="card-art__texture">
        <CardTexture design={design} bare />
      </span>
      <svg className="card-art__layer" viewBox="0 0 200 300" preserveAspectRatio="none" focusable="false">
        <FrameLines design={design} stroke={palette.accent} width={3.4} />
        <CornerGlyphs design={design} size={16} fill={palette.accent} />
      </svg>
    </span>
  );
}

/** The emblem's setting: the card's own shape, filled and outlined in its colours. */
export function MedallionShape({
  shape,
  passiveId,
  className,
}: {
  shape: ShapeId;
  passiveId: PassiveId;
  className?: string;
}) {
  const { palette } = CARD_DESIGNS[passiveId];
  return (
    <svg className={`card-shape ${className ?? ""}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path
        d={SHAPE_PATHS[shape]}
        fill={palette.paper}
        stroke={palette.accent}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path
        d={SHAPE_PATHS[shape]}
        fill="none"
        stroke={palette.deep}
        strokeWidth="2.4"
        strokeLinejoin="round"
        transform="translate(50 50) scale(0.8) translate(-50 -50)"
        opacity="0.55"
      />
    </svg>
  );
}

/** The crown round the medallion on the back. */
function Ring({ design }: { design: CardDesign }) {
  const { palette } = design;
  if (design.ring === "none") return null;
  if (design.ring === "beads") {
    return (
      <g fill={palette.hi} stroke={INK} strokeWidth="1.4">
        {Array.from({ length: 20 }, (_, index) => {
          const angle = (index / 20) * Math.PI * 2;
          return <circle key={index} cx={100 + 76 * Math.cos(angle)} cy={150 + 76 * Math.sin(angle)} r="3.6" />;
        })}
      </g>
    );
  }
  return (
    <g fill={palette.hi} stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        const half = Math.PI / 32;
        const point = (r: number, a: number) =>
          `${(100 + r * Math.cos(a)).toFixed(1)} ${(150 + r * Math.sin(a)).toFixed(1)}`;
        return <path key={index} d={`M${point(66, angle - half)} L${point(88, angle)} L${point(66, angle + half)}Z`} />;
      })}
    </g>
  );
}

/**
 * The back of a card, built from the same design as its face: the texture of the card, its frame, its glyphs, and in
 * the middle its emblem in its own medallion. Every back is its card's alone, and it turns the same way up or down.
 */
export function CardBack({ passiveId }: { passiveId: PassiveId }) {
  const design = CARD_DESIGNS[passiveId];
  const { palette } = design;
  return (
    <span className="card-back" aria-hidden="true">
      <span className="card-back__sheet">
        <CardTexture design={design} />
      </span>
      <svg className="card-art__layer" viewBox="0 0 200 300" preserveAspectRatio="none" focusable="false">
        <FrameLines design={design} stroke={palette.hi} width={4} />
        <path
          d={FRAME_PATHS.plain[0]}
          fill="none"
          stroke={INK}
          strokeWidth="1.6"
          transform="translate(100 150) scale(0.94 0.95) translate(-100 -150)"
          opacity="0.5"
        />
        <CornerGlyphs design={design} size={24} fill={palette.hi} />
        <Ring design={design} />
        <g transform="translate(100 150) scale(1.15) translate(-50 -50)">
          <path
            d={SHAPE_PATHS[design.shape]}
            fill={palette.accent}
            stroke={INK}
            strokeWidth="4.5"
            strokeLinejoin="round"
            transform="translate(0 4)"
            opacity="0.35"
          />
          <path
            d={SHAPE_PATHS[design.shape]}
            fill={palette.accent}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d={SHAPE_PATHS[design.shape]}
            fill={palette.paper}
            stroke={palette.hi}
            strokeWidth="2.6"
            strokeLinejoin="round"
            transform="translate(50 50) scale(0.8) translate(-50 -50)"
          />
        </g>
      </svg>
      <span className="card-back__emblem">
        <PassiveIcon passiveId={passiveId} size={64} />
      </span>
    </span>
  );
}
