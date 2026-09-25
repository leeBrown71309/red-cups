import { useState, type CSSProperties } from "react";
import { PLAYER_COLORS } from "../game/types";

interface SetupScreenProps {
  onStart: (names: string[]) => void;
}

const PLAYER_LIMIT = 8;
const MIN_PLAYERS = 2;

export default function SetupScreen({ onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState(() =>
    Array.from({ length: PLAYER_LIMIT }, (_, index) => `Joueur ${index + 1}`),
  );

  const updateName = (index: number, value: string) => {
    setNames((currentNames) =>
      currentNames.map((name, nameIndex) => (nameIndex === index ? value : name)),
    );
  };

  return (
    <main className="setup-screen">
      <div className="setup-screen__backdrop" aria-hidden="true">
        <div className="setup-screen__glow setup-screen__glow--red" />
        <div className="setup-screen__glow setup-screen__glow--gold" />
        <div className="setup-screen__orbit setup-screen__orbit--one" />
        <div className="setup-screen__orbit setup-screen__orbit--two" />
      </div>

      <section className="setup-card">
        <div className="setup-card__intro">
          <div className="brand-lockup">
            <span className="brand-lockup__cup" aria-hidden="true">RC</span>
            <span className="brand-lockup__name">RED CUPS</span>
          </div>
          <span className="eyebrow">LA TABLE EST À VOUS</span>
          <h1>La soirée peut<br />mal tourner.</h1>
          <p>
            Ramasse trois Red Cups, garde tes amis près de toi et évite
            l’Enfer. Tout le monde joue autour du même écran.
          </p>

          <div className="setup-facts">
            <div>
              <span className="setup-facts__value">02–08</span>
              <span className="setup-facts__label">joueurs</span>
            </div>
            <div>
              <span className="setup-facts__value">03</span>
              <span className="setup-facts__label">Red Cups pour gagner</span>
            </div>
            <div>
              <span className="setup-facts__value">2 000</span>
              <span className="setup-facts__label">pièces au départ</span>
            </div>
          </div>
        </div>

        <div className="setup-card__form">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NOUVELLE PARTIE</span>
              <h2>Qui joue ce soir ?</h2>
            </div>
            <span className="players-count">{String(playerCount).padStart(2, "0")} / 08</span>
          </div>

          <div className="player-count-control" aria-label="Nombre de joueurs">
            <button
              type="button"
              aria-label="Retirer un joueur"
              disabled={playerCount <= MIN_PLAYERS}
              onClick={() => setPlayerCount((count) => Math.max(MIN_PLAYERS, count - 1))}
            >
              −
            </button>
            <div className="player-count-control__dots" aria-hidden="true">
              {Array.from({ length: PLAYER_LIMIT }, (_, index) => (
                <span
                  className={index < playerCount ? "is-active" : ""}
                  key={index}
                  style={{ "--player-color": PLAYER_COLORS[index] } as CSSProperties}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Ajouter un joueur"
              disabled={playerCount >= PLAYER_LIMIT}
              onClick={() => setPlayerCount((count) => Math.min(PLAYER_LIMIT, count + 1))}
            >
              +
            </button>
          </div>

          <div className="setup-player-list">
            {names.slice(0, playerCount).map((name, index) => (
              <label className="setup-player" key={index}>
                <span
                  className="setup-player__token"
                  style={{ backgroundColor: PLAYER_COLORS[index] }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="setup-player__input-wrap">
                  <span className="setup-player__caption">JOUEUR {String(index + 1).padStart(2, "0")}</span>
                  <input
                    aria-label={`Nom du joueur ${index + 1}`}
                    maxLength={20}
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                  />
                </span>
                <span className="setup-player__ready" aria-hidden="true">●</span>
              </label>
            ))}
          </div>

          <button className="button button--primary setup-submit" onClick={() => onStart(names.slice(0, playerCount))}>
            Lancer la partie <span aria-hidden="true">↗</span>
          </button>
          <p className="setup-note">Les passifs et la première Red Cup seront attribués automatiquement.</p>
        </div>
      </section>

      <footer className="setup-footer">
        <span>UNE TABLE · UN HÔTE · BEAUCOUP DE MAUVAISES DÉCISIONS</span>
        <span>V.0.1 — PARTIE LOCALE</span>
      </footer>
    </main>
  );
}
