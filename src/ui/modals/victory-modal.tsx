import { countRedCups } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CupPips } from "../hud/players-bar";
import { CoinIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

const CONFETTI_PIECES = 36;

export function VictoryModal() {
  const players = useGameStore((state) => state.players);
  const winnerId = useGameStore((state) => state.winnerId);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const winner = players.find((player) => player.id === winnerId);
  if (!winner) return null;

  const standings = [...players].sort(
    (left, right) => countRedCups(right) - countRedCups(left) || right.currency - left.currency,
  );

  return (
    <div className="modal-layer victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="modal-backdrop" />
      <div className="victory__confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
          <i key={index} style={{ left: `${(index * 97) % 100}%`, animationDelay: `${(index % 12) * 0.12}s` }} />
        ))}
      </div>
      <section className="modal-card modal-card--gold modal-card--medium victory__card">
        <div className="victory__hero">
          <UiIcon name="crown" size={42} className="victory__crown" />
          <PlayerAvatar color={winner.color} size={120} />
        </div>
        <span className="modal-card__eyebrow">Trois Red Cups. Une légende.</span>
        <h2 id="victory-title" className="victory__title">
          {winner.name} gagne la partie !
        </h2>
        <ol className="standings">
          {standings.map((player, index) => (
            <li key={player.id} className={player.id === winner.id ? "is-winner" : ""}>
              <span className="standings__rank">{index + 1}</span>
              <PlayerAvatar color={player.color} size={34} />
              <span className="standings__name">{player.name}</span>
              <CupPips count={countRedCups(player)} size={14} />
              <span className="standings__coins">
                <CoinIcon size={14} /> {formatCurrency(player.currency)}
              </span>
            </li>
          ))}
        </ol>
        <div className="modal-actions">
          <button type="button" className="btn btn--cream" onClick={resetGame}>
            Menu principal
          </button>
          <button
            type="button"
            className="btn btn--cup"
            onClick={() => startGame(players.map((player) => player.name))}
            data-autofocus
          >
            <UiIcon name="refresh" size={20} /> Revanche !
          </button>
        </div>
      </section>
    </div>
  );
}
