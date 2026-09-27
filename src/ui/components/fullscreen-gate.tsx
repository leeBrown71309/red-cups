import { useState } from "react";
import { readStorage, writeStorage } from "../../utils/safe-local-storage";
import {
  detectHomeScreenBrowser,
  enterGameFullscreen,
  isFullscreenSupported,
  isStandaloneApp,
  isTouchDevice,
  useFullscreenState,
  useInstallGuide,
  type HomeScreenBrowser,
} from "../fullscreen";
import { UiIcon } from "../icons/ui-icon";
import { GameLogo } from "./game-logo";

const IOS_HINT_KEY = "red-cups-ios-fullscreen-hint";

/**
 * On phones the browser bars eat most of a landscape screen. This gate asks
 * for the one tap browsers require, enters fullscreen and locks landscape. It
 * comes back whenever fullscreen is left (swipe, back button). Where the
 * browser cannot go fullscreen (every iPhone browser), it explains the home
 * screen icon instead: once by itself, then whenever it is asked for.
 */
export function FullscreenGate() {
  const [touchDevice] = useState(isTouchDevice);
  const [standalone] = useState(isStandaloneApp);
  const fullscreen = useFullscreenState();
  const [skipped, setSkipped] = useState(false);
  const [iosHintSeen, setIosHintSeen] = useState(() => readStorage(IOS_HINT_KEY) === "seen");
  const guideRequested = useInstallGuide((state) => state.open);
  const setGuideOpen = useInstallGuide((state) => state.setOpen);

  if (standalone || fullscreen) return null;

  if (!isFullscreenSupported()) {
    if (!guideRequested && (!touchDevice || iosHintSeen)) return null;
    const dismiss = () => {
      writeStorage(IOS_HINT_KEY, "seen");
      setIosHintSeen(true);
      setGuideOpen(false);
    };
    return <InstallGuide onDismiss={dismiss} />;
  }

  if (!touchDevice || skipped) return null;

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

function InstallGuide({ onDismiss }: { onDismiss: () => void }) {
  const [browser] = useState(detectHomeScreenBrowser);
  const onIphone = browser !== "other";

  return (
    <div className="fullscreen-gate" role="dialog" aria-modal="true" aria-labelledby="fullscreen-gate-title">
      <GameLogo compact />
      <h2 id="fullscreen-gate-title">{onIphone ? "Plein écran sur iPhone" : "Plein écran"}</h2>
      <p>
        {onIphone
          ? "Sur iPhone, aucun navigateur ne peut cacher ses barres. L’icône sur l’écran d’accueil, si."
          : "Ce navigateur ne peut pas cacher ses barres. L’icône sur l’écran d’accueil, si."}
      </p>
      <ol className="fullscreen-gate__steps">
        <HomeScreenSteps browser={browser} />
        <li>Ouvre Red Cups depuis sa nouvelle icône : plus aucune barre du navigateur.</li>
      </ol>
      <button type="button" className="btn btn--cup btn--large" onClick={onDismiss} data-autofocus>
        Compris
      </button>
    </div>
  );
}

function HomeScreenSteps({ browser }: { browser: HomeScreenBrowser }) {
  switch (browser) {
    case "safari":
      return (
        <>
          <li>
            Dans Safari, touche <strong>Partager</strong> (ou <strong>•••</strong> puis <strong>Partager</strong>).
          </li>
          <li>
            Choisis <strong>Sur l’écran d’accueil</strong>.
          </li>
        </>
      );
    case "chrome":
      return (
        <>
          <li>
            Dans Chrome, touche <strong>Partager</strong> dans la barre d’adresse.
          </li>
          <li>
            Choisis <strong>Ajouter à l’écran d’accueil</strong>.
          </li>
        </>
      );
    case "other-ios":
      return (
        <>
          <li>
            Ouvre le menu <strong>Partager</strong> de ton navigateur.
          </li>
          <li>
            Choisis <strong>Ajouter à l’écran d’accueil</strong>.
          </li>
        </>
      );
    case "other":
      return (
        <>
          <li>Ouvre le menu de ton navigateur.</li>
          <li>
            Choisis <strong>Ajouter à l’écran d’accueil</strong> ou <strong>Installer l’application</strong>.
          </li>
        </>
      );
  }
}
