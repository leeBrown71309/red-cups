import { isTableBroke } from "../blessing";
import { getNeighbors, getOpenBoard, getShortestPath } from "../board";
import { isInvisible } from "../mist";
import { getMudOwnerReward, isImmuneToItems } from "../passive-rules";
import { findPlayer } from "../state-utils";
import type { GameState } from "../types";
import { BULLET_BILL_CHARGE_STEPS, BULLET_BILL_DAMAGE, HELL_NODE_ID, START_NODE_ID } from "../types";
import {
  balanceMatches,
  hellRewardCoins,
  newLogTexts,
  slidOnIce,
  turnChanged,
  violation,
  type RuleViolation,
} from "./invariant-helpers";

/**
 * Checks for the table-wide events: Bullet Bill, the Tour de Bénédiction,
 * players leaving and mud paying whoever laid it.
 */

/** Bullet Bill lands on the start when bought, then charges one tile at the start of each round. */
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
  // Nobody Mi-vu, Mi-vue hides is chased either.
  // Nor anybody it has no road to: on the Archipel the tide of the new round may cut the board in two.
  const tideBoard = getOpenBoard({ ...previous, round: next.round });
  const reachable = previous.players.some(
    (player) =>
      player.position !== HELL_NODE_ID &&
      !isImmuneToItems(player) &&
      !isInvisible(previous, player) &&
      (bullet === null || getShortestPath(tideBoard, bullet.position, player.position, true) !== null),
  );
  if (next.round > previous.round && due && reachable && !flew) {
    found.push(violation("bullet-charges", `Bullet Bill stayed put at the start of round ${next.round}`));
  }
  if (!flew || !flight) return;

  // When every seat skips, several rounds start within one action and Bullet Bill charges at each of
  // them: only the first charge leaves from where it stood before the action.
  const charges = flight.seq - (previous.lastBulletFlight?.seq ?? 0);
  if (!bullet || (charges === 1 && flight.from !== bullet.position)) {
    found.push(violation("bullet-flight-start", `Bullet Bill took off from ${flight.from}`));
  }
  if (flight.path.length > BULLET_BILL_CHARGE_STEPS) {
    found.push(violation("bullet-range", `Bullet Bill flew ${flight.path.length} tiles`));
  }
  const board = getOpenBoard(previous);
  let landing = flight.from;
  for (const step of flight.path) {
    if (!getNeighbors(board, landing, true).includes(step)) {
      found.push(violation("bullet-follows-roads", `Bullet Bill flew ${landing} → ${step} off the roads`));
    }
    landing = step;
  }

  // Non merci: its victim cancelled the hit; it fizzles out on their tile.
  if (flight.dodgedBy) {
    const dodger = findPlayer(next, flight.dodgedBy);
    const answered = previous.pendingReaction?.action.type === "bullet-bill";
    // Banquise: the blizzard of the round that starts may carry the dodger away, or their own turn may begin
    // with them breaking out of fallen ice onto the tile they were sliding to.
    const thawed =
      previous.frozenSlides.some((slide) => slide.playerId === flight.dodgedBy) &&
      !next.frozenSlides.some((slide) => slide.playerId === flight.dodgedBy);
    const carried = slidOnIce(previous, next, flight.dodgedBy) || thawed;
    const onLanding = dodger?.position === landing || carried;
    if (next.bulletBill !== null || !answered || !onLanding || flight.victimId !== null) {
      found.push(violation("bullet-dodge", `Bullet Bill was dodged by ${flight.dodgedBy} without fizzling out`));
    }
    return;
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
  // Knocked out on le diable's tile, the victim may go straight to Hell through their Toucher d'Enfer.
  const touched = logs.some((text) => text.includes("Toucher d’Enfer")) && after.position === HELL_NODE_ID;
  // Banquise: the blizzard may freeze the victim's tile as the round begins, and the ice carry them away.
  // Banquise: the ice may carry the victim away (blizzard) or, held in it, they break free as their turn begins.
  const thawedVictim = next.lastMovement?.thawed === true && next.lastMovement.playerId === before.id;
  if (after.position !== landing && !touched && !slidOnIce(previous, next, before.id) && !thawedVictim) {
    found.push(violation("bullet-hits-target", `${before.name} was hit from afar`));
  }
  // Whoever just served their Hell sentence lands on the start, paying the toll, right before the charge.
  const releasedFromHell = logs.some((text) => text.startsWith(`${before.name} a purgé`));
  // Banquise: a thaw as the next turn begins may land the victim on a coloured tile, or pick up a
  // Red Cup whose Goblin then steals from the table.
  const thawed = next.lastMovement?.thawed === true && next.lastMovement.seq !== previous.lastMovement?.seq;
  // The last wheel of a Tour de Bénédiction pays out in the same action that opens the charging round.
  const wheelPaidToo = previous.pendingWheel !== null;
  // Sent to Hell by Toucher d'Enfer, the victim may find the Black Cup there, and Goblins steal at the new Cup.
  const cupFound = next.redCupCycle !== previous.redCupCycle;
  if (
    !releasedFromHell &&
    !thawed &&
    !wheelPaidToo &&
    !cupFound &&
    // Le diable, hit by the blast, may send a bystander of it to Hell: the 50 coins of that fall are his.
    !balanceMatches(before, -BULLET_BILL_DAMAGE, after.currency, hellRewardCoins(logs, before.name))
  ) {
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
  // Online, forfeits wait for the table to rest: two players out of chances may leave together.
  const logs = newLogTexts(previous, next);
  const forfeits = gone.filter((player) => logs.includes(`${player.name} déclare forfait : trois tours sans jouer.`));
  // A Mage noir out of chances leaves as the table comes to rest, which may be the same moment as a forfeit.
  const fallenMages = gone.filter((player) =>
    logs.some((text) => text.startsWith(`${player.name} n’a plus aucune chance`)),
  );
  if (gone.length > 1 && forfeits.length + fallenMages.length === gone.length) return;
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
  // L'Ange-Gardien takes the place of a protégé who leaves, in Hell: what arriving there sets off (a duel,
  // the Black Cup and the next Cup's choices, their own turn going on from Hell) changes the stage.
  const heirDuel = previous.guardian?.protegeId === leaver.id;
  // Online, a forfeit is settled once the table is at rest, right after the action that got it there.
  const forfeit = newLogTexts(previous, next).some((text) => text.startsWith(`${leaver.name} déclare forfait`));
  if (forfeit) return;
  // A Mage noir who spent their last chance in an answer (to an item, to a wheel) leaves as the table comes to rest.
  const fallen = newLogTexts(previous, next).some((text) => text.startsWith(`${leaver.name} n’a plus aucune chance`));
  if (fallen) return;
  if (previousActive.id !== leaver.id) {
    if (nextActive?.id !== previousActive.id || (next.turnStage !== previous.turnStage && !heirDuel)) {
      found.push(violation("abandon-keeps-turn", `${leaver.name} leaving interrupted ${previousActive.name}'s turn`));
    }
  } else if (
    next.phase !== "finished" &&
    !["move", "hell"].includes(next.turnStage) &&
    !next.lastMovement?.thawed &&
    !next.pendingDuel?.ghost &&
    !next.pendingDuelChoice?.ghost &&
    !heirDuel &&
    next.pendingReaction?.action.type !== "bullet-bill"
  ) {
    // The next player's turn opens with their thaw at Banquise, which may owe a wheel first,
    // or with the Luna Park ghost riding onto somebody; or the turn change waits for Non merci on Bullet Bill.
    found.push(violation("abandon-passes-turn", `after ${leaver.name} left the stage is ${next.turnStage}`));
  }
}

/** Somebody else stepping in your mud pays you; your own mud pays nobody. */
export function checkMudReward(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const triggered = previous.mudTraps.filter((trap) => !next.mudTraps.some((candidate) => candidate.id === trap.id));
  if (triggered.length === 0) return;

  const logs = newLogTexts(previous, next);
  // Walked into or sent there by a wheel: whoever the log shows falling in, not only the last walker.
  const victimId = previous.players.find((player) => logs.includes(`${player.name} tombe dans la Boue.`))?.id;
  // Chance aveugle slips in it instead: nobody pays, nobody earns.
  const slipped = previous.players.some((player) =>
    logs.some((text) => text.startsWith(`${player.name} glisse dans la Boue`)),
  );
  for (const trap of triggered) {
    const owner = findPlayer(previous, trap.ownerId);
    if (!owner) continue;
    const paid = logs.includes(`${owner.name} touche ${getMudOwnerReward(owner)} pièces grâce à sa Boue.`);
    if (slipped && !victimId) {
      if (paid) found.push(violation("mud-blind-luck", `${owner.name} was paid for Chance aveugle's slip`));
      continue;
    }
    if (owner.id !== victimId && !paid) found.push(violation("mud-pays-owner", `${owner.name} got nothing`));
    if (owner.id === victimId && paid) found.push(violation("mud-own-trap", `${owner.name} was paid by their own mud`));
  }
}
