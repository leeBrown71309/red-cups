const INK = "#3a2530";
const OUTLINE = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export type GhostMood = "menacing" | "laughing" | "defeated";

interface GhostAvatarProps {
  size?: number;
  mood?: GhostMood;
  className?: string;
}

/**
 * 2D portrait of the Luna Park ghost for the HUD: a torn pale sheet with
 * hollow eyes lit from inside, drawn with the same ink outline as the pawns
 * but nothing cute about it.
 */
export function GhostAvatar({ size = 48, mood = "menacing", className }: GhostAvatarProps) {
  const defeated = mood === "defeated";
  const pupil = defeated ? "#8f7fa8" : "#c77dff";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ghost-sheet" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#dff3ee" />
          <stop offset="100%" stopColor="#a9d6cf" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="15" ry="2.6" fill={INK} opacity="0.22" />
      {/* Ragged sleeves, raised to grab when it means business. */}
      <path
        d={mood === "laughing" ? "M13 34 L3 22 L9 23 L6 16 L16 27" : "M13 36 L4 42 L9 43 L6 49 L15 43"}
        fill="url(#ghost-sheet)"
        {...OUTLINE}
      />
      <path
        d={mood === "laughing" ? "M51 34 L61 22 L55 23 L58 16 L48 27" : "M51 36 L60 42 L55 43 L58 49 L49 43"}
        fill="url(#ghost-sheet)"
        {...OUTLINE}
      />
      {/* Tall sheet with a torn, uneven hem. */}
      <path
        d="M32 4 C45 4 52 15 52 28 L52 50 L47 55 L43 49 L38 57 L33 50 L28 57 L23 49 L18 55 L12 50 L12 28 C12 15 19 4 32 4 Z"
        fill="url(#ghost-sheet)"
        {...OUTLINE}
      />
      <path d="M20 12 C23 8 27 7 30 7" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      {/* Hollow sockets, slanted, with a glow deep inside. */}
      <path d="M17 22 L29 25 C29 31 26 33 22 33 C18 33 16 29 17 22 Z" fill={INK} />
      <path d="M47 22 L35 25 C35 31 38 33 42 33 C46 33 48 29 47 22 Z" fill={INK} />
      <circle cx="23" cy="28.5" r={defeated ? 1.4 : 2.3} fill={pupil} />
      <circle cx="41" cy="28.5" r={defeated ? 1.4 : 2.3} fill={pupil} />
      {!defeated && (
        <>
          <circle cx="23" cy="28.5" r="4.4" fill={pupil} opacity="0.25" />
          <circle cx="41" cy="28.5" r="4.4" fill={pupil} opacity="0.25" />
        </>
      )}
      {defeated ? (
        <path d="M24 44 C27 41 37 41 40 44" fill="none" {...OUTLINE} strokeWidth={2.6} />
      ) : (
        <path
          d={
            mood === "laughing"
              ? "M21 37 L43 37 C42 46 37 50 32 50 C27 50 22 46 21 37 Z"
              : "M23 39 C27 36 37 36 41 39 C40 45 36 48 32 48 C28 48 24 45 23 39 Z"
          }
          fill={INK}
        />
      )}
      {!defeated && (
        <path
          d={
            mood === "laughing"
              ? "M24 37 L26 41 L28 37 L30 41 L32 37 L34 41 L36 37 L38 41 L40 37"
              : "M26 38.5 L28 41.5 L30 38 L32 41.5 L34 38 L36 41.5 L38 38.5"
          }
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
