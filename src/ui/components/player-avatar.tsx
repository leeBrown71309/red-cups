import type { ReactElement } from "react";
import type { PlayerColor } from "../../game/types";
import { getPlayerLook, type AccessoryId, type PlayerLook } from "../../theme/player-looks";

const INK = "#3a2530";
const OUTLINE = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export type AvatarExpression = "happy" | "sleepy" | "worried";

interface PlayerAvatarProps {
  color: PlayerColor;
  size?: number;
  expression?: AvatarExpression;
  className?: string;
}

/** 2D twin of the 3D chibi pawn, used everywhere in the HUD. */
export function PlayerAvatar({ color, size = 48, expression = "happy", className }: PlayerAvatarProps) {
  const look = getPlayerLook(color);
  const behind = look.accessory === "cat-ears" || look.accessory === "horns";

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {behind && <Accessory look={look} />}
      <ellipse cx="22" cy="58" rx="6" ry="3.5" fill={look.deep} {...OUTLINE} strokeWidth={2.5} />
      <ellipse cx="42" cy="58" rx="6" ry="3.5" fill={look.deep} {...OUTLINE} strokeWidth={2.5} />
      <path
        d="M32 15 C47 15 56 26 56 39 C56 51 46 57 32 57 C18 57 8 51 8 39 C8 26 17 15 32 15 Z"
        fill={color}
        {...OUTLINE}
      />
      <ellipse cx="21" cy="25" rx="6" ry="3.5" fill="#ffffff" opacity="0.35" transform="rotate(-25 21 25)" />
      <Face expression={expression} />
      <ellipse cx="15" cy="45" rx="4" ry="2.4" fill="#ff8fa3" opacity="0.8" />
      <ellipse cx="49" cy="45" rx="4" ry="2.4" fill="#ff8fa3" opacity="0.8" />
      {!behind && <Accessory look={look} />}
    </svg>
  );
}

function Face({ expression }: { expression: AvatarExpression }) {
  if (expression === "sleepy") {
    return (
      <>
        <path d="M18 37 C21 40 26 40 29 37" fill="none" {...OUTLINE} />
        <path d="M35 37 C38 40 43 40 46 37" fill="none" {...OUTLINE} />
        <path d="M29 47 C31 49 33 49 35 47" fill="none" {...OUTLINE} strokeWidth={2.5} />
      </>
    );
  }

  const worried = expression === "worried";
  return (
    <>
      <ellipse cx="24" cy="36" rx="6" ry="7" fill="#ffffff" {...OUTLINE} strokeWidth={2.5} />
      <ellipse cx="40" cy="36" rx="6" ry="7" fill="#ffffff" {...OUTLINE} strokeWidth={2.5} />
      <circle cx="25" cy={worried ? 38 : 37} r={worried ? 2.4 : 3.4} fill={INK} />
      <circle cx="41" cy={worried ? 38 : 37} r={worried ? 2.4 : 3.4} fill={INK} />
      <circle cx="26.4" cy="34.6" r="1.3" fill="#ffffff" />
      <circle cx="42.4" cy="34.6" r="1.3" fill="#ffffff" />
      {worried ? (
        <>
          <path d="M18 27 L28 29" {...OUTLINE} strokeWidth={2.5} />
          <path d="M46 27 L36 29" {...OUTLINE} strokeWidth={2.5} />
          <path d="M28 49 C30 47 34 47 36 49" fill="none" {...OUTLINE} strokeWidth={2.5} />
        </>
      ) : (
        <path d="M28 46 C30 49 34 49 36 46" fill="none" {...OUTLINE} strokeWidth={2.5} />
      )}
    </>
  );
}

const ACCESSORY_ART: Record<AccessoryId, (look: PlayerLook) => ReactElement> = {
  "party-hat": () => (
    <g transform="rotate(-10 32 16)">
      <path d="M25 18 L32 1 L39 18 Z" fill="#ffd166" {...OUTLINE} />
      <path d="M28 11 L36 11" stroke="#ff5d8f" strokeWidth="2.5" />
      <circle cx="32" cy="2" r="3.2" fill="#ff5d8f" {...OUTLINE} strokeWidth={2.2} />
    </g>
  ),
  sprout: () => (
    <>
      <path d="M32 16 V8" stroke="#3a9a4a" strokeWidth="3.2" strokeLinecap="round" />
      <ellipse
        cx="25.5"
        cy="7"
        rx="7"
        ry="3.4"
        fill="#7ee07a"
        {...OUTLINE}
        strokeWidth={2.4}
        transform="rotate(-22 25.5 7)"
      />
      <ellipse
        cx="38.5"
        cy="7"
        rx="7"
        ry="3.4"
        fill="#7ee07a"
        {...OUTLINE}
        strokeWidth={2.4}
        transform="rotate(22 38.5 7)"
      />
    </>
  ),
  bow: () => (
    <>
      <path d="M32 16 L21 9 L21 23 Z" fill="#ff6fae" {...OUTLINE} strokeWidth={2.6} />
      <path d="M32 16 L43 9 L43 23 Z" fill="#ff6fae" {...OUTLINE} strokeWidth={2.6} />
      <circle cx="32" cy="16" r="3.4" fill="#ff3f8e" {...OUTLINE} strokeWidth={2.4} />
    </>
  ),
  antenna: (look) => (
    <>
      <path d="M32 16 V6" stroke={look.deep} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="4.2" fill="#ffe066" {...OUTLINE} strokeWidth={2.4} />
    </>
  ),
  horns: () => (
    <>
      <path d="M19 21 L14 6 L26 16 Z" fill="#fff1d6" {...OUTLINE} strokeWidth={2.6} />
      <path d="M45 21 L50 6 L38 16 Z" fill="#fff1d6" {...OUTLINE} strokeWidth={2.6} />
    </>
  ),
  "cat-ears": (look) => (
    <>
      <path d="M13 27 L14 8 L28 18 Z" fill={look.color} {...OUTLINE} />
      <path d="M51 27 L50 8 L36 18 Z" fill={look.color} {...OUTLINE} />
      <path d="M17 20 L17.5 13 L23 17 Z" fill="#ff9fb2" />
      <path d="M47 20 L46.5 13 L41 17 Z" fill="#ff9fb2" />
    </>
  ),
  beanie: () => (
    <>
      <path d="M13 24 C13 10 51 10 51 24 Z" fill="#5aa9e6" {...OUTLINE} />
      <rect x="11" y="21" width="42" height="7" rx="3.5" fill="#3f8fd0" {...OUTLINE} strokeWidth={2.6} />
      <circle cx="32" cy="9" r="4.4" fill="#ffffff" {...OUTLINE} strokeWidth={2.4} />
    </>
  ),
  halo: () => (
    <>
      <ellipse cx="32" cy="7" rx="12" ry="3.8" fill="none" stroke={INK} strokeWidth="6.5" />
      <ellipse cx="32" cy="7" rx="12" ry="3.8" fill="none" stroke="#ffe27a" strokeWidth="3.4" />
    </>
  ),
};

function Accessory({ look }: { look: PlayerLook }) {
  const Art = ACCESSORY_ART[look.accessory];
  return <Art {...look} />;
}
