import { EnergyIcon } from "../icons/item-icon";

/** "2 points d’énergie", "1 point d’énergie" or "sans énergie". */
export function formatEnergyCost(cost: number): string {
  if (cost === 0) return "sans énergie";
  return `${cost} point${cost > 1 ? "s" : ""} d’énergie`;
}

export type EnergyTone = "full" | "mid" | "low" | "empty";

/** Blue while three points or more are left, orange at two, red at the last one. */
export function getEnergyTone(left: number): EnergyTone {
  if (left <= 0) return "empty";
  if (left === 1) return "low";
  if (left === 2) return "mid";
  return "full";
}

const BOLT_FILLS: Record<EnergyTone, string> = {
  full: "#62c7ff",
  mid: "#ffa04a",
  low: "#ff6a5c",
  empty: "#d8c6b4",
};

interface EnergyGaugeProps {
  left: number;
  capacity: number;
  /** Bigger pips, for the player card. */
  large?: boolean;
}

/** The energy left this turn, one pip per point, coloured by how much is left. */
export function EnergyGauge({ left, capacity, large = false }: EnergyGaugeProps) {
  const tone = getEnergyTone(left);
  return (
    <span
      className={`energy-gauge energy-gauge--${tone} ${large ? "energy-gauge--large" : ""}`}
      role="img"
      aria-label={`Énergie : ${left} sur ${capacity}`}
      title="Énergie du tour : chaque objet en coûte, le déplacement prend le reste."
    >
      <EnergyIcon size={large ? 22 : 16} fill={BOLT_FILLS[tone]} />
      {Array.from({ length: capacity }, (_, index) => (
        <span key={index} className={`energy-gauge__pip ${index < left ? "is-full" : ""}`} />
      ))}
    </span>
  );
}

/** What an item costs to use, in energy. */
export function EnergyCost({ cost }: { cost: number }) {
  return (
    <span className="energy-chip" title={`Utilisation : ${formatEnergyCost(cost)}`}>
      <EnergyIcon size={14} />
      {cost}
    </span>
  );
}
