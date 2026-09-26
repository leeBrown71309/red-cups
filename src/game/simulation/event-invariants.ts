import { isTableBroke } from "../blessing";
import { getNeighbors } from "../board";
import { findPlayer } from "../state-utils";
import type { GameState } from "../types";
import { BULLET_BILL_DAMAGE, HELL_NODE_ID, MUD_OWNER_REWARD, START_NODE_ID } from "../types";
import { expectedBalance, newLogTexts, turnChanged, violation, type RuleViolation } from "./invariant-helpers";

/**
 * Checks for the table-wide events: Bullet Bill, the Tour de Bénédiction,
 * players leaving and mud paying whoever laid it.
 */

/** Bullet Bill lands on the start when bought, then charges one or two tiles at the start of each round. */
export function checkBulletBill(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (!previous.bulletBill && next.bulletBill) {
    const { status, position, spawnRound } = next.bulletBill;
    if (status !== "waiting" || position !== START_NODE_ID || spawnRound !== previous.round + 1) {
      found.push(violation("bullet-launch", `Bullet Bill bought ${status} on ${position} for round ${spawnRound}`));
    }
  }

  const flight = next.lastBulletFlight;
  const flew = flight !== null && flight.seq !== previous.lastBulletFlight?.seq;
  const bullet = previous.bulletBill;
  const due = bullet !== null && (bullet.status === "active" || bullet.spawnRound <= next.round);
  const reachable = previous.players.some((player) => player.position !== HELL_NODE_ID);
  if (next.round > previous.round && due && reachable && !flew) {
    found.push(violation("bullet-charges", `Bullet Bill stayed put at the start of round ${next.round}`));
  }
  if (!flew || !flight) return;

  if (!bullet || flight.from !== bullet.position) {
    found.push(violation("bullet-flight-start", `Bullet Bill took off from ${flight.from}`));
  }
  if (flight.path.length > 2) found.push(violation("bullet-range", `Bullet Bill flew ${flight.path.length} tiles`));
  let landing = flight.from;
  for (const step of flight.path) {
    if (!getNeighbors(landing, true).includes(step)) {
      found.push(violation("bullet-follows-roads", `Bullet Bill flew ${landing} → ${step} off the roads`));
    }
    landing = step;
  }

  if (!flight.victimId) {
    if (next.bulletBill?.position !== landing) {
      found.push(violation("bullet-lands", `Bullet Bill should hover over tile ${landing}`));
    }
    return;
  }

  if (next.bulletBill !== null) found.push(violation("bullet-explodes", "Bullet Bill survived its hit"));
  const before = findPlayer(previous, flight.victimId);
  const after = findPlayer(next, flight.victimId);
  if (!before || !after) return;
  const logs = newLogTexts(previous, next);
  if (after.position !== landing) found.push(violation("bullet-hits-target", `${before.name} was hit from afar`));
  // Whoever just served their Hell sentence lands on the start, paying the toll, right before the charge.
  const releasedFromHell = logs.some((text) => text.startsWith(`${before.name} a purgé`));
  if (!releasedFromHell && after.currency !== expectedBalance(before, -BULLET_BILL_DAMAGE)) {
    found.push(violation("bullet-damage", `${before.name} went from ${before.currency} to ${after.currency}`));
  }
  // The victim may be next to play, in which case the stun is spent at once.
  const stunSpent = logs.includes(`${before.name} passe son tour.`);
  if (after.skippedTurns <= before.skippedTurns && !stunSpent) {
    found.push(violation("bullet-stuns", `${before.name} was hit but keeps their next turn`));
  }
}

/** Every player broke as a turn ends: the whole table spins the wheel of fortune, in turn order. */
export function checkBlessing(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (previous.turnStage === "blessing") {
    const [spinnerId, ...rest] = previous.blessingQueue;
    const wheel = next.pendingWheel;
    if (wheel?.wheelId !== "fortune" || wheel.playerId !== spinnerId) {
      found.push(violation("blessing-spin", `the blessing spun ${wheel?.wheelId} for ${wheel?.playerId ?? "nobody"}`));
    }
    if (next.blessingQueue.join() !== rest.join()) {
      found.push(violation("blessing-order", "a player was skipped during the Tour de Bénédiction"));
    }
    return;
  }

  const endedTurn =
    ["turn-end", "shop", "move"].includes(previous.turnStage) &&
    next.players.length === previous.players.length &&
    (next.turnStage === "blessing" || turnChanged(previous, next));
  if (!endedTurn) return;

  if (!isTableBroke(previous)) {
    if (next.turnStage === "blessing") {
      found.push(violation("blessing-undue", "Tour de Bénédiction while someone still has coins"));
    }
    return;
  }
  const seatCount = previous.players.length;
  const expectedOrder = previous.players.map(
    (_, offset) => previous.players[(previous.activePlayerIndex + 1 + offset) % seatCount].id,
  );
  const started =
    next.turnStage === "blessing" &&
    next.activePlayerIndex === previous.activePlayerIndex &&
    next.blessingQueue.join() === expectedOrder.join();
  if (!started) found.push(violation("blessing-trigger", "the whole table is broke but nobody is blessed"));
}

/** A player who leaves takes their seat along; the turn passes on if it was theirs, the last one standing wins. */
export function checkAbandon(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (next.players.length >= previous.players.length) return;
  const gone = previous.players.filter((player) => !findPlayer(next, player.id));
  if (gone.length !== 1) {
    found.push(violation("abandon-one-seat", `${gone.length} players left in a single action`));
    return;
  }

  const [leaver] = gone;
  if (!next.abandonedPlayers.some((player) => player.id === leaver.id)) {
    found.push(violation("abandon-recorded", `${leaver.name} is missing from the standings`));
  }
  if (next.players.length === 1) {
    if (next.phase !== "finished" || next.winnerId !== next.players[0].id || next.winReason !== "forfeit") {
      found.push(violation("abandon-last-wins", "the last player standing did not win"));
    }
    return;
  }

  const previousActive = previous.players[previous.activePlayerIndex];
  const nextActive = next.players[next.activePlayerIndex];
  if (previousActive.id !== leaver.id) {
    if (nextActive?.id !== previousActive.id || next.turnStage !== previous.turnStage) {
      found.push(violation("abandon-keeps-turn", `${leaver.name} leaving interrupted ${previousActive.name}'s turn`));
    }
  } else if (!["move", "hell"].includes(next.turnStage)) {
    found.push(violation("abandon-passes-turn", `after ${leaver.name} left the stage is ${next.turnStage}`));
  }
}

/** Somebody else stepping in your mud pays you; your own mud pays nobody. */
export function checkMudReward(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const triggered = previous.mudTraps.filter((trap) => !next.mudTraps.some((candidate) => candidate.id === trap.id));
  if (triggered.length === 0) return;

  const victimId = next.lastMovement?.playerId;
  const logs = newLogTexts(previous, next);
  for (const trap of triggered) {
    const owner = findPlayer(previous, trap.ownerId);
    if (!owner) continue;
    const paid = logs.includes(`${owner.name} touche ${MUD_OWNER_REWARD} pièces grâce à sa Boue.`);
    if (owner.id !== victimId && !paid) found.push(violation("mud-pays-owner", `${owner.name} got nothing`));
    if (owner.id === victimId && paid) found.push(violation("mud-own-trap", `${owner.name} was paid by their own mud`));
  }
}
