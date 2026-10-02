import { BLACKJACK_TARGET, getHandValue } from "../../game/blackjack";
import { useGameStore } from "../../game/store";
import type { PendingDuel, PlayingCard } from "../../game/types";
import { useCanActFor } from "../../net/room-store";
import { WaitingNote } from "../components/waiting-note";
import { UiIcon } from "../icons/ui-icon";
import { isGhost, type Duellist } from "./duellists";

const RANK_LABELS: Record<number, string> = { 1: "A", 11: "V", 12: "D", 13: "R" };
const SUITS = ["♠", "♥", "♦", "♣"];

/**
 * Blackjack duel: both hands face up, the first duellist plays, then the
 * second; the ghost draws as a dealer. Only the duellist whose turn it is may
 * draw or stand, on their own device online.
 */
export function BlackjackGame({ duel, first, second }: { duel: PendingDuel; first: Duellist; second: Duellist }) {
  const blackjackHit = useGameStore((state) => state.blackjackHit);
  const blackjackStand = useGameStore((state) => state.blackjackStand);
  const blackjack = duel.blackjack;
  const turnId = blackjack?.turnId ?? null;
  const canPlay = useCanActFor([turnId]);
  if (!blackjack) return null;
  const turn = turnId === first.id ? first : turnId === second.id ? second : null;

  return (
    <div className="duel-panel blackjack">
      {[first, second].map((duellist) => (
        <Hand
          key={duellist.id}
          duellist={duellist}
          cards={blackjack.hands[duellist.id] ?? []}
          active={duellist.id === turnId}
        />
      ))}
      {turn && !isGhost(turn) && canPlay ? (
        <div className="modal-actions">
          <button type="button" className="btn btn--gold" onClick={() => blackjackHit(turn.id)} data-autofocus>
            <UiIcon name="plus" size={18} /> Tirer
          </button>
          <button type="button" className="btn btn--cream" onClick={() => blackjackStand(turn.id)}>
            Rester
          </button>
        </div>
      ) : (
        turn && <WaitingNote player={undefined} text={`${turn.name} réfléchit…`} />
      )}
    </div>
  );
}

function Hand({ duellist, cards, active }: { duellist: Duellist; cards: PlayingCard[]; active: boolean }) {
  const value = getHandValue(cards);
  const bust = value > BLACKJACK_TARGET;
  return (
    <div className={`blackjack-hand ${active ? "is-active" : ""}`}>
      <span className="blackjack-hand__who">
        {duellist.name} · <strong className={bust ? "is-bust" : ""}>{bust ? `${value}, sauté !` : value}</strong>
      </span>
      <span className="blackjack-hand__cards">
        {cards.map((card, index) => (
          <span key={index} className={`playing-card ${card.suit === 1 || card.suit === 2 ? "is-red" : ""}`}>
            {RANK_LABELS[card.rank] ?? card.rank}
            <small>{SUITS[card.suit]}</small>
          </span>
        ))}
      </span>
    </div>
  );
}
