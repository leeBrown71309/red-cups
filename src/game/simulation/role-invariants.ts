import { findDevil, getDevilGoalFor } from "../devil";
import { avoidsHell, isImmuneToItems, isMalefactor } from "../passive-rules";
import { countRedCups } from "../rules";
import { findPlayer } from "../state-utils";
import type { GameState, ItemId } from "../types";
import { HELL_NODE_ID, MADE_IN_HEAVEN_CUP_NODE_ID, START_NODE_ID } from "../types";
import { violation, type RuleViolation } from "./invariant-helpers";

/** Checks for le diable, their shop, and L'Ange-Gardien (patch 0.1.4). */

export function checkRoleState(state: GameState, found: RuleViolation[]): void {
  for (const player of state.players) {
    if ((player.passiveId === "devil" || player.passiveId === "guardian-angel") && countRedCups(player) > 0) {
      found.push(violation("role-no-cup", `${player.name} holds a Red Cup`));
    }
    if (avoidsHell(player) && player.position === HELL_NODE_ID) {
      found.push(violation("angel-no-hell", `${player.name} stands in Hell`));
    }
  }

  const devil = findDevil(state);
  if (devil && state.phase === "playing" && state.devilHellEntries >= getDevilGoalFor(state)) {
    found.push(violation("devil-victory", `${state.devilHellEntries} Hell entries but the game goes on`));
  }
  if (state.redCupNodeId === HELL_NODE_ID && !state.blackCup) {
    found.push(violation("black-cup", "the Red Cup lies in Hell without a Black Cup"));
  }
  if (state.blackCup && state.redCupNodeId !== HELL_NODE_ID && state.phase === "playing") {
    found.push(violation("black-cup-away", `the Black Cup waits but the Red Cup is on tile ${state.redCupNodeId}`));
  }
  for (const portal of state.hellPortals) {
    if (portal.nodeId === START_NODE_ID || portal.nodeId === HELL_NODE_ID) {
      found.push(violation("portal-tile", `a Portail opened on tile ${portal.nodeId}`));
    }
  }

  const guardian = state.guardian;
  if (guardian) {
    const angel = findPlayer(state, guardian.angelId);
    const protege = findPlayer(state, guardian.protegeId);
    if (angel?.passiveId !== "guardian-angel" || !protege || isMalefactor(protege) || protege.id === angel.id) {
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

/** Every player but le diable stepping into Hell counts once towards their goal. */
export function checkHellEntries(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (!findDevil(previous) || !findDevil(next)) return;
  const entries = next.players.filter((player) => {
    const before = findPlayer(previous, player.id);
    return (
      before !== undefined &&
      player.passiveId !== "devil" &&
      before.position !== HELL_NODE_ID &&
      player.position === HELL_NODE_ID
    );
  }).length;
  if (next.devilHellEntries - previous.devilHellEntries !== entries) {
    found.push(
      violation("devil-count", `${entries} entries counted as ${next.devilHellEntries - previous.devilHellEntries}`),
    );
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
      if (next.hellPortals.length !== previous.hellPortals.length + 1) {
        found.push(violation("portal-open", "the Portail did not open"));
      }
      break;
    case "black-cup":
      if (!next.blackCup || next.blackCup.returnNodeId !== previous.redCupNodeId) {
        found.push(violation("black-cup-cast", "the Black Cup did not take the Red Cup to Hell"));
      }
      break;
    case "doomsday":
      if (!next.doomsday || next.doomsday.casterId !== userId) {
        found.push(violation("doomsday-cast", "Doomsday did not start"));
      }
      break;
    case "made-in-heaven":
      if (next.blackCup || next.redCupNodeId !== MADE_IN_HEAVEN_CUP_NODE_ID) {
        found.push(violation("made-in-heaven-black-cup", "the Red Cup stayed in Hell"));
      }
      break;
    default:
      break;
  }
}
