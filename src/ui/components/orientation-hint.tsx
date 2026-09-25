import { UiIcon } from "../icons/ui-icon";

/** Shown by CSS only on small portrait screens: the board is designed for landscape. */
export function OrientationHint() {
  return (
    <div className="orientation-hint" role="alert">
      <div className="orientation-hint__phone" aria-hidden="true">
        <UiIcon name="rotate" size={54} strokeWidth={2} />
      </div>
      <strong>Tourne ton téléphone</strong>
      <p>Red Cups se joue en mode paysage.</p>
    </div>
  );
}
