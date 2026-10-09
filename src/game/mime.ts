import { ownsCard } from "./cards";
import { PASSIVE_CATALOG } from "./catalog";
import { getEnergyCapacity } from "./energy";
import { isInvisible } from "./mist";
import { withPowerEvent } from "./power-event";
import { addBagLog, findPlayer, getActivePlayer, updatePlayer } from "./state-utils";
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

/** The actif of `target` the Mime would copy, or null when it cannot be copied. */
export function getCopyableCard(target: Pick<Player, "passiveId">): PassiveId | null {
  return UNCOPYABLE_CARDS.includes(target.passiveId) ? null : target.passiveId;
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

/** The players whose actif the Mime may copy: another player, in view, holding a card that can be copied. */
export function getMimeTargets(state: GameState, player: Player): Player[] {
  if (!canMimeCopy(state, player)) return [];
  return state.players.filter(
    (other) => other.id !== player.id && !isInvisible(state, other) && getCopyableCard(other) !== null,
  );
}

/** The copy: the Mime holds the target's actif until their turn ends, with the energy it brings. */
export function mimeCopy(state: GameState, targetId: PlayerId): GameState {
  const mime = getActivePlayer(state);
  const target = findPlayer(state, targetId);
  if (!mime || !target || !getMimeTargets(state, mime).some((candidate) => candidate.id === targetId)) return state;
  const cardId = getCopyableCard(target);
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
  // The card copied stays a secret of the Mime's: the table only learns whose Cups Power they borrowed.
  return addBagLog(
    nextState,
    mime.id,
    `${mime.name} copie le Cups Power de ${target.name} : ${PASSIVE_CATALOG[cardId].name}, jusqu’à la fin de son tour.`,
    `${mime.name} copie le Cups Power de ${target.name} jusqu’à la fin de son tour.`,
    "event",
  );
}
