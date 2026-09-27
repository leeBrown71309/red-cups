import { useState } from "react";
import { playBotsFrom } from "../game/simulation/play-bots";
import type { GameState } from "../game/types";
import type { HistoryGame, HistoryStatus } from "../net/history";
import { buildOnlineGame } from "../net/room-protocol";
import { GameHistoryModal } from "../ui/online/game-history";

/**
 * Dev only (`?preview=history`): the "Mes parties" screen filled with games
 * the bots really played, seen by a simulated Google account. No Supabase,
 * no Google: the database side of the history has its own simulation test.
 */

const ME = "Moussa";

interface SimulatedGame {
  names: string[];
  seed: number;
  /** The simulated account swaps seats with the winner once the game is over, to show a win. */
  meWins?: boolean;
  maxSteps?: number;
  abandonSeat?: number;
  status?: HistoryStatus;
}

const SIMULATED_GAMES: SimulatedGame[] = [
  { names: [ME, "Awa", "Léa"], seed: 11, meWins: true },
  { names: ["Awa", ME, "Inès", "Tom"], seed: 23 },
  { names: [ME, "Malik"], seed: 37, abandonSeat: 0 },
  { names: [ME, "Zoé", "Noé"], seed: 41, maxSteps: 60, status: "unfinished" },
  { names: [ME, "Awa", "Léa", "Tom", "Inès", "Malik", "Zoé", "Noé"], seed: 59 },
  { names: [ME, "Awa"], seed: 71, status: "playing" },
];

function simulate(game: SimulatedGame, index: number): HistoryGame {
  const players = game.names.map((name, seat) => ({
    userId: `user-${seat}`,
    seat: null,
    name,
    avatar: seat,
    absent: false,
  }));
  const { state } = buildOnlineGame(players, game.seed, "classic");
  const final: GameState = playBotsFrom(state, {
    seed: game.seed,
    maxSteps: game.maxSteps,
    abandon: game.abandonSeat === undefined ? undefined : { playerId: `p${game.abandonSeat + 1}`, afterStep: 30 },
  });
  const names = [...game.names];
  if (game.meWins && final.winnerId) {
    const winnerSeat = Number(final.winnerId.slice(1)) - 1;
    const mine = names.indexOf(ME);
    [names[mine], names[winnerSeat]] = [names[winnerSeat], names[mine]];
  }
  const rename = <T extends { id: string; name: string }>(player: T): T => ({
    ...player,
    name: names[Number(player.id.slice(1)) - 1] ?? player.name,
  });
  const status = game.status ?? "finished";
  const startedAt = new Date(Date.now() - (index + 1) * 5 * 3_600_000);
  const board: GameState = {
    ...final,
    players: final.players.map(rename),
    abandonedPlayers: final.abandonedPlayers.map(rename),
    log: [],
  };
  return {
    id: `simulated-${index}`,
    status,
    startedAt,
    endedAt: status === "playing" ? null : new Date(startedAt.getTime() + final.round * 2 * 60_000),
    final: status === "playing" ? null : board,
    mySeat: names.indexOf(ME),
    seats: names.map((name, seat) => ({ seat, name, avatar: seat })),
  };
}

export function HistoryPreview() {
  // Played once and kept: a new loader on every render would reload the list forever.
  const [loadGames] = useState(() => {
    const games = SIMULATED_GAMES.map(simulate);
    return () => Promise.resolve(games);
  });
  const [open, setOpen] = useState(true);
  return (
    <main className="lobby">
      {open ? (
        <GameHistoryModal loadGames={loadGames} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className="btn btn--cup" onClick={() => setOpen(true)}>
          Rouvrir « Mes parties »
        </button>
      )}
    </main>
  );
}
