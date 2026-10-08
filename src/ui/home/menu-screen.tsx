import { useState, type CSSProperties } from "react";
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
        <span className="menu-screen__spark menu-screen__spark--a" aria-hidden="true">
          ✦
        </span>
        <span className="menu-screen__spark menu-screen__spark--b" aria-hidden="true">
          ✦
        </span>
        <span className="menu-screen__spark menu-screen__spark--c" aria-hidden="true">
          ✦
        </span>
        <GameLogo />
        <p className="lobby__tagline">Le jeu de plateau qui finit mal entre amis.</p>
        <span className="menu-screen__version" title="Version du jeu">
          Version {APP_VERSION}
        </span>
      </section>

      <nav className="lobby__panel panel menu-screen__panel" aria-label="Menu du jeu">
        <p className="menu-screen__banner" style={stagger(0)}>
          <span aria-hidden="true">★</span> Prêt à jouer ? <span aria-hidden="true">★</span>
        </p>
        {localPlayAvailable && (
          <button
            type="button"
            className="btn btn--cup menu-cta"
            style={stagger(1)}
            onClick={() => setView("setup")}
            data-autofocus
          >
            <span className="menu-cta__icon">
              <UiIcon name="play" size={26} />
            </span>
            Commencer la partie
          </button>
        )}
        {onPlayOnline &&
          (localPlayAvailable ? (
            <MenuRow tone="sky" icon="globe" label="Jouer en ligne" order={2} onClick={onPlayOnline} />
          ) : (
            <button
              type="button"
              className="btn btn--cup menu-cta"
              style={stagger(1)}
              onClick={onPlayOnline}
              data-autofocus
            >
              <span className="menu-cta__icon">
                <UiIcon name="globe" size={26} />
              </span>
              Jouer en ligne
            </button>
          ))}
        <MenuRow tone="mint" icon="help" label="Comment jouer" order={3} onClick={() => setHelpOpen(true)} />
        <div className="menu-screen__tiles">
          <MenuTile tone="grape" icon="info" label="Wiki du jeu" order={4} onClick={openWiki} />
          <MenuTile tone="orange" icon="flag" label="Signaler un bug" order={5} onClick={openReports} />
          <MenuTile tone="cream" icon="settings" label="Paramètres" order={6} onClick={() => setSettingsOpen(true)} />
          <MenuTile tone="gold" icon="journal" label="Nouveautés" order={7} onClick={() => setView("changelog")} />
        </div>
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

type MenuTone = "sky" | "mint" | "grape" | "orange" | "cream" | "gold";

/** Entrance order: each button pops in a beat after the one above. */
function stagger(order: number): CSSProperties {
  return { "--order": order } as CSSProperties;
}

interface MenuEntryProps {
  tone: MenuTone;
  icon: UiIconName;
  label: string;
  order: number;
  onClick: () => void;
}

/** A wide button: the icon in a round badge, the label, an arrow. */
function MenuRow({ tone, icon, label, order, onClick }: MenuEntryProps) {
  return (
    <button type="button" className={`btn btn--${tone} menu-row`} style={stagger(order)} onClick={onClick}>
      <span className="menu-badge">
        <UiIcon name={icon} size={22} />
      </span>
      <span className="menu-row__label">{label}</span>
      <UiIcon name="chevronRight" size={20} />
    </button>
  );
}

/** A square tile for the secondary pages: a big badge over a short label. */
function MenuTile({ tone, icon, label, order, onClick }: MenuEntryProps) {
  return (
    <button type="button" className={`btn btn--${tone} menu-tile`} style={stagger(order)} onClick={onClick}>
      <span className="menu-badge menu-badge--big">
        <UiIcon name={icon} size={26} />
      </span>
      <span className="menu-tile__label">{label}</span>
    </button>
  );
}
