import { useState } from "react";
import { localPlayAvailable } from "../../env";
import { APP_VERSION } from "../../version";
import { AudioToggles } from "../components/audio-controls";
import { FullscreenButton } from "../components/fullscreen-button";
import { GameLogo } from "../components/game-logo";
import { UiIcon, type UiIconName } from "../icons/ui-icon";
import { HelpModal } from "../modals/help-modal";
import { useHomeStore } from "./home-store";
import { SettingsModal } from "./settings-modal";

interface MenuScreenProps {
  /** Offered only when the build has an online backend. */
  onPlayOnline?: () => void;
}

/**
 * The game's front door: start a game, play online, read the rules, tune the
 * settings or read what changed. The version of the game is always in sight.
 * On the public build, local play is gone: « Jouer en ligne » becomes the
 * one big cup button that starts everything.
 */
export function MenuScreen({ onPlayOnline }: MenuScreenProps) {
  const setView = useHomeStore((state) => state.setView);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="lobby menu-screen">
      <div className="lobby__corner">
        <AudioToggles />
        <FullscreenButton />
      </div>

      <section className="lobby__hero">
        <GameLogo />
        <p className="lobby__tagline">Le jeu de plateau qui finit mal entre amis.</p>
        <span className="menu-screen__version" title="Version du jeu">
          Version {APP_VERSION}
        </span>
      </section>

      <nav className="lobby__panel panel menu-screen__panel" aria-label="Menu du jeu">
        {localPlayAvailable && (
          <button type="button" className="btn btn--cup btn--large" onClick={() => setView("setup")} data-autofocus>
            <UiIcon name="play" size={22} /> Commencer la partie
          </button>
        )}
        {onPlayOnline &&
          (localPlayAvailable ? (
            <MenuButton tone="sky" icon="globe" label="Jouer en ligne" onClick={onPlayOnline} />
          ) : (
            <button type="button" className="btn btn--cup btn--large" onClick={onPlayOnline} data-autofocus>
              <UiIcon name="globe" size={22} /> Jouer en ligne
            </button>
          ))}
        <MenuButton tone="cream" icon="help" label="Comment jouer" onClick={() => setHelpOpen(true)} />
        <MenuButton tone="cream" icon="info" label="Wiki du jeu" onClick={openWiki} />
        <MenuButton tone="cream" icon="flag" label="Signaler un bug, une idée" onClick={openReports} />
        <MenuButton tone="cream" icon="settings" label="Paramètres" onClick={() => setSettingsOpen(true)} />
        <MenuButton
          tone="cream"
          icon="journal"
          label="Journal des modifications"
          onClick={() => setView("changelog")}
        />
      </nav>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

/** The wiki is a second page of this build, served next to the game. */
function openWiki() {
  window.open(`${import.meta.env.BASE_URL}wiki.html`, "_blank", "noopener");
}

/** The bug-and-ideas page is a third page of the same build. */
function openReports() {
  window.open(`${import.meta.env.BASE_URL}feedback.html`, "_blank", "noopener");
}

function MenuButton({
  tone,
  icon,
  label,
  onClick,
}: {
  tone: "sky" | "cream";
  icon: UiIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`btn btn--${tone}`} onClick={onClick}>
      <UiIcon name={icon} size={20} /> {label}
    </button>
  );
}
