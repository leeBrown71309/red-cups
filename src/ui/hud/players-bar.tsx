import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "../../game/catalog";
import { countRedCups, getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import { HELL_NODE_ID, HELL_TURN_LIMIT, RED_CUP_GOAL } from "../../game/types";
import { PlayerAvatar, type AvatarExpression } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

export function getAvatarExpression(player: Player): AvatarExpression {
  if (player.skippedTurns > 0) return "sleepy";
  if (player.position === HELL_NODE_ID) return "worried";
  return "happy";
}

export function CupPips({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <span className="cup-pips" aria-label={`${count} Red Cup sur ${RED_CUP_GOAL}`}>
      {Array.from({ length: RED_CUP_GOAL }, (_, index) => (
        <span key={index} className={`cup-pips__pip ${index < count ? "is-filled" : ""}`}>
          <RedCupIcon size={size} />
        </span>
      ))}
    </span>
  );
}

const DETAILS_WIDTH = 280;
const VIEWPORT_MARGIN = 8;

interface DetailsAnchor {
  playerId: string;
  left: number;
  top: number;
  arrowLeft: number;
}

/**
 * Places the details card under its chip, clamped inside the viewport. The
 * position is computed once on open, so the card appears directly in place.
 */
function computeAnchor(playerId: string, chip: HTMLElement): DetailsAnchor {
  const rect = chip.getBoundingClientRect();
  const width = Math.min(DETAILS_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center - width / 2, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN);
  return { playerId, left, top: rect.bottom + 12, arrowLeft: center - left };
}

/** Everyone's table status at a glance, with details on tap. */
export function PlayersBar() {
  const players = useGameStore((state) => state.players);
  const activePlayerIndex = useGameStore((state) => state.activePlayerIndex);
  const phase = useGameStore((state) => state.phase);
  const [anchor, setAnchor] = useState<DetailsAnchor | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return undefined;
    const close = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setAnchor(null);
    };
    const closeOnResize = () => setAnchor(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", closeOnResize);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [anchor]);

  const openedPlayer = players.find((player) => player.id === anchor?.playerId);

  return (
    <div
      className="players-bar"
      ref={barRef}
      role="list"
      aria-label="Joueurs"
      data-crowded={players.length > 5 ? "true" : "false"}
    >
      {players.map((player, index) => {
        const active = phase === "playing" && index === activePlayerIndex;
        const cups = countRedCups(player);
        const open = anchor?.playerId === player.id;
        return (
          <div className="player-chip-wrap" role="listitem" key={player.id}>
            <button
              type="button"
              className={["player-chip", active && "is-active", player.position === HELL_NODE_ID && "is-hell"]
                .filter(Boolean)
                .join(" ")}
              style={{ "--player-color": player.color } as CSSProperties}
              onClick={(event) => setAnchor(open ? null : computeAnchor(player.id, event.currentTarget))}
              aria-expanded={open}
              aria-label={`${player.name}, ${formatCurrency(player.currency)} pièces, ${cups} Red Cup`}
            >
              <PlayerAvatar color={player.color} size={active ? 40 : 34} expression={getAvatarExpression(player)} />
              <span className="player-chip__info">
                <span className="player-chip__name">{player.name}</span>
                <span className="player-chip__stats">
                  <span className={`player-chip__coins ${player.currency < 0 ? "is-negative" : ""}`}>
                    <CoinIcon size={14} />
                    {formatCurrency(player.currency)}
                  </span>
                  <CupPips count={cups} size={12} />
                </span>
              </span>
              {player.skippedTurns > 0 && (
                <span className="player-chip__badge" title="Passe son prochain tour">
                  <UiIcon name="sleep" size={12} strokeWidth={2.8} />
                </span>
              )}
            </button>
          </div>
        );
      })}
      {anchor && openedPlayer && <PlayerDetails player={openedPlayer} anchor={anchor} />}
    </div>
  );
}

function PlayerDetails({ player, anchor }: { player: Player; anchor: DetailsAnchor }) {
  const round = useGameStore((state) => state.round);
  const passive = PASSIVE_CATALOG[player.passiveId];
  const noThanksStatus =
    player.passiveId !== "no-thanks"
      ? null
      : player.noThanksReadyRound <= round
        ? "Prêt à servir."
        : `De retour au tour ${player.noThanksReadyRound}.`;
  const capacity = getInventoryCapacity(player);
  const empty = Math.max(0, capacity - player.inventory.length);
  const cups = countRedCups(player);
  const position = { left: anchor.left, top: anchor.top, "--arrow-left": `${anchor.arrowLeft}px` } as CSSProperties;

  return (
    <div className="player-details panel" role="dialog" aria-label={`Détails de ${player.name}`} style={position}>
      <div className="player-details__head">
        <PlayerAvatar color={player.color} size={52} expression={getAvatarExpression(player)} />
        <div>
          <strong>{player.name}</strong>
          <span className="player-details__where">
            {player.position === HELL_NODE_ID
              ? `En Enfer · ${player.hellTurns}/${HELL_TURN_LIMIT} tours`
              : `Case ${player.position}`}
            {player.skippedTurns > 0 && " · passe son tour"}
          </span>
        </div>
      </div>
      <div className="player-details__stats">
        <div className="player-details__stat">
          <span className="eyebrow">Red Cups</span>
          <span className="player-details__stat-value">
            <CupPips count={cups} size={22} />
            <strong>
              {cups}/{RED_CUP_GOAL}
            </strong>
          </span>
        </div>
        <div className="player-details__stat">
          <span className="eyebrow">Pièces</span>
          <span className={`player-details__stat-value ${player.currency < 0 ? "is-negative" : ""}`}>
            <CoinIcon size={22} />
            <strong>{formatCurrency(player.currency)}</strong>
          </span>
        </div>
      </div>
      <div className="player-details__passive">
        <span className="eyebrow">Passif</span>
        <strong>{passive.name}</strong>
        <p>{passive.description}</p>
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
              {entry.kind === "red-cup" ? <RedCupIcon size={26} /> : <ItemIcon itemId={entry.itemId} size={26} />}
            </span>
          ))}
          {Array.from({ length: empty }, (_, index) => (
            <span key={`empty-${index}`} className="mini-slot is-empty" />
          ))}
        </div>
      </div>
    </div>
  );
}
