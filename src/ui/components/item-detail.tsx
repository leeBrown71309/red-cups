import type { ReactNode } from "react";
import type { ItemDefinition } from "../../game/catalog";
import type { ItemId } from "../../game/types";
import { formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { EnergyCost, formatEnergyCost } from "./energy-meter";

/** When, and for how much energy, a bought item can be used. */
export function describeEnergyUse(item: ItemDefinition): string {
  if (item.energyCost === 0 && item.target === "special") return "Agit tout seul, sans énergie.";
  const cost = item.energyCost === 0 ? "sans énergie" : `pour ${formatEnergyCost(item.energyCost)}`;
  return `Utilisable dès ton prochain tour, ${cost}.`;
}

interface ItemDetailProps {
  itemId: ItemId;
  item: ItemDefinition;
  /** The price shown; the shop's is the one this player pays. */
  price: number;
  /** Prefix of the price when it moves (the Botte). */
  pricePrefix?: string;
  /** What to do with the item: the shop's buttons. */
  children?: ReactNode;
}

/**
 * The fixed side of a catalogue, in the shop and in the help: the item, what it costs, what it does. A long
 * description scrolls inside its own block, so the panel never grows past its column.
 */
export function ItemDetail({ itemId, item, price, pricePrefix = "", children }: ItemDetailProps) {
  return (
    <div className="item-detail">
      <div className="item-detail__head">
        <ItemIcon itemId={itemId} size={72} className="item-detail__icon" />
        <div className="item-detail__title">
          <strong>{item.name}</strong>
          <span className="item-detail__chips">
            <span className="price-chip">
              <CoinIcon size={14} />
              {pricePrefix}
              {formatCurrency(price)}
            </span>
            <EnergyCost cost={item.energyCost} />
            {item.target === "player" && <span className="item-detail__tag">Cible un joueur</span>}
          </span>
        </div>
      </div>
      <div className="item-detail__description scroll-block" tabIndex={0}>
        <p>{item.description}</p>
        <p className="item-detail__use">{describeEnergyUse(item)}</p>
      </div>
      {children && <div className="item-detail__actions">{children}</div>}
    </div>
  );
}
