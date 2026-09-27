import { useState } from "react";
import { isTouchDevice, useFullscreenToggle } from "../fullscreen";
import { UiIcon } from "../icons/ui-icon";

/** Lobby corner shortcut on phones: back to fullscreen, or to the home screen guide on iPhone. */
export function FullscreenButton() {
  const [touchDevice] = useState(isTouchDevice);
  const { available, active, toggle } = useFullscreenToggle();
  if (!touchDevice || !available) return null;

  const label = active ? "Quitter le plein écran" : "Plein écran";
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={label} title={label}>
      <UiIcon name={active ? "shrink" : "expand"} />
    </button>
  );
}
