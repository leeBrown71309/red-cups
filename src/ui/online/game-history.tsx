import { useCallback, useEffect, useState } from "react";
import { PLAYER_COLORS } from "../../game/types";
import {
  fetchMyGames,
  getDurationMinutes,
  getOutcome,
  getWinnerName,
  type HistoryGame,
  type HistoryOutcome,
} from "../../net/history";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { StandingsList } from "../components/standings-list";
import { UiIcon } from "../icons/ui-icon";

type HistoryLoad = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; games: HistoryGame[] };

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

interface GameHistoryModalProps {
  onClose: () => void;
  /** Where the games come from: the database, or simulated games in the dev preview. */
  loadGames?: () => Promise<HistoryGame[]>;
}

/** The latest online games of the signed-in Google account, then one of them in detail. */
export function GameHistoryModal({ onClose, loadGames = fetchMyGames }: GameHistoryModalProps) {
  const [load, setLoad] = useState<HistoryLoad>({ kind: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      setLoad({ kind: "ready", games: await loadGames() });
    } catch (error) {
      setLoad({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [loadGames]);

  useEffect(() => void reload(), [reload]);

  const opened = load.kind === "ready" ? load.games.find((game) => game.id === openId) : undefined;

  return (
    <ModalShell
      title={opened ? "Détail de la partie" : "Mes parties"}
      eyebrow="Historique en ligne"
      onClose={onClose}
      className="history-modal"
    >
      {opened ? (
        <GameDetail game={opened} onBack={() => setOpenId(null)} />
      ) : load.kind === "loading" ? (
        <p className="modal-lead">Chargement des parties…</p>
      ) : load.kind === "error" ? (
        <div className="history-modal__error">
          <p className="modal-lead">{load.message}</p>
          <button type="button" className="btn btn--cream btn--small" onClick={() => void reload()}>
            <UiIcon name="refresh" size={18} /> Réessayer
          </button>
        </div>
      ) : load.games.length === 0 ? (
        <p className="modal-lead">Aucune partie en ligne pour l’instant. Tes prochaines parties apparaîtront ici.</p>
      ) : (
        <ol className="history-list">
          {load.games.map((game) => (
            <li key={game.id}>
              <GameRow game={game} onOpen={() => setOpenId(game.id)} />
            </li>
          ))}
        </ol>
      )}
    </ModalShell>
  );
}

function GameRow({ game, onOpen }: { game: HistoryGame; onOpen: () => void }) {
  const outcome = getOutcome(game);
  const winner = getWinnerName(game);
  return (
    <button type="button" className="history-row" onClick={onOpen} disabled={!game.final}>
      <OutcomeBadge outcome={outcome} />
      <span className="history-row__main">
        <strong>{DATE_FORMAT.format(game.startedAt)}</strong>
        <span>
          {winner && outcome.kind !== "won" ? `Victoire de ${winner}` : describeStatus(game)}
          {game.final && (
            <>
              {" · "}
              <GameFacts game={game} />
            </>
          )}
        </span>
      </span>
      <span className="history-row__players" aria-label={game.seats.map((seat) => seat.name).join(", ")}>
        {game.seats.map((seat) => (
          <PlayerAvatar key={seat.seat} color={PLAYER_COLORS[seat.avatar] ?? PLAYER_COLORS[0]} size={24} />
        ))}
      </span>
    </button>
  );
}

function GameDetail({ game, onBack }: { game: HistoryGame; onBack: () => void }) {
  return (
    <div className="history-detail">
      <button type="button" className="btn btn--cream btn--small history-detail__back" onClick={onBack}>
        <UiIcon name="arrowLeft" size={18} /> Toutes les parties
      </button>
      <p className="history-detail__facts">
        <OutcomeBadge outcome={getOutcome(game)} /> {DATE_FORMAT.format(game.startedAt)} · <GameFacts game={game} />
      </p>
      {game.final && <StandingsList state={game.final} />}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: HistoryOutcome }) {
  const [label, tone] = describeOutcome(outcome);
  return <span className={`history-badge history-badge--${tone}`}>{label}</span>;
}

function GameFacts({ game }: { game: HistoryGame }) {
  const minutes = getDurationMinutes(game);
  const rounds = game.final?.round;
  return (
    <>
      {rounds !== undefined && `${rounds} tour${rounds > 1 ? "s" : ""}`}
      {minutes !== null && (
        <>
          {" "}
          <UiIcon name="clock" size={13} /> {formatDuration(minutes)}
        </>
      )}
    </>
  );
}

function describeOutcome(outcome: HistoryOutcome): [label: string, tone: string] {
  switch (outcome.kind) {
    case "won":
      return ["Victoire", "won"];
    case "placed":
      return [`${outcome.place}${outcome.place === 1 ? "re" : "e"} sur ${outcome.of}`, "placed"];
    case "abandoned":
      return ["Abandon", "left"];
    case "unfinished":
      return ["Inachevée", "quiet"];
    case "playing":
      return ["En cours", "quiet"];
  }
}

function describeStatus(game: HistoryGame): string {
  if (game.status === "playing") return "Partie en cours";
  if (game.status === "unfinished") return "Partie interrompue";
  return "Partie terminée";
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
