import { APP_VERSION } from "../../version";
import { AudioSliders } from "../components/audio-controls";
import { ModalShell } from "../components/modal-shell";
import { useFullscreenToggle } from "../fullscreen";
import { UiIcon } from "../icons/ui-icon";

/** The settings of the menu: sound, and fullscreen where the browser allows it. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const fullscreen = useFullscreenToggle();

  return (
    <ModalShell title="Paramètres" eyebrow="Red Cups" size="small" onClose={onClose} className="settings-modal">
      <AudioSliders />
      {fullscreen.available && (
        <button type="button" className="btn btn--cream btn--block" onClick={fullscreen.toggle}>
          <UiIcon name={fullscreen.active ? "shrink" : "expand"} size={20} />
          {fullscreen.active ? "Quitter le plein écran" : "Plein écran"}
        </button>
      )}
      <p className="settings-modal__version">Version {APP_VERSION}</p>
    </ModalShell>
  );
}
