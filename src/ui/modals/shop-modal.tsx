import { useState } from "react";
import { ITEM_CATALOG, ITEM_ORDER } from "../../game/catalog";
import { getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { ItemId } from "../../game/types";
import { ModalShell } from "../components/modal-shell";
import { formatCurrency } from "../display/game-display";
import { getPurchaseStatus } from "../display/item-availability";
import { useActivePlayer } from "../game-hooks";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

interface ShopModalProps {
  onClose: () => void;
}

/** Market stall: pick an item on the shelf, read what it does, buy it. */
export function ShopModal({ onClose }: ShopModalProps) {
  const game = useGameStore();
  const player = useActivePlayer();
  const [selectedId, setSelectedId] = useState<ItemId>("boot");
  if (!player) return null;

  const capacity = getInventoryCapacity(player);
  const selected = ITEM_CATALOG[selectedId];
  const selectedStatus = getPurchaseStatus(selectedId, game, player);

  return (
    <ModalShell
      title="Boutique"
      eyebrow={`Case ${player.position} · ${player.name}`}
      tone="sky"
      size="large"
      onClose={onClose}
      className="shop-modal"
      footer={
        <>
          <button type="button" className="btn btn--cream" onClick={onClose}>
            Voir le plateau
          </button>
          <button type="button" className="btn btn--cup" onClick={game.endTurn}>
            Fin du tour <UiIcon name="arrowRight" size={20} />
          </button>
        </>
      }
    >
      <div className="shop-status">
        <span className="shop-status__wallet">
          <CoinIcon size={22} /> {formatCurrency(player.currency)}
        </span>
        <span className="shop-status__bag">
          <UiIcon name="bag" size={18} /> {player.inventory.length}/{capacity} places
        </span>
      </div>

      <div className="shop-layout">
        <ul className="shop-shelf" aria-label="Objets en vente">
          {ITEM_ORDER.map((itemId) => {
            const status = getPurchaseStatus(itemId, game, player);
            return (
              <li key={itemId}>
                <button
                  type="button"
                  className={["shop-item", selectedId === itemId && "is-selected", !status.canBuy && "is-unavailable"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedId(itemId)}
                  aria-pressed={selectedId === itemId}
                >
                  <ItemIcon itemId={itemId} size={40} />
                  <span className="shop-item__name">{ITEM_CATALOG[itemId].name}</span>
                  <span className="price-chip">
                    <CoinIcon size={14} />
                    {formatCurrency(status.price)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="shop-detail" aria-live="polite">
          <ItemIcon itemId={selectedId} size={72} className="shop-detail__icon" />
          <strong className="shop-detail__name">{selected.name}</strong>
          <p>{selected.description}</p>
          {selectedId === "boot" && (
            <small className="shop-detail__note">Son prix monte de 50 à chaque tour de table (max 500).</small>
          )}
          <button
            type="button"
            className="btn btn--gold btn--block"
            disabled={!selectedStatus.canBuy}
            onClick={() => game.buyItem(selectedId)}
          >
            {selectedStatus.canBuy ? (
              <>
                Acheter · <CoinIcon size={18} /> {formatCurrency(selectedStatus.price)}
              </>
            ) : (
              selectedStatus.reason
            )}
          </button>
        </aside>
      </div>
    </ModalShell>
  );
}
