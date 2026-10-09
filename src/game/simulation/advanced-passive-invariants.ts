import { hasCard, ownsCard } from "../cards";
import { ITEM_ORDER } from "../catalog";
import { isImmuneToItems } from "../passive-rules";
import { countItemUnits } from "../rules";
import { dropCopies, findPlayer, getActivePlayer } from "../state-utils";
import type { GameState, TurnStage } from "../types";
import { HELL_NODE_ID, MADE_IN_HEAVEN_CUP_NODE_ID, START_NODE_ID } from "../types";
import {
  expectedBalance,
  insurerCoins,
  newLogTexts,
  slidOnIce,
  touchedByHell,
  violation,
  type RuleViolation,
} from "./invariant-helpers";

/** Checks for Double or nothing, Chance aveugle with Made In Heaven, and the Voleur (patch 0.1.4). */

/** Where a gamble may be offered: nothing half-resolved, so play resumes as it was. */
const GAMBLE_STAGES: TurnStage[] = ["move", "hell", "shop", "turn-end", "blessing"];

/**
 * A gamble on offer pauses play on top of the stage it interrupted; the other
 * checks look at that stage, as if the pause were not there.
 */
export function withoutGamblePause(state: GameState): GameState {
  return state.turnStage === "gamble" ? { ...state, turnStage: state.gambleResumeStage } : state;
}

export function checkAdvancedPassiveState(state: GameState, found: RuleViolation[]): void {
  if (state.phase !== "playing") return;
  if (state.turnStage === "gamble" && state.pendingGambles.length === 0) {
    found.push(violation("gamble-stage", "Double or nothing offers a gamble that does not exist"));
  }
  if (state.pendingGambles.length > 0 && GAMBLE_STAGES.includes(state.turnStage)) {
    found.push(violation("gamble-offered", `${state.pendingGambles.length} gamble(s) wait while play goes on`));
  }
  for (const gamble of state.pendingGambles) {
    const holder = findPlayer(state, gamble.playerId);
    if (!(hasCard(holder, "double-or-nothing") || ownsCard(holder, "mime")) || gamble.amount === 0) {
      found.push(violation("gamble-holder", `${holder?.name ?? gamble.playerId} may stake ${gamble.amount} coins`));
    }
  }
  const active = getActivePlayer(state);
  if (state.theftAttempted && !hasCard(active, "thief")) {
    found.push(violation("theft-passive", `${active?.name ?? "nobody"} has a theft this turn`));
  }
}

/** Double or nothing: every change of the holder's coins is offered, then doubled, wiped out or kept. */
function checkGamble(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (previous.turnStage === "gamble") {
    const [gamble] = previous.pendingGambles;
    const before = findPlayer(previous, gamble?.playerId);
    const after = findPlayer(next, gamble?.playerId);
    if (!gamble || !before || !after) return;
    // A loss that waited to knock the holder out ends at 0 (lost or refused) or back where it was (wiped out).
    const outcomes = [
      before.currency,
      expectedBalance(before, gamble.amount),
      expectedBalance(before, -gamble.amount),
      0,
      before.currency - gamble.amount,
    ];
    if (!outcomes.includes(after.currency)) {
      found.push(violation("gamble-outcome", `${before.name} staked ${gamble.amount} and went to ${after.currency}`));
    }
    // A knock-out that waited for the gamble passes the holder's turn at once, and play moves on with it.
    const knockedOut = newLogTexts(previous, next).some((text) =>
      text.startsWith(`${before.name} tombe à −300 pièces`),
    );
    if (!knockedOut && withoutGamblePause(next).turnStage !== previous.gambleResumeStage && next.phase === "playing") {
      found.push(violation("gamble-resumes", `play went back to ${next.turnStage}, not ${previous.gambleResumeStage}`));
    }
    return;
  }

  // Voluntary spending is never staked: purchases (and Corrupteur, for another passive).
  const logs = newLogTexts(previous, next);
  const bought = logs.some((text) => text.includes(" achète ") || text.includes(" revend "));
  for (const holder of previous.players.filter((player) => hasCard(player, "double-or-nothing"))) {
    const after = findPlayer(next, holder.id);
    // The price of a theft that went wrong is not staked either.
    const caught = logs.some((text) => text.startsWith(`${holder.name} se fait prendre`));
    // Nor is the Corrupteur's toll, which can now sit with Double or nothing on the same player.
    const bribed = logs.some((text) => text.startsWith(`${holder.name} ignore les flèches`));
    // What the bank pays L'Assureur is income nobody stakes.
    const insured = logs.reduce((sum, text) => sum + insurerCoins(text, holder.name), 0);
    if (
      !after ||
      // The Mime's copy ended with the turn: a gain that lands afterwards is no longer theirs to stake.
      !hasCard(after, "double-or-nothing") ||
      after.currency === holder.currency ||
      after.currency - holder.currency === insured ||
      bought ||
      caught ||
      bribed ||
      next.phase !== "playing"
    )
      continue;
    const queued = (state: GameState) => state.pendingGambles.filter((gamble) => gamble.playerId === holder.id).length;
    if (queued(next) <= queued(previous)) {
      found.push(violation("gamble-queued", `${holder.name}'s coins changed without a gamble on offer`));
    }
  }
}

/** Voleur: one try per turn, at the shop; away with the item, or caught and sent to Hell. */
function checkTheft(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (previous.theftAttempted || !next.theftAttempted) return;
  const thief = getActivePlayer(previous);
  const after = findPlayer(next, thief?.id);
  if (!thief || !after) return;
  if (previous.turnStage !== "shop" || !hasCard(thief, "thief")) {
    found.push(violation("theft-shop", `${thief.name} stole outside the shop`));
  }
  const caught = newLogTexts(previous, next).some((text) => text.startsWith(`${thief.name} se fait prendre`));
  if (!caught) {
    const gained = ITEM_ORDER.some((itemId) => countItemUnits(after, itemId) === countItemUnits(thief, itemId) + 1);
    if (!gained || after.currency !== thief.currency) {
      found.push(violation("theft-success", `${thief.name} got away without the item, or paid for it`));
    }
    return;
  }
  // A Parachute spent on the way down keeps the caught thief out of Hell.
  const parachuted = countItemUnits(after, "parachute") < countItemUnits(thief, "parachute");
  if (after.position !== HELL_NODE_ID && !parachuted)
    found.push(violation("theft-caught", `${thief.name} was caught but not in Hell`));
  const hadItems = thief.inventory.some((entry) => entry.kind === "item");
  const lostItem = thief.inventory.some(
    (entry) => entry.kind === "item" && !after.inventory.some((candidate) => candidate.id === entry.id),
  );
  if (hadItems && !lostItem) found.push(violation("theft-penalty", `${thief.name} was caught but kept every item`));
}

/** Chance aveugle: the mud only pushes them back, and costs or pays nothing. */
function checkBlindLuckMud(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const logs = newLogTexts(previous, next);
  for (const player of previous.players.filter(isImmuneToItems)) {
    if (logs.includes(`${player.name} tombe dans la Boue.`)) {
      found.push(violation("blind-luck-mud", `${player.name} paid for the mud`));
    }
  }
}

/** Made In Heaven: everybody else is on the start, its user has not moved, and the Cup stands on tile 8. */
export function checkMadeInHeaven(previous: GameState, next: GameState, userId: string, found: RuleViolation[]): void {
  const user = findPlayer(previous, userId);
  const userAfter = findPlayer(next, userId);
  if (!user || !userAfter) return;
  if (userAfter.position !== user.position) found.push(violation("made-in-heaven-user", `${user.name} moved`));
  if (next.redCupNodeId !== MADE_IN_HEAVEN_CUP_NODE_ID && next.phase === "playing") {
    found.push(violation("made-in-heaven-cup", `the Red Cup stands on tile ${next.redCupNodeId}`));
  }
  // Toucher d'Enfer may take a knocked-out player on to Hell, and a frozen start slides them on (Banquise).
  const left = next.players.filter(
    (player) =>
      player.id !== userId &&
      !isImmuneToItems(player) &&
      player.position !== START_NODE_ID &&
      !touchedByHell(previous, next, player.id) &&
      !slidOnIce(previous, next, player.id),
  );
  // The Luna Park ghost may duel whoever it finds on the start, and the duel sends a loser to Hell.
  if (left.length > 0 && next.pendingDuel === null) {
    found.push(violation("made-in-heaven", `${left.map((player) => player.name).join(", ")} stayed away`));
  }
}

/** Bullet Bill never chases Chance aveugle (judged when it hits: an heir may take the passive later). */
function checkBlindLuckBullet(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const flight = next.lastBulletFlight;
  if (!flight || flight.seq === previous.lastBulletFlight?.seq) return;
  // The Mime's copy ended with the turn, before Bullet Bill looked for its target.
  const victim = findPlayer(dropCopies(previous), flight.victimId);
  if (victim && isImmuneToItems(victim)) found.push(violation("blind-luck-bullet", "Bullet Bill hit Chance aveugle"));
}

export function checkAdvancedPassives(previous: GameState, next: GameState, found: RuleViolation[]): void {
  checkBlindLuckBullet(previous, next, found);
  checkGamble(previous, next, found);
  checkTheft(previous, next, found);
  checkBlindLuckMud(previous, next, found);
}
