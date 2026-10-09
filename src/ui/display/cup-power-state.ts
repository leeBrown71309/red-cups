import { getLuck } from "../../game/mage-luck";
import { findMark } from "../../game/mage-queries";
import { isInvisible } from "../../game/mist";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { getSisterNode } from "../../game/sister";
import type { GameState, PassiveId, Player } from "../../game/types";
import { MAGE_MAX_LUCK } from "../../game/types";

/** Where a power that comes back after a cooldown stands, in words. */
function formatCooldown(readyRound: number | undefined, round: number, ready: string): string {
  return (readyRound ?? 0) <= round ? ready : `De retour au tour ${readyRound}.`;
}

/**
 * What a Cups Power of patch 0.2.3 is doing for its holder, in a sentence for the player's details: a cooldown, the
 * pentagrams left, where the sister floats. Null for the cards that keep nothing of the kind.
 */
export function describeCupPowerState(game: GameState, player: Player, cardId: PassiveId): string | null {
  switch (cardId) {
    case "mime":
      return player.mimicId
        ? `Copie ${PASSIVE_CATALOG[player.mimicId].name} jusqu’à la fin de son tour.`
        : formatCooldown(player.mimeReadyRound, game.round, "Prêt à copier.");
    case "mole":
      return formatCooldown(player.moleReadyRound, game.round, "Prête à creuser.");
    case "black-mage": {
      const mark = findMark(game, player.id);
      const reserve = `${getLuck(player)}/${MAGE_MAX_LUCK} pentagrammes en réserve.`;
      return mark ? `${reserve} Pentagramme posé en case ${mark.nodeId}.` : `${reserve} Aucun pentagramme posé.`;
    }
    case "half-seen":
      return isInvisible(game, player) ? "Invisible en ce moment." : "Visible en ce moment.";
    case "ghost-sister":
      return `Sa sœur flotte en case ${getSisterNode(player)}. ${formatCooldown(player.swapReadyRound, game.round, "Swap prêt.")}`;
    default:
      return null;
  }
}
