import { useState } from "react";
import { readStorage, writeStorage } from "../../utils/safe-local-storage";
import { enterGameFullscreen, isFullscreenSupported, isStandaloneApp, useFullscreenState } from "../fullscreen";
import { UiIcon } from "../icons/ui-icon";
import { GameLogo } from "./game-logo";

const IOS_HINT_KEY = "red-cups-ios-fullscreen-hint";

function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}

/**
 * On phones the browser bars eat most of a landscape screen. This gate asks
 * for the one tap browsers require, enters fullscreen and locks landscape. It
 * comes back whenever fullscreen is left (swipe, back button).
 */
export function FullscreenGate() {
  const [touchDevice] = useState(isTouchDevice);
  const [standalone] = useState(isStandaloneApp);
  const fullscreen = useFullscreenState();
  const [skipped, setSkipped] = useState(false);
  const [iosHintSeen, setIosHintSeen] = useState(() => readStorage(IOS_HINT_KEY) === "seen");

  if (!touchDevice || standalone || fullscreen || skipped) return null;

  if (!isFullscreenSupported()) {
    if (iosHintSeen) return null;
    const dismiss = () => {
      writeStorage(IOS_HINT_KEY, "seen");
      setIosHintSeen(true);
    };
    return (
      <div className="fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
        <GameLogo compact />
        <h2 id="fullscreen-gate-title">Plein écran sur iPhone</h2>
        <ol className="fullscreen-gate__steps">
          <li>
            Touche <strong>Partager</strong> dans Safari.
          </li>
          <li>
            Choisis <strong>Sur l’écran d’accueil</strong>.
          </li>
          <li>Ouvre Red Cups depuis sa nouvelle icône : plus aucune barre du navigateur.</li>
        </ol>
        <button type="button" className="btn btn--cup btn--large" onClick={dismiss}>
          Compris
        </button>
      </div>
    );
  }

  const start = async () => {
    const entered = await enterGameFullscreen();
    if (!entered) setSkipped(true);
  };

  return (
    <div className="fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
      <GameLogo compact />
      <h2 id="fullscreen-gate-title">Prêt à jouer ?</h2>
      <p>Le jeu passe en plein écran et en paysage, sans les barres du navigateur.</p>
      <button type="button" className="btn btn--cup btn--large btn--pulse" onClick={() => void start()} data-autofocus>
        <UiIcon name="expand" size={24} /> Jouer en plein écran
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setSkipped(true)}>
        Continuer dans le navigateur
      </button>
    </div>
  );
}
