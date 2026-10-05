import { hasCard } from "../../game/cards";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { canAbandon } from "../../game/abandon";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "../../game/catalog";
import { getEnergyCapacity } from "../../game/energy";
import { countRedCups, getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { IDLE_STRIKES_TO_FORFEIT } from "../../game/turn-clock";
import type { PassiveId, Player } from "../../game/types";
import { HELL_NODE_ID, RED_CUP_GOAL } from "../../game/types";
import { getUserIdOfPlayer } from "../../net/room-protocol";
import { useLocalPlayerId, useRoomStore } from "../../net/room-store";
import { useVisibleCards } from "../card-visibility";
import { EnergyGauge } from "../components/energy-meter";
import { KickButton } from "../components/kick-button";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CloverIcon, CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { CupPips, getAvatarExpression, getChancesLeft, getPlayerStatuses, StatusToken } from "./player-status";

const DETAILS_WIDTH = 290;
const VIEWPORT_MARGIN = 8;
/** Gap between the card and the row it points at. */
const ROW_GAP = 14;
/** The arrow never sits closer than this to the card's corners. */
const ARROW_INSET = 22;

/** The row a details card was opened from, measured when it was tapped. */
export interface DetailsAnchor {
  playerId: string;
  rect: DOMRect;
}

interface Placement {
  left: number;
  top: number;
  arrowTop: number;
}

/**
 * Right of the players list, level with the row. The card's height is only
 * known once drawn, so it is placed on the first layout, before it is painted.
 */
function usePlacement(anchor: DetailsAnchor) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const { rect } = anchor;
    const width = Math.min(DETAILS_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const height = card.offsetHeight;
    const rowCenter = rect.top + rect.height / 2;
    const left = Math.min(rect.right + ROW_GAP, window.innerWidth - width - VIEWPORT_MARGIN);
    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, rowCenter - height / 2),
      Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
    );
    const arrowTop = Math.min(Math.max(rowCenter - top, ARROW_INSET), height - ARROW_INSET);
    setPlacement({ left, top, arrowTop });
  }, [anchor]);

  return { cardRef, placement };
}

/** The gauge left this turn for the active player; the others refill it when their turn comes. */
function EnergyStat({ player }: { player: Player }) {
  const playing = useGameStore(
    (state) => state.phase === "playing" && state.players[state.activePlayerIndex]?.id === player.id,
  );
  const energyLeft = useGameStore((state) => state.energyLeft);
  const capacity = getEnergyCapacity(player);
  const shown = playing ? energyLeft : capacity;

  return (
    <div className="player-details__stat">
      <span className="eyebrow">Énergie</span>
      <span className="player-details__stat-value">
        <EnergyGauge left={shown} capacity={capacity} />
        <strong>
          {shown}/{capacity}
        </strong>
      </span>
      <small className="player-details__stat-note">{playing ? "ce tour" : "à son prochain tour"}</small>
    </div>
  );
}

/** Online: the chances a player has left before a forfeit, one clover each. */
function ChancesStat({ player }: { player: Player }) {
  const left = useGameStore((state) => getChancesLeft(state, player));

  return (
    <div className="player-details__stat" title="Un tour passé sans jouer coûte une chance : forfait à la dernière">
      <span className="eyebrow">Chances</span>
      <span className="player-details__stat-value">
        <span className="clover-pips" aria-hidden="true">
          {Array.from({ length: IDLE_STRIKES_TO_FORFEIT }, (_, index) => (
            <span key={index} className={`clover-pips__pip ${index < left ? "is-left" : ""}`}>
              <CloverIcon size={20} />
            </span>
          ))}
        </span>
        <strong>
          {left}/{IDLE_STRIKES_TO_FORFEIT}
        </strong>
      </span>
    </div>
  );
}

/** Online, the host may send another player away; a seat in the middle of a decision has to wait. */
function KickControl({ player }: { player: Player }) {
  const seatOrder = useRoomStore((state) => state.seatOrder);
  const hostId = useRoomStore((state) => state.hostId);
  const myUserId = useRoomStore((state) => state.myUserId);
  const busy = useRoomStore((state) => state.busy);
  const kick = useRoomStore((state) => state.kick);
  const atRest = useGameStore((state) => canAbandon(state));
  const userId = getUserIdOfPlayer(seatOrder, player.id);
  if (!myUserId || myUserId !== hostId || !userId || userId === myUserId) return null;
  return <KickButton name={player.name} labelled disabled={busy || !atRest} onKick={() => void kick(userId)} />;
}

/** One of the two cards of a player: its name and rules, or why it is not shown. */
function CardBlock({
  label,
  cardId,
  hiddenText,
  children,
}: {
  label: string;
  cardId: PassiveId | null;
  hiddenText: string;
  children?: ReactNode;
}) {
  const card = cardId ? PASSIVE_CATALOG[cardId] : null;
  return (
    <div className="player-details__passive">
      <span className="eyebrow">{label}</span>
      {card ? (
        <>
          <strong>{card.name}</strong>
          {/* Some cards explain a lot: the text scrolls instead of stretching the card. */}
          <div className="player-details__passive-text scroll-block" tabIndex={0}>
            <p>{card.description}</p>
          </div>
        </>
      ) : (
        <p className="player-details__passive-hidden">
          {label === "Actif" ? `${label} caché. ${hiddenText}` : hiddenText}
        </p>
      )}
      {children}
    </div>
  );
}

export function PlayerDetails({
  player,
  anchor,
  onClose,
}: {
  player: Player;
  anchor: DetailsAnchor;
  onClose: () => void;
}) {
  const round = useGameStore((state) => state.round);
  const game = useGameStore();
  // The chances only count online, where turns have a clock.
  const online = useLocalPlayerId() !== null;
  const { cardRef, placement } = usePlacement(anchor);
  const cards = useVisibleCards(player);
  const statuses = getPlayerStatuses(game, player);
  const noThanksStatus = !hasCard(player, "no-thanks")
    ? null
    : player.noThanksReadyRound <= round
      ? "Prêt à servir."
      : `De retour au tour ${player.noThanksReadyRound}.`;
  const capacity = getInventoryCapacity(player);
  const empty = Math.max(0, capacity - player.inventory.length);
  const cups = countRedCups(player);
  const position = {
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    visibility: placement ? "visible" : "hidden",
    "--arrow-top": `${placement?.arrowTop ?? ARROW_INSET}px`,
  } as CSSProperties;

  return (
    <div
      ref={cardRef}
      className="player-details panel"
      role="dialog"
      aria-label={`Détails de ${player.name}`}
      style={position}
    >
      <div className="player-details__body">
        <div className="player-details__head">
          <PlayerAvatar color={player.color} size={48} expression={getAvatarExpression(player)} />
          <div>
            <strong>{player.name}</strong>
            <span className="player-details__where">
              {player.position === HELL_NODE_ID ? "En Enfer" : `Case ${player.position}`}
            </span>
          </div>
          <button
            type="button"
            className="icon-button player-details__close"
            onClick={onClose}
            aria-label={`Fermer les détails de ${player.name}`}
          >
            <UiIcon name="close" size={16} strokeWidth={3} />
          </button>
        </div>
        {statuses.length > 0 && (
          <ul className="player-details__statuses">
            {statuses.map((status) => (
              <li key={status.id}>
                <StatusToken status={status} />
                <span>{status.label}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="player-details__stats">
          <div className="player-details__stat">
            <span className="eyebrow">Red Cups</span>
            <span className="player-details__stat-value">
              <CupPips count={cups} size={20} />
              <strong>
                {cups}/{RED_CUP_GOAL}
              </strong>
            </span>
          </div>
          <div className="player-details__stat">
            <span className="eyebrow">Pièces</span>
            <span className={`player-details__stat-value ${player.currency < 0 ? "is-negative" : ""}`}>
              <CoinIcon size={20} />
              <strong>{formatCurrency(player.currency)}</strong>
            </span>
          </div>
          <EnergyStat player={player} />
          {online && <ChancesStat player={player} />}
        </div>
        <CardBlock label="Actif" cardId={cards.actif} hiddenText="Seul son porteur connaît son actif." />
        <CardBlock label="Passif" cardId={cards.passif} hiddenText="Pas de passif.">
          {noThanksStatus && <p className="player-details__passive-status">{noThanksStatus}</p>}
        </CardBlock>
        <div className="player-details__bag">
          <span className="eyebrow">
            Sac · {player.inventory.length}/{capacity}
          </span>
          <div className="mini-slots">
            {player.inventory.map((entry) => (
              <span
                key={entry.id}
                className="mini-slot"
                title={entry.kind === "red-cup" ? "Red Cup" : ITEM_CATALOG[entry.itemId].name}
              >
                {entry.kind === "red-cup" ? <RedCupIcon size={24} /> : <ItemIcon itemId={entry.itemId} size={24} />}
              </span>
            ))}
            {Array.from({ length: empty }, (_, index) => (
              <span key={`empty-${index}`} className="mini-slot is-empty" />
            ))}
          </div>
        </div>
        <KickControl player={player} />
      </div>
    </div>
  );
}
