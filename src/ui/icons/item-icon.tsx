import type { ReactElement, SVGProps } from "react";
import type { ItemId } from "../../game/types";

const INK = "#3a2530";
const OUTLINE = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

interface IconProps {
  size?: number;
  className?: string;
}

function IconFrame({ size = 48, className, children, ...rest }: IconProps & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Original illustrations for every shop item, drawn in the board's toy style. */
const ITEM_ARTWORK: Record<ItemId, () => ReactElement> = {
  ndoye: () => (
    <>
      <circle cx="32" cy="35" r="22" fill="#7a5aa8" {...OUTLINE} />
      <path d="M32 35 L32 13 A22 22 0 0 1 51.05 24 Z" fill="#4b3566" />
      <path d="M32 35 L51.05 46 A22 22 0 0 1 32 57 Z" fill="#4b3566" />
      <path d="M32 35 L12.95 46 A22 22 0 0 1 12.95 24 Z" fill="#4b3566" />
      <circle cx="32" cy="35" r="22" fill="none" {...OUTLINE} />
      <circle cx="32" cy="35" r="5.5" fill="#ffd166" {...OUTLINE} strokeWidth={3} />
      <path d="M25 5 L39 5 L32 16 Z" fill="#e8453c" {...OUTLINE} />
    </>
  ),
  "hollow-purple": () => (
    <>
      <circle cx="13" cy="15" r="6" fill="#ff5d5d" {...OUTLINE} />
      <circle cx="52" cy="50" r="6" fill="#4fa5f2" {...OUTLINE} />
      <circle cx="32" cy="33" r="19" fill="#9b5de5" {...OUTLINE} />
      <circle cx="32" cy="33" r="10" fill="#dcbcff" />
      <circle cx="27" cy="27" r="4" fill="#ffffff" />
      <path d="M9 40 C17 57 49 57 55 30" fill="none" stroke="#5b2a9e" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  rope: () => (
    <>
      <path d="M48 29 C58 22 56 9 45 8" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M48 29 C58 22 56 9 45 8" fill="none" stroke="#e0a868" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="30" cy="38" rx="21" ry="17" fill="#e0a868" {...OUTLINE} />
      <ellipse cx="30" cy="38" rx="13" ry="10" fill="none" stroke="#b27a3e" strokeWidth="3.5" />
      <ellipse cx="30" cy="38" rx="5" ry="3.5" fill="#8f5d2c" />
    </>
  ),
  boot: () => (
    <>
      <path d="M3 25 H12 M1 33 H11 M4 41 H12" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M22 10 H41 V36 L53 41 C59 44 59 55 52 55 H21 C18 55 16 53 16 50 V40 C16 36 20 34 22 32 Z"
        fill="#c9573f"
        {...OUTLINE}
      />
      <rect x="19" y="6" width="25" height="9" rx="3" fill="#f2c76b" {...OUTLINE} />
      <path d="M16 48 H58" stroke={INK} strokeWidth="3.5" />
      <path d="M27 22 V30" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </>
  ),
  mud: () => (
    <>
      <path
        d="M7 44 C4 34 17 29 24 32 C28 23 42 23 45 31 C53 29 61 36 57 44 C54 53 11 55 7 44 Z"
        fill="#8a5a3c"
        {...OUTLINE}
      />
      <circle cx="26" cy="38" r="4.5" fill="#b07a55" stroke={INK} strokeWidth="2.5" />
      <circle cx="40" cy="42" r="3" fill="#b07a55" stroke={INK} strokeWidth="2.5" />
      <path d="M14 45 C17 42 21 42 23 43" fill="none" stroke="#c28d67" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  eraser: () => (
    <g transform="rotate(-28 32 34)">
      <rect x="9" y="23" width="46" height="22" rx="5" fill="#6fb7ff" {...OUTLINE} />
      <path d="M14 23 H33 V45 H14 A5 5 0 0 1 9 40 V28 A5 5 0 0 1 14 23 Z" fill="#ff8fb1" {...OUTLINE} />
      <path d="M16 29 H28" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </g>
  ),
  "bullet-bill": () => (
    <>
      <path d="M13 17 H38 C51 17 59 26 59 32 C59 38 51 47 38 47 H13 Z" fill="#2f2a33" {...OUTLINE} />
      <rect x="6" y="14" width="9" height="36" rx="3" fill="#2f2a33" {...OUTLINE} />
      <ellipse cx="41" cy="29" rx="5.5" ry="6.5" fill="#ffffff" />
      <circle cx="42.5" cy="30" r="2.8" fill={INK} />
      <path d="M34 20 L47 24" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 47 L20 58 L32 50 Z" fill="#ffffff" {...OUTLINE} strokeWidth={3} />
    </>
  ),
  "middle-finger": () => (
    <>
      <rect x="27" y="6" width="11" height="30" rx="5.5" fill="#ffcf9e" {...OUTLINE} />
      <path
        d="M16 36 C16 31 20 29 24 29 H44 C48 29 50 32 50 36 V46 C50 53 44 58 37 58 H28 C21 58 16 53 16 46 Z"
        fill="#ffcf9e"
        {...OUTLINE}
      />
      <path d="M21 29 V36 M44 29 V36" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M16 41 C9 40 9 50 17 50" fill="#ffcf9e" {...OUTLINE} />
      <path d="M31 12 V20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  "monopoly-man": () => (
    <>
      <path d="M18 37 V13 C18 8 46 8 46 13 V37 Z" fill="#2f2a33" {...OUTLINE} />
      <rect x="18" y="28" width="28" height="7" fill="#e8453c" />
      <ellipse cx="32" cy="38" rx="25" ry="6" fill="#2f2a33" {...OUTLINE} />
      <path
        d="M16 53 C22 46 29 48 32 51 C35 48 42 46 48 53 C42 58 35 56 32 53 C29 56 22 58 16 53 Z"
        fill="#ffffff"
        {...OUTLINE}
        strokeWidth={3}
      />
      <path d="M24 15 V25" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </>
  ),
  "water-bottle": () => (
    <>
      <rect x="25" y="3" width="14" height="9" rx="2.5" fill="#2f78c4" {...OUTLINE} />
      <path d="M26 12 H38 L42 19 H22 Z" fill="#cfefff" {...OUTLINE} />
      <rect x="19" y="19" width="26" height="40" rx="8" fill="#bfe8ff" {...OUTLINE} />
      <path d="M19 35 H45 V51 A8 8 0 0 1 37 59 H27 A8 8 0 0 1 19 51 Z" fill="#4fa5f2" />
      <rect x="19" y="19" width="26" height="40" rx="8" fill="none" {...OUTLINE} />
      <path d="M26 39 V52" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
    </>
  ),
  helmet: () => (
    <>
      <path d="M8 43 C8 22 20 12 32 12 C44 12 56 22 56 43 Z" fill="#ffc94d" {...OUTLINE} />
      <path d="M32 12 V42" stroke="#e8983a" strokeWidth="5" />
      <rect x="3" y="41" width="58" height="9" rx="4.5" fill="#f2a93b" {...OUTLINE} />
      <path d="M17 32 C17 25 21 20 26 18" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  draven: () => (
    <>
      <path
        d="M8 46 C10 53 17 58 25 59"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path d="M29 27 L55 57" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M29 27 L55 57" stroke="#a8784f" strokeWidth="4" strokeLinecap="round" />
      <path d="M21 6 C37 8 46 21 41 37 C33 30 22 30 13 33 C18 24 20 15 21 6 Z" fill="#e8453c" {...OUTLINE} />
      <path d="M23 13 C30 16 34 21 35 27" fill="none" stroke="#ffd9d4" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

export function ItemIcon({ itemId, size, className }: IconProps & { itemId: ItemId }) {
  const Artwork = ITEM_ARTWORK[itemId];
  return (
    <IconFrame size={size} className={className}>
      <Artwork />
    </IconFrame>
  );
}

export function RedCupIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <path d="M14 15 H50 L45 56 C45 58 43 60 41 60 H23 C21 60 19 58 19 56 Z" fill="#e8453c" {...OUTLINE} />
      <rect x="10" y="8" width="44" height="9" rx="3.5" fill="#fff4ec" {...OUTLINE} />
      <path d="M17 29 H47 M18.5 41 H45.5" stroke="#b92f2c" strokeWidth="3" />
      <path d="M24 22 L27 52" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    </IconFrame>
  );
}

export function CoinIcon({ size, className }: IconProps) {
  return (
    <IconFrame size={size} className={className}>
      <circle cx="32" cy="32" r="25" fill="#ffc94d" {...OUTLINE} />
      <circle cx="32" cy="32" r="16.5" fill="none" stroke="#e09a22" strokeWidth="3.5" />
      <path
        d="M32 21 L35.2 28.4 L43 28.8 L37 33.8 L39 41.5 L32 37.2 L25 41.5 L27 33.8 L21 28.8 L28.8 28.4 Z"
        fill="#fff4c8"
        stroke="#e09a22"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}
