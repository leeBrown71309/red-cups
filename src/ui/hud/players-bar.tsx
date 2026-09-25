import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ITEM_CATALOG, PASSIVE_CATALOG } from "../../game/catalog";
import { countRedCups, getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import { HELL_NODE_ID, RED_CUP_GOAL } from "../../game/types";
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

/** Everyone's table status at a glance, with details on tap. */
export function PlayersBar() {
  const players = useGameStore((state) => state.players);
  const activePlayerIndex = useGameStore((state) => state.activePlayerIndex);
  const phase = useGameStore((state) => state.phase);
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPlayerId) return undefined;
    const close = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenPlayerId(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [openPlayerId]);

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
        const open = openPlayerId === player.id;
        return (
          <div className="player-chip-wrap" role="listitem" key={player.id}>
            <button
              type="button"
              className={["player-chip", active && "is-active", player.position === HELL_NODE_ID && "is-hell"]
                .filter(Boolean)
                .join(" ")}
              style={{ "--player-color": player.color } as CSSProperties}
              onClick={() => setOpenPlayerId(open ? null : player.id)}
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
            {open && <PlayerDetails player={player} />}
          </div>
        );
      })}
    </div>
  );
}

function PlayerDetails({ player }: { player: Player }) {
  const passive = PASSIVE_CATALOG[player.passiveId];
  const capacity = getInventoryCapacity(player);
  const empty = Math.max(0, capacity - player.inventory.length);

  return (
    <div className="player-details panel" role="dialog" aria-label={`Détails de ${player.name}`}>
      <div className="player-details__head">
        <PlayerAvatar color={player.color} size={52} expression={getAvatarExpression(player)} />
        <div>
          <strong>{player.name}</strong>
          <span className="player-details__where">
            {player.position === HELL_NODE_ID ? "En Enfer" : `Case ${player.position}`}
            {player.skippedTurns > 0 && " · passe son tour"}
          </span>
        </div>
      </div>
      <div className="player-details__passive">
        <span className="eyebrow">Passif</span>
        <strong>{passive.name}</strong>
        <p>{passive.description}</p>
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
