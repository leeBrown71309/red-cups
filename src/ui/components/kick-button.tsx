import { useEffect, useState } from "react";
import { UiIcon } from "../icons/ui-icon";

/** How long the confirmation waits before the button goes back to its first state. */
const CONFIRM_WINDOW_MS = 4_000;

/**
 * The host's button to send a player away. A first tap only asks, a second
 * tap within a few seconds does it: a stray tap never costs somebody their seat.
 */
export function KickButton({
  name,
  onKick,
  disabled = false,
  labelled = false,
}: {
  name: string;
  onKick: () => void;
  disabled?: boolean;
  /** Spells the action out next to the icon, for a card rather than a roster row. */
  labelled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const label = confirming ? `Confirmer l’exclusion de ${name}` : `Exclure ${name}`;
  return (
    <button
      type="button"
      className={`kick-button ${confirming ? "is-confirming" : ""} ${labelled ? "kick-button--labelled" : ""}`}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onKick();
      }}
    >
      <UiIcon name="logout" size={16} strokeWidth={2.6} />
      {(labelled || confirming) && <span>{confirming ? "Confirmer ?" : "Exclure"}</span>}
    </button>
  );
}
