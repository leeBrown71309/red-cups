import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "../../game/catalog";
import { getEnergyCapacity } from "../../game/energy";
import { countRedCups, getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { IDLE_STRIKES_TO_FORFEIT } from "../../game/turn-clock";
import type { Player } from "../../game/types";
import { HELL_NODE_ID, RED_CUP_GOAL } from "../../game/types";
import { useLocalPlayerId } from "../../net/room-store";
import { EnergyGauge } from "../components/energy-meter";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CloverIcon, CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
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

export function PlayerDetails({ player, anchor }: { player: Player; anchor: DetailsAnchor }) {
  const round = useGameStore((state) => state.round);
  const game = useGameStore();
  // The chances only count online, where turns have a clock.
  const online = useLocalPlayerId() !== null;
  const { cardRef, placement } = usePlacement(anchor);
  const passive = PASSIVE_CATALOG[player.passiveId];
  const statuses = getPlayerStatuses(game, player);
  const noThanksStatus =
    player.passiveId !== "no-thanks"
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
        <div className="player-details__passive">
          <span className="eyebrow">Passif</span>
          <strong>{passive.name}</strong>
          {/* Some passives explain a lot: the text scrolls instead of stretching the card. */}
          <div className="player-details__passive-text scroll-block" tabIndex={0}>
            <p>{passive.description}</p>
          </div>
          {noThanksStatus && <p className="player-details__passive-status">{noThanksStatus}</p>}
        </div>
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
      </div>
    </div>
  );
}
