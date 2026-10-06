import { useEffect, useState, type CSSProperties } from "react";
import { countRedCups } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { HELL_NODE_ID } from "../../game/types";
import { getUserIdOfPlayer } from "../../net/room-protocol";
import { useRoomStore } from "../../net/room-store";
import { PlayerAvatar } from "../components/player-avatar";
import { VoiceBadge } from "../components/voice-controls";
import { formatCurrency } from "../display/game-display";
import { CoinIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { prefersCompactHud, usePersistentToggle } from "../use-persistent-toggle";
import { PlayerDetails, type DetailsAnchor } from "./player-details";
import { CupPips, getAvatarExpression, getPlayerStatuses, StatusToken } from "./player-status";

const FOLDED_KEY = "red-cups-players-folded";
/** Tokens a row has room for; the rest is counted, and spelled out in the details. */
const ROW_STATUS_LIMIT = 2;

/**
 * Everyone's table status at a glance, on the left of the board, without a
 * frame: just the players' bubbles. It folds down to their avatars and
 * scrolls when the table is too big for the screen; a tap on a player opens
 * their details.
 */
export function PlayersPanel() {
  const game = useGameStore();
  const seatOrder = useRoomStore((state) => state.seatOrder);
  const [folded, setFolded] = usePersistentToggle(FOLDED_KEY, prefersCompactHud);
  const [anchor, setAnchor] = useState<DetailsAnchor | null>(null);
  const { players, activePlayerIndex, phase } = game;

  // The card only closes with its cross (or its row): a tap on the board must not lose what is being read.
  useEffect(() => {
    if (!anchor) return undefined;
    const closeOnResize = () => setAnchor(null);
    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, [anchor]);

  // The rows move when the panel folds: a card left open would point at nothing.
  useEffect(() => setAnchor(null), [folded]);

  const openedPlayer = players.find((player) => player.id === anchor?.playerId);

  return (
    <aside className={`players-panel ${folded ? "is-folded" : ""}`} aria-label="Joueurs">
      <header className="players-panel__head">
        <button
          type="button"
          className="players-panel__toggle"
          onClick={() => setFolded(!folded)}
          aria-expanded={!folded}
          aria-label={folded ? "Afficher la liste des joueurs" : "Réduire la liste des joueurs"}
          title={folded ? "Afficher la liste des joueurs" : "Réduire la liste des joueurs"}
        >
          <UiIcon name={folded ? "chevronRight" : "chevronLeft"} size={16} strokeWidth={3} />
        </button>
      </header>
      <ul className="players-panel__list" onScroll={() => setAnchor(null)}>
        {players.map((player, index) => {
          const active = phase === "playing" && index === activePlayerIndex;
          const cups = countRedCups(player);
          const open = anchor?.playerId === player.id;
          const statuses = getPlayerStatuses(game, player);
          const shown = statuses.slice(0, ROW_STATUS_LIMIT);
          const hidden = statuses.length - shown.length;
          const label = [
            player.name,
            active ? "à son tour" : null,
            `${formatCurrency(player.currency)} pièces`,
            `${cups} Red Cup`,
            ...statuses.map((status) => status.label),
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={player.id}>
              <button
                type="button"
                className={[
                  "player-row",
                  active && "is-active",
                  open && "is-open",
                  player.position === HELL_NODE_ID && "is-hell",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--player-color": player.color } as CSSProperties}
                onClick={(event) =>
                  setAnchor(open ? null : { playerId: player.id, rect: event.currentTarget.getBoundingClientRect() })
                }
                aria-expanded={open}
                aria-label={label}
                title={folded ? label : undefined}
              >
                <PlayerAvatar color={player.color} size={folded ? 34 : 36} expression={getAvatarExpression(player)} />
                {folded ? (
                  statuses.length > 0 && <span className="player-row__dot" aria-hidden="true" />
                ) : (
                  <span className="player-row__main">
                    <span className="player-row__line">
                      <span className="player-row__name">{player.name}</span>
                      <span className="player-row__statuses">
                        {shown.map((status) => (
                          <StatusToken key={status.id} status={status} />
                        ))}
                        {hidden > 0 && (
                          <span className="status-token status-token--more" title="Toucher pour tout voir">
                            +{hidden}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="player-row__line">
                      <span className={`player-row__coins ${player.currency < 0 ? "is-negative" : ""}`}>
                        <CoinIcon size={14} />
                        {formatCurrency(player.currency)}
                      </span>
                      <CupPips count={cups} size={12} />
                    </span>
                  </span>
                )}
                <VoiceBadge userId={getUserIdOfPlayer(seatOrder, player.id)} />
              </button>
            </li>
          );
        })}
      </ul>
      {anchor && openedPlayer && (
        <PlayerDetails player={openedPlayer} anchor={anchor} onClose={() => setAnchor(null)} />
      )}
    </aside>
  );
}
