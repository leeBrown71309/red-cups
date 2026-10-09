import { ownsCard } from "./cards";
import { PASSIVE_CATALOG } from "./catalog";
import { getEnergyCapacity } from "./energy";
import { getCopyLimit } from "./passive-rules";
import { getInventoryCapacity } from "./rules";
import { isInvisible } from "./mist";
import { withPowerEvent } from "./power-event";
import { addBagLog, addLog, dropCopies, findPlayer, getActivePlayer, updatePlayer } from "./state-utils";
import type { GameState, PassiveId, Player, PlayerId } from "./types";
import { MIME_COOLDOWN_ROUNDS } from "./types";

/**
 * Mime (patch 0.2.3): once every three rounds, copies another player's actif for the turn in progress. Every
 * advantage and every drawback of the copied card applies to them until the turn ends (`Player.mimicId`, which
 * `hasCard` reads like a card of their own), and copying costs no energy.
 */

/**
 * Cards the Mime cannot copy: the ones that make no sense for a single turn or lean on a state only their dealt
 * holder has: the roles set up at the start (le diable, L'Ange-Gardien and their protégé), the cards that keep a
 * state of their own across turns (Mage noir's mark and chances, Sœur Fantôme's sister, Mi-vu, Mi-vue's cycle), the
 * Mime itself, and the empty Lambda.
 */
export const UNCOPYABLE_CARDS: PassiveId[] = [
  "mime",
  "lambda",
  "devil",
  "guardian-angel",
  "black-mage",
  "ghost-sister",
  "half-seen",
];

/**
 * The passifs the Mime cannot copy: Non merci (its recharge belongs to its holder), L'Ermite and L'Assureur (their
 * prime and their earnings are kept from turn to turn), and L'Habitué de l'Enfer (it sets the length of the sentence
 * being served, which a single turn cannot change).
 */
export const UNCOPYABLE_PASSIFS: PassiveId[] = ["no-thanks", "hermit", "insurer", "hell-regular"];

/** What the Mime borrows: the Cups Power (actif) or the passif of another player. */
export type MimeCopyKind = "actif" | "passif";

/** The card of `target` the Mime would copy, of the kind asked, or null when it cannot be copied. */
export function getCopyableCard(
  target: Pick<Player, "passiveId" | "passifId">,
  kind: MimeCopyKind = "actif",
): PassiveId | null {
  if (kind === "passif") {
    return target.passifId && !UNCOPYABLE_PASSIFS.includes(target.passifId) ? target.passifId : null;
  }
  return UNCOPYABLE_CARDS.includes(target.passiveId) ? null : target.passiveId;
}

/** The kinds of card of `target` the Mime may copy. */
export function getCopyableKinds(target: Pick<Player, "passiveId" | "passifId">): MimeCopyKind[] {
  return (["actif", "passif"] as const).filter((kind) => getCopyableCard(target, kind) !== null);
}

/** Whether the active Mime may copy right now: their cooldown is over, nothing is copied yet, their move is ahead. */
export function canMimeCopy(state: GameState, player: Player | undefined): player is Player {
  return (
    player !== undefined &&
    state.phase === "playing" &&
    getActivePlayer(state)?.id === player.id &&
    ownsCard(player, "mime") &&
    !player.mimicId &&
    (state.turnStage === "move" || state.turnStage === "hell") &&
    state.diceRoll === null &&
    state.moveDistance === 1 &&
    state.round >= (player.mimeReadyRound ?? 0) &&
    !isInvisible(state, player)
  );
}

/** The players the Mime may copy: another player, in view, holding a Cups Power or a passif that can be copied. */
export function getMimeTargets(state: GameState, player: Player): Player[] {
  if (!canMimeCopy(state, player)) return [];
  return state.players.filter(
    (other) => other.id !== player.id && !isInvisible(state, other) && getCopyableKinds(other).length > 0,
  );
}

/**
 * The turn ends, and so do the copies. What a copied card let a Mime hoard beyond what their own cards allow (the
 * Tomate stacks of Tomato Enjoyer) goes with it, so no bag is left over its limit.
 */
export function endCopies(state: GameState): GameState {
  const copiers = state.players.filter((player) => player.mimicId);
  let nextState = dropCopies(state);
  for (const copier of copiers) {
    const current = findPlayer(nextState, copier.id);
    if (!current) continue;
    const capacity = getInventoryCapacity(current);
    const kept = new Map<string, number>();
    const inventory = current.inventory.filter((entry) => {
      if (entry.kind !== "item") return true;
      const count = (kept.get(entry.itemId) ?? 0) + 1;
      kept.set(entry.itemId, count);
      return count <= getCopyLimit(current, entry.itemId, capacity);
    });
    if (inventory.length === current.inventory.length) continue;
    nextState = updatePlayer(nextState, current.id, (player) => ({ ...player, inventory }));
    nextState = addLog(nextState, `${current.name} perd ce que la copie lui permettait de garder en trop.`, "event");
  }
  return nextState;
}

/**
 * The copy: the Mime holds the target's Cups Power or passif, as they choose, until their turn ends, with the energy
 * it brings.
 */
export function mimeCopy(state: GameState, targetId: PlayerId, kind: MimeCopyKind = "actif"): GameState {
  const mime = getActivePlayer(state);
  const target = findPlayer(state, targetId);
  if (!mime || !target || !getMimeTargets(state, mime).some((candidate) => candidate.id === targetId)) return state;
  const cardId = getCopyableCard(target, kind);
  if (!cardId) return state;

  const copied = updatePlayer(state, mime.id, (current) => ({
    ...current,
    mimicId: cardId,
    mimeReadyRound: state.round + MIME_COOLDOWN_ROUNDS,
  }));
  // A copy that enlarges the energy gauge (Red Bull) gives its points at once.
  const gained = Math.max(
    0,
    getEnergyCapacity(findPlayer(copied, mime.id) ?? mime, copied) - getEnergyCapacity(mime, state),
  );
  const nextState = withPowerEvent(
    { ...copied, energyLeft: copied.energyLeft + gained },
    { kind: "mime-copy", playerId: mime.id, targetId, cardId },
  );
  // A passif is public, so the table reads which one was borrowed. The Cups Power copied stays a secret of the Mime's:
  // the table only learns whose Cups Power they borrowed.
  if (kind === "passif") {
    return addLog(
      nextState,
      `${mime.name} copie le passif de ${target.name} : ${PASSIVE_CATALOG[cardId].name}, jusqu’à la fin de son tour.`,
      "event",
    );
  }
  return addBagLog(
    nextState,
    mime.id,
    `${mime.name} copie le Cups Power de ${target.name} : ${PASSIVE_CATALOG[cardId].name}, jusqu’à la fin de son tour.`,
    `${mime.name} copie le Cups Power de ${target.name} jusqu’à la fin de son tour.`,
    "event",
  );
}
