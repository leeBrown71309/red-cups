import { countRedCups } from "../../game/rules";
import { getStandings, isWinnerOf } from "../../game/standings";
import type { GameState, Player } from "../../game/types";
import { formatCurrency } from "../display/game-display";
import { CupPips } from "../hud/player-status";
import { CoinIcon } from "../icons/item-icon";
import { PlayerAvatar } from "./player-avatar";

type StandingsSource = Pick<GameState, "players" | "abandonedPlayers" | "winnerId"> &
  Partial<Pick<GameState, "coWinnerId">>;

/** The final table of a game: the victory screen and the game history show the same list. */
export function StandingsList({ state }: { state: StandingsSource }) {
  const { ranked, leavers } = getStandings(state);
  return (
    <ol className="standings">
      {ranked.map((player, index) => (
        <StandingRow key={player.id} player={player} rank={index + 1} isWinner={isWinnerOf(state, player.id)} />
      ))}
      {leavers.map((player) => (
        <StandingRow key={player.id} player={player} rank={null} isWinner={false} />
      ))}
    </ol>
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
