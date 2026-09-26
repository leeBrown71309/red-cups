import { countRedCups } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CupPips } from "../hud/players-bar";
import { CoinIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

const CONFETTI_PIECES = 36;

export function VictoryModal() {
  const players = useGameStore((state) => state.players);
  const abandonedPlayers = useGameStore((state) => state.abandonedPlayers);
  const winnerId = useGameStore((state) => state.winnerId);
  const winReason = useGameStore((state) => state.winReason);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const leaveRoom = useRoomStore((state) => state.leave);
  const isOnline = useLocalPlayerId() !== null;
  const winner = players.find((player) => player.id === winnerId);
  if (!winner) return null;

  const standings = [...players].sort(
    (left, right) => countRedCups(right) - countRedCups(left) || right.currency - left.currency,
  );
  // Players who left are listed last, most recent departure first.
  const leavers = [...abandonedPlayers].reverse();
  // A rematch replays the same local table; online, everybody goes back to the menu.
  const canRematch = !isOnline && players.length >= 2;

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
        <span className="modal-card__eyebrow">
          {winReason === "forfeit" ? "Dernière personne à table" : "Trois Red Cups. Une légende."}
        </span>
        <h2 id="victory-title" className="victory__title">
          {winner.name} gagne la partie !
        </h2>
        <ol className="standings">
          {standings.map((player, index) => (
            <StandingRow key={player.id} player={player} rank={index + 1} isWinner={player.id === winner.id} />
          ))}
          {leavers.map((player) => (
            <StandingRow key={player.id} player={player} rank={null} isWinner={false} />
          ))}
        </ol>
        <div className="modal-actions">
          <button
            type="button"
            className={`btn ${canRematch ? "btn--cream" : "btn--cup"}`}
            onClick={() => (isOnline ? void leaveRoom() : resetGame())}
          >
            {isOnline ? "Quitter le salon" : "Menu principal"}
          </button>
          {canRematch && (
            <button
              type="button"
              className="btn btn--cup"
              onClick={() => startGame(players.map((player) => player.name))}
              data-autofocus
            >
              <UiIcon name="refresh" size={20} /> Revanche !
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** `rank` is null for a player who abandoned. */
function StandingRow({ player, rank, isWinner }: { player: Player; rank: number | null; isWinner: boolean }) {
  return (
    <li className={[isWinner && "is-winner", rank === null && "is-abandoned"].filter(Boolean).join(" ")}>
      <span className="standings__rank">{rank ?? "–"}</span>
      <PlayerAvatar color={player.color} size={34} expression={rank === null ? "sleepy" : "happy"} />
      <span className="standings__name">
        {player.name}
        {rank === null && <small className="standings__tag">Abandon</small>}
      </span>
      <CupPips count={countRedCups(player)} size={14} />
      <span className="standings__coins">
        <CoinIcon size={14} /> {formatCurrency(player.currency)}
      </span>
    </li>
  );
}
