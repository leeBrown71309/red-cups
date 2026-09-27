import { ITEM_CATALOG } from "../../game/catalog";
import { useGameStore } from "../../game/store";
import { GHOST_EMPTY_LOOT_REWARD, GHOST_LOOT_COINS, GHOST_STEAL_COINS } from "../../game/types";
import { ModalShell } from "../components/modal-shell";
import { GhostAvatar } from "../components/ghost-avatar";
import { CoinIcon, ItemIcon } from "../icons/item-icon";

/** Enough slots that the chest reads as a hoard even with little in it. */
const MIN_VISIBLE_SLOTS = 8;

/**
 * Luna Park: the ghost's hoard, opened by clicking it on the board. Everything
 * it stole waits here for whoever beats it, one piece per victory.
 */
export function GhostLootModal({ onClose }: { onClose: () => void }) {
  const ghost = useGameStore((state) => state.ghost);
  if (!ghost) return null;
  const { coins, items } = ghost.loot;
  const filled = items.length + (coins > 0 ? 1 : 0);
  const emptySlots = Math.max(0, MIN_VISIBLE_SLOTS - filled);

  return (
    <ModalShell title="Butin du fantôme" eyebrow="Luna Park" tone="night" size="medium" onClose={onClose}>
      <div className="ghost-loot__hero">
        <GhostAvatar size={84} mood={filled > 0 ? "laughing" : "menacing"} />
        <p>
          {filled === 0
            ? "Rien pour l’instant : il n’a encore rien volé."
            : `${filled} ${filled > 1 ? "trésors volés attendent" : "trésor volé attend"} qu’on le batte.`}
        </p>
      </div>

      <div className="ghost-loot__grid">
        {coins > 0 && (
          <div className="ghost-loot__slot ghost-loot__slot--coins">
            <CoinIcon size={34} />
            <strong>{coins}</strong>
            pièces
          </div>
        )}
        {items.map((entry) => (
          <div key={entry.id} className="ghost-loot__slot">
            <ItemIcon itemId={entry.itemId} size={40} />
            {ITEM_CATALOG[entry.itemId].name}
          </div>
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div key={`empty-${index}`} className="ghost-loot__slot ghost-loot__slot--empty" aria-hidden="true" />
        ))}
      </div>

      <div className="ghost-loot__rules">
        <p>
          Il vole {GHOST_STEAL_COINS} pièces ou un objet à ceux qu’il bat, et les garde ici, à moins d’emporter sa
          victime en Enfer.
        </p>
        <p>
          Le battre rapporte un seul morceau de butin, tiré au hasard : un objet, ou {GHOST_LOOT_COINS} pièces du tas.
          Sans butin, il paie {GHOST_EMPTY_LOOT_REWARD} pièces.
        </p>
      </div>
    </ModalShell>
  );
}
