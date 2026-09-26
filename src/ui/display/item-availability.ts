import { ITEM_CATALOG } from "../../game/catalog";
import { getDelinquentBlocker, getInventoryCapacity, type DelinquentBlocker } from "../../game/rules";
import type { GameState, ItemId, Player } from "../../game/types";
import { DELINQUENT_COST, FIRST_ROUND, HELL_NODE_ID } from "../../game/types";

const DELINQUENT_HINTS: Record<Exclude<DelinquentBlocker, "not-delinquent">, { short: string; full: string }> = {
  "too-poor": {
    short: `${DELINQUENT_COST} pièces requises`,
    full: `Il faut ${DELINQUENT_COST} pièces pour ignorer une flèche.`,
  },
  "first-round-start": {
    short: `dès le tour ${FIRST_ROUND + 1}`,
    full: "Au premier tour, Délinquant ne peut pas quitter le départ à contresens.",
  },
};

/** Why the Délinquant toggle is greyed out, or null when the arrows can be ignored. */
export function getDelinquentHint(player: Player, round: number): { short: string; full: string } | null {
  const blocker = getDelinquentBlocker(player, round);
  return blocker === null || blocker === "not-delinquent" ? null : DELINQUENT_HINTS[blocker];
}

export type ItemUseKind = "prepare-boot" | "target" | "instant" | "passive";

export interface ItemAvailability {
  usable: boolean;
  kind: ItemUseKind;
  actionLabel: string;
  /** Why the item cannot be used right now, shown under the disabled button. */
  reason?: string;
}

/** Mirrors the store guards so the HUD can explain, not just disable. */
export function getItemAvailability(itemId: ItemId, state: GameState, player: Player): ItemAvailability {
  const isActive = state.players[state.activePlayerIndex]?.id === player.id;
  const inHell = player.position === HELL_NODE_ID;
  const actionStage = inHell ? state.turnStage === "hell" : state.turnStage === "move";
  const notYourTurn = !isActive || state.phase !== "playing";

  if (itemId === "helmet") {
    return {
      usable: false,
      kind: "passive",
      actionLabel: "Automatique",
      reason: "Se déclenche tout seul avant de passer sous zéro.",
    };
  }
  if (itemId === "eraser") {
    return {
      usable: false,
      kind: "passive",
      actionLabel: "Réaction",
      reason: "Se propose quand une roue vient de s’arrêter.",
    };
  }
  if (notYourTurn) return { usable: false, kind: "instant", actionLabel: "Utiliser", reason: "Attends ton tour." };

  if (itemId === "boot") {
    if (inHell) return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: "Inutile en Enfer." };
    if (state.turnStage !== "move") {
      return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: "À préparer avant de bouger." };
    }
    if (state.moveDistance > 1)
      return { usable: false, kind: "prepare-boot", actionLabel: "Chaussée", reason: "Déjà prête !" };
    return { usable: true, kind: "prepare-boot", actionLabel: "Chausser" };
  }

  if (itemId === "mud" && inHell) {
    return { usable: false, kind: "instant", actionLabel: "Poser", reason: "La Boue ne tient pas en Enfer." };
  }
  if (itemId === "mud" && state.mudPlacedThisTurn) {
    return { usable: false, kind: "instant", actionLabel: "Poser", reason: "Une seule Boue par tour." };
  }

  if (itemId === "water-bottle" && !inHell) {
    return { usable: false, kind: "instant", actionLabel: "Boire", reason: "Ne sert qu’à sortir de l’Enfer." };
  }

  if (!actionStage) {
    return { usable: false, kind: "instant", actionLabel: "Utiliser", reason: "Ton action du tour est déjà faite." };
  }

  const kind: ItemUseKind = ITEM_CATALOG[itemId].target === "player" ? "target" : "instant";
  const actionLabel = itemId === "water-bottle" ? "Boire" : itemId === "mud" ? "Poser" : "Utiliser";
  return { usable: true, kind, actionLabel };
}

export interface PurchaseStatus {
  price: number;
  canBuy: boolean;
  reason?: string;
}

/** Explains why an item is greyed out in the shop instead of silently disabling it. */
export function getPurchaseStatus(itemId: ItemId, state: GameState, player: Player): PurchaseStatus {
  const price = itemId === "boot" ? state.bootPrice : ITEM_CATALOG[itemId].price;
  const copies = player.inventory.filter((entry) => entry.kind === "item" && entry.itemId === itemId).length;

  if (itemId === "bullet-bill") {
    if (state.bulletBill) return { price, canBuy: false, reason: "Déjà lancé" };
  } else {
    if (player.inventory.length >= getInventoryCapacity(player)) return { price, canBuy: false, reason: "Sac plein" };
    if (itemId === "eraser" && copies >= 1) return { price, canBuy: false, reason: "Une seule Gomme" };
    if (copies >= 2) return { price, canBuy: false, reason: "Max 2 exemplaires" };
  }

  if (player.currency < price) return { price, canBuy: false, reason: "Trop cher" };
  return { price, canBuy: true };
}
