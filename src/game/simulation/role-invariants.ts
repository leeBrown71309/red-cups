import { hasCard } from "../cards";
import { DEVIL_HELL_REWARD, findDevil, getDevilGoalFor } from "../devil";
import { avoidsHell, isImmuneToItems, isMalefactor } from "../passive-rules";
import { countRedCups } from "../rules";
import { findPlayer } from "../state-utils";
import type { GameState, ItemId } from "../types";
import { getBoardMap } from "../maps/map-registry";
import { HELL_NODE_ID, MADE_IN_HEAVEN_CUP_NODE_ID, START_NODE_ID } from "../types";
import { newLogTexts, violation, type RuleViolation } from "./invariant-helpers";

/** Checks for le diable, their shop, and L'Ange-Gardien (patch 0.1.4). */

export function checkRoleState(state: GameState, found: RuleViolation[]): void {
  for (const player of state.players) {
    if ((hasCard(player, "devil") || hasCard(player, "guardian-angel")) && countRedCups(player) > 0) {
      found.push(violation("role-no-cup", `${player.name} holds a Red Cup`));
    }
    if (avoidsHell(player) && player.position === HELL_NODE_ID) {
      found.push(violation("angel-no-hell", `${player.name} stands in Hell`));
    }
  }

  const devil = findDevil(state);
  if (devil && state.phase === "playing" && state.devilHellTurns >= getDevilGoalFor(state)) {
    found.push(violation("devil-victory", `${state.devilHellTurns} turns in Hell but the game goes on`));
  }
  if (state.redCupNodeId === HELL_NODE_ID && !state.blackCup) {
    found.push(violation("black-cup", "the Red Cup lies in Hell without a Black Cup"));
  }
  if (state.blackCup && state.redCupNodeId !== HELL_NODE_ID && state.phase === "playing") {
    found.push(violation("black-cup-away", `the Black Cup waits but the Red Cup is on tile ${state.redCupNodeId}`));
  }
  // Sœur Fantôme's swap may set a Portail down on the tile the player stood on, the start included.
  const swap = state.lastPowerEvent?.kind === "sister-swap" ? state.lastPowerEvent : null;
  for (const portal of state.hellPortals) {
    const carried =
      [...state.players, ...state.abandonedPlayers].some((player) => hasCard(player, "ghost-sister")) || swap !== null;
    if ((portal.nodeId === START_NODE_ID && !carried) || portal.nodeId === HELL_NODE_ID) {
      found.push(violation("portal-tile", `a Portail opened on tile ${portal.nodeId}`));
    }
  }

  const guardian = state.guardian;
  if (guardian) {
    const angel = findPlayer(state, guardian.angelId);
    const protege = findPlayer(state, guardian.protegeId);
    if (!angel || !hasCard(angel, "guardian-angel") || !protege || isMalefactor(protege) || protege.id === angel.id) {
      found.push(violation("guardian-pair", `${angel?.name ?? "nobody"} protects ${protege?.name ?? "nobody"}`));
    }
  }
  if (state.phase === "finished") {
    const expected = guardian && guardian.protegeId === state.winnerId ? guardian.angelId : null;
    if (state.coWinnerId !== expected) {
      found.push(violation("guardian-co-win", `co-winner ${state.coWinnerId}, expected ${expected}`));
    }
  }
}

/**
 * Le diable's count of the turns the others spend in Hell: it never goes
 * back, and a turn handed to another player who starts it in Hell adds to it.
 * Their own trips to Hell pay them.
 */
export function checkDevilHellTurns(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const devil = findDevil(next);
  if (!findDevil(previous) || !devil) return;
  const added = next.devilHellTurns - previous.devilHellTurns;
  if (added < 0) found.push(violation("devil-count", `the count went back by ${-added}`));

  const active = next.players[next.activePlayerIndex];
  const before = active && findPlayer(previous, active.id);
  // An earlier seat leaving shifts the index of the same player: only another player, or a new round, is a new turn.
  const previousActive = previous.players[previous.activePlayerIndex];
  const newTurn = active?.id !== previousActive?.id || next.round !== previous.round;
  if (newTurn && !hasCard(active, "devil") && active?.position === HELL_NODE_ID && before && added < 1) {
    found.push(violation("devil-count", `${active.name} began a turn in Hell without it being counted`));
  }

  const devilBefore = findPlayer(previous, devil.id);
  const entered = devilBefore && devilBefore.position !== HELL_NODE_ID && devil.position === HELL_NODE_ID;
  if (entered && !newLogTexts(previous, next).some((text) => text.includes("est chez lui en Enfer"))) {
    found.push(violation("devil-hell-reward", `${devil.name} went to Hell without their ${DEVIL_HELL_REWARD} coins`));
  }
}

/** Le diable's items, once used. */
export function checkDevilItem(
  previous: GameState,
  next: GameState,
  itemId: ItemId,
  userId: string,
  found: RuleViolation[],
): void {
  switch (itemId) {
    case "sentence":
      for (const player of next.players) {
        const before = findPlayer(previous, player.id);
        const doomed = before && player.id !== userId && before.currency <= 0;
        if (doomed && !isImmuneToItems(player) && !avoidsHell(player) && player.position !== HELL_NODE_ID) {
          // A duel may already have sent the winner of two in Hell back to the start.
          if (next.pendingDuel || player.position === START_NODE_ID) continue;
          found.push(violation("sentence", `${player.name} was broke but stayed out of Hell`));
        }
      }
      break;
    case "portal":
      if (next.hellPortals.length !== previous.hellPortals.length + 2) {
        found.push(violation("portal-open", "the two Portails did not open"));
      }
      break;
    case "black-cup": {
      // Toucher d'Enfer may send a knocked-out player to Hell at once, who finds the Black Cup there.
      const foundAtOnce = newLogTexts(previous, next).some((text) => text.includes("trouve la Black Cup"));
      if (foundAtOnce) break;
      if (!next.blackCup || next.blackCup.returnNodeId !== previous.redCupNodeId) {
        found.push(violation("black-cup-cast", "the Black Cup did not take the Red Cup to Hell"));
      }
      break;
    }
    case "doomsday":
      if (!next.doomsday || next.doomsday.casterId !== userId) {
        found.push(violation("doomsday-cast", "Doomsday did not start"));
      }
      break;
    case "made-in-heaven":
      if (next.blackCup || (!getBoardMap(next.mapId).desert && next.redCupNodeId !== MADE_IN_HEAVEN_CUP_NODE_ID)) {
        found.push(violation("made-in-heaven-black-cup", "the Red Cup stayed in Hell"));
      }
      break;
    default:
      break;
  }
}
