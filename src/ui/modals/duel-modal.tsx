import { useEffect, useState } from "react";
import { useGameStore } from "../../game/store";
import type { PendingDuel, Player, PlayerId, RpsChoice } from "../../game/types";
import { soundEffects } from "../../audio/sound-effects";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { DUEL_MODE_LABELS } from "../display/game-display";
import { UiIcon } from "../icons/ui-icon";

const RPS_OPTIONS: { id: RpsChoice; label: string; emoji: string }[] = [
  { id: "rock", label: "Pierre", emoji: "✊" },
  { id: "paper", label: "Feuille", emoji: "✋" },
  { id: "scissors", label: "Ciseaux", emoji: "✌️" },
];

const BEATS: Record<RpsChoice, RpsChoice> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function DuelModal() {
  const duel = useGameStore((state) => state.pendingDuel);
  const players = useGameStore((state) => state.players);
  if (!duel) return null;
  const first = players.find((player) => player.id === duel.playerOneId);
  const second = players.find((player) => player.id === duel.playerTwoId);
  if (!first || !second) return null;
  return (
    <DuelArena key={`${duel.playerOneId}-${duel.playerTwoId}-${duel.mode}`} duel={duel} first={first} second={second} />
  );
}

interface DuelArenaProps {
  duel: PendingDuel;
  first: Player;
  second: Player;
}

function DuelArena({ duel, first, second }: DuelArenaProps) {
  const players = useGameStore((state) => state.players);
  const resolveDuel = useGameStore((state) => state.resolveDuel);
  const [winnerId, setWinnerId] = useState<PlayerId | null>(null);
  const winner = winnerId === first.id ? first : winnerId === second.id ? second : null;
  const voters = players.filter((player) => player.id !== first.id && player.id !== second.id);

  useEffect(() => {
    if (winnerId) soundEffects.duelWin();
  }, [winnerId]);

  return (
    <ModalShell
      title="Duel en Enfer"
      eyebrow={DUEL_MODE_LABELS[duel.mode]}
      tone="grape"
      size="medium"
      className="duel-modal"
    >
      <div className="duel-versus">
        <Contestant player={first} state={winner ? (winner.id === first.id ? "won" : "lost") : "idle"} />
        <span className="duel-versus__vs">VS</span>
        <Contestant player={second} state={winner ? (winner.id === second.id ? "won" : "lost") : "idle"} />
      </div>

      {winner ? (
        <div className="duel-outcome">
          <strong>{winner.name} remporte le duel !</strong>
          <p>Retour à la case Départ. L’autre reste en Enfer.</p>
          <button type="button" className="btn btn--cup" onClick={() => resolveDuel(winner.id)} data-autofocus>
            Continuer <UiIcon name="arrowRight" size={20} />
          </button>
        </div>
      ) : duel.mode === "coin-flip" ? (
        <CoinFlip duel={duel} first={first} second={second} onDecided={setWinnerId} />
      ) : duel.mode === "rock-paper-scissors" ? (
        <RockPaperScissors first={first} second={second} onDecided={setWinnerId} />
      ) : (
        <TableVote first={first} second={second} voters={voters} onDecided={setWinnerId} />
      )}
    </ModalShell>
  );
}

function Contestant({ player, state }: { player: Player; state: "idle" | "won" | "lost" }) {
  return (
    <div className={`contestant contestant--${state}`}>
      <PlayerAvatar color={player.color} size={78} expression={state === "lost" ? "worried" : "happy"} />
      <strong>{player.name}</strong>
    </div>
  );
}

function CoinFlip({ duel, first, second, onDecided }: DuelArenaProps & { onDecided: (id: PlayerId) => void }) {
  const [flipping, setFlipping] = useState(false);
  const landsOnFirst = duel.coinWinnerId === first.id;

  const flip = () => {
    setFlipping(true);
    soundEffects.coinFlip();
    window.setTimeout(() => duel.coinWinnerId && onDecided(duel.coinWinnerId), 1_700);
  };

  return (
    <div className="duel-panel">
      <div className={`duel-coin ${flipping ? (landsOnFirst ? "is-flipping-first" : "is-flipping-second") : ""}`}>
        <span className="duel-coin__face duel-coin__face--front">
          <PlayerAvatar color={first.color} size={70} />
        </span>
        <span className="duel-coin__face duel-coin__face--back">
          <PlayerAvatar color={second.color} size={70} />
        </span>
      </div>
      <p>
        Face : <strong>{first.name}</strong> · Pile : <strong>{second.name}</strong>
      </p>
      <button type="button" className="btn btn--gold" onClick={flip} disabled={flipping} data-autofocus>
        Lancer la pièce
      </button>
    </div>
  );
}

function RockPaperScissors({
  first,
  second,
  onDecided,
}: {
  first: Player;
  second: Player;
  onDecided: (id: PlayerId) => void;
}) {
  const [firstChoice, setFirstChoice] = useState<RpsChoice | null>(null);
  const [secondChoice, setSecondChoice] = useState<RpsChoice | null>(null);
  const [handedOver, setHandedOver] = useState(false);
  const [ties, setTies] = useState(0);

  const revealed = firstChoice !== null && secondChoice !== null;
  const tie = revealed && firstChoice === secondChoice;

  useEffect(() => {
    if (!revealed) return undefined;
    soundEffects.reveal();
    if (tie) return undefined;
    const winner = BEATS[firstChoice] === secondChoice ? first.id : second.id;
    const timer = window.setTimeout(() => onDecided(winner), 1_400);
    return () => window.clearTimeout(timer);
  }, [revealed, tie, firstChoice, secondChoice, first.id, second.id, onDecided]);

  const replay = () => {
    setFirstChoice(null);
    setSecondChoice(null);
    setHandedOver(false);
    setTies((count) => count + 1);
  };

  if (revealed) {
    const optionFor = (choice: RpsChoice) => RPS_OPTIONS.find((option) => option.id === choice);
    return (
      <div className="duel-panel">
        <div className="rps-reveal">
          <span className="rps-hand rps-hand--left">{optionFor(firstChoice)?.emoji}</span>
          <span className="rps-hand rps-hand--right">{optionFor(secondChoice)?.emoji}</span>
        </div>
        {tie && (
          <button type="button" className="btn btn--gold" onClick={replay} data-autofocus>
            Égalité ! On rejoue
          </button>
        )}
      </div>
    );
  }

  if (firstChoice && !handedOver) {
    return (
      <div className="duel-panel">
        <p className="duel-secret">
          Choix de {first.name} enregistré. Passe l’écran à <strong>{second.name}</strong>.
        </p>
        <button type="button" className="btn btn--gold" onClick={() => setHandedOver(true)} data-autofocus>
          <UiIcon name="eye" size={20} /> Je suis {second.name}
        </button>
      </div>
    );
  }

  const chooser = firstChoice ? second : first;
  return (
    <div className="duel-panel">
      <p className="duel-secret">
        {ties > 0 && <span className="tie-badge">Manche {ties + 1}</span>}
        <strong>{chooser.name}</strong>, choisis en secret :
      </p>
      <div className="rps-options">
        {RPS_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="rps-option"
            onClick={() => (firstChoice ? setSecondChoice(option.id) : setFirstChoice(option.id))}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TableVote({
  first,
  second,
  voters,
  onDecided,
}: {
  first: Player;
  second: Player;
  voters: Player[];
  onDecided: (id: PlayerId) => void;
}) {
  const [votes, setVotes] = useState<PlayerId[]>([]);
  const [tieBreak, setTieBreak] = useState<PlayerId | null>(null);
  const voter = voters[votes.length];
  const finished = votes.length >= voters.length;
  const firstVotes = votes.filter((vote) => vote === first.id).length;
  const secondVotes = votes.length - firstVotes;

  useEffect(() => {
    if (!finished) return undefined;
    soundEffects.reveal();
    const winner =
      firstVotes === secondVotes
        ? Math.random() < 0.5
          ? first.id
          : second.id
        : firstVotes > secondVotes
          ? first.id
          : second.id;
    if (firstVotes === secondVotes) setTieBreak(winner);
    const timer = window.setTimeout(() => onDecided(winner), firstVotes === secondVotes ? 2_000 : 1_400);
    return () => window.clearTimeout(timer);
  }, [finished, firstVotes, secondVotes, first.id, second.id, onDecided]);

  if (finished) {
    return (
      <div className="duel-panel">
        <div className="vote-tally">
          <span>
            {first.name} <strong>{firstVotes}</strong>
          </span>
          <span>
            <strong>{secondVotes}</strong> {second.name}
          </span>
        </div>
        {tieBreak && <p>Égalité : la pièce départage…</p>}
      </div>
    );
  }

  return (
    <div className="duel-panel">
      <p className="duel-secret">
        Vote secret de <strong>{voter?.name}</strong> ({votes.length + 1}/{voters.length})
      </p>
      <div className="vote-options">
        {[first, second].map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="vote-option"
            onClick={() => setVotes((current) => [...current, candidate.id])}
          >
            <PlayerAvatar color={candidate.color} size={44} />
            {candidate.name}
          </button>
        ))}
      </div>
    </div>
  );
}
