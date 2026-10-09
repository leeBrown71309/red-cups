import type { ReactNode } from "react";

/**
 * The textures of the cards: one for each card, drawn as a tile that repeats (or, for two of them, over the whole
 * card). A tile is painted over the card's deep colour with its two other colours, so the same code gives every card
 * its own look. The coordinates are those of the 200 × 300 sheet a card is drawn on.
 */

export interface CardPalette {
  /** The darkest colour: the ground of the back. */
  deep: string;
  /** The body colour of the texture. */
  mid: string;
  /** The light of the texture. */
  hi: string;
  /** The vivid colour of the card: ribbon, medallion. */
  accent: string;
  /** The tint of the face's paper. */
  paper: string;
}

export type PatternId =
  | "stripes"
  | "coins"
  | "flames"
  | "clouds"
  | "bolts"
  | "circuit"
  | "tomatoes"
  | "pips"
  | "clover"
  | "casino"
  | "harlequin"
  | "strata"
  | "pentagrams"
  | "wisps"
  | "bricks"
  | "slashes"
  | "notebook"
  | "plaid"
  | "keyholes"
  | "chevrons"
  | "cups"
  | "waves"
  | "scales"
  | "spikes"
  | "jaws"
  | "steps"
  | "leaves"
  | "zigzag"
  | "embers"
  | "claws"
  | "triangles"
  | "patchwork"
  | "umbrellas"
  | "nightsky"
  | "sunburst"
  | "moonsplit";

interface TilePattern {
  w: number;
  h: number;
  draw: (palette: CardPalette) => ReactNode;
}

interface FullPattern {
  full: (palette: CardPalette) => ReactNode;
}

export type CardPattern = TilePattern | FullPattern;

/** A sunburst's rays, alternate wedges out of one point. */
function rays(cx: number, cy: number, count: number, fill: string, opacity = 1): ReactNode {
  const wedges: string[] = [];
  for (let index = 0; index < count; index += 2) {
    const from = (index / count) * Math.PI * 2;
    const to = ((index + 1) / count) * Math.PI * 2;
    const far = 420;
    wedges.push(
      `M${cx} ${cy} L${(cx + far * Math.cos(from)).toFixed(1)} ${(cy + far * Math.sin(from)).toFixed(1)} L${(
        cx +
        far * Math.cos(to)
      ).toFixed(1)} ${(cy + far * Math.sin(to)).toFixed(1)}Z`,
    );
  }
  return <path d={wedges.join(" ")} fill={fill} opacity={opacity} />;
}

export const CARD_PATTERNS: Record<PatternId, CardPattern> = {
  // Lambda: plain diagonal stripes, the card of nobody in particular.
  stripes: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M-10 50 L50 -10 M-10 30 L30 -10 M10 50 L50 10" stroke={mid} strokeWidth="9" />
        <path d="M0 42 L42 0" stroke={hi} strokeWidth="1.6" opacity="0.6" />
      </>
    ),
  },
  // Cupide: a purse of coins.
  coins: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid} stroke={hi} strokeWidth="2">
          <circle cx="10" cy="10" r="9" />
          <circle cx="30" cy="30" r="9" />
        </g>
        <g fill="none" stroke={hi} strokeWidth="1.6">
          <circle cx="10" cy="10" r="5" />
          <circle cx="30" cy="30" r="5" />
        </g>
        <circle cx="30" cy="9" r="2.4" fill={hi} />
        <circle cx="9" cy="31" r="2.4" fill={hi} />
      </>
    ),
  },
  // Le diable: tongues of fire.
  flames: {
    w: 40,
    h: 44,
    draw: ({ mid, hi }) => (
      <>
        <path
          d="M20 3 C26 13 34 18 32 30 C31 38 24 43 20 43 C14 43 8 38 8 30 C8 22 14 20 16 12 C17 9 18 6 20 3Z"
          fill={mid}
        />
        <path d="M20 19 C24 25 27 29 25 34 C24 38 21 40 20 40 C17 40 15 38 15 34 C15 29 19 25 20 19Z" fill={hi} />
        <path d="M0 18 C3 22 4 26 2 30 M40 18 C37 22 36 26 38 30" stroke={mid} strokeWidth="3" fill="none" />
      </>
    ),
  },
  // L'Ange-Gardien: clouds.
  clouds: {
    w: 56,
    h: 36,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid}>
          <circle cx="14" cy="22" r="8" />
          <circle cx="26" cy="17" r="11" />
          <circle cx="38" cy="22" r="8" />
          <rect x="14" y="22" width="24" height="8" />
        </g>
        <path d="M8 6 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill={hi} />
        <circle cx="48" cy="6" r="2" fill={hi} />
      </>
    ),
  },
  // Red Bull: lightning.
  bolts: {
    w: 36,
    h: 48,
    draw: ({ mid, hi }) => (
      <>
        <path d="M21 3 L7 27 H17 L13 46 L30 20 H20Z" fill={mid} />
        <path d="M20 8 L11 24" stroke={hi} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="30" cy="8" r="2" fill={hi} />
        <circle cx="4" cy="40" r="1.6" fill={hi} />
      </>
    ),
  },
  // eShop: a circuit board.
  circuit: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path
          d="M0 20 H13 M27 20 H40 M20 0 V12 M20 28 V40 M20 20 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0"
          stroke={mid}
          strokeWidth="2"
          fill="none"
        />
        <circle cx="20" cy="20" r="3" fill={hi} />
        <rect x="2" y="2" width="5" height="5" fill={hi} opacity="0.8" />
        <rect x="33" y="33" width="5" height="5" fill={hi} opacity="0.8" />
      </>
    ),
  },
  // Tomato Enjoyer: round red tomatoes, a green crown on each.
  tomatoes: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid}>
          <circle cx="10" cy="12" r="9" />
          <circle cx="30" cy="32" r="9" />
        </g>
        <g fill={hi}>
          <path d="M10 3 l2 3 l3 -1 l-1 3 l-4 -1 l-4 1 l-1 -3 l3 1z" />
          <path d="M30 23 l2 3 l3 -1 l-1 3 l-4 -1 l-4 1 l-1 -3 l3 1z" />
        </g>
      </>
    ),
  },
  // Roller: dice.
  pips: {
    w: 44,
    h: 44,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid} stroke={hi} strokeWidth="1.6">
          <rect x="3" y="3" width="17" height="17" rx="4" />
          <rect x="24" y="24" width="17" height="17" rx="4" />
        </g>
        <g fill={hi}>
          <circle cx="8" cy="8" r="1.9" />
          <circle cx="15" cy="15" r="1.9" />
          <circle cx="29" cy="29" r="1.9" />
          <circle cx="36" cy="29" r="1.9" />
          <circle cx="32.5" cy="32.5" r="1.9" />
          <circle cx="29" cy="36" r="1.9" />
          <circle cx="36" cy="36" r="1.9" />
        </g>
      </>
    ),
  },
  // Chance aveugle: four-leaf clovers.
  clover: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid} stroke={hi} strokeWidth="1.4">
          <circle cx="15.5" cy="15.5" r="5.5" />
          <circle cx="24.5" cy="15.5" r="5.5" />
          <circle cx="15.5" cy="24.5" r="5.5" />
          <circle cx="24.5" cy="24.5" r="5.5" />
        </g>
        <path d="M20 22 Q22 30 28 34" stroke={hi} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="4" cy="4" r="1.8" fill={hi} />
        <circle cx="36" cy="36" r="1.8" fill={hi} />
      </>
    ),
  },
  // Double or nothing: a casino floor, every other square a gold coin.
  casino: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <rect x="0" y="0" width="20" height="20" fill={mid} />
        <rect x="20" y="20" width="20" height="20" fill={mid} />
        <circle cx="30" cy="10" r="6" fill={hi} />
        <circle cx="10" cy="30" r="6" fill={hi} />
        <path d="M30 7 v6 M27 10 h6" stroke={mid} strokeWidth="2" />
        <path d="M10 27 v6 M7 30 h6" stroke={mid} strokeWidth="2" />
      </>
    ),
  },
  // Mime: a harlequin's diamonds.
  harlequin: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M20 0 L40 20 L20 40 L0 20Z" fill={mid} />
        <path d="M20 9 L31 20 L20 31 L9 20Z" fill={hi} />
        <path d="M0 0 L8 0 L0 8Z M40 0 L32 0 L40 8Z M0 40 L8 40 L0 32Z M40 40 L32 40 L40 32Z" fill={hi} />
      </>
    ),
  },
  // Taupe: layers of earth, with the mouth of a tunnel.
  strata: {
    w: 56,
    h: 44,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 8 Q14 2 28 8 T56 8 V16 H0Z" fill={mid} />
        <path d="M0 26 Q14 20 28 26 T56 26 V34 H0Z" fill={mid} opacity="0.7" />
        <g fill={hi}>
          <ellipse cx="10" cy="20" rx="4" ry="2.5" />
          <ellipse cx="44" cy="38" rx="4" ry="2.5" />
          <ellipse cx="34" cy="14" rx="2.5" ry="1.6" />
        </g>
        <path d="M18 44 V36 A10 10 0 0 1 38 36 V44" stroke={hi} strokeWidth="2.4" fill="none" />
      </>
    ),
  },
  // Mage noir: pentagrams in circles.
  pentagrams: {
    w: 44,
    h: 44,
    draw: ({ mid, hi }) => (
      <>
        <circle cx="22" cy="22" r="15" fill="none" stroke={mid} strokeWidth="1.8" />
        <path
          d="M22 7 L27.9 31.8 L10.6 14.3 L33.4 14.3 L16.1 31.8Z"
          fill="none"
          stroke={hi}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="0" r="2" fill={mid} />
        <circle cx="44" cy="44" r="2" fill={mid} />
      </>
    ),
  },
  // Sœur Fantôme: two wisps, one the mirror of the other.
  wisps: {
    w: 40,
    h: 48,
    draw: ({ mid, hi }) => (
      <>
        <path
          d="M10 0 C2 12 18 20 10 32 C6 38 8 44 10 48"
          stroke={hi}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M30 0 C38 12 22 20 30 32 C34 38 32 44 30 48"
          stroke={mid}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="20" cy="24" r="1.8" fill={hi} />
      </>
    ),
  },
  // Baraqué: a wall.
  bricks: {
    w: 40,
    h: 24,
    draw: ({ mid, hi }) => (
      <>
        <g fill={mid} stroke={hi} strokeWidth="1.2">
          <rect x="1" y="1" width="18" height="10" rx="1" />
          <rect x="21" y="1" width="18" height="10" rx="1" />
          <rect x="-9" y="13" width="18" height="10" rx="1" />
          <rect x="11" y="13" width="18" height="10" rx="1" />
          <rect x="31" y="13" width="18" height="10" rx="1" />
        </g>
      </>
    ),
  },
  // Non merci: the "no" sign.
  slashes: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <circle cx="20" cy="20" r="12" fill="none" stroke={mid} strokeWidth="4.5" />
        <path d="M11.5 28.5 L28.5 11.5" stroke={hi} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="2" cy="2" r="1.6" fill={hi} />
        <circle cx="38" cy="38" r="1.6" fill={hi} />
      </>
    ),
  },
  // J'prends des notes: the lines of a notebook and its red margin.
  notebook: {
    w: 40,
    h: 18,
    draw: ({ mid, hi, paper }) => (
      <>
        <rect width="40" height="18" fill={hi} />
        <path d="M0 17 H40" stroke={mid} strokeWidth="1.6" />
        <path d="M7 0 V18" stroke="#e0584f" strokeWidth="1.4" />
        <circle cx="2" cy="9" r="1.6" fill={paper} opacity="0.9" />
      </>
    ),
  },
  // Corrupteur: a banknote's guilloche.
  plaid: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <rect width="40" height="10" fill={mid} opacity="0.7" />
        <rect y="22" width="40" height="4" fill={hi} opacity="0.55" />
        <rect width="10" height="40" fill={mid} opacity="0.5" />
        <rect x="24" width="4" height="40" fill={hi} opacity="0.5" />
        <circle cx="32" cy="12" r="3" fill="none" stroke={hi} strokeWidth="1.4" />
      </>
    ),
  },
  // Le Voleur: keyholes in the dark.
  keyholes: {
    w: 36,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <circle cx="18" cy="15" r="6" fill={mid} stroke={hi} strokeWidth="1.6" />
        <path d="M15 19 H21 L23.5 31 H12.5Z" fill={mid} stroke={hi} strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="18" cy="15" r="2" fill={hi} />
      </>
    ),
  },
  // Feu rouge, feu vert: arrows pointing both ways, red above and green below.
  chevrons: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 6 L20 18 L40 6" stroke={mid} strokeWidth="7" fill="none" />
        <path d="M0 26 L20 38 L40 26" stroke={hi} strokeWidth="7" fill="none" />
      </>
    ),
  },
  // New Cup, New Me: a new red cup, over and over.
  cups: {
    w: 36,
    h: 42,
    draw: ({ mid, hi }) => (
      <>
        <path d="M8 8 H28 L25 36 H11Z" fill={mid} stroke={hi} strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx="18" cy="8" rx="10" ry="2.8" fill={hi} />
        <path d="M11 17 H25" stroke={hi} strokeWidth="2" opacity="0.8" />
        <path d="M32 2 v5 M29.5 4.5 h5" stroke={hi} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  // Calme-toi: slow waves.
  waves: {
    w: 40,
    h: 22,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 8 Q10 -2 20 8 T40 8" stroke={mid} strokeWidth="4.5" fill="none" />
        <path d="M0 18 Q10 8 20 18 T40 18" stroke={hi} strokeWidth="1.8" fill="none" opacity="0.8" />
      </>
    ),
  },
  // Bébé de papa: scales of gold, a crown's worth.
  scales: {
    w: 32,
    h: 24,
    draw: ({ mid, hi }) => (
      <g fill={mid} stroke={hi} strokeWidth="1.8">
        <circle cx="0" cy="24" r="13" />
        <circle cx="32" cy="24" r="13" />
        <circle cx="16" cy="12" r="13" />
      </g>
    ),
  },
  // Goblin: a row of warty teeth.
  spikes: {
    w: 40,
    h: 28,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 28 L10 4 L20 28 L30 4 L40 28Z" fill={mid} stroke={hi} strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="10" cy="16" r="1.8" fill={hi} />
        <circle cx="30" cy="16" r="1.8" fill={hi} />
      </>
    ),
  },
  // Piégeur: the jaws of a trap, teeth meshing.
  jaws: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 0 H40 V6 L35 16 L30 6 L25 16 L20 6 L15 16 L10 6 L5 16 L0 6Z" fill={mid} />
        <path d="M0 40 H40 V34 L35 24 L30 34 L25 24 L20 34 L15 24 L10 34 L5 24 L0 34Z" fill={hi} opacity="0.9" />
      </>
    ),
  },
  // Dernier de la classe: stairs, going up.
  steps: {
    w: 48,
    h: 48,
    draw: ({ mid, hi }) => (
      <>
        <rect x="0" y="36" width="12" height="12" fill={mid} />
        <rect x="12" y="24" width="12" height="24" fill={hi} opacity="0.85" />
        <rect x="24" y="12" width="12" height="36" fill={mid} />
        <rect x="36" y="0" width="12" height="48" fill={hi} opacity="0.85" />
      </>
    ),
  },
  // Main verte: leaves.
  leaves: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M5 29 C5 13 17 4 35 6 C35 23 24 33 5 29Z" fill={mid} />
        <path d="M8 27 L29 10" stroke={hi} strokeWidth="2" strokeLinecap="round" />
        <path d="M34 36 C34 30 38 28 40 28 C40 33 38 36 34 36Z" fill={hi} />
      </>
    ),
  },
  // Main rouge: a red zigzag.
  zigzag: {
    w: 40,
    h: 24,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 18 L10 6 L20 18 L30 6 L40 18" stroke={mid} strokeWidth="5.5" fill="none" strokeLinejoin="miter" />
        <path d="M0 23 L10 11 L20 23 L30 11 L40 23" stroke={hi} strokeWidth="1.6" fill="none" opacity="0.7" />
      </>
    ),
  },
  // Habitué de l'Enfer: embers rising.
  embers: {
    w: 40,
    h: 48,
    draw: ({ mid, hi }) => (
      <>
        <circle cx="8" cy="40" r="3.2" fill={hi} />
        <circle cx="28" cy="31" r="2.2" fill={mid} />
        <circle cx="19" cy="14" r="4" fill={hi} opacity="0.9" />
        <circle cx="35" cy="6" r="2.2" fill={mid} />
        <circle cx="4" cy="16" r="1.8" fill={mid} />
        <path d="M30 46 C33 42 31 38 33 35" stroke={mid} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  // Touché funeste: claw marks.
  claws: {
    w: 48,
    h: 48,
    draw: ({ mid, hi }) => (
      <>
        <g fill="none" strokeLinecap="round">
          <path d="M10 4 Q18 24 12 44" stroke={mid} strokeWidth="5" />
          <path d="M24 2 Q32 24 26 46" stroke={mid} strokeWidth="5" />
          <path d="M38 4 Q46 24 40 44" stroke={mid} strokeWidth="5" />
          <path d="M11 8 Q17 24 13 38" stroke={hi} strokeWidth="1.6" />
          <path d="M25 6 Q31 24 27 40" stroke={hi} strokeWidth="1.6" />
        </g>
      </>
    ),
  },
  // Meneur de jeu: a mosaic of triangles, like a game board's pieces.
  triangles: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path d="M0 0 H40 L0 40Z" fill={mid} />
        <path d="M40 40 V0 L0 40Z" fill={hi} opacity="0.55" />
        <path d="M20 8 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill={hi} />
      </>
    ),
  },
  // Brocanteur: a patchwork of what was found.
  patchwork: {
    w: 48,
    h: 48,
    draw: ({ mid, hi, paper }) => (
      <>
        <rect width="24" height="24" fill={mid} />
        <rect x="24" width="24" height="24" fill={hi} opacity="0.55" />
        <rect y="24" width="24" height="24" fill={hi} opacity="0.3" />
        <rect x="24" y="24" width="24" height="24" fill={mid} opacity="0.75" />
        <path d="M0 24 H48 M24 0 V48" stroke={paper} strokeWidth="1.6" strokeDasharray="3 2.5" />
        <path d="M6 6 l4 4 m0 -4 l-4 4 M30 30 l4 4 m0 -4 l-4 4" stroke={paper} strokeWidth="1.4" />
      </>
    ),
  },
  // L'Assureur: umbrellas, and the coins they shelter.
  umbrellas: {
    w: 40,
    h: 40,
    draw: ({ mid, hi }) => (
      <>
        <path
          d="M5 20 A15 15 0 0 1 35 20 Q31 16 27.5 20 Q24 16 20 20 Q16 16 12.5 20 Q9 16 5 20Z"
          fill={mid}
          stroke={hi}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M20 20 V32 Q20 36 16 36" stroke={hi} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="4" cy="36" r="2.4" fill={hi} />
        <circle cx="36" cy="6" r="2.4" fill={hi} />
      </>
    ),
  },
  // L'Ermite: a night sky, a few stars far apart.
  nightsky: {
    w: 64,
    h: 64,
    draw: ({ mid, hi }) => (
      <>
        <path d="M16 12 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill={hi} />
        <circle cx="46" cy="40" r="2.6" fill={hi} />
        <circle cx="52" cy="10" r="1.6" fill={mid} />
        <circle cx="10" cy="48" r="1.6" fill={mid} />
        <circle cx="34" cy="26" r="1.2" fill={mid} />
        <circle cx="26" cy="56" r="1.2" fill={mid} />
      </>
    ),
  },
  // Touché angélique: rays of light out of the middle of the card.
  sunburst: {
    full: ({ deep, mid, hi }) => (
      <>
        <rect width="200" height="300" fill={deep} />
        {rays(100, 150, 28, mid)}
        <circle cx="100" cy="150" r="70" fill={hi} opacity="0.18" />
      </>
    ),
  },
  // Mi-vu, Mi-vue: seen on one side, unseen on the other.
  moonsplit: {
    full: ({ deep, mid, hi }) => (
      <>
        <rect width="200" height="300" fill={hi} />
        <path d="M100 0 H200 V300 H100Z" fill={deep} />
        {/* The daylight half, dotted with sun. */}
        <g fill={mid} opacity="0.55">
          {[30, 90, 150, 210, 270].map((y) => (
            <circle key={y} cx={y % 120 === 90 ? 28 : 62} cy={y} r="6" />
          ))}
        </g>
        {/* The night half, with its stars. */}
        <g fill={hi}>
          {[24, 78, 132, 186, 240, 288].map((y, index) => (
            <circle key={y} cx={index % 2 ? 138 : 172} cy={y} r={index % 3 === 0 ? 3.2 : 2} />
          ))}
        </g>
        <path d="M100 0 V300" stroke={mid} strokeWidth="3" strokeDasharray="6 5" />
      </>
    ),
  },
};
