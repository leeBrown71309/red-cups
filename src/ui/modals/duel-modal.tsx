import { useEffect, useState } from "react";
import { getHumanDuellistIds, isDuellist } from "../../game/duel";
import { describeCoinReward } from "../../game/ghost";
import { ITEM_CATALOG } from "../../game/catalog";
import { useGameStore } from "../../game/store";
import type { GhostStakes, PendingDuel, PlayerId, RpsChoice } from "../../game/types";
import { useCanActFor, useLocalPlayerId } from "../../net/room-store";
import { soundEffects } from "../../audio/sound-effects";
import { useCanSeeBagOf } from "../card-visibility";
import { ModalShell } from "../components/modal-shell";
import { WaitingNote } from "../components/waiting-note";
import { DUEL_MODE_LABELS } from "../display/game-display";
import { UiIcon } from "../icons/ui-icon";
import { BasketGame } from "./basket-game";
import { BlackjackGame } from "./blackjack-game";
import { DuellistAvatar, findDuellist, isGhost, type Duellist } from "./duellists";

const RPS_OPTIONS: { id: RpsChoice; label: string; emoji: string }[] = [
  { id: "rock", label: "Pierre", emoji: "✊" },
  { id: "paper", label: "Feuille", emoji: "✋" },
  { id: "scissors", label: "Ciseaux", emoji: "✌️" },
];

const COIN_FLIP_MS = 1_700;
const REVEAL_MS = 1_400;
const TIE_BREAK_REVEAL_MS = 2_000;

/**
 * The engine decides every duel (coin, hands, votes, baskets); this screen
 * collects the choices and plays the reveal. At a local table one screen is
 * passed around; online each player chooses on their own device. At Luna
 * Park the second duellist may be the ghost, whose moves the engine draws.
 */
export function DuelModal() {
  const duel = useGameStore((state) => state.pendingDuel);
  const players = useGameStore((state) => state.players);
  if (!duel) return null;
  const first = findDuellist(players, duel.playerOneId);
  const second = findDuellist(players, duel.playerTwoId);
  if (!first || !second) return null;
  return (
    <DuelArena
      key={`${duel.playerOneId}-${duel.playerTwoId}-${duel.mode}-${duel.basket?.id ?? ""}`}
      duel={duel}
      first={first}
      second={second}
    />
  );
}

/** Meneur de jeu: two mini-games were drawn, their host picks the one the duel is played with. */
export function DuelChoiceModal() {
  const choice = useGameStore((state) => state.pendingDuelChoice);
  const players = useGameStore((state) => state.players);
  const chooseDuelMode = useGameStore((state) => state.chooseDuelMode);
  const canChoose = useCanActFor([choice?.chooserId]);
  if (!choice) return null;
  const chooser = players.find((player) => player.id === choice.chooserId);
  const first = findDuellist(players, choice.playerOneId);
  const second = findDuellist(players, choice.playerTwoId);

  return (
    <ModalShell title="Duel en Enfer" eyebrow="Meneur de jeu" tone="grape" size="medium" className="duel-modal">
      {first && second && (
        <div className="duel-versus">
          <Contestant duellist={first} state="idle" />
          <span className="duel-versus__vs">VS</span>
          <Contestant duellist={second} state="idle" />
        </div>
      )}
      {canChoose ? (
        <div className="duel-panel">
          <p className="duel-secret">
            <strong>{chooser?.name}</strong>, choisis le mini-jeu :
          </p>
          <div className="vote-options">
            {choice.modes.map((mode) => (
              <button key={mode} type="button" className="vote-option" onClick={() => chooseDuelMode(mode)}>
                {DUEL_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <WaitingNote player={chooser} text={`${chooser?.name ?? "Le meneur de jeu"} choisit le mini-jeu…`} />
      )}
    </ModalShell>
  );
}

interface DuelArenaProps {
  duel: PendingDuel;
  first: Duellist;
  second: Duellist;
}

/** Once the engine names the winner, the reveal plays before the result shows. */
function useRevealedWinner(duel: PendingDuel): PlayerId | null {
  const [revealedId, setRevealedId] = useState<PlayerId | null>(null);
  const tieBroken = duel.voteTieBroken || duel.basket?.tieBroken === true;
  useEffect(() => {
    if (!duel.winnerId) return undefined;
    const delay = duel.mode === "coin-flip" ? COIN_FLIP_MS : tieBroken ? TIE_BREAK_REVEAL_MS : REVEAL_MS;
    const timer = window.setTimeout(() => setRevealedId(duel.winnerId), delay);
    return () => window.clearTimeout(timer);
  }, [duel.winnerId, duel.mode, tieBroken]);
  return revealedId;
}

function DuelArena({ duel, first, second }: DuelArenaProps) {
  const resolveDuel = useGameStore((state) => state.resolveDuel);
  const canSettle = useCanActFor(getHumanDuellistIds(duel));
  const players = useGameStore((state) => state.players);
  const revealedId = useRevealedWinner(duel);
  const winner = revealedId === first.id ? first : revealedId === second.id ? second : null;
  const againstGhost = duel.ghost !== null;
  // While a Basket round runs, the court needs the room: the big face-off and the stakes step aside.
  const basketLive = duel.basket?.shooterId != null && !winner;

  useEffect(() => {
    if (!winner) return;
    if (isGhost(winner)) soundEffects.ghostLaugh();
    else soundEffects.duelWin();
  }, [winner]);

  const stateOf = (duellist: Duellist) => (winner ? (winner.id === duellist.id ? "won" : "lost") : "idle");
  return (
    <ModalShell
      title={againstGhost ? "Le fantôme attaque !" : "Duel en Enfer"}
      eyebrow={DUEL_MODE_LABELS[duel.mode]}
      tone={againstGhost ? "night" : "grape"}
      size="medium"
      className={`duel-modal ${againstGhost ? "duel-modal--ghost" : ""} ${basketLive ? "duel-modal--basket-live" : ""}`}
    >
      <div className="duel-versus">
        <Contestant duellist={first} state={stateOf(first)} />
        <span className="duel-versus__vs">VS</span>
        <Contestant duellist={second} state={stateOf(second)} />
      </div>

      {winner ? (
        <div className="duel-outcome">
          <strong>{isGhost(winner) ? "Le fantôme l’emporte !" : `${winner.name} remporte le duel !`}</strong>
          {duel.ghost ? (
            <GhostOutcome stakes={duel.ghost} player={first} playerWon={!isGhost(winner)} />
          ) : (
            <p>Retour à la case Départ. L’autre reste en Enfer.</p>
          )}
          {canSettle ? (
            <button type="button" className="btn btn--cup" onClick={() => resolveDuel(winner.id)} data-autofocus>
              Continuer <UiIcon name="arrowRight" size={20} />
            </button>
          ) : (
            <WaitingNote player={players.find((player) => player.id === (isGhost(winner) ? first.id : winner.id))} />
          )}
        </div>
      ) : duel.mode === "coin-flip" ? (
        <CoinFlip duel={duel} first={first} second={second} />
      ) : duel.mode === "rock-paper-scissors" ? (
        <RockPaperScissors duel={duel} first={first} second={second} />
      ) : duel.mode === "basket" ? (
        <BasketGame duel={duel} first={first} second={second} />
      ) : duel.mode === "blackjack" ? (
        <BlackjackGame duel={duel} first={first} second={second} />
      ) : (
        <TableVote duel={duel} first={first} second={second} />
      )}

      {againstGhost && !winner && <GhostStakesNote />}
    </ModalShell>
  );
}

function Contestant({ duellist, state }: { duellist: Duellist; state: "idle" | "won" | "lost" }) {
  return (
    <div className={`contestant contestant--${state} ${isGhost(duellist) ? "contestant--ghost" : ""}`}>
      <DuellistAvatar duellist={duellist} size={78} state={state} />
      <strong>{duellist.name}</strong>
    </div>
  );
}

/** What is at stake, without telling which penalty or reward was drawn: that stays a surprise. */
function GhostStakesNote() {
  return (
    <p className="ghost-stakes">
      Perdu : l’Enfer, 300 pièces ou un objet volés. Gagné : un morceau de son butin, ou 300 pièces s’il est vide.
    </p>
  );
}

function GhostOutcome({ stakes, player, playerWon }: { stakes: GhostStakes; player: Duellist; playerWon: boolean }) {
  // Online, the item taken from a bag is named to its owner only.
  const canSeeBag = useCanSeeBagOf(player.id);
  if (playerWon) {
    const { reward } = stakes;
    const text =
      reward.kind === "item"
        ? `${player.name} reprend ${ITEM_CATALOG[reward.itemId].name} dans le butin du fantôme.`
        : describeCoinReward(player.name, reward);
    return <p>{text} Le fantôme s’évapore pour quelques tours.</p>;
  }
  const { penalty } = stakes;
  const text =
    penalty.kind === "hell"
      ? `Il gifle ${player.name} et l’emporte en Enfer !`
      : penalty.kind === "coins"
        ? `Il vole ${penalty.amount} pièces à ${player.name}, qu’il garde dans son butin.`
        : `Il vole ${canSeeBag ? ITEM_CATALOG[penalty.itemId].name : "un objet"} à ${player.name}, qu’il garde dans son butin.`;
  return <p>{text}</p>;
}

function CoinFlip({ duel, first, second }: DuelArenaProps) {
  const flipDuelCoin = useGameStore((state) => state.flipDuelCoin);
  const players = useGameStore((state) => state.players);
  const canFlip = useCanActFor(getHumanDuellistIds(duel));
  const flipping = duel.winnerId !== null;
  const landsOnFirst = duel.coinWinnerId === first.id;

  useEffect(() => {
    if (flipping) soundEffects.coinFlip();
  }, [flipping]);

  const waitingText = isGhost(second)
    ? `${first.name} lance la pièce…`
    : `${first.name} ou ${second.name} lance la pièce…`;
  return (
    <div className="duel-panel">
      <div className={`duel-coin ${flipping ? (landsOnFirst ? "is-flipping-first" : "is-flipping-second") : ""}`}>
        <span className="duel-coin__face duel-coin__face--front">
          <DuellistAvatar duellist={first} size={70} />
        </span>
        <span className="duel-coin__face duel-coin__face--back">
          <DuellistAvatar duellist={second} size={70} />
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
        !flipping && <WaitingNote player={players.find((player) => player.id === first.id)} text={waitingText} />
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
  const players = useGameStore((state) => state.players);
  const localPlayerId = useLocalPlayerId();
  const [seenTies, setSeenTies] = useState(0);
  const [handedOver, setHandedOver] = useState(false);
  const decided = duel.winnerId !== null;
  const showingTie = duel.rpsTiedRound !== null && seenTies < duel.rpsTies;
  // The ghost's hand is drawn by the engine: only the seated duellists choose.
  const choosers = [first, second].filter((duellist) => !isGhost(duellist));

  useEffect(() => {
    if (decided || showingTie) soundEffects.reveal();
  }, [decided, showingTie]);

  // Online, only a duellist presses « On rejoue »: the others watch the tie, then the table goes on by itself.
  const canAdvanceTie = localPlayerId === null || choosers.some((duellist) => duellist.id === localPlayerId);
  useEffect(() => {
    if (!showingTie || canAdvanceTie) return undefined;
    const timer = window.setTimeout(() => setSeenTies(duel.rpsTies), TIE_BREAK_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [showingTie, canAdvanceTie, duel.rpsTies]);

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
        {canAdvanceTie ? (
          <button type="button" className="btn btn--gold" onClick={() => setSeenTies(duel.rpsTies)} data-autofocus>
            Égalité ! On rejoue
          </button>
        ) : (
          <p className="duel-secret">Égalité ! On rejoue…</p>
        )}
      </div>
    );
  }

  const roundBadge = duel.rpsTies > 0 && <span className="tie-badge">Manche {duel.rpsTies + 1}</span>;
  const picker = (chooser: Duellist) => (
    <div className="duel-panel">
      <p className="duel-secret">
        {roundBadge}
        <strong>{chooser.name}</strong>, choisis en secret
        {choosers.length === 1 ? " : le fantôme joue en même temps" : ""} :
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
    const me = choosers.find((duellist) => duellist.id === localPlayerId);
    if (me && !duel.rpsChoices[me.id]) return picker(me);
    const pending = choosers.filter((duellist) => !duel.rpsChoices[duellist.id]);
    return (
      <div className="duel-panel">
        {roundBadge}
        <WaitingNote
          player={players.find((player) => player.id === pending[0]?.id)}
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
  const [chooserOne, chooserTwo] = choosers;
  if (!duel.rpsChoices[chooserOne.id]) return picker(chooserOne);
  if (!chooserTwo) return null;
  if (!handedOver) {
    return (
      <div className="duel-panel">
        <p className="duel-secret">
          Choix de {chooserOne.name} enregistré. Passe l’écran à <strong>{chooserTwo.name}</strong>.
        </p>
        <button type="button" className="btn btn--gold" onClick={() => setHandedOver(true)} data-autofocus>
          <UiIcon name="eye" size={20} /> Je suis {chooserTwo.name}
        </button>
      </div>
    );
  }
  return picker(chooserTwo);
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
            <DuellistAvatar duellist={candidate} size={44} />
            {candidate.name}
          </button>
        ))}
      </div>
    </div>
  );
}
