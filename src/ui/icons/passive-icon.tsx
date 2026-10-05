import type { ReactElement } from "react";
import type { PassiveId } from "../../game/types";
import { IconFrame, INK, OUTLINE, type IconProps } from "./item-icon";

/**
 * Original emblems for every passive, drawn like the shop items: thick ink
 * contours, flat toy colours, a 64 × 64 grid.
 */
/** A raised hand, shared by the cards of the wheels. */
const HAND_PATH =
  "M17 36 V22 C17 19 22 19 22 22 V12 C22 9 27 9 27 12 V10 C27 7 32 7 32 10 V12 C32 9 37 9 37 12 V30 L41 26 C44 24 48 27 46 31 L38 48 C35 55 31 58 25 58 C19 58 17 52 17 46 Z";

const PASSIVE_ARTWORK: Record<PassiveId, () => ReactElement> = {
  // A fist, knuckles up.
  "built-like-a-tank": () => (
    <>
      <path
        d="M14 30 C14 21 21 19 25 22 C27 17 35 17 37 22 C41 19 49 22 49 30 L49 42 C49 52 41 58 31 58 C21 58 14 52 14 42 Z"
        fill="#f2b27a"
        {...OUTLINE}
      />
      <path d="M25 22 V32 M37 22 V32 M49 30 V34" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M20 44 C24 50 38 50 44 44" stroke="#c9804a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M6 12 L12 18 M58 12 L52 18 M32 4 V10" stroke="#e8453c" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A fresh cup with sparks around it.
  "new-cup-new-me": () => (
    <>
      <path d="M17 18 H47 L43 56 C43 58 41 60 39 60 H25 C23 60 21 58 21 56 Z" fill="#e8453c" {...OUTLINE} />
      <rect x="13" y="11" width="38" height="9" rx="3.5" fill="#fff4ec" {...OUTLINE} />
      <path d="M20 32 H44 M21.5 44 H42.5" stroke="#b92f2c" strokeWidth="3" />
      <path d="M12 4 V10 M9 7 H15 M54 3 V9 M51 6 H57" stroke="#ffd166" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A traffic light, red and green lit.
  "red-light-green-light": () => (
    <>
      <rect x="20" y="4" width="24" height="56" rx="9" fill="#4b3a45" {...OUTLINE} />
      <circle cx="32" cy="17" r="7" fill="#f2594f" stroke={INK} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="7" fill="#7a6a52" stroke={INK} strokeWidth="2.5" />
      <circle cx="32" cy="47" r="7" fill="#5cc46a" stroke={INK} strokeWidth="2.5" />
      <circle cx="29.5" cy="14.5" r="2" fill="#ffffff" opacity="0.7" />
      <circle cx="29.5" cy="44.5" r="2" fill="#ffffff" opacity="0.7" />
    </>
  ),
  // A raised palm: no, thanks.
  "no-thanks": () => (
    <>
      <path
        d="M17 36 V22 C17 19 22 19 22 22 V12 C22 9 27 9 27 12 V10 C27 7 32 7 32 10 V12 C32 9 37 9 37 12 V30 L41 26 C44 24 48 27 46 31 L38 48 C35 55 31 58 25 58 C19 58 17 52 17 46 Z"
        fill="#ffd9b0"
        {...OUTLINE}
      />
      <circle cx="46" cy="16" r="10" fill="#e8453c" {...OUTLINE} strokeWidth="3" />
      <path d="M40 22 L52 10" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  // A bag of coins that buys its way through one-way streets.
  corrupter: () => (
    <>
      <path d="M24 10 L28 18 H36 L40 10 Z" fill="#c98e5a" {...OUTLINE} strokeWidth="3" />
      <path d="M28 18 C10 28 8 54 22 58 H42 C56 54 54 28 36 18 Z" fill="#d9a35c" {...OUTLINE} />
      <path d="M26 20 H38" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M36 33 C35 30 28 30 28 35 C28 40 36 38 36 44 C36 49 29 49 27 46 M32 28 V51"
        fill="none"
        stroke="#fff4ec"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </>
  ),
  // A green face, big ears and a sly grin.
  goblin: () => (
    <>
      <path d="M12 30 L2 20 L14 16 Z M52 30 L62 20 L50 16 Z" fill="#6cc56e" {...OUTLINE} strokeWidth="3" />
      <circle cx="32" cy="34" r="20" fill="#7ccf6e" {...OUTLINE} />
      <path d="M20 28 L28 31 M44 28 L36 31" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="34" r="4" fill="#ffd166" stroke={INK} strokeWidth="2.5" />
      <circle cx="40" cy="34" r="4" fill="#ffd166" stroke={INK} strokeWidth="2.5" />
      <path d="M21 44 C28 52 36 52 43 44 Z" fill="#fff4ec" {...OUTLINE} strokeWidth="3" />
      <path d="M27 46 V50 M37 46 V50" stroke={INK} strokeWidth="2.5" />
    </>
  ),
  // A notepad and the pencil that keeps count.
  "i-take-notes": () => (
    <>
      <rect x="10" y="9" width="36" height="48" rx="5" fill="#fff4ec" {...OUTLINE} />
      <path d="M16 22 H40 M16 31 H40 M16 40 H32" stroke="#8fd3ff" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 6 V14 M24 6 V14 M32 6 V14 M40 6 V14" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M52 20 L58 26 L40 52 L32 54 L34 46 Z" fill="#ffd166" {...OUTLINE} strokeWidth="3" />
      <path d="M49 23 L55 29" stroke={INK} strokeWidth="3" />
    </>
  ),
  // A serene face, eyes closed, a leaf drifting by.
  "calm-down": () => (
    <>
      <circle cx="30" cy="34" r="21" fill="#ffe08a" {...OUTLINE} />
      <path
        d="M19 32 C22 36 27 36 29 32 M33 32 C36 36 41 36 43 32"
        fill="none"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M23 43 C28 47 34 47 39 43" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M46 8 C58 8 58 22 48 24 C40 24 40 12 46 8 Z" fill="#7ccf6e" {...OUTLINE} strokeWidth="3" />
      <path d="M46 22 L50 13" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  // The plain lambda of the plain person.
  lambda: () => (
    <>
      <circle cx="32" cy="32" r="25" fill="#dcefff" {...OUTLINE} />
      <path
        d="M20 14 L26 14 L46 52 M32 33 L20 52"
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 14 L26 14 L46 52 M32 33 L20 52"
        fill="none"
        stroke="#4fa5f2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // A baby bottle under a small crown: born rich.
  "nepo-baby": () => (
    <>
      <path d="M24 6 L28 12 L32 4 L36 12 L40 6 L40 14 H24 Z" fill="#ffd166" {...OUTLINE} strokeWidth="3" />
      <path d="M27 16 C27 12 37 12 37 16 V20 H27 Z" fill="#ffc2d4" {...OUTLINE} strokeWidth="3" />
      <rect x="21" y="20" width="22" height="6" rx="3" fill="#8fd3ff" {...OUTLINE} strokeWidth="3" />
      <rect x="23" y="26" width="18" height="30" rx="6" fill="#fff4ec" {...OUTLINE} />
      <path d="M23 36 H41 M23 44 H41" stroke="#8fd3ff" strokeWidth="3" />
      <rect x="25" y="46" width="14" height="8" rx="3" fill="#ffffff" opacity="0.8" />
    </>
  ),
  // A bull's head, ring in its nose: more energy.
  "red-bull": () => (
    <>
      <path
        d="M12 26 C4 24 2 14 6 8 C10 16 16 18 22 20 Z M52 26 C60 24 62 14 58 8 C54 16 48 18 42 20 Z"
        fill="#fff4ec"
        {...OUTLINE}
      />
      <path d="M18 20 C26 14 38 14 46 20 C50 36 46 50 32 56 C18 50 14 36 18 20 Z" fill="#e8453c" {...OUTLINE} />
      <ellipse cx="32" cy="46" rx="11" ry="8" fill="#ffc2b8" {...OUTLINE} strokeWidth="3" />
      <circle cx="26" cy="31" r="3" fill={INK} />
      <circle cx="38" cy="31" r="3" fill={INK} />
      <circle cx="28" cy="46" r="1.8" fill={INK} />
      <circle cx="36" cy="46" r="1.8" fill={INK} />
      <path d="M28 52 C28 58 36 58 36 52" fill="none" stroke="#ffd166" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  // A shopping cart with a parcel: the shop follows.
  eshop: () => (
    <>
      <path
        d="M4 10 H12 L20 40 H48"
        fill="none"
        stroke={INK}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 18 H56 L50 36 H20 Z" fill="#4fa5f2" {...OUTLINE} />
      <path d="M26 18 L28 36 M38 18 L38 36" stroke="#dcefff" strokeWidth="3" />
      <circle cx="24" cy="50" r="5" fill="#ffd166" {...OUTLINE} strokeWidth="3" />
      <circle cx="44" cy="50" r="5" fill="#ffd166" {...OUTLINE} strokeWidth="3" />
      <rect x="28" y="4" width="14" height="12" rx="2" fill="#ffc2d4" {...OUTLINE} strokeWidth="3" />
    </>
  ),
  // A ripe tomato with its green crown.
  "tomato-enjoyer": () => (
    <>
      <circle cx="32" cy="36" r="22" fill="#e8453c" {...OUTLINE} />
      <path
        d="M32 16 L26 8 L32 12 L36 6 L38 14 L46 12 L38 19 L42 25 L32 21 L22 25 L26 19 L18 12 L26 14 Z"
        fill="#5cc46a"
        {...OUTLINE}
        strokeWidth="3"
      />
      <path
        d="M18 34 C18 28 22 24 26 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M26 44 C30 48 36 48 40 44" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A roller skate: boot over four wheels.
  roller: () => (
    <>
      <path
        d="M14 8 H32 V28 L50 34 C58 36 58 46 50 46 H16 C12 46 10 44 10 40 V14 C10 10 12 8 14 8 Z"
        fill="#ff9fd1"
        {...OUTLINE}
      />
      <path d="M14 14 H28 M14 20 H28" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="44" width="46" height="5" rx="2" fill="#6a6fb8" {...OUTLINE} strokeWidth="3" />
      <circle cx="16" cy="54" r="5" fill="#7dffb2" {...OUTLINE} strokeWidth="3" />
      <circle cx="28" cy="54" r="5" fill="#7dffb2" {...OUTLINE} strokeWidth="3" />
      <circle cx="40" cy="54" r="5" fill="#7dffb2" {...OUTLINE} strokeWidth="3" />
      <circle cx="52" cy="54" r="5" fill="#7dffb2" {...OUTLINE} strokeWidth="3" />
    </>
  ),
  // Piles of gold under a grin of glints: wins at six thousand.
  greedy: () => (
    <>
      <ellipse cx="22" cy="50" rx="15" ry="6" fill="#d9951a" {...OUTLINE} strokeWidth="3" />
      <ellipse cx="22" cy="44" rx="15" ry="6" fill="#ffc44d" {...OUTLINE} strokeWidth="3" />
      <ellipse cx="22" cy="38" rx="15" ry="6" fill="#ffc44d" {...OUTLINE} strokeWidth="3" />
      <circle cx="43" cy="30" r="15" fill="#ffd166" {...OUTLINE} />
      <circle cx="43" cy="30" r="10" fill="none" stroke="#d9951a" strokeWidth="3" />
      <path
        d="M46 25 C45 22 39 22 39 26 C39 30 46 29 46 34 C46 38 40 38 38 35 M42 20 V40"
        fill="none"
        stroke="#b97a10"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M8 14 V22 M4 18 H12 M54 6 V12 M51 9 H57" stroke="#ffd166" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // Two dice, double or nothing.
  "double-or-nothing": () => (
    <>
      <rect x="6" y="20" width="32" height="32" rx="7" fill="#fff4ec" {...OUTLINE} transform="rotate(-10 22 36)" />
      <g transform="rotate(-10 22 36)" fill={INK}>
        <circle cx="15" cy="29" r="3" />
        <circle cx="29" cy="43" r="3" />
        <circle cx="22" cy="36" r="3" />
      </g>
      <rect x="30" y="8" width="28" height="28" rx="6" fill="#e8453c" {...OUTLINE} transform="rotate(12 44 22)" />
      <g transform="rotate(12 44 22)" fill="#ffffff">
        <circle cx="38" cy="16" r="2.8" />
        <circle cx="50" cy="16" r="2.8" />
        <circle cx="38" cy="28" r="2.8" />
        <circle cx="50" cy="28" r="2.8" />
      </g>
    </>
  ),
  // A four-leaf clover with its eye shut: luck that cannot see.
  "blind-luck": () => (
    <>
      <circle cx="22" cy="22" r="12" fill="#7ccf6e" {...OUTLINE} />
      <circle cx="42" cy="22" r="12" fill="#7ccf6e" {...OUTLINE} />
      <circle cx="22" cy="42" r="12" fill="#7ccf6e" {...OUTLINE} />
      <circle cx="42" cy="42" r="12" fill="#7ccf6e" {...OUTLINE} />
      <circle cx="32" cy="32" r="12" fill="#fff4ec" {...OUTLINE} />
      <path d="M25 33 C29 38 35 38 39 33" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M27 36 L25 40 M32 37.5 V42 M37 36 L39 40" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 44 C34 52 40 56 46 58" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A horned head with a wide grin.
  devil: () => (
    <>
      <path
        d="M12 26 C6 18 8 8 14 4 C16 12 22 16 28 18 Z M52 26 C58 18 56 8 50 4 C48 12 42 16 36 18 Z"
        fill="#b92f2c"
        {...OUTLINE}
      />
      <circle cx="32" cy="36" r="21" fill="#e8453c" {...OUTLINE} />
      <path d="M19 28 L28 33 M45 28 L36 33" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="25" cy="35" r="3.2" fill="#ffd166" stroke={INK} strokeWidth="2" />
      <circle cx="39" cy="35" r="3.2" fill="#ffd166" stroke={INK} strokeWidth="2" />
      <path d="M20 44 C28 56 36 56 44 44 Z" fill={INK} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M26 46 L28 50 L31 46 M33 46 L36 50 L38 46"
        fill="#fff4ec"
        stroke="#fff4ec"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  ),
  // A halo, a gentle face and two wings.
  "guardian-angel": () => (
    <>
      <path
        d="M14 34 C4 32 0 22 3 14 C9 20 14 22 20 23 Z M50 34 C60 32 64 22 61 14 C55 20 50 22 44 23 Z"
        fill="#ffffff"
        {...OUTLINE}
      />
      <ellipse cx="32" cy="9" rx="13" ry="4.5" fill="none" stroke={INK} strokeWidth="7.5" />
      <ellipse cx="32" cy="9" rx="13" ry="4.5" fill="none" stroke="#ffd166" strokeWidth="3.5" />
      <circle cx="32" cy="36" r="19" fill="#ffe9d0" {...OUTLINE} />
      <path
        d="M22 34 C24 31 28 31 30 34 M34 34 C36 31 40 31 42 34"
        fill="none"
        stroke={INK}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path d="M25 43 C29 47 35 47 39 43" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="21" cy="41" r="3" fill="#ffb3b3" opacity="0.8" />
      <circle cx="43" cy="41" r="3" fill="#ffb3b3" opacity="0.8" />
    </>
  ),
  // A bandit's mask and the sack it carries.
  thief: () => (
    <>
      <circle cx="30" cy="32" r="22" fill="#ffe9d0" {...OUTLINE} />
      <path
        d="M8 28 C18 22 42 22 52 28 C52 38 44 42 38 38 C34 36 26 36 22 38 C16 42 8 38 8 28 Z"
        fill="#3a2530"
        {...OUTLINE}
        strokeWidth="3"
      />
      <ellipse cx="22" cy="31" rx="4.5" ry="3.5" fill="#fff4ec" />
      <ellipse cx="38" cy="31" rx="4.5" ry="3.5" fill="#fff4ec" />
      <circle cx="22" cy="31" r="1.8" fill={INK} />
      <circle cx="38" cy="31" r="1.8" fill={INK} />
      <path d="M24 48 C28 51 34 51 38 48" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M46 40 C56 40 62 52 56 58 H42 C38 52 40 42 46 40 Z" fill="#c98e5a" {...OUTLINE} strokeWidth="3" />
      <path d="M44 41 L48 38 L52 41" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  // A podium, its last step tiny, a bolt for the extra energy.
  "last-in-class": () => (
    <>
      <rect x="6" y="34" width="16" height="22" rx="2" fill="#8fd3ff" {...OUTLINE} strokeWidth="3" />
      <rect x="24" y="22" width="16" height="34" rx="2" fill="#ffd166" {...OUTLINE} strokeWidth="3" />
      <rect x="42" y="46" width="16" height="10" rx="2" fill="#ff9fb2" {...OUTLINE} strokeWidth="3" />
      <path d="M50 14 L44 28 H51 L47 40 L58 22 H51 Z" fill="#62c7ff" {...OUTLINE} strokeWidth="3" />
    </>
  ),
  // A flame over a ring of Hell with a coin falling in.
  "hell-regular": () => (
    <>
      <ellipse cx="32" cy="48" rx="24" ry="10" fill="#5e3a99" {...OUTLINE} />
      <ellipse cx="32" cy="48" rx="15" ry="5.5" fill="#c86bff" />
      <path
        d="M32 6 C40 16 46 24 40 34 C38 38 34 40 32 40 C26 40 22 34 26 26 C28 30 30 30 30 26 C30 20 30 14 32 6 Z"
        fill="#ff9f43"
        {...OUTLINE}
        strokeWidth="3"
      />
      <circle cx="32" cy="29" r="7" fill="#ffd166" {...OUTLINE} strokeWidth="2.5" />
      <path d="M32 25 V33" stroke="#b97a10" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  // A green hand, a clover leaf in its palm.
  "green-hand": () => (
    <>
      <path d={HAND_PATH} fill="#7ccf6e" {...OUTLINE} />
      <circle cx="29" cy="40" r="4" fill="#fff4ec" stroke={INK} strokeWidth="2.5" />
      <circle cx="35" cy="40" r="4" fill="#fff4ec" stroke={INK} strokeWidth="2.5" />
      <circle cx="32" cy="46" r="4" fill="#fff4ec" stroke={INK} strokeWidth="2.5" />
      <path d="M8 8 V16 M4 12 H12 M54 6 V12 M51 9 H57" stroke="#ffd166" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A red hand, cracked.
  "red-hand": () => (
    <>
      <path d={HAND_PATH} fill="#f2594f" {...OUTLINE} />
      <path
        d="M26 32 L30 40 L26 46 M38 36 L34 44"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 10 L14 16 M56 10 L50 16" stroke="#3a2530" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A white hand under a halo, with small wings.
  "angelic-touch": () => (
    <>
      <path
        d="M4 36 C0 30 2 22 6 18 C8 24 12 28 18 30 Z M60 36 C64 30 62 22 58 18 C56 24 52 28 46 30 Z"
        fill="#ffffff"
        {...OUTLINE}
        strokeWidth="3"
      />
      <path d={HAND_PATH} fill="#fff4ec" {...OUTLINE} transform="translate(0 4)" />
      <ellipse cx="32" cy="6" rx="12" ry="4" fill="none" stroke={INK} strokeWidth="7" />
      <ellipse cx="32" cy="6" rx="12" ry="4" fill="none" stroke="#ffd166" strokeWidth="3.2" />
    </>
  ),
  // A purple hand with two small horns.
  "devils-hand": () => (
    <>
      <path
        d="M20 14 C14 8 14 2 18 0 C20 6 24 8 28 10 Z M44 14 C50 8 50 2 46 0 C44 6 40 8 36 10 Z"
        fill="#b92f2c"
        {...OUTLINE}
        strokeWidth="3"
      />
      <path d={HAND_PATH} fill="#8e5bd9" {...OUTLINE} transform="translate(0 4)" />
      <path d="M27 44 C29 38 33 38 35 44 C34 49 28 49 27 44 Z" fill="#ff9f43" stroke={INK} strokeWidth="2.5" />
    </>
  ),
  // Two cards of a deck: the host picks the game.
  "game-master": () => (
    <>
      <rect x="8" y="10" width="28" height="40" rx="5" fill="#fff4ec" {...OUTLINE} transform="rotate(-12 22 30)" />
      <rect x="26" y="12" width="28" height="40" rx="5" fill="#fff4ec" {...OUTLINE} transform="rotate(10 40 32)" />
      <path
        d="M40 24 L43 31 L50 32 L45 37 L46 44 L40 40 L34 44 L35 37 L30 32 L37 31 Z"
        fill="#e8453c"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
        transform="rotate(10 40 32)"
      />
      <circle cx="17" cy="21" r="3" fill="#4fa5f2" stroke={INK} strokeWidth="2" transform="rotate(-12 22 30)" />
    </>
  ),
  // A price tag with a coin: items go back for sixty per cent.
  "junk-dealer": () => (
    <>
      <path d="M8 30 L30 8 H54 V32 L32 56 Z" fill="#ffd166" {...OUTLINE} />
      <circle cx="44" cy="19" r="4" fill="#fff4ec" stroke={INK} strokeWidth="2.5" />
      <path
        d="M26 30 C26 26 34 26 34 30 C34 34 26 33 26 38 C26 42 34 42 36 38 M30 24 V44"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        transform="rotate(-45 30 34)"
      />
      <path d="M14 52 C20 58 40 58 50 50" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  // A puddle of mud with a single flag: one trap at a time.
  trapper: () => (
    <>
      <path
        d="M6 48 C2 38 15 32 22 35 C26 26 40 26 43 34 C52 32 60 40 56 48 C53 57 10 58 6 48 Z"
        fill="#8a5a3c"
        {...OUTLINE}
      />
      <circle cx="24" cy="42" r="4.5" fill="#b07a55" stroke={INK} strokeWidth="2.5" />
      <circle cx="40" cy="45" r="3.5" fill="#4f2c17" />
      <path d="M32 36 V8" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 8 L50 14 L32 21 Z" fill="#e8453c" {...OUTLINE} strokeWidth="3" />
    </>
  ),
};

export function PassiveIcon({ passiveId, size, className }: IconProps & { passiveId: PassiveId }) {
  const Artwork = PASSIVE_ARTWORK[passiveId];
  return (
    <IconFrame size={size} className={className}>
      <Artwork />
    </IconFrame>
  );
}
