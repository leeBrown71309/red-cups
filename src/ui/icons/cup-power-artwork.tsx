import type { ReactElement } from "react";
import { INK, OUTLINE } from "./item-icon";

/**
 * Emblems of the Cups Power cards that arrived with 0.2.3 and of the two new talismans, in the same toy style as
 * `passive-icon.tsx`: thick ink contours, flat colours, a 64 × 64 grid. They live in their own file so the shared
 * icon modules stay small; `INK` and `OUTLINE` come from `item-icon.tsx` like everywhere else.
 */
export type CupPowerArtworkId = "mime" | "mole" | "black-mage" | "half-seen" | "ghost-sister" | "hermit" | "insurer";

const CREAM = "#fff4ec";
const GOLD = "#ffd166";
const GLASS_BLUE = "#8fd3ff";

/** The shoulders and striped shirt under the mime's chin. */
const MIME_SHIRT_PATH = "M7 58 C7 50.5 14 47 24 47 C34 47 41 50.5 41 58 Z";

/** The sheet of the little ghost, shared by her body and by her faint mirrored shadow. */
const GHOST_BODY_PATH =
  "M18 53 C18 43 17 36 17.5 28 C18.5 15 24 6 32 6 C40 6 45.5 15 46.5 28 C47 36 46 43 46 53 Q42.5 61 39 53 Q35.5 61 32 53 Q28.5 61 25 53 Q21.5 61 18 53 Z";

/** Three curved claws pointing up from the origin, drawn on top of a paw ellipse by the mole. */
const MOLE_CLAWS_PATH =
  "M-7.5 -3 Q-7.5 -8.5 -5 -11.5 Q-2.4 -8.5 -2.3 -3 Z M-2.6 -3 Q-2.6 -9 0 -12.5 Q2.6 -9 2.6 -3 Z M2.3 -3 Q2.4 -8.5 5 -11.5 Q7.5 -8.5 7.5 -3 Z";

export const CUP_POWER_ARTWORK: Record<CupPowerArtworkId, () => ReactElement> = {
  // A mime in a red beret, one white glove flat against an invisible pane of glass.
  mime: () => (
    <>
      <defs>
        <clipPath id="mime-shirt-clip">
          <path d={MIME_SHIRT_PATH} />
        </clipPath>
      </defs>
      <rect
        x="4"
        y="5"
        width="56"
        height="54"
        rx="6"
        fill="#bfe6ff"
        fillOpacity="0.4"
        stroke={GLASS_BLUE}
        strokeWidth="2.5"
      />
      <path d={MIME_SHIRT_PATH} fill="#ffffff" />
      <path d="M5 52.3 H43 M5 55.7 H43" stroke={INK} strokeWidth="2" clipPath="url(#mime-shirt-clip)" />
      <path d={MIME_SHIRT_PATH} fill="none" {...OUTLINE} strokeWidth="3" />
      <ellipse cx="24" cy="35" rx="14" ry="15" fill={CREAM} {...OUTLINE} />
      <path
        d="M15.5 30 C17.5 26.5 21 26.5 22.5 29.5 M26 29.5 C27.5 26.5 31 26.5 33 30"
        fill="none"
        stroke={INK}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <ellipse cx="19" cy="35" rx="2.2" ry="2.9" fill={INK} />
      <ellipse cx="29.5" cy="35" rx="2.2" ry="2.9" fill={INK} />
      <circle cx="19.6" cy="34" r="0.9" fill="#ffffff" />
      <circle cx="30.1" cy="34" r="0.9" fill="#ffffff" />
      <circle cx="14.5" cy="41.5" r="2.4" fill="#f2594f" />
      <circle cx="33.5" cy="41.5" r="2.4" fill="#f2594f" />
      <path
        d="M20 44.5 C22 48 26.5 48 28.5 44.5 C26.5 45.8 22 45.8 20 44.5 Z"
        fill="#e8453c"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g transform="rotate(-10 22 17)">
        <ellipse cx="22" cy="17" rx="15.5" ry="7.8" fill="#e8453c" {...OUTLINE} />
        <path
          d="M8 18.5 C12.5 23.5 31.5 23.5 36 18.5"
          fill="none"
          stroke="#b92f2c"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M13 12.5 C16 10.5 19 10 22 10.2"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="29" cy="9" r="2.4" fill="#e8453c" stroke={INK} strokeWidth="2.2" />
      </g>
      <ellipse
        cx="40.5"
        cy="42"
        rx="3.2"
        ry="5.8"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="3"
        transform="rotate(-30 40.5 42)"
      />
      <path
        d="M41.5 46 V29 C41.5 26 45.7 26 45.7 29 V25 C45.7 22 49.9 22 49.9 25 V26.5 C49.9 23.5 54.1 23.5 54.1 26.5 V31 C54.1 28.5 58.3 28.5 58.3 31 V46 C58.3 50 56 51 49.9 51 C44 51 41.5 50 41.5 46 Z"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M45.7 31 V38 M49.9 27.5 V38 M54.1 31 V38" stroke="#b9c7d9" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M46 9 L41 20 M53 9 L50.5 15" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // A mole popping out of a mound, star nose first, claws on the rim and clods flying.
  mole: () => (
    <>
      <circle cx="8" cy="22" r="2.6" fill="#b07a55" stroke={INK} strokeWidth="2.2" />
      <circle cx="14" cy="8.5" r="2.2" fill="#b07a55" stroke={INK} strokeWidth="2.2" />
      <circle cx="50" cy="20" r="2.8" fill="#b07a55" stroke={INK} strokeWidth="2.2" />
      <circle cx="43" cy="8" r="2.2" fill="#b07a55" stroke={INK} strokeWidth="2.2" />
      <ellipse cx="27" cy="27" rx="14" ry="16" fill="#7d6e8c" {...OUTLINE} />
      <path
        d="M17 14 C19.5 11.5 23 10.5 26 10.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M17 19 Q19.2 21.4 21.4 19 M32.6 19 Q34.8 21.4 37 19"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M27 21.4 L28.91 25.38 L33.08 23.92 L31.62 28.09 L35.6 30 L31.62 31.91 L33.08 36.08 L28.91 34.62 L27 38.6 L25.09 34.62 L20.92 36.08 L22.38 31.91 L18.4 30 L22.38 28.09 L20.92 23.92 L25.09 25.38 Z"
        fill="#ff9fb2"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="30" r="2.6" fill="#e8607a" />
      <path d="M8 59 C9 48 17 41 27 41 C37 41 45 48 46 59 Z" fill="#8a5a3c" {...OUTLINE} />
      <ellipse cx="20" cy="51" rx="3" ry="2" fill="#a56d47" />
      <ellipse cx="34" cy="49.5" rx="2.4" ry="1.7" fill="#a56d47" />
      <ellipse cx="28" cy="55.5" rx="3.2" ry="1.9" fill="#6d4429" />
      <g transform="translate(14 44.5) rotate(-24)">
        <path d={MOLE_CLAWS_PATH} fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <ellipse cx="0" cy="0" rx="8" ry="5.4" fill={CREAM} {...OUTLINE} strokeWidth="3" />
      </g>
      <g transform="translate(40 44.5) rotate(24)">
        <path d={MOLE_CLAWS_PATH} fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <ellipse cx="0" cy="0" rx="8" ry="5.4" fill={CREAM} {...OUTLINE} strokeWidth="3" />
      </g>
      <ellipse cx="53.5" cy="56" rx="6.3" ry="3.6" fill="#b07a55" {...OUTLINE} strokeWidth="2.5" />
      <ellipse cx="53.5" cy="56.3" rx="4" ry="2" fill="#2a1822" />
    </>
  ),
  // A hooded mage with glowing red eyes; a pentagram floats above his open palm.
  "black-mage": () => (
    <>
      <circle cx="46" cy="15.5" r="13.5" fill="#ff4d4d" opacity="0.28" />
      <circle cx="46" cy="15.5" r="13.5" fill="none" stroke="#ff6b5e" strokeWidth="2" opacity="0.7" />
      <path d="M12 29 C8 38 4 50 5 59 H43 C44 50 40 38 36 29 Z" fill="#3d2a5c" {...OUTLINE} />
      <path
        d="M16 40 C15 47 15 53 14 58 M32 40 C33 47 33 53 34 58 M24 38 V58"
        fill="none"
        stroke="#5b3f8f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M33 33 C37 38 42 37 45 32" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
      <path d="M33 33 C37 38 42 37 45 32" fill="none" stroke="#3d2a5c" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="46.5" cy="29" rx="5" ry="3" fill="#d9c6e8" stroke={INK} strokeWidth="2.5" />
      <path d="M25 4 C33 7 37 17 36.5 28.5 Q24 33 11.5 28.5 C11 17 16 8 25 4 Z" fill="#3d2a5c" {...OUTLINE} />
      <path d="M14 18 C15 13 18 9 21 7" fill="none" stroke="#7a5aa8" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="24" cy="20.5" rx="8.2" ry="8.8" fill="#150d1c" />
      <circle cx="20" cy="21" r="4" fill="#ff4d4d" opacity="0.3" />
      <circle cx="28" cy="21" r="4" fill="#ff4d4d" opacity="0.3" />
      <ellipse cx="20.2" cy="21" rx="2.6" ry="1.7" fill="#ff4d4d" transform="rotate(18 20.2 21)" />
      <ellipse cx="27.8" cy="21" rx="2.6" ry="1.7" fill="#ff4d4d" transform="rotate(-18 27.8 21)" />
      <circle cx="20.6" cy="21" r="0.8" fill="#ffd0c0" />
      <circle cx="27.4" cy="21" r="0.8" fill="#ffd0c0" />
      <circle cx="46" cy="15.5" r="9.5" fill="#2a1a3a" {...OUTLINE} strokeWidth="3" />
      <circle cx="46" cy="15.5" r="7.6" fill="none" stroke="#ff4d4d" strokeWidth="1.4" />
      <path
        d="M46 8.1 L50.35 21.49 L38.96 13.21 L53.04 13.21 L41.65 21.49 Z"
        fill="none"
        stroke="#ff4d4d"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </>
  ),
  // A face cut in two: the left half is there, the right half is a dashed ghost dissolving into pixels.
  "half-seen": () => (
    <>
      <path d="M28 13 A20 20 0 0 1 28 53 Z" fill={GLASS_BLUE} fillOpacity="0.22" />
      <path d="M28 13 A20 20 0 0 0 28 53 Z" fill="#ffe9d0" {...OUTLINE} />
      <path
        d="M28 13 A20 20 0 0 1 28 53"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeDasharray="3.5 4.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M16 23 C18.5 21 22 21 24.5 23" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M31.5 23 C34 21 37.5 21 40 23"
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeDasharray="3.2 3.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <ellipse cx="21" cy="30.5" rx="3.6" ry="4.5" fill={INK} />
      <circle cx="22.2" cy="28.8" r="1.3" fill="#ffffff" />
      <ellipse
        cx="35"
        cy="30.5"
        rx="3.6"
        ry="4.5"
        fill={INK}
        fillOpacity="0.14"
        stroke={INK}
        strokeWidth="2.2"
        strokeDasharray="3 2.6"
        opacity="0.6"
      />
      <circle cx="15.5" cy="38.5" r="3.2" fill="#ffb3b3" opacity="0.8" />
      <circle cx="40.5" cy="38.5" r="3.2" fill="#ffb3b3" opacity="0.3" />
      <path d="M19 42 C22 46 25.5 46.5 28 45.5" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path
        d="M28 45.5 C31 46.5 35 46 37.5 42"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="3.4 3.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <g fill="#4fa5f2">
        <rect x="51" y="21" width="4" height="4" rx="1" opacity="0.85" transform="rotate(12 53 23)" />
        <rect x="52" y="33" width="4.4" height="4.4" rx="1" opacity="0.8" transform="rotate(-10 54 35)" />
        <rect x="50.5" y="43" width="3.6" height="3.6" rx="1" opacity="0.75" transform="rotate(8 52 45)" />
        <rect x="57" y="27" width="3" height="3" rx="0.8" opacity="0.55" />
        <rect x="58" y="39" width="2.6" height="2.6" rx="0.8" opacity="0.5" />
        <rect x="56.5" y="48" width="2.2" height="2.2" rx="0.6" opacity="0.4" />
        <rect x="55" y="15" width="2.4" height="2.4" rx="0.6" opacity="0.45" />
      </g>
    </>
  ),
  // A pale little ghost hugging a teddy bear, her faint mirror image floating beside her.
  "ghost-sister": () => (
    <>
      <circle cx="32" cy="32" r="29" fill="#d6efff" opacity="0.3" />
      <circle cx="32" cy="32" r="23" fill="#d6efff" opacity="0.4" />
      <path
        d={GHOST_BODY_PATH}
        transform="translate(-8 2)"
        fill={GLASS_BLUE}
        fillOpacity="0.15"
        stroke="#6fb0e6"
        strokeWidth="2.4"
        strokeDasharray="4 3.4"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <g transform="translate(3 0)">
        <ellipse
          cx="12.5"
          cy="31"
          rx="4.2"
          ry="7.2"
          fill="#9cc4ee"
          {...OUTLINE}
          strokeWidth="2.5"
          transform="rotate(16 12.5 31)"
        />
        <ellipse
          cx="51.5"
          cy="31"
          rx="4.2"
          ry="7.2"
          fill="#9cc4ee"
          {...OUTLINE}
          strokeWidth="2.5"
          transform="rotate(-16 51.5 31)"
        />
        <path d={GHOST_BODY_PATH} fill="#eaf6ff" fillOpacity="0.94" {...OUTLINE} />
        <path
          d="M17.6 27 C18.5 15 24 6 32 6 C40 6 45.5 15 46.4 27 C43 19.5 38 16 32 16 C26 16 21 19.5 17.6 27 Z"
          fill="#9cc4ee"
        />
        <path
          d="M17.6 27 C21 19.5 26 16 32 16 C38 16 43 19.5 46.4 27"
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d={GHOST_BODY_PATH} fill="none" {...OUTLINE} />
        <path
          d="M0 0 L-5.2 -4 V4 Z M0 0 L5.2 -4 V4 Z"
          fill="#e8453c"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
          transform="translate(17.4 25) rotate(-28)"
        />
        <path
          d="M0 0 L-5.2 -4 V4 Z M0 0 L5.2 -4 V4 Z"
          fill="#e8453c"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
          transform="translate(46.6 25) rotate(28)"
        />
        <circle cx="17.4" cy="25" r="1.7" fill="#e8453c" stroke={INK} strokeWidth="1.6" />
        <circle cx="46.6" cy="25" r="1.7" fill="#e8453c" stroke={INK} strokeWidth="1.6" />
        <ellipse cx="26.5" cy="25" rx="2.8" ry="3.5" fill={INK} />
        <ellipse cx="37.5" cy="25" rx="2.8" ry="3.5" fill={INK} />
        <circle cx="27.4" cy="23.8" r="1.1" fill="#ffffff" />
        <circle cx="38.4" cy="23.8" r="1.1" fill="#ffffff" />
        <ellipse cx="22.4" cy="31.2" rx="2.4" ry="1.6" fill="#ffb3c7" opacity="0.85" />
        <ellipse cx="41.6" cy="31.2" rx="2.4" ry="1.6" fill="#ffb3c7" opacity="0.85" />
        <path d="M30.4 31.6 Q32 33 33.6 31.6" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <circle cx="28.2" cy="38.2" r="2.3" fill="#a8683a" {...OUTLINE} strokeWidth="2" />
        <circle cx="35.8" cy="38.2" r="2.3" fill="#a8683a" {...OUTLINE} strokeWidth="2" />
        <circle cx="32" cy="42" r="4.8" fill="#a8683a" {...OUTLINE} strokeWidth="2.5" />
        <ellipse cx="32" cy="43.6" rx="2.3" ry="1.7" fill="#ffe0b8" />
        <circle cx="30" cy="40.8" r="0.9" fill={INK} />
        <circle cx="34" cy="40.8" r="0.9" fill={INK} />
        <path
          d="M18 40 C18.5 47.5 25 50 33.5 48.2 M46 40 C45.5 47.5 39 50 30.5 48.2"
          fill="none"
          stroke={INK}
          strokeWidth="8.4"
          strokeLinecap="round"
        />
        <path
          d="M18 40 C18.5 47.5 25 50 33.5 48.2 M46 40 C45.5 47.5 39 50 30.5 48.2"
          fill="none"
          stroke="#eaf6ff"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </>
  ),
  // A hooded hermit on a snowy peak, a lantern hanging from his stick, a crescent moon above.
  hermit: () => (
    <>
      <path d="M45 28 H55 L60 53 H37 Z" fill="#ffe27a" opacity="0.42" />
      <circle cx="50" cy="22.5" r="11" fill="#ffe27a" opacity="0.35" />
      <path d="M14 5 A7.5 7.5 0 1 0 20 17 A5.8 5.8 0 1 1 14 5 Z" fill={GOLD} {...OUTLINE} strokeWidth="2.6" />
      <path d="M5 58 L23 41 Q32 36.5 41 41 L59 58 Z" fill="#8d9bb8" {...OUTLINE} />
      <path
        d="M14.5 49 L23 41 Q32 36.5 41 41 L49.5 49 Q47 53 44 49.5 Q41 53.5 37.5 50 Q34.5 54 31.5 50 Q28 54 25 50 Q22 53.5 19 49.5 Q16.5 52 14.5 49 Z"
        fill="#ffffff"
        {...OUTLINE}
        strokeWidth="2.8"
      />
      <path d="M43 44 L42.5 11" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M43 44 L42.5 11" fill="none" stroke="#c98e5a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M42.5 11 C42.5 6.5 50 6.5 50 13.5" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      <rect x="44" y="15" width="12" height="15" rx="3.2" fill={GOLD} {...OUTLINE} strokeWidth="3" />
      <rect x="47" y="18.5" width="6" height="8" rx="2.2" fill="#fff6c4" />
      <path d="M25 27 C21 32 19 38 19 42.5 Q29 46 40 42.5 C40 36 38 31 35 27 Z" fill="#9b7b64" {...OUTLINE} />
      <path d="M25.5 42 C25 37 26 33 28 30" fill="none" stroke="#7a5c47" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M37 21 C37 14 33 8 26 6 C27 10 24 12 23 17 C22 22 25 27 30 27 C34 27 37 25 37 21 Z"
        fill="#9b7b64"
        {...OUTLINE}
      />
      <ellipse cx="34.5" cy="21" rx="3.3" ry="4" fill="#ffd9b0" {...OUTLINE} strokeWidth="2.5" />
      <path d="M37.6 21.6 L40 23.4 L37.2 24.4 Z" fill="#ffd9b0" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="35.4" cy="20" r="0.9" fill={INK} />
      <path
        d="M34 24.5 C39 25.5 38 33 32.5 35 C29.5 31 30 26 34 24.5 Z"
        fill="#ffffff"
        {...OUTLINE}
        strokeWidth="2.5"
      />
      <path d="M32 30.5 C35 32 39 31 43 31.5" fill="none" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M32 30.5 C35 32 39 31 43 31.5" fill="none" stroke="#9b7b64" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="43" cy="31.5" r="2.8" fill="#ffd9b0" stroke={INK} strokeWidth="2.2" />
    </>
  ),
  // An open umbrella in red and cream, a shield badge on its canopy and a coin dropping in.
  insurer: () => (
    <>
      <path d="M32 42 V52 C32 59 22 59 22 52" fill="none" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M32 42 V52 C32 59 22 59 22 52" fill="none" stroke="#c98e5a" strokeWidth="3" strokeLinecap="round" />
      <g strokeWidth="3" strokeLinejoin="round" stroke={INK}>
        <path d="M5 42 C5 26 18 16 32 16 C23.6 16 15.8 26 15.8 42 Q10.4 35 5 42 Z" fill="#e8453c" />
        <path d="M15.8 42 C15.8 26 23.6 16 32 16 C29.2 16 26.6 26 26.6 42 Q21.2 35 15.8 42 Z" fill={CREAM} />
        <path d="M26.6 42 C26.6 26 29.2 16 32 16 C34.8 16 37.4 26 37.4 42 Q32 35 26.6 42 Z" fill="#e8453c" />
        <path d="M37.4 42 C37.4 26 34.8 16 32 16 C40.4 16 48.2 26 48.2 42 Q42.8 35 37.4 42 Z" fill={CREAM} />
        <path d="M48.2 42 C48.2 26 40.4 16 32 16 C46 16 59 26 59 42 Q53.6 35 48.2 42 Z" fill="#e8453c" />
      </g>
      <circle cx="32" cy="14.5" r="2.4" fill={GOLD} stroke={INK} strokeWidth="2.2" />
      <path
        d="M32 21 L38.5 23.5 V28.5 C38.5 33 35.5 35.5 32 37 C28.5 35.5 25.5 33 25.5 28.5 V23.5 Z"
        fill="#4fa5f2"
        {...OUTLINE}
        strokeWidth="2.6"
      />
      <path
        d="M28.7 28.4 L31 30.9 L35.5 25.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="rotate(-18 46 9.5)">
        <ellipse cx="46" cy="9.5" rx="5.4" ry="5.8" fill={GOLD} {...OUTLINE} strokeWidth="2.8" />
        <ellipse cx="46" cy="9.5" rx="2.5" ry="2.9" fill="none" stroke="#d9951a" strokeWidth="1.8" />
      </g>
      <path d="M10 6 V14 M6 10 H14 M56 18 V23 M53.5 20.5 H58.5" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
};
