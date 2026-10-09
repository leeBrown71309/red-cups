import { getBoard } from "../board";
import { hasCard, ownsCard } from "../cards";
import { getMimeTargets, getCopyableCard } from "../mime";
import { getCrossingEnergy, getVisitedNodeIds } from "../mole";
import { getLuck } from "../mage-luck";
import { isInvisible } from "../mist";
import { getSisterNode, mirrorWalk } from "../sister";
import { isHermitPrimeActive } from "../passive-rules";
import { findPlayer, getActivePlayer } from "../state-utils";
import type { GameState, PlayerId } from "../types";
import {
  HELL_NODE_ID,
  HERMIT_START_BONUS,
  INSURER_ROUND_CAP,
  MAGE_MAX_LUCK,
  MIME_COOLDOWN_ROUNDS,
  MOLE_COOLDOWN_ROUNDS,
  MOLE_DIG_ENERGY,
  SISTER_SWAP_ENERGY,
} from "../types";
import { newLogTexts, newPowerEvent, violation, type RuleViolation } from "./invariant-helpers";

/**
 * Checks for the Cups Power and passifs of patch 0.2.3: Mime, Taupe, Mage noir, Mi-vu, Mi-vue, Sœur Fantôme, L'Ermite
 * and L'Assureur. The state checks hold in any state; the transition checks read the deed an action recorded.
 */

export function checkCupPowerState(state: GameState, found: RuleViolation[]): void {
  if (state.phase !== "playing") return;
  const board = getBoard(state);
  const walkable = board.normalNodeIds;
  const active = getActivePlayer(state);

  const tunnelEnds = new Set<number>();
  for (const tunnel of state.moleTunnels) {
    if (!walkable.includes(tunnel.a) || !walkable.includes(tunnel.b) || tunnel.a === tunnel.b) {
      found.push(violation("tunnel-ends", `a tunnel links ${tunnel.a} and ${tunnel.b}`));
    }
    if (tunnel.crossingsLeft < 1) found.push(violation("tunnel-spent", "a tunnel that was crossed is still open"));
    for (const end of [tunnel.a, tunnel.b]) {
      if (tunnelEnds.has(end)) found.push(violation("tunnel-shared-end", `two tunnels open on tile ${end}`));
      tunnelEnds.add(end);
    }
  }

  const markOwners = new Set<PlayerId>();
  for (const mark of state.blackMarks) {
    const owner = findPlayer(state, mark.ownerId);
    if (!owner || !ownsCard(owner, "black-mage")) found.push(violation("mark-owner", `a mark of ${mark.ownerId}`));
    if (markOwners.has(mark.ownerId)) found.push(violation("mark-single", `${owner?.name} has two marks`));
    markOwners.add(mark.ownerId);
    if (!walkable.includes(mark.nodeId)) found.push(violation("mark-tile", `a mark on tile ${mark.nodeId}`));
  }

  for (const player of state.players) {
    if (ownsCard(player, "black-mage")) {
      const luck = getLuck(player);
      if (luck < 0 || luck > MAGE_MAX_LUCK) found.push(violation("mage-luck", `${player.name} has ${luck} chances`));
    }
    if (ownsCard(player, "ghost-sister")) {
      const sister = getSisterNode(player);
      if (!walkable.includes(sister))
        found.push(violation("sister-tile", `${player.name}'s sister is on tile ${sister}`));
    }
    if (player.mimicId) {
      const copyable = getCopyableCard({ passiveId: player.mimicId }) !== null;
      if (!ownsCard(player, "mime") || player.id !== active?.id || !copyable) {
        found.push(violation("mime-copy-state", `${player.name} holds the copy of ${player.mimicId} out of turn`));
      }
    }
    if (ownsCard(player, "mole") || ownsCard(player, "mime")) {
      const visited = getVisitedNodeIds(player);
      if (visited.some((nodeId) => !walkable.includes(nodeId)) || new Set(visited).size !== visited.length) {
        found.push(violation("visited-tiles", `${player.name} visited ${visited.join(",")}`));
      }
      // The list is written as the first action goes through: a card handed out afterwards has none yet.
      if (player.visitedNodeIds && player.position !== HELL_NODE_ID && !visited.includes(player.position)) {
        found.push(violation("visited-position", `${player.name} stands on ${player.position}, never visited`));
      }
    }
    if (player.insurerEarned && player.insurerEarned.amount > INSURER_ROUND_CAP) {
      found.push(violation("insurer-cap", `${player.name} earned ${player.insurerEarned.amount} from losses`));
    }
  }
}

export function checkCupPowerTransition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const event = newPowerEvent(previous, next);
  if (event) checkPowerEvent(previous, next, event, found);
  checkSisterWalk(previous, next, found);
  checkInvisibility(previous, next, found);
}

/** The bank's coins and Hell's reward are paid on top: L'Assureur never holds more than the round's cap from losses. */
export function getHermitStartBonus(state: GameState, playerId: PlayerId): number {
  const player = findPlayer(state, playerId);
  return player && isHermitPrimeActive(state, player) ? HERMIT_START_BONUS : 0;
}

function checkPowerEvent(
  previous: GameState,
  next: GameState,
  event: NonNullable<GameState["lastPowerEvent"]>,
  found: RuleViolation[],
): void {
  const before = findPlayer(previous, event.playerId);
  const after = findPlayer(next, event.playerId);
  if (!before) return;

  switch (event.kind) {
    case "mime-copy": {
      const targets = getMimeTargets(previous, before).map((player) => player.id);
      if (!targets.includes(event.targetId) || previous.round < (before.mimeReadyRound ?? 0)) {
        found.push(violation("mime-copy", `${before.name} copied ${event.targetId} out of the rules`));
      }
      if (after?.mimeReadyRound !== previous.round + MIME_COOLDOWN_ROUNDS || after.mimicId !== event.cardId) {
        found.push(violation("mime-cooldown", `${before.name}'s copy did not set its cooldown`));
      }
      if (hasCard(after, event.cardId) !== true || previous.turnActionTaken !== next.turnActionTaken) {
        found.push(violation("mime-free", `${before.name}'s copy cost an action`));
      }
      break;
    }
    case "tunnel-dig": {
      const visited = getVisitedNodeIds(before);
      if (
        !hasCard(before, "mole") ||
        previous.energyLeft < MOLE_DIG_ENERGY ||
        previous.round < (before.moleReadyRound ?? 0) ||
        !visited.includes(event.to)
      ) {
        found.push(violation("tunnel-dig", `${before.name} dug ${event.from} → ${event.to} out of the rules`));
      }
      for (const nodeId of [event.from, event.to]) {
        const trapped =
          previous.mudTraps.some((trap) => trap.nodeId === nodeId) ||
          previous.hellPortals.some((portal) => portal.nodeId === nodeId);
        if (
          previous.redCupNodeId === nodeId ||
          trapped ||
          previous.moleTunnels.some((t) => t.a === nodeId || t.b === nodeId)
        ) {
          found.push(
            violation("tunnel-dig-end", `a tunnel was dug on tile ${nodeId}, which holds a Cup, a trap or a tunnel`),
          );
        }
      }
      if (!next.moleTunnels.some((tunnel) => tunnel.id === event.tunnelId)) {
        found.push(violation("tunnel-open", `the tunnel ${event.from} ↔ ${event.to} is not open`));
      }
      if (after?.moleReadyRound !== previous.round + MOLE_COOLDOWN_ROUNDS) {
        found.push(violation("mole-cooldown", `${before.name} may dig again too soon`));
      }
      break;
    }
    case "tunnel-cross": {
      const tunnel = previous.moleTunnels.find((candidate) => candidate.id === event.tunnelId);
      if (
        !tunnel ||
        (tunnel.a !== event.from && tunnel.b !== event.from) ||
        previous.energyLeft < getCrossingEnergy(tunnel, before)
      ) {
        found.push(violation("tunnel-cross", `${before.name} crossed ${event.from} → ${event.to} out of the rules`));
      }
      if (next.moleTunnels.some((candidate) => candidate.id === event.tunnelId)) {
        found.push(violation("tunnel-closes", "a tunnel stayed open after being crossed"));
      }
      break;
    }
    case "mark-place": {
      if (previous.blackMarks.some((mark) => mark.ownerId === event.playerId) || before.position !== event.nodeId) {
        found.push(violation("mark-place", `${before.name} laid a second mark, or away from their tile`));
      }
      if (previous.mudTraps.some((trap) => trap.nodeId === event.nodeId) || before.position === HELL_NODE_ID) {
        found.push(violation("mark-place-tile", `${before.name} laid a mark on mud or in Hell`));
      }
      break;
    }
    case "mark-teleport": {
      const mark = previous.blackMarks.find((entry) => entry.ownerId === event.playerId);
      if (!mark || mark.nodeId !== event.to || getLuck(before) < 1) {
        found.push(violation("mark-teleport", `${before.name} teleported without a mark or a chance`));
      }
      // A chance may come back in the very action that spends one: the round turns on a Bullet Bill dodge.
      const regained = newLogTexts(previous, next).some((text) => text.includes("regagne une chance"));
      if (after && getLuck(after) !== getLuck(before) - 1 + (regained ? 1 : 0)) {
        found.push(
          violation("mage-luck-spent", `${before.name}'s chances went ${getLuck(before)} → ${getLuck(after)}`),
        );
      }
      const stillMarked = next.blackMarks.some((entry) => entry.ownerId === event.playerId);
      if (stillMarked !== event.kept)
        found.push(violation("mark-kept", `the mark of ${before.name} ${stillMarked ? "stayed" : "went"}`));
      for (const victimId of event.victimIds) {
        const victim = findPlayer(previous, victimId);
        if (victim?.position !== event.to || findPlayer(next, victimId)?.position !== HELL_NODE_ID) {
          found.push(violation("mark-victim", `${victimId} fell through a mark they did not stand on`));
        }
      }
      break;
    }
    case "sister-swap": {
      const sister = getSisterNode(before);
      if (
        !hasCard(before, "ghost-sister") ||
        event.playerFrom !== before.position ||
        event.sisterFrom !== sister ||
        previous.energyLeft < SISTER_SWAP_ENERGY ||
        previous.round < (before.swapReadyRound ?? 0) ||
        before.position === HELL_NODE_ID
      ) {
        found.push(violation("sister-swap", `${before.name} swapped out of the rules`));
      }
      if (after && getSisterNode(after) !== event.playerFrom) {
        found.push(violation("sister-swap-place", `the sister of ${before.name} did not take their old tile`));
      }
      break;
    }
  }
}

/** Sœur Fantôme: the sister's steps follow the mirror rule exactly, and stay put whenever the player was set down. */
function checkSisterWalk(previous: GameState, next: GameState, found: RuleViolation[]): void {
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before || !ownsCard(player, "ghost-sister")) continue;
    const walk = next.lastMovement;
    const walked = walk !== null && walk.seq !== previous.lastMovement?.seq && walk.playerId === player.id;
    const mirrored =
      walked && !walk.flungByGhost && !walk.tunnel && !walk.thawed
        ? (mirrorWalk(getBoard(previous), getSisterNode(before), walk.from, walk.path).at(-1) ?? getSisterNode(before))
        : null;
    const event = newPowerEvent(previous, next);
    // A mage leaving in the same action overwrites the record of the swap: only the position is then checked.
    const swapped = event?.kind === "sister-swap" && event.playerId === player.id;
    const fell = player.position === HELL_NODE_ID && before.position !== HELL_NODE_ID;
    if (swapped) continue;
    const expected = fell ? 0 : (mirrored ?? getSisterNode(before));
    if (getSisterNode(player) !== expected) {
      found.push(
        violation("sister-follows", `${player.name}'s sister went to ${getSisterNode(player)}, not ${expected}`),
      );
    }
  }
}

/** Mi-vu, Mi-vue: nobody aims at the player in the dark, and Bullet Bill does not chase them. */
function checkInvisibility(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const flight = next.lastBulletFlight;
  if (flight && flight.seq !== previous.lastBulletFlight?.seq) {
    const target = findPlayer(previous, flight.targetId);
    // Read where the target stood when the charge went off: a release from Hell next to the Red Cup shows them again.
    const where = findPlayer(next, flight.targetId)?.position ?? target?.position;
    // Hidden both where they stood before the action and where it left them: a release from Hell next to the Red
    // Cup (or a fall into Hell after the hit) changes what the charge could see.
    if (
      target &&
      where !== undefined &&
      isInvisible(previous, target) &&
      isInvisible(next, { ...target, position: where })
    ) {
      found.push(violation("invisible-chased", `Bullet Bill chased ${target.name}, who was invisible`));
    }
  }
}
