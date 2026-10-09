import type { IconProps } from "./item-icon";

/** The five points of a pentagram, joined every second one, inside a circle of radius 10 on a 24 × 24 grid. */
const STAR_PATH =
  Array.from({ length: 5 }, (_, index) => {
    const angle = ((-90 + index * 144) * Math.PI) / 180;
    return `${index === 0 ? "M" : "L"}${(12 + 10 * Math.cos(angle)).toFixed(2)} ${(12 + 10 * Math.sin(angle)).toFixed(2)}`;
  }).join(" ") + " Z";

/** A mini pentagram: lit (a pentagram left in the mage's reserve) or dark (one spent). */
export function PentagramIcon({ size = 20, className, lit = true }: IconProps & { lit?: boolean }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="12" cy="12" r="10.5" fill={lit ? "#e7d7ff" : "#efe6dc"} stroke="#3a2530" strokeWidth="1.6" />
      <path
        d={STAR_PATH}
        fill={lit ? "#9b5de5" : "none"}
        stroke={lit ? "#3a2530" : "#b9a89a"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fillRule="nonzero"
      />
    </svg>
  );
}
