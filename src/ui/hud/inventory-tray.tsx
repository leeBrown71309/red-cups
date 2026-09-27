import { useEffect, useRef, useState } from "react";
import { ITEM_CATALOG } from "../../game/catalog";
import { getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { InventoryEntry, Player } from "../../game/types";
import { getItemAvailability } from "../display/item-availability";
import { useLocalPlayerId } from "../../net/room-store";
import { useActivePlayer } from "../game-hooks";
import { ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

interface InventoryTrayProps {
  onRequestTarget: (entryId: string) => void;
}

/**
 * The bag on screen: the active player's at a local table, your own online.
 * Tapping an item explains it before using it; it can only be used on your turn.
 */
export function InventoryTray({ onRequestTarget }: InventoryTrayProps) {
  const turnPlayer = useActivePlayer();
  const game = useGameStore();
  const localPlayerId = useLocalPlayerId();
  const activePlayer = localPlayerId ? game.players.find((player) => player.id === localPlayerId) : turnPlayer;
  const isOwnTurn = activePlayer !== undefined && activePlayer.id === turnPlayer?.id;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelectedId(null), [activePlayer?.id, game.turnStage]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const close = (event: PointerEvent) => {
      if (!trayRef.current?.contains(event.target as Node)) setSelectedId(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [selectedId]);

  if (!activePlayer || game.phase !== "playing") return null;

  const capacity = getInventoryCapacity(activePlayer);
  const emptySlots = Math.max(0, capacity - activePlayer.inventory.length);
  const selected = activePlayer.inventory.find((entry) => entry.id === selectedId);

  const useEntry = (entry: InventoryEntry) => {
    if (entry.kind !== "item") return;
    const availability = getItemAvailability(entry.itemId, game, activePlayer);
    if (!isOwnTurn || !availability.usable) return;
    setSelectedId(null);
    if (availability.kind === "prepare-boot") game.prepareBoot(entry.id);
    else if (availability.kind === "target") onRequestTarget(entry.id);
    else game.useItem(entry.id);
  };

  return (
    <div className="inventory-tray" ref={trayRef}>
      <span className="inventory-tray__label">
        <UiIcon name="bag" size={14} /> Sac {activePlayer.inventory.length}/{capacity}
      </span>
      <div className="inventory-tray__slots">
        {activePlayer.inventory.map((entry) => {
          const isCup = entry.kind === "red-cup";
          const usable =
            isOwnTurn && entry.kind === "item" && getItemAvailability(entry.itemId, game, activePlayer).usable;
          return (
            <button
              key={entry.id}
              type="button"
              className={`bag-slot ${isCup ? "bag-slot--cup" : ""} ${usable ? "is-usable" : ""} ${
                selectedId === entry.id ? "is-selected" : ""
              }`}
              onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
              aria-label={isCup ? "Red Cup" : ITEM_CATALOG[entry.itemId].name}
            >
              {isCup ? <RedCupIcon size={34} /> : <ItemIcon itemId={entry.itemId} size={34} />}
            </button>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <span key={`empty-${index}`} className="bag-slot bag-slot--empty" aria-hidden="true" />
        ))}
      </div>

      {selected && (
        <div className="item-card panel" role="dialog" aria-label="Détail de l’objet">
          {selected.kind === "red-cup" ? (
            <>
              <div className="item-card__head">
                <RedCupIcon size={44} />
                <div>
                  <strong>Red Cup</strong>
                  <span className="item-card__tag">Trophée</span>
                </div>
              </div>
              <p>
                Encore {3 - activePlayer.inventory.filter((entry) => entry.kind === "red-cup").length} pour gagner. Elle
                ne peut pas être jetée.
              </p>
            </>
          ) : (
            <ItemCardBody entry={selected} player={activePlayer} ownTurn={isOwnTurn} onUse={() => useEntry(selected)} />
          )}
        </div>
      )}
    </div>
  );
}

interface ItemCardBodyProps {
  entry: InventoryEntry & { kind: "item" };
  player: Player;
  ownTurn: boolean;
  onUse: () => void;
}

function ItemCardBody({ entry, player, ownTurn, onUse }: ItemCardBodyProps) {
  const game = useGameStore();
  const item = ITEM_CATALOG[entry.itemId];
  const availability = getItemAvailability(entry.itemId, game, player);
  const usable = ownTurn && availability.usable;
  const reason = ownTurn ? availability.reason : "Attends ton tour pour l’utiliser.";

  return (
    <>
      <div className="item-card__head">
        <ItemIcon itemId={entry.itemId} size={44} />
        <div>
          <strong>{item.name}</strong>
          {item.target === "player" && <span className="item-card__tag">Cible un joueur</span>}
        </div>
      </div>
      <p>{item.description}</p>
      <button type="button" className="btn btn--cup btn--small btn--block" disabled={!usable} onClick={onUse}>
        {availability.actionLabel}
      </button>
      {reason && <small className="item-card__reason">{reason}</small>}
    </>
  );
}
