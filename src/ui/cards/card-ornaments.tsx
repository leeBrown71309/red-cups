import type { ReactNode } from "react";

/**
 * What a card is dressed with besides its texture: the shape of its medallion, the little glyph in its corners and the
 * border that frames it. Each card picks one of each, so two cards never share the whole outfit.
 */

export type ShapeId =
  "circle" | "hex" | "shield" | "diamond" | "arch" | "octagon" | "egg" | "burst" | "scallop" | "squircle" | "drop";

function polar(count: number, radius: (index: number) => number): string {
  return (
    Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const r = radius(index);
      return `${index === 0 ? "M" : "L"}${(50 + r * Math.cos(angle)).toFixed(1)} ${(50 + r * Math.sin(angle)).toFixed(1)}`;
    }).join(" ") + "Z"
  );
}

/** The medallion shapes, on a 100 × 100 grid. */
export const SHAPE_PATHS: Record<ShapeId, string> = {
  circle: "M50 4 A46 46 0 1 1 49.99 4Z",
  hex: "M50 4 L90 27 L90 73 L50 96 L10 73 L10 27Z",
  shield: "M50 4 L88 16 V50 C88 74 70 88 50 96 C30 88 12 74 12 50 V16Z",
  diamond: "M50 3 L97 50 L50 97 L3 50Z",
  arch: "M12 96 V46 A38 38 0 0 1 88 46 V96Z",
  octagon: "M32 4 H68 L96 32 V68 L68 96 H32 L4 68 V32Z",
  egg: "M50 4 C74 4 90 34 90 60 C90 82 72 96 50 96 C28 96 10 82 10 60 C10 34 26 4 50 4Z",
  burst: polar(32, (index) => (index % 2 === 0 ? 47 : 37)),
  scallop: polar(80, (index) => 41 + 6 * Math.cos((index / 80) * Math.PI * 2 * 10)),
  squircle: "M50 4 C86 4 96 14 96 50 C96 86 86 96 50 96 C14 96 4 86 4 50 C4 14 14 4 50 4Z",
  drop: "M50 4 C70 34 90 50 90 66 A40 40 0 0 1 10 66 C10 50 30 34 50 4Z",
};

export type GlyphId =
  | "star4"
  | "star5"
  | "coin"
  | "flame"
  | "bolt"
  | "moon"
  | "drop"
  | "leaf"
  | "clover"
  | "diamond"
  | "heart"
  | "ring"
  | "triangle"
  | "key"
  | "cup"
  | "eye"
  | "shield"
  | "arrow"
  | "crown"
  | "page"
  | "die";

/** The glyphs, on a 24 × 24 grid, each a mark of what the card is about. */
export const GLYPHS: Record<GlyphId, ReactNode> = {
  star4: <path d="M12 1 L15 9 L23 12 L15 15 L12 23 L9 15 L1 12 L9 9Z" />,
  star5: <path d="M12 1.5 L14.9 8.6 L22.5 9.2 L16.7 14.2 L18.5 21.6 L12 17.6 L5.5 21.6 L7.3 14.2 L1.5 9.2 L9.1 8.6Z" />,
  coin: <path fillRule="evenodd" d="M12 2 A10 10 0 1 1 11.99 2Z M12 6.5 A5.5 5.5 0 1 0 12.01 6.5Z" />,
  flame: <path d="M12 1 C14 7 20 10 18 17 C17 21 14 23 12 23 C9 23 6 21 6 17 C6 12 10 10 12 1Z" />,
  bolt: <path d="M14 1 L5 14 H11 L9 23 L19 9 H13Z" />,
  moon: <path d="M16 2 A10 10 0 1 0 22 16 A8 8 0 1 1 16 2Z" />,
  drop: <path d="M12 1 C16 8 20 12 20 16 A8 8 0 0 1 4 16 C4 12 8 8 12 1Z" />,
  leaf: <path d="M4 20 C2 9 10 3 21 3 C21 14 15 22 4 20Z" />,
  clover: (
    <>
      <circle cx="8" cy="8" r="4.6" />
      <circle cx="16" cy="8" r="4.6" />
      <circle cx="8" cy="16" r="4.6" />
      <circle cx="16" cy="16" r="4.6" />
    </>
  ),
  diamond: <path d="M12 1 L22 12 L12 23 L2 12Z" />,
  heart: <path d="M12 22 C2 14 2 6 7 4 C10 3 12 5 12 7 C12 5 14 3 17 4 C22 6 22 14 12 22Z" />,
  ring: <path fillRule="evenodd" d="M12 2 A10 10 0 1 1 11.99 2Z M12 7 A5 5 0 1 0 12.01 7Z" />,
  triangle: <path d="M12 2 L22 21 H2Z" />,
  key: (
    <>
      <circle cx="7" cy="12" r="5" />
      <rect x="11" y="10.5" width="12" height="3" />
      <rect x="18" y="13" width="2.6" height="4" />
    </>
  ),
  cup: <path d="M5 3 H19 L17 21 H7Z" />,
  eye: <path fillRule="evenodd" d="M1 12 C5 4 19 4 23 12 C19 20 5 20 1 12Z M12 8 A4 4 0 1 0 12.01 8Z" />,
  shield: <path d="M12 1 L21 4 V12 C21 18 16 21 12 23 C8 21 3 18 3 12 V4Z" />,
  arrow: <path d="M2 9 H14 V3 L23 12 L14 21 V15 H2Z" />,
  crown: <path d="M2 19 L3 7 L8 12 L12 4 L16 12 L21 7 L22 19Z" />,
  page: <path fillRule="evenodd" d="M4 2 H20 V22 H4Z M8 8 H16 V10 H8Z M8 13 H16 V15 H8Z" />,
  die: (
    <path
      fillRule="evenodd"
      d="M3 3 H21 V21 H3Z M7 7 A1.8 1.8 0 1 0 7.01 7Z M17 7 A1.8 1.8 0 1 0 17.01 7Z M12 12 A1.8 1.8 0 1 0 12.01 12Z M7 17 A1.8 1.8 0 1 0 7.01 17Z M17 17 A1.8 1.8 0 1 0 17.01 17Z"
    />
  ),
};

export type FrameId = "plain" | "double" | "notched" | "scallop" | "arch" | "stitch" | "ticket" | "jagged" | "wavy";

const X0 = 12;
const Y0 = 12;
const X1 = 188;
const Y1 = 288;

/** An edge of the frame, drawn as bumps, waves or teeth along the sides of the card. */
function bumpyEdge(kind: "scallop" | "jagged" | "wavy"): string {
  const sides = [
    { from: [X0, Y0], to: [X1, Y0], out: [0, -1] },
    { from: [X1, Y0], to: [X1, Y1], out: [1, 0] },
    { from: [X1, Y1], to: [X0, Y1], out: [0, 1] },
    { from: [X0, Y1], to: [X0, Y0], out: [-1, 0] },
  ];
  let path = `M${X0} ${Y0}`;
  for (const { from, to, out } of sides) {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const count = Math.round(length / 22);
    const dx = (to[0] - from[0]) / count;
    const dy = (to[1] - from[1]) / count;
    for (let step = 1; step <= count; step += 1) {
      const x = from[0] + dx * step;
      const y = from[1] + dy * step;
      if (kind === "scallop") {
        path += ` A${(length / count / 2).toFixed(1)} ${(length / count / 2).toFixed(1)} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else if (kind === "wavy") {
        const sweep = step % 2 === 0 ? 0 : 1;
        path += ` A${(length / count / 2).toFixed(1)} ${(length / count / 2).toFixed(1)} 0 0 ${sweep} ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        const bump = step % 2 === 0 ? 0 : 6;
        path += ` L${(x - dx / 2 + out[0] * bump).toFixed(1)} ${(y - dy / 2 + out[1] * bump).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
  }
  return `${path}Z`;
}

const rect = (inset: number, radius: number) =>
  `M${X0 + inset + radius} ${Y0 + inset} H${X1 - inset - radius} Q${X1 - inset} ${Y0 + inset} ${X1 - inset} ${Y0 + inset + radius} V${
    Y1 - inset - radius
  } Q${X1 - inset} ${Y1 - inset} ${X1 - inset - radius} ${Y1 - inset} H${X0 + inset + radius} Q${X0 + inset} ${Y1 - inset} ${
    X0 + inset
  } ${Y1 - inset - radius} V${Y0 + inset + radius} Q${X0 + inset} ${Y0 + inset} ${X0 + inset + radius} ${Y0 + inset}Z`;

const CUT = 16;
const MIDDLE = 150;

/** The border of each frame, on the 200 × 300 sheet of a card. */
export const FRAME_PATHS: Record<FrameId, string[]> = {
  plain: [rect(0, 12)],
  double: [rect(0, 12), rect(7, 8)],
  notched: [
    `M${X0 + CUT} ${Y0} H${X1 - CUT} L${X1} ${Y0 + CUT} V${Y1 - CUT} L${X1 - CUT} ${Y1} H${X0 + CUT} L${X0} ${Y1 - CUT} V${Y0 + CUT}Z`,
  ],
  scallop: [bumpyEdge("scallop")],
  arch: [`M${X0 + 2} ${Y1} V92 C${X0 + 2} 34 60 ${Y0} 100 ${Y0} C140 ${Y0} ${X1 - 2} 34 ${X1 - 2} 92 V${Y1}Z`],
  stitch: [rect(0, 12)],
  ticket: [
    `M${X0 + 8} ${Y0} H${X1 - 8} Q${X1} ${Y0} ${X1} ${Y0 + 8} V${MIDDLE - 12} A12 12 0 0 0 ${X1} ${MIDDLE + 12} V${Y1 - 8} Q${X1} ${Y1} ${
      X1 - 8
    } ${Y1} H${X0 + 8} Q${X0} ${Y1} ${X0} ${Y1 - 8} V${MIDDLE + 12} A12 12 0 0 0 ${X0} ${MIDDLE - 12} V${Y0 + 8} Q${X0} ${Y0} ${X0 + 8} ${Y0}Z`,
  ],
  jagged: [bumpyEdge("jagged")],
  wavy: [bumpyEdge("wavy")],
};

/** Where the four corner glyphs sit on the sheet. */
export const CORNER_SPOTS: { x: number; y: number }[] = [
  { x: 30, y: 32 },
  { x: 170, y: 32 },
  { x: 30, y: 268 },
  { x: 170, y: 268 },
];
