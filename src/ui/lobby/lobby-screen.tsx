import { useEffect, useState } from "react";
import { PLAYER_COLORS } from "../../game/types";
import { AudioToggles } from "../components/audio-controls";
import { GameLogo } from "../components/game-logo";
import { PlayerAvatar } from "../components/player-avatar";
import { CoinIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { HelpModal } from "../modals/help-modal";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const NAME_MAX_LENGTH = 16;
const STORAGE_KEY = "red-cups-table";
const DEFAULT_NAMES = ["Léa", "Malik", "Inès", "Tom"];

function loadRememberedNames(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    if (Array.isArray(parsed) && parsed.length >= MIN_PLAYERS && parsed.every((name) => typeof name === "string")) {
      return parsed.slice(0, MAX_PLAYERS);
    }
  } catch {
    // A missing or corrupted memory simply falls back to the default table.
  }
  return DEFAULT_NAMES;
}

function rememberNames(names: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Storage can be unavailable (private mode); remembering names is optional.
  }
}

interface LobbyScreenProps {
  onStart: (names: string[]) => void;
}

export function LobbyScreen({ onStart }: LobbyScreenProps) {
  const [names, setNames] = useState<string[]>(loadRememberedNames);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => rememberNames(names), [names]);

  const updateName = (index: number, value: string) =>
    setNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  const removePlayer = (index: number) => setNames((current) => current.filter((_, nameIndex) => nameIndex !== index));
  const addPlayer = () => setNames((current) => [...current, `Joueur ${current.length + 1}`]);
  const shuffleOrder = () =>
    setNames((current) => {
      const shuffled = [...current];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      return shuffled;
    });

  const startGame = () => onStart(names.map((name, index) => name.trim() || `Joueur ${index + 1}`));

  return (
    <main className="lobby">
      <div className="lobby__corner">
        <AudioToggles />
        <button type="button" className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Comment jouer">
          <UiIcon name="help" />
        </button>
      </div>

      <section className="lobby__hero">
        <GameLogo />
        <p className="lobby__tagline">Le jeu de plateau qui finit mal entre amis.</p>
        <ul className="lobby__facts">
          <li>
            <UiIcon name="users" size={18} /> 2 à 8 joueurs
          </li>
          <li>
            <RedCupIcon size={20} /> 3 Red Cups pour gagner
          </li>
          <li>
            <CoinIcon size={20} /> 2 000 pièces au départ
          </li>
        </ul>
        <button type="button" className="btn btn--cream btn--small lobby__rules" onClick={() => setHelpOpen(true)}>
          <UiIcon name="help" size={18} /> Comment jouer ?
        </button>
      </section>

      <section className="lobby__panel panel" aria-labelledby="lobby-title">
        <header className="lobby__panel-header">
          <div>
            <span className="eyebrow">Nouvelle partie</span>
            <h1 id="lobby-title">Qui joue ce soir ?</h1>
          </div>
          <span className="count-badge">
            {names.length}/{MAX_PLAYERS}
          </span>
        </header>

        <ol className="lobby__players">
          {names.map((name, index) => (
            <li className="lobby-player" key={index} style={{ animationDelay: `${index * 40}ms` }}>
              <span className="lobby-player__seat">{index + 1}</span>
              <PlayerAvatar color={PLAYER_COLORS[index]} size={44} />
              <input
                className="lobby-player__input"
                value={name}
                maxLength={NAME_MAX_LENGTH}
                aria-label={`Nom du joueur ${index + 1}`}
                onChange={(event) => updateName(index, event.target.value)}
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                className="icon-button icon-button--small"
                onClick={() => removePlayer(index)}
                disabled={names.length <= MIN_PLAYERS}
                aria-label={`Retirer ${name || `le joueur ${index + 1}`}`}
              >
                <UiIcon name="close" size={18} />
              </button>
            </li>
          ))}
        </ol>

        <div className="lobby__tools">
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={addPlayer}
            disabled={names.length >= MAX_PLAYERS}
          >
            <UiIcon name="plus" size={18} /> Ajouter
          </button>
          <button type="button" className="btn btn--cream btn--small" onClick={shuffleOrder}>
            <UiIcon name="dice" size={18} /> Mélanger l’ordre
          </button>
        </div>

        <button type="button" className="btn btn--cup btn--large lobby__start" onClick={startGame}>
          <UiIcon name="play" size={22} /> Lancer la partie
        </button>
        <p className="lobby__note">Les passifs sont tirés au hasard. La première Red Cup attend en case 8.</p>
      </section>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </main>
  );
}
