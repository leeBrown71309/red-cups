import type { ReactElement } from "react";
import { CoinIcon, IconFrame, INK, OUTLINE, RedCupIcon, type IconProps } from "./item-icon";

/**
 * The wiki's own illustrations, drawn like the shop items: one coloured picture for each board (what makes it itself)
 * and for each page of rules, on the same 64 × 64 grid with the same ink outline.
 */

/** Points of a regular polygon, as an SVG `points` value. */
function polygon(cx: number, cy: number, radius: number, sides: number, turn = 0): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = turn + (index / sides) * Math.PI * 2;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");
}

/** A four-point sparkle. */
function sparkle(cx: number, cy: number, size: number): string {
  const inner = size * 0.28;
  return `M${cx} ${cy - size} L${cx + inner} ${cy - inner} L${cx + size} ${cy} L${cx + inner} ${cy + inner} L${cx} ${cy + size} L${cx - inner} ${cy + inner} L${cx - size} ${cy} L${cx - inner} ${cy - inner} Z`;
}

// ------------------------------------------------------------------------------------------------------------ boards

const MAP_ARTWORK: Record<string, () => ReactElement> = {
  // Coffre à jouets: the toy chest the board is made of, with its blocks spilling out.
  classic: () => (
    <>
      <rect x="13" y="12" width="15" height="15" rx="2" fill="#e8453c" {...OUTLINE} transform="rotate(-10 20 19)" />
      <circle cx="42" cy="19" r="9" fill="#4fa5f2" {...OUTLINE} />
      <polygon points="31,5 40,16 22,16" fill="#ffd166" {...OUTLINE} />
      <rect x="7" y="27" width="50" height="29" rx="5" fill="#c98e5a" {...OUTLINE} />
      <path d="M7 38 H57" stroke="#9c6a3c" strokeWidth="3.5" />
      <path d="M15 27 V56 M49 27 V56" stroke="#9c6a3c" strokeWidth="3" />
      <rect x="26" y="33" width="12" height="12" rx="3" fill="#ffd166" {...OUTLINE} strokeWidth={3} />
      <circle cx="32" cy="39" r="2" fill={INK} />
    </>
  ),
  // Banquise: a penguin and the snowball it is about to throw.
  banquise: () => (
    <>
      <ellipse cx="32" cy="58" rx="20" ry="4" fill="#cfe6f7" />
      <path d="M17 38 C9 40 8 49 12 53 C16 51 18 45 19 41 Z" fill="#34507a" {...OUTLINE} strokeWidth={3} />
      <path d="M47 38 C55 40 56 49 52 53 C48 51 46 45 45 41 Z" fill="#34507a" {...OUTLINE} strokeWidth={3} />
      <ellipse cx="32" cy="38" rx="16" ry="19" fill="#34507a" {...OUTLINE} />
      <ellipse cx="32" cy="43" rx="10.5" ry="13.5" fill="#ffffff" />
      <circle cx="26" cy="27" r="3.6" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
      <circle cx="38" cy="27" r="3.6" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
      <circle cx="26.6" cy="27.4" r="1.6" fill={INK} />
      <circle cx="37.4" cy="27.4" r="1.6" fill={INK} />
      <path d="M27.5 32 H36.5 L32 38.5 Z" fill="#ffa94d" {...OUTLINE} strokeWidth={2.5} />
      <path d="M20 58 H28 M36 58 H44" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M20 58 H28 M36 58 H44" stroke="#ffa94d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="54" cy="10" r="6" fill="#ffffff" {...OUTLINE} strokeWidth={3} />
      <path d="M44 14 L48 12" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  // Archipel des Marées: an islet with its palm, and the tide round it.
  archipel: () => (
    <>
      <path d="M12 44 C14 36 50 36 52 44 C52 49 12 49 12 44 Z" fill="#f2d58a" {...OUTLINE} />
      <path d="M32 40 C31 30 33 22 37 15" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M32 40 C31 30 33 22 37 15" fill="none" stroke="#a8784f" strokeWidth="4" strokeLinecap="round" />
      <path d="M37 15 C28 10 20 14 17 21 C26 17 31 17 37 15 Z" fill="#4fae5b" {...OUTLINE} strokeWidth={3} />
      <path d="M37 15 C46 10 54 14 56 22 C47 17 42 17 37 15 Z" fill="#4fae5b" {...OUTLINE} strokeWidth={3} />
      <path d="M37 15 C35 7 40 3 46 3 C42 7 41 11 37 15 Z" fill="#6bd07f" {...OUTLINE} strokeWidth={3} />
      <circle cx="35" cy="19" r="3.4" fill="#8f5d2c" stroke={INK} strokeWidth="2.2" />
      <path d="M2 50 C8 45 14 45 20 50 S32 55 38 50 S50 45 56 50 S62 52 62 52 V62 H2 Z" fill="#4fb6e8" {...OUTLINE} />
      <path
        d="M8 57 C13 54 17 54 22 57 M34 58 C40 55 44 55 50 58"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    </>
  ),
  // Désert des Mirages: a cactus under the sun, a mirage shimmering above the dunes.
  desert: () => (
    <>
      <circle cx="48" cy="15" r="9" fill="#ffcf4d" {...OUTLINE} />
      <path d="M2 50 C14 40 28 42 36 47 C46 41 56 42 62 47 V62 H2 Z" fill="#f2c879" {...OUTLINE} />
      <path d="M6 57 C16 52 26 54 34 58" stroke="#d9a25c" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M17 31 V37 A5 5 0 0 0 22 42 H25" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d="M17 31 V37 A5 5 0 0 0 22 42 H25" fill="none" stroke="#4fae5b" strokeWidth="5" strokeLinecap="round" />
      <rect x="23" y="14" width="14" height="42" rx="7" fill="#4fae5b" {...OUTLINE} />
      <path d="M37 24 H41 A5 5 0 0 1 46 29 V32" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d="M37 24 H41 A5 5 0 0 1 46 29 V32" fill="none" stroke="#4fae5b" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 22 V50" stroke="#3a8a46" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
};

export function MapIcon({ mapId, size, className }: IconProps & { mapId: string }) {
  const Artwork = MAP_ARTWORK[mapId];
  if (!Artwork) return null;
  return (
    <IconFrame size={size} className={className}>
      <Artwork />
    </IconFrame>
  );
}

// ------------------------------------------------------------------------------------------------ pages of the rules

const SYSTEM_ARTWORK: Record<string, () => ReactElement> = {
  // The turn and its energy: a clock with the bolt of energy over it.
  turn: () => (
    <>
      <circle cx="30" cy="32" r="24" fill="#fff4ec" {...OUTLINE} />
      <circle cx="30" cy="32" r="24" fill="none" stroke="#e8453c" strokeWidth="5" opacity="0.9" />
      <path
        d="M30 17 V32 L40 38"
        stroke={INK}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M46 28 L34 46 H43 L40 60 L58 38 H48 L52 28 Z" fill="#62c7ff" {...OUTLINE} strokeWidth={3} />
    </>
  ),
  // Moving: stepping stones along the road, a pawn hopping to the next one.
  move: () => (
    <>
      <polygon points={polygon(14, 48, 10, 6, Math.PI / 6)} fill="#f3e2bf" {...OUTLINE} strokeWidth={3} />
      <polygon points={polygon(32, 38, 10, 6, Math.PI / 6)} fill="#f3e2bf" {...OUTLINE} strokeWidth={3} />
      <polygon points={polygon(50, 28, 10, 6, Math.PI / 6)} fill="#ffd166" {...OUTLINE} strokeWidth={3} />
      <path d="M18 24 C24 14 36 12 44 14" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M18 24 C24 14 36 12 44 14" fill="none" stroke="#5cc96b" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 6 L48 14 L38 21 Z" fill="#5cc96b" {...OUTLINE} strokeWidth={3} />
    </>
  ),
  // The tiles: three of the board's coloured tiles, one over the other.
  tiles: () => (
    <>
      <polygon points={polygon(21, 24, 16, 8, Math.PI / 8)} fill="#4fa5f2" {...OUTLINE} />
      <polygon points={polygon(44, 26, 16, 8, Math.PI / 8)} fill="#e8453c" {...OUTLINE} />
      <polygon points={polygon(32, 43, 17, 8, Math.PI / 8)} fill="#5cc96b" {...OUTLINE} />
      <circle cx="32" cy="43" r="8" fill="#ffffff" opacity="0.9" />
      <path d="M32 38 V48 M27 43 H37" stroke="#3f9b4f" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // Hell: the horned, glowing pit.
  hell: () => (
    <>
      <path d="M12 26 L9 8 L24 17 Z" fill="#7a2fb0" {...OUTLINE} strokeWidth={3} />
      <path d="M52 26 L55 8 L40 17 Z" fill="#7a2fb0" {...OUTLINE} strokeWidth={3} />
      <circle cx="32" cy="36" r="24" fill="#5a3c78" {...OUTLINE} />
      <circle cx="32" cy="36" r="17" fill="#2d1745" />
      <path d="M21 31 L30 34 L22 38 Z" fill="#ffd166" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M43 31 L34 34 L42 38 Z" fill="#ffd166" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M22 46 L26 42 L30 46 L34 42 L38 46 L42 42"
        fill="none"
        stroke="#c86bff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // The bag: a satchel with a buckle and a tomato peeking out.
  bag: () => (
    <>
      <circle cx="42" cy="17" r="9" fill="#e8453c" {...OUTLINE} strokeWidth={3} />
      <path d="M39 9 C41 6 44 6 46 9" fill="none" stroke="#3f9b4f" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M13 22 H51 L56 54 C56 57 54 59 51 59 H13 C10 59 8 57 8 54 Z" fill="#c98e5a" {...OUTLINE} />
      <path
        d="M13 22 C13 14 20 10 32 10 C39 10 43 12 45 15"
        fill="none"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M10 33 H54" stroke="#9c6a3c" strokeWidth="3.5" />
      <rect x="26" y="29" width="12" height="13" rx="3" fill="#ffd166" {...OUTLINE} strokeWidth={3} />
      <circle cx="32" cy="35" r="2" fill={INK} />
    </>
  ),
  // The draft: two cards, one face down.
  draft: () => (
    <>
      <g transform="rotate(-14 24 36)">
        <rect x="9" y="12" width="30" height="42" rx="4" fill="#e8453c" {...OUTLINE} />
        <rect
          x="14"
          y="17"
          width="20"
          height="32"
          rx="2"
          fill="none"
          stroke="#fff4ec"
          strokeWidth="2.5"
          strokeDasharray="4 3"
        />
        <circle cx="24" cy="33" r="6" fill="#fff4ec" />
      </g>
      <g transform="rotate(12 42 34)">
        <rect x="27" y="10" width="30" height="42" rx="4" fill="#fff4ec" {...OUTLINE} />
        <path d={sparkle(42, 28, 9)} fill="#ffd166" {...OUTLINE} strokeWidth={2.5} />
        <path d="M33 45 H51" stroke="#c9b8a0" strokeWidth="3" strokeLinecap="round" />
      </g>
    </>
  ),
  // Online games: the globe, and a red cup on it.
  online: () => (
    <>
      <circle cx="30" cy="32" r="23" fill="#4fa5f2" {...OUTLINE} />
      <path d="M17 22 C20 14 30 12 34 17 C32 22 24 22 22 29 C18 29 15 26 17 22 Z" fill="#5cc96b" />
      <path d="M33 38 C40 34 47 38 46 45 C41 50 34 49 33 38 Z" fill="#5cc96b" />
      <path
        d="M7 32 H53 M30 9 C23 18 23 46 30 55 M30 9 C37 18 37 46 30 55"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        opacity="0.55"
      />
      <circle cx="30" cy="32" r="23" fill="none" {...OUTLINE} />
      <path
        d="M40 30 H60 L57.5 54 C57.5 55.5 56.5 56.5 55 56.5 H45 C43.5 56.5 42.5 55.5 42.5 54 Z"
        fill="#e8453c"
        {...OUTLINE}
        strokeWidth={3}
      />
      <rect x="38" y="26" width="24" height="6" rx="2.5" fill="#fff4ec" {...OUTLINE} strokeWidth={3} />
    </>
  ),
  // Tides and the ferry: the crest of a wave under the moon that pulls it.
  tide: () => (
    <>
      <path d="M44 6 A13 13 0 1 0 56 24 A10 10 0 0 1 44 6 Z" fill="#ffe08a" {...OUTLINE} strokeWidth={3} />
      <path d="M2 42 C6 30 20 24 30 32 C36 24 52 26 56 38 C58 42 62 42 62 42 V62 H2 Z" fill="#4fb6e8" {...OUTLINE} />
      <path d="M18 38 C22 34 28 36 28 42" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M8 54 C13 50 18 50 23 54 S33 58 38 54 S48 50 54 54"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
    </>
  ),
  // Mirages: a red cup and its ghostly twin.
  mirage: () => (
    <>
      <g opacity="0.45">
        <path
          d="M33 15 H57 L53.5 52 C53.5 54 52 55.5 50 55.5 H40 C38 55.5 36.5 54 36.5 52 Z"
          fill="#e8453c"
          stroke={INK}
          strokeWidth="3"
          strokeDasharray="5 4"
        />
        <rect
          x="30"
          y="9"
          width="30"
          height="8"
          rx="3"
          fill="#fff4ec"
          stroke={INK}
          strokeWidth="3"
          strokeDasharray="5 4"
        />
      </g>
      <path d="M8 18 H36 L32.5 58 C32.5 60 31 61 29 61 H15 C13 61 11.5 60 11.5 58 Z" fill="#e8453c" {...OUTLINE} />
      <rect x="5" y="10" width="34" height="9" rx="3.5" fill="#fff4ec" {...OUTLINE} />
      <path d="M14 32 H30 M15 44 H29" stroke="#b92f2c" strokeWidth="3" />
      <path
        d="M44 58 C47 55 50 61 53 58 C56 55 59 61 62 58"
        fill="none"
        stroke="#f2c879"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </>
  ),
  // The Tour de Bénédiction: a halo and the sparkles of a blessing.
  blessing: () => (
    <>
      <ellipse cx="32" cy="14" rx="16" ry="6" fill="none" stroke={INK} strokeWidth="9" />
      <ellipse cx="32" cy="14" rx="16" ry="6" fill="none" stroke="#ffd166" strokeWidth="4.5" />
      <path
        d="M32 24 C46 24 52 36 52 46 C52 56 44 60 32 60 C20 60 12 56 12 46 C12 36 18 24 32 24 Z"
        fill="#fff4ec"
        {...OUTLINE}
      />
      <ellipse cx="25" cy="41" rx="3.2" ry="4.4" fill={INK} />
      <ellipse cx="39" cy="41" rx="3.2" ry="4.4" fill={INK} />
      <path d="M28 49 Q32 53 36 49" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="19" cy="48" rx="3.2" ry="2.2" fill="#ff8fa3" opacity="0.8" />
      <ellipse cx="45" cy="48" rx="3.2" ry="2.2" fill="#ff8fa3" opacity="0.8" />
      <path d={sparkle(8, 24, 6)} fill="#ffd166" {...OUTLINE} strokeWidth={2.5} />
      <path d={sparkle(57, 30, 5)} fill="#ffd166" {...OUTLINE} strokeWidth={2.5} />
    </>
  ),
  // Winning: the crown, and the three cups that earn it.
  victory: () => (
    <>
      <path d="M6 20 L18 32 L32 10 L46 32 L58 20 L53 50 H11 Z" fill="#ffc94d" {...OUTLINE} />
      <path d="M11 50 H53 L54 58 H10 Z" fill="#e09a22" {...OUTLINE} />
      <circle cx="32" cy="38" r="5" fill="#e8453c" stroke={INK} strokeWidth="3" />
      <circle cx="19" cy="42" r="3.2" fill="#4fa5f2" stroke={INK} strokeWidth="2.5" />
      <circle cx="45" cy="42" r="3.2" fill="#5cc96b" stroke={INK} strokeWidth="2.5" />
      <circle cx="6" cy="19" r="3.5" fill="#fff4c8" stroke={INK} strokeWidth="2.5" />
      <circle cx="32" cy="9" r="3.5" fill="#fff4c8" stroke={INK} strokeWidth="2.5" />
      <circle cx="58" cy="19" r="3.5" fill="#fff4c8" stroke={INK} strokeWidth="2.5" />
    </>
  ),
};

/** The Red Cup and the coin already have their pictures in the game: the wiki reuses them. */
export function SystemIcon({ systemId, size, className }: IconProps & { systemId: string }) {
  if (systemId === "cups") return <RedCupIcon size={size} className={className} />;
  if (systemId === "money") return <CoinIcon size={size} className={className} />;
  const Artwork = SYSTEM_ARTWORK[systemId];
  if (!Artwork) return null;
  return (
    <IconFrame size={size} className={className}>
      <Artwork />
    </IconFrame>
  );
}

// ---------------------------------------------------------------------------------------------- shops and duels

const HUB_ARTWORK: Record<string, () => ReactElement> = {
  // The shop: a striped awning over a counter, a coin on it.
  shop: () => (
    <>
      <rect x="9" y="26" width="46" height="31" rx="3" fill="#c98e5a" {...OUTLINE} />
      <rect x="14" y="36" width="36" height="6" fill="#9c6a3c" />
      <path d="M5 14 H59 L55 28 H9 Z" fill="#fff4ec" {...OUTLINE} />
      <path d="M14 14 L12.5 28 M23 14 V28 M32 14 V28 M41 14 V28 M50 14 L51.5 28" stroke="#e8453c" strokeWidth="6" />
      <path d="M5 14 H59 L55 28 H9 Z" fill="none" {...OUTLINE} />
      <path
        d="M9 28 C9 32 17 32 17 28 C17 32 27 32 27 28 C27 32 37 32 37 28 C37 32 47 32 47 28 C47 32 55 32 55 28"
        fill="none"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="9" r="5" fill="#ffc94d" {...OUTLINE} strokeWidth={3} />
      <circle cx="24" cy="49" r="6" fill="#ffc94d" {...OUTLINE} strokeWidth={3} />
      <circle cx="38" cy="50" r="5" fill="#ffc94d" {...OUTLINE} strokeWidth={3} />
    </>
  ),
  // The duels: two crossed blades and the spark where they meet.
  duels: () => (
    <>
      <g transform="rotate(45 32 32)">
        <path d="M28 4 H36 V38 H28 Z" fill="#dfe8f2" {...OUTLINE} />
        <path d="M31 8 V34" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="20" y="38" width="24" height="6" rx="3" fill="#e8453c" {...OUTLINE} />
        <rect x="29" y="44" width="6" height="12" rx="2" fill="#8f5d2c" {...OUTLINE} />
        <circle cx="32" cy="59" r="3.5" fill="#ffc94d" {...OUTLINE} strokeWidth={3} />
      </g>
      <g transform="rotate(-45 32 32)">
        <path d="M28 4 H36 V38 H28 Z" fill="#dfe8f2" {...OUTLINE} />
        <path d="M31 8 V34" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="20" y="38" width="24" height="6" rx="3" fill="#4fa5f2" {...OUTLINE} />
        <rect x="29" y="44" width="6" height="12" rx="2" fill="#8f5d2c" {...OUTLINE} />
        <circle cx="32" cy="59" r="3.5" fill="#ffc94d" {...OUTLINE} strokeWidth={3} />
      </g>
      <path d={sparkle(32, 24, 9)} fill="#ffd166" {...OUTLINE} strokeWidth={3} />
    </>
  ),
};

export function HubIcon({ hubId, size, className }: IconProps & { hubId: string }) {
  const Artwork = HUB_ARTWORK[hubId];
  if (!Artwork) return null;
  return (
    <IconFrame size={size} className={className}>
      <Artwork />
    </IconFrame>
  );
}

export const hasHubIcon = (hubId: string): boolean => hubId in HUB_ARTWORK;

/** Whether the wiki has a picture for this board / page of rules. */
export const hasMapIcon = (mapId: string): boolean => mapId in MAP_ARTWORK;
export const hasSystemIcon = (systemId: string): boolean =>
  systemId in SYSTEM_ARTWORK || systemId === "cups" || systemId === "money";
