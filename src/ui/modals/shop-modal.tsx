import { hasCard } from "../../game/cards";
import { useState } from "react";
import { DEVIL_ITEMS, ITEM_CATALOG, type ItemDefinition } from "../../game/catalog";
import { getShopItems } from "../../game/passive-rules";
import { getInventoryCapacity } from "../../game/rules";
import { getMaxPurchaseCount } from "../../game/shopping";
import { useGameStore } from "../../game/store";
import type { ItemId } from "../../game/types";
import { EnergyCost, formatEnergyCost } from "../components/energy-meter";
import { ModalShell } from "../components/modal-shell";
import { formatCurrency } from "../display/game-display";
import { getPurchaseStatus, getTheftStatus } from "../display/item-availability";
import { useActivePlayer } from "../game-hooks";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

/** When, and for how much energy, a bought item can be used. */
function describeEnergyUse(item: ItemDefinition): string {
  if (item.energyCost === 0 && item.target === "special") return "Agit tout seul, sans énergie.";
  const cost = item.energyCost === 0 ? "sans énergie" : `pour ${formatEnergyCost(item.energyCost)}`;
  return `Utilisable dès ton prochain tour, ${cost}.`;
}

interface ShopModalProps {
  onClose: () => void;
}

type ShopTab = "shop" | "devil";

/** Market stall: pick an item on the shelf, read what it does, buy it. Le diable has a second stall. */
export function ShopModal({ onClose }: ShopModalProps) {
  const game = useGameStore();
  const player = useActivePlayer();
  const [selectedId, setSelectedId] = useState<ItemId>("boot");
  const [tab, setTab] = useState<ShopTab>("shop");
  const [wantedCount, setWantedCount] = useState(1);
  if (!player) return null;

  const isDevil = hasCard(player, "devil");
  const shelf = getShopItems(player).filter((itemId) => DEVIL_ITEMS.includes(itemId) === (tab === "devil"));
  const selectItem = (itemId: ItemId) => {
    setSelectedId(itemId);
    setWantedCount(1);
  };
  const openTab = (next: ShopTab) => {
    setTab(next);
    selectItem(next === "devil" ? DEVIL_ITEMS[0] : "boot");
  };

  const capacity = getInventoryCapacity(player);
  const selected = ITEM_CATALOG[selectedId];
  const selectedStatus = getPurchaseStatus(selectedId, game, player);
  const theftStatus = getTheftStatus(selectedId, game, player);
  // Several copies at once when the bag and the purse allow it; the count follows what is still possible.
  const maxCount = getMaxPurchaseCount(game, selectedId);
  const count = Math.max(1, Math.min(wantedCount, maxCount));

  return (
    <ModalShell
      title={tab === "devil" ? "Boutique du diable" : "Boutique"}
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
        {isDevil && (
          <span className="shop-tabs" role="tablist" aria-label="Étals">
            {(["shop", "devil"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={tab === option}
                className={`btn btn--small ${tab === option ? "btn--grape" : "btn--cream"}`}
                onClick={() => openTab(option)}
              >
                {option === "devil" ? (
                  <>
                    <UiIcon name="flame" size={16} /> Diable
                  </>
                ) : (
                  "Boutique"
                )}
              </button>
            ))}
          </span>
        )}
      </div>

      <div className="shop-layout">
        <ul className="shop-shelf" aria-label="Objets en vente">
          {shelf.map((itemId) => {
            const status = getPurchaseStatus(itemId, game, player);
            return (
              <li key={itemId}>
                <button
                  type="button"
                  className={["shop-item", selectedId === itemId && "is-selected", !status.canBuy && "is-unavailable"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectItem(itemId)}
                  aria-pressed={selectedId === itemId}
                >
                  <ItemIcon itemId={itemId} size={40} />
                  <span className="shop-item__name">{ITEM_CATALOG[itemId].name}</span>
                  <span className="shop-item__chips">
                    <span className="price-chip">
                      <CoinIcon size={14} />
                      {formatCurrency(status.price)}
                    </span>
                    <EnergyCost cost={ITEM_CATALOG[itemId].energyCost} />
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
          <span className="shop-detail__energy">
            <EnergyCost cost={selected.energyCost} /> {describeEnergyUse(selected)}
          </span>
          {selectedStatus.canBuy && maxCount > 1 && (
            <QuantityPicker value={count} max={maxCount} onChange={setWantedCount} />
          )}
          <button
            type="button"
            className="btn btn--gold btn--block"
            disabled={!selectedStatus.canBuy}
            onClick={() => game.buyItem(selectedId, count)}
          >
            {selectedStatus.canBuy ? (
              <>
                Acheter{count > 1 ? ` ×${count}` : ""} · <CoinIcon size={18} />{" "}
                {formatCurrency(selectedStatus.price * count)}
              </>
            ) : (
              selectedStatus.reason
            )}
          </button>
          {theftStatus && (
            <button
              type="button"
              className="btn btn--cream btn--block"
              disabled={!theftStatus.canSteal}
              onClick={() => game.stealItem(selectedId)}
              title="Pris, tu files en Enfer et perds des objets valant 1,5 fois son prix, sinon des pièces."
            >
              {theftStatus.canSteal ? `Voler · ${Math.round(theftStatus.risk * 100)} % de risque` : theftStatus.reason}
            </button>
          )}
        </aside>
      </div>
    </ModalShell>
  );
}

interface QuantityPickerProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
}

/** How many copies to buy in one go, from one to what the bag and the purse allow. */
function QuantityPicker({ value, max, onChange }: QuantityPickerProps) {
  return (
    <div className="quantity-picker" role="group" aria-label="Quantité">
      <span className="quantity-picker__label">Quantité</span>
      <button
        type="button"
        className="quantity-picker__step"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Un de moins"
      >
        <UiIcon name="minus" size={16} strokeWidth={3} />
      </button>
      <output className="quantity-picker__value" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="quantity-picker__step"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Un de plus"
      >
        <UiIcon name="plus" size={16} strokeWidth={3} />
      </button>
      <button type="button" className="quantity-picker__max" onClick={() => onChange(max)} disabled={value >= max}>
        Max · {max}
      </button>
    </div>
  );
}
