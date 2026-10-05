import { hasCard } from "../../game/cards";
import { ITEM_CATALOG } from "../../game/catalog";
import { canAffordItem, getItemEnergyCost } from "../../game/energy";
import {
  getCopyLimit,
  getTheftRisk,
  throwsOneStackPerTurn,
  mustWaitForMudToBeSteppedOn,
} from "../../game/passive-rules";
import {
  getCorrupterBlocker,
  getInventoryCapacity,
  getPriceFor,
  isOnSale,
  type CorrupterBlocker,
} from "../../game/rules";
import { findStackWithRoom } from "../../game/state-utils";
import type { GameState, ItemId, Player } from "../../game/types";
import { CORRUPTER_COST, FIRST_ROUND, HELL_NODE_ID } from "../../game/types";
import { formatEnergyCost } from "../components/energy-meter";

const CORRUPTER_HINTS: Record<Exclude<CorrupterBlocker, "not-corrupter">, { short: string; full: string }> = {
  "too-poor": {
    short: `${CORRUPTER_COST} pièces requises`,
    full: `Il faut ${CORRUPTER_COST} pièces pour ignorer une flèche.`,
  },
  "first-round-start": {
    short: `dès le tour ${FIRST_ROUND + 1}`,
    full: "Au premier tour, Corrupteur ne peut pas quitter le départ à contresens.",
  },
};

/** Why the Corrupteur toggle is greyed out, or null when the arrows can be ignored. */
export function getCorrupterHint(player: Player, round: number): { short: string; full: string } | null {
  const blocker = getCorrupterBlocker(player, round);
  return blocker === null || blocker === "not-corrupter" ? null : CORRUPTER_HINTS[blocker];
}

export type ItemUseKind = "prepare-boot" | "target" | "instant" | "passive";

/** Items that act on their own, never from a button: when they do. */
const AUTOMATIC_ITEM_HINTS: Partial<Record<ItemId, string>> = {
  helmet: "Se déclenche tout seul avant de passer sous zéro.",
  "hell-touch": "Se déclenche tout seul dès qu’un joueur assommé se trouve sur ta case.",
  shield: "Se propose tout seul quand ton protégé est visé ou que Bullet Bill fonce sur lui.",
  "wake-up": "Se déclenche tout seul quand un tour sauté te menace.",
  parachute: "Se déclenche tout seul avant une descente en Enfer.",
  mirror: "Se déclenche tout seul quand un objet te vise.",
};

export interface ItemAvailability {
  usable: boolean;
  kind: ItemUseKind;
  actionLabel: string;
  /** Why the item cannot be used right now, shown under the disabled button. */
  reason?: string;
}

/** Why the gauge cannot pay for an item; a prepared Botte keeps a point for the move. */
function getEnergyReason(itemId: ItemId, state: GameState): string {
  const cost = formatEnergyCost(getItemEnergyCost(itemId));
  if (itemId === "boot") return "Il faut 2 points d’énergie : 1 pour la Botte, 1 gardé pour bouger.";
  if (state.moveDistance > 1) return `Pas assez d’énergie : ${cost}, et la Botte garde 1 point pour bouger.`;
  return `Pas assez d’énergie : il faut ${cost}, il t’en reste ${state.energyLeft}.`;
}

/**
 * Mirrors the store guards so the HUD can explain, not just disable. `entryId`
 * names the bag slot, which matters for a stack of Tomates.
 */
export function getItemAvailability(
  itemId: ItemId,
  state: GameState,
  player: Player,
  entryId?: string,
): ItemAvailability {
  const isActive = state.players[state.activePlayerIndex]?.id === player.id;
  const inHell = player.position === HELL_NODE_ID;
  const actionStage = inHell ? state.turnStage === "hell" : state.turnStage === "move";
  const notYourTurn = !isActive || state.phase !== "playing";

  const automatic = AUTOMATIC_ITEM_HINTS[itemId];
  if (automatic) return { usable: false, kind: "passive", actionLabel: "Automatique", reason: automatic };
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
    if (hasCard(player, "roller")) {
      return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: "Le Roller a son dé." };
    }
    if (inHell) return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: "Inutile en Enfer." };
    if (state.turnStage !== "move") {
      return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: "À préparer avant de bouger." };
    }
    if (state.moveDistance > 1)
      return { usable: false, kind: "prepare-boot", actionLabel: "Chaussée", reason: "Déjà prête !" };
    if (!canAffordItem(state, itemId)) {
      return { usable: false, kind: "prepare-boot", actionLabel: "Chausser", reason: getEnergyReason(itemId, state) };
    }
    return { usable: true, kind: "prepare-boot", actionLabel: "Chausser" };
  }

  if (itemId === "mud" && inHell) {
    return { usable: false, kind: "instant", actionLabel: "Poser", reason: "La Boue ne tient pas en Enfer." };
  }
  if (itemId === "mud" && state.mudPlacedThisTurn) {
    return { usable: false, kind: "instant", actionLabel: "Poser", reason: "Une seule Boue par tour." };
  }
  if (itemId === "mud" && mustWaitForMudToBeSteppedOn(state, player)) {
    return { usable: false, kind: "instant", actionLabel: "Poser", reason: "Ta Boue attend encore sa victime." };
  }

  if (itemId === "water-bottle" && !inHell) {
    return { usable: false, kind: "instant", actionLabel: "Boire", reason: "Ne sert qu’à sortir de l’Enfer." };
  }

  if (state.diceRoll !== null && actionStage) {
    return { usable: false, kind: "instant", actionLabel: "Utiliser", reason: "Le dé est lancé : déplace-toi." };
  }
  if (!actionStage) {
    return {
      usable: false,
      kind: "instant",
      actionLabel: "Utiliser",
      reason: "Tu as déjà bougé : garde-le pour ton prochain tour.",
    };
  }

  const kind: ItemUseKind =
    ITEM_CATALOG[itemId].target === "player" || ITEM_CATALOG[itemId].target === "road" ? "target" : "instant";
  const actionLabel =
    itemId === "water-bottle"
      ? "Boire"
      : itemId === "mud"
        ? "Poser"
        : itemId === "tomato" || itemId === "bullet-bill"
          ? "Lancer"
          : "Utiliser";
  if (itemId === "bullet-bill" && state.bulletBill) {
    return { usable: false, kind, actionLabel, reason: "Un Bullet Bill est déjà sur le plateau." };
  }
  const otherStackThrown = state.thrownStackId !== null && entryId !== state.thrownStackId;
  if (itemId === "tomato" && otherStackThrown && throwsOneStackPerTurn(player)) {
    return { usable: false, kind, actionLabel, reason: "Une seule pile de Tomates par tour." };
  }
  if (!canAffordItem(state, itemId))
    return { usable: false, kind, actionLabel, reason: getEnergyReason(itemId, state) };
  return { usable: true, kind, actionLabel };
}

export interface PurchaseStatus {
  price: number;
  canBuy: boolean;
  reason?: string;
}

/** Why an item cannot leave the shelf for this player, whatever they pay: their passive, the bag, the Cup. */
function getShelfBlocker(itemId: ItemId, state: GameState, player: Player): string | null {
  if (itemId === "boot" && hasCard(player, "roller")) return "Pas pour le Roller";
  // Chance aveugle is not told where the Red Cup stands.
  if (!isOnSale(state, itemId)) return "Pas en vente pour l’instant";

  // A stack with room takes one more without a new slot; a new stack counts as a copy.
  if (findStackWithRoom(player, itemId)) return null;
  const capacity = getInventoryCapacity(player);
  const copyLimit = getCopyLimit(player, itemId, capacity);
  const copies = player.inventory.filter((entry) => entry.kind === "item" && entry.itemId === itemId).length;
  if (player.inventory.length >= capacity) return "Sac plein";
  if (copies < copyLimit) return null;
  if (itemId === "eraser") return "Une seule Gomme";
  if (ITEM_CATALOG[itemId].stackLimit) return copyLimit === 1 ? "Une seule pile" : `Max ${copyLimit} piles`;
  return copyLimit === 1 ? "Un seul à la fois" : `Max ${copyLimit} exemplaires`;
}

/** Explains why an item is greyed out in the shop instead of silently disabling it. */
export function getPurchaseStatus(itemId: ItemId, state: GameState, player: Player): PurchaseStatus {
  const price = getPriceFor(state, itemId, player);
  const blocker = getShelfBlocker(itemId, state, player);
  if (blocker) return { price, canBuy: false, reason: blocker };
  if (player.currency < price) return { price, canBuy: false, reason: "Trop cher" };
  return { price, canBuy: true };
}

export interface TheftStatus {
  /** Chance of being caught, from 0 to 1. */
  risk: number;
  canSteal: boolean;
  reason?: string;
}

/** Voleur: the risk of stealing an item, or why it cannot be tried; null for everyone else. */
export function getTheftStatus(itemId: ItemId, state: GameState, player: Player): TheftStatus | null {
  if (!hasCard(player, "thief")) return null;
  const risk = getTheftRisk(getPriceFor(state, itemId, player));
  if (state.theftAttempted) return { risk, canSteal: false, reason: "Un seul vol par visite" };
  const blocker = getShelfBlocker(itemId, state, player);
  return blocker ? { risk, canSteal: false, reason: blocker } : { risk, canSteal: true };
}
