import { useEffect, useState } from "react";
import { isDuellist } from "../../game/duel";
import { useGameStore } from "../../game/store";
import type { PendingDuel, Player, PlayerId, RpsChoice } from "../../game/types";
import { useCanActFor, useLocalPlayerId } from "../../net/room-store";
import { soundEffects } from "../../audio/sound-effects";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { WaitingNote } from "../components/waiting-note";
import { DUEL_MODE_LABELS } from "../display/game-display";
import { UiIcon } from "../icons/ui-icon";

const RPS_OPTIONS: { id: RpsChoice; label: string; emoji: string }[] = [
  { id: "rock", label: "Pierre", emoji: "✊" },
  { id: "paper", label: "Feuille", emoji: "✋" },
  { id: "scissors", label: "Ciseaux", emoji: "✌️" },
];

const COIN_FLIP_MS = 1_700;
const REVEAL_MS = 1_400;
const TIE_BREAK_REVEAL_MS = 2_000;

/**
 * The engine decides every duel (coin, hands, votes); this screen collects
 * the choices and plays the reveal. At a local table one screen is passed
 * around; online each player chooses on their own device.
 */
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

/** Once the engine names the winner, the reveal plays before the result shows. */
function useRevealedWinner(duel: PendingDuel): Player["id"] | null {
  const [revealedId, setRevealedId] = useState<PlayerId | null>(null);
  useEffect(() => {
    if (!duel.winnerId) return undefined;
    const delay = duel.mode === "coin-flip" ? COIN_FLIP_MS : duel.voteTieBroken ? TIE_BREAK_REVEAL_MS : REVEAL_MS;
    const timer = window.setTimeout(() => setRevealedId(duel.winnerId), delay);
    return () => window.clearTimeout(timer);
  }, [duel.winnerId, duel.mode, duel.voteTieBroken]);
  return revealedId;
}

function DuelArena({ duel, first, second }: DuelArenaProps) {
  const resolveDuel = useGameStore((state) => state.resolveDuel);
  const canSettle = useCanActFor([first.id, second.id]);
  const revealedId = useRevealedWinner(duel);
  const winner = revealedId === first.id ? first : revealedId === second.id ? second : null;

  useEffect(() => {
    if (winner) soundEffects.duelWin();
  }, [winner]);

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
          {canSettle ? (
            <button type="button" className="btn btn--cup" onClick={() => resolveDuel(winner.id)} data-autofocus>
              Continuer <UiIcon name="arrowRight" size={20} />
            </button>
          ) : (
            <WaitingNote player={winner} />
          )}
        </div>
      ) : duel.mode === "coin-flip" ? (
        <CoinFlip duel={duel} first={first} second={second} />
      ) : duel.mode === "rock-paper-scissors" ? (
        <RockPaperScissors duel={duel} first={first} second={second} />
      ) : (
        <TableVote duel={duel} first={first} second={second} />
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

function CoinFlip({ duel, first, second }: DuelArenaProps) {
  const flipDuelCoin = useGameStore((state) => state.flipDuelCoin);
  const canFlip = useCanActFor([first.id, second.id]);
  const flipping = duel.winnerId !== null;
  const landsOnFirst = duel.coinWinnerId === first.id;

  useEffect(() => {
    if (flipping) soundEffects.coinFlip();
  }, [flipping]);

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
      {canFlip ? (
        <button type="button" className="btn btn--gold" onClick={flipDuelCoin} disabled={flipping} data-autofocus>
          Lancer la pièce
        </button>
      ) : (
        !flipping && <WaitingNote player={first} text={`${first.name} ou ${second.name} lance la pièce…`} />
      )}
    </div>
  );
}

function HandsReveal({ duel, first, second }: DuelArenaProps) {
  const hands = duel.winnerId ? duel.rpsChoices : (duel.rpsTiedRound ?? {});
  const emojiOf = (playerId: PlayerId) => RPS_OPTIONS.find((option) => option.id === hands[playerId])?.emoji;
  return (
    <div className="rps-reveal">
      <span className="rps-hand rps-hand--left">{emojiOf(first.id)}</span>
      <span className="rps-hand rps-hand--right">{emojiOf(second.id)}</span>
    </div>
  );
}

function RockPaperScissors({ duel, first, second }: DuelArenaProps) {
  const pickDuelHand = useGameStore((state) => state.pickDuelHand);
  const localPlayerId = useLocalPlayerId();
  const [seenTies, setSeenTies] = useState(0);
  const [handedOver, setHandedOver] = useState(false);
  const decided = duel.winnerId !== null;
  const showingTie = duel.rpsTiedRound !== null && seenTies < duel.rpsTies;

  useEffect(() => {
    if (decided || showingTie) soundEffects.reveal();
  }, [decided, showingTie]);

  useEffect(() => {
    // A new round starts with nobody's hand picked: the local hand-over starts over too.
    if (Object.keys(duel.rpsChoices).length === 0) setHandedOver(false);
  }, [duel.rpsChoices]);

  if (decided) {
    return (
      <div className="duel-panel">
        <HandsReveal duel={duel} first={first} second={second} />
      </div>
    );
  }

  if (showingTie) {
    return (
      <div className="duel-panel">
        <HandsReveal duel={duel} first={first} second={second} />
        <button type="button" className="btn btn--gold" onClick={() => setSeenTies(duel.rpsTies)} data-autofocus>
          Égalité ! On rejoue
        </button>
      </div>
    );
  }

  const roundBadge = duel.rpsTies > 0 && <span className="tie-badge">Manche {duel.rpsTies + 1}</span>;
  const picker = (chooser: Player) => (
    <div className="duel-panel">
      <p className="duel-secret">
        {roundBadge}
        <strong>{chooser.name}</strong>, choisis en secret :
      </p>
      <div className="rps-options">
        {RPS_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="rps-option"
            onClick={() => pickDuelHand(chooser.id, option.id)}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Online: each duellist picks on their own screen, everyone else waits.
  if (localPlayerId !== null) {
    const me = [first, second].find((player) => player.id === localPlayerId);
    if (me && !duel.rpsChoices[me.id]) return picker(me);
    const pending = [first, second].filter((player) => !duel.rpsChoices[player.id]);
    return (
      <div className="duel-panel">
        {roundBadge}
        <WaitingNote
          player={pending[0]}
          text={
            pending.length === 2
              ? `${first.name} et ${second.name} choisissent en secret…`
              : `En attente du choix de ${pending[0]?.name ?? "l’adversaire"}…`
          }
        />
      </div>
    );
  }

  // Local table: one screen, handed from the first duellist to the second.
  if (!duel.rpsChoices[first.id]) return picker(first);
  if (!handedOver) {
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
  return picker(second);
}

function TableVote({ duel, first, second }: DuelArenaProps) {
  const castDuelVote = useGameStore((state) => state.castDuelVote);
  const players = useGameStore((state) => state.players);
  const localPlayerId = useLocalPlayerId();
  const voters = players.filter((player) => !isDuellist(duel, player.id));
  const voterIds = voters.map((player) => player.id);
  const castCount = voterIds.filter((id) => duel.votes[id]).length;
  const decided = duel.winnerId !== null;

  useEffect(() => {
    if (decided) soundEffects.reveal();
  }, [decided]);

  if (decided) {
    const firstVotes = voterIds.filter((id) => duel.votes[id] === first.id).length;
    return (
      <div className="duel-panel">
        <div className="vote-tally">
          <span>
            {first.name} <strong>{firstVotes}</strong>
          </span>
          <span>
            <strong>{voterIds.length - firstVotes}</strong> {second.name}
          </span>
        </div>
        {duel.voteTieBroken && <p>Égalité : la pièce départage…</p>}
      </div>
    );
  }

  // Online each voter votes on their own device; locally the screen goes round the table.
  const voter =
    localPlayerId !== null
      ? voters.find((candidate) => candidate.id === localPlayerId && !duel.votes[candidate.id])
      : voters.find((candidate) => !duel.votes[candidate.id]);

  if (!voter) {
    return (
      <div className="duel-panel">
        <WaitingNote
          player={voters.find((candidate) => !duel.votes[candidate.id])}
          text={`La table vote en secret… (${castCount}/${voterIds.length})`}
        />
      </div>
    );
  }

  return (
    <div className="duel-panel">
      <p className="duel-secret">
        Vote secret de <strong>{voter.name}</strong> ({castCount + 1}/{voterIds.length})
      </p>
      <div className="vote-options">
        {[first, second].map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="vote-option"
            onClick={() => castDuelVote(voter.id, candidate.id)}
          >
            <PlayerAvatar color={candidate.color} size={44} />
            {candidate.name}
          </button>
        ))}
      </div>
    </div>
  );
}
