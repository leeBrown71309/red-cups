import type { CSSProperties } from "react";
import { RedCupIcon } from "../icons/item-icon";
import { UiIcon, type UiIconName } from "../icons/ui-icon";

/**
 * The three chapters of the pre-game flow: the table, then the board, then the cards.
 * The stepper is itself a tiny board game: three tiles on a path, and a red cup as the pawn that
 * walks from one to the next. The same stepper heads the setup and the draft, so the pawn never
 * resets between the two pages and the player feels one long journey.
 */
export type FlowStepId = "players" | "map" | "draft";

const FLOW_STEPS: { id: FlowStepId; label: string; icon: UiIconName }[] = [
  { id: "players", label: "Les joueurs", icon: "users" },
  { id: "map", label: "La carte", icon: "flag" },
  { id: "draft", label: "La distribution", icon: "hand" },
];

interface FlowStepperProps {
  current: FlowStepId;
  /** Clicking an already-done chapter goes back to it; omit to freeze the trail. */
  onBack?: (step: FlowStepId) => void;
}

export function FlowStepper({ current, onBack }: FlowStepperProps) {
  const currentIndex = Math.max(
    0,
    FLOW_STEPS.findIndex((step) => step.id === current),
  );
  const progress = currentIndex / (FLOW_STEPS.length - 1);

  return (
    <nav
      className="flow-stepper"
      aria-label="Étapes de la préparation"
      style={{ "--progress": progress } as CSSProperties}
    >
      {/* The path runs from the first tile's centre to the last one's; the fill and the pawn share its width. */}
      <div className="flow-stepper__path" aria-hidden="true">
        <span className="flow-stepper__fill" />
      </div>
      <ol className="flow-stepper__list">
        {FLOW_STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const className = `flow-stepper__step${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`;
          const inner = (
            <>
              <span className="flow-stepper__tile">
                <UiIcon name={isDone ? "check" : step.icon} size={18} />
              </span>
              <span className="flow-stepper__label">{step.label}</span>
            </>
          );
          return (
            <li key={step.id} className="flow-stepper__slot">
              {isDone && onBack ? (
                <button type="button" className={className} onClick={() => onBack(step.id)}>
                  {inner}
                </button>
              ) : (
                <span className={className} aria-current={isCurrent ? "step" : undefined}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flow-stepper__travel" aria-hidden="true">
        <span className="flow-stepper__mover">
          <span key={current} className="flow-stepper__pawn">
            <RedCupIcon size={28} />
          </span>
        </span>
      </div>
    </nav>
  );
}
