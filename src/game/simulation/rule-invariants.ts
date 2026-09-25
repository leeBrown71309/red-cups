import { NORMAL_NODE_IDS, earnsStartBonus, getNeighbors } from "../board";
import { ITEM_ORDER } from "../catalog";
import { countItemCopies, countRedCups, getInventoryCapacity, getTileWheel, isShopNode } from "../rules";
import { findPlayer, getActivePlayer } from "../state-utils";
import type { GameState, ItemId, Player, PlayerId, TurnStage } from "../types";
import { CURRENCY_RESET_THRESHOLD, HELL_NODE_ID, HELL_TURN_LIMIT, RED_CUP_GOAL, START_NODE_ID } from "../types";

/**
 * Rule checks run by the bots after every single action. Each violation names
 * the rule it breaks, so a failing campaign reads like a bug report.
 */

export interface RuleViolation {
  rule: string;
  message: string;
}

const STAGES_WITH_PENDING: Partial<Record<TurnStage, keyof GameState>> = {
  "wheel-result": "pendingWheel",
  duel: "pendingDuel",
  discard: "pendingDiscard",
  target: "pendingChallenge",
  "passive-choice": "pendingCalmDown",
  reposition: "pendingCupRepositionPlayerId",
  reaction: "pendingReaction",
};

/** Stages where the table is "at rest": no effect is half-resolved. */
const RESTING_STAGES: TurnStage[] = ["move", "hell", "shop", "tile-wheel", "turn-end"];

const ALL_NODE_IDS = [...NORMAL_NODE_IDS, HELL_NODE_ID];

function violation(rule: string, message: string): RuleViolation {
  return { rule, message };
}

function checkPlayer(state: GameState, player: Player): RuleViolation[] {
  const found: RuleViolation[] = [];
  const name = player.name;

  if (!ALL_NODE_IDS.includes(player.position)) {
    found.push(violation("position-valid", `${name} is on unknown tile ${player.position}`));
  }
  if (player.inventory.length > getInventoryCapacity(player)) {
    found.push(violation("bag-capacity", `${name} carries ${player.inventory.length} entries`));
  }
  if (countRedCups(player) > RED_CUP_GOAL) {
    found.push(violation("cup-limit", `${name} holds ${countRedCups(player)} Red Cups`));
  }
  for (const itemId of ITEM_ORDER) {
    const copies = countItemCopies(player, itemId);
    if (copies > 2) found.push(violation("no-third-copy", `${name} has ${copies} × ${itemId}`));
    if (itemId === "eraser" && copies > 1) found.push(violation("single-eraser", `${name} has ${copies} Gommes`));
    if (itemId === "bullet-bill" && copies > 0) {
      found.push(violation("bullet-not-owned", `${name} keeps Bullet Bill in the bag`));
    }
  }
  if (player.currency <= CURRENCY_RESET_THRESHOLD) {
    found.push(violation("negative-reset", `${name} sits at ${player.currency} coins`));
  }
  if (!Number.isInteger(player.skippedTurns) || player.skippedTurns < 0) {
    found.push(violation("skipped-turns", `${name} has skippedTurns = ${player.skippedTurns}`));
  }
  if (state.phase === "playing" && player.passiveId === undefined) {
    found.push(violation("passive-assigned", `${name} has no passive`));
  }
  return found;
}

/** Checks that must hold in any state, whatever happened before. */
export function checkState(state: GameState): RuleViolation[] {
  if (state.phase === "setup") return [];
  const found = state.players.flatMap((player) => checkPlayer(state, player));
  const active = getActivePlayer(state);

  if (!active) found.push(violation("active-player", `activePlayerIndex ${state.activePlayerIndex} is out of range`));
  if (new Set(state.players.map((player) => player.id)).size !== state.players.length) {
    found.push(violation("unique-players", "two players share an id"));
  }

  for (const [stage, key] of Object.entries(STAGES_WITH_PENDING) as [TurnStage, keyof GameState][]) {
    const hasPending = state[key] !== null && state[key] !== undefined;
    if ((state.turnStage === stage) !== hasPending) {
      found.push(violation("stage-matches-pending", `stage ${state.turnStage} but ${key} is ${String(hasPending)}`));
    }
  }

  if (active && state.phase === "playing") {
    const inHell = active.position === HELL_NODE_ID;
    if (state.turnStage === "hell" && !inHell) found.push(violation("hell-stage", `${active.name} is not in Hell`));
    if (state.turnStage === "move" && inHell) found.push(violation("move-stage", `${active.name} walks from Hell`));
    if (state.turnStage === "shop" && !isShopNode(active.position)) {
      found.push(violation("shop-stage", `${active.name} shops on tile ${active.position}`));
    }
    const nextWheel = state.pendingTileWheels[0];
    if (state.turnStage === "tile-wheel" && (!nextWheel || getTileWheel(nextWheel.nodeId) === null)) {
      found.push(violation("tile-wheel-stage", "tile-wheel stage without a green or red tile to spin"));
    }
    if (RESTING_STAGES.includes(state.turnStage) && state.turnStage !== "tile-wheel") {
      if (state.pendingTileWheels.length > 0) {
        found.push(violation("lost-tile-wheel", `${state.pendingTileWheels.length} tile wheel(s) never spun`));
      }
    }
    if (state.turnStage === "hell" && (active.hellTurns < 1 || active.hellTurns > HELL_TURN_LIMIT)) {
      found.push(violation("hell-countdown", `${active.name} plays Hell turn ${active.hellTurns}/${HELL_TURN_LIMIT}`));
    }
    if (active.skippedTurns > 0 && ["move", "hell"].includes(state.turnStage) && !state.turnActionTaken) {
      found.push(violation("skipped-player-plays", `${active.name} plays despite a skipped turn`));
    }
  }

  for (const player of state.players) {
    if (player.position === HELL_NODE_ID && player.hellTurns > HELL_TURN_LIMIT) {
      found.push(violation("hell-overstay", `${player.name} spent ${player.hellTurns} turns in Hell`));
    }
  }

  const hellCount = state.players.filter((player) => player.position === HELL_NODE_ID).length;
  if (state.phase === "playing" && RESTING_STAGES.includes(state.turnStage) && hellCount > 1) {
    found.push(violation("one-soul-in-hell", `${hellCount} players rest in Hell without a duel`));
  }

  if (state.redCupNodeId !== null) {
    if (state.redCupNodeId === START_NODE_ID || state.redCupNodeId === HELL_NODE_ID) {
      found.push(violation("cup-tile", `Red Cup on forbidden tile ${state.redCupNodeId}`));
    }
    if (state.redCupCycle > 0 && state.redCupNodeId === state.previousRedCupNodeId) {
      found.push(violation("cup-moves-on", `Red Cup reappeared on tile ${state.redCupNodeId}`));
    }
  } else if (state.phase === "playing" && state.pendingCupRevealNodeId === null) {
    found.push(violation("cup-exists", "no Red Cup on the board during play"));
  }

  const champions = state.players.filter((player) => countRedCups(player) >= RED_CUP_GOAL);
  if (champions.length > 0 && (state.phase !== "finished" || state.winnerId !== champions[0].id)) {
    found.push(violation("instant-victory", `${champions[0].name} has 3 Cups but the game goes on`));
  }
  if (state.phase === "finished" && champions.length === 0) {
    found.push(violation("victory-needs-cups", "the game ended without a 3-Cup winner"));
  }

  if (state.bootPrice < 100 || state.bootPrice > 500 || state.bootPrice % 50 !== 0) {
    found.push(violation("boot-price", `boot costs ${state.bootPrice}`));
  }
  if (state.mudTraps.some((trap) => !NORMAL_NODE_IDS.includes(trap.nodeId))) {
    found.push(violation("mud-tile", "mud lies outside the walkable tiles"));
  }

  if (state.pendingReaction) {
    for (const reactorId of state.pendingReaction.reactorIds) {
      const reactor = findPlayer(state, reactorId);
      if (!reactor || reactor.passiveId !== "no-thanks") {
        found.push(violation("reactor-has-passive", `${reactor?.name ?? reactorId} is offered Non merci`));
      } else if (reactor.id === state.pendingReaction.actorId) {
        found.push(violation("no-self-reaction", `${reactor.name} may cancel their own action`));
      } else if (reactor.noThanksUsedCycle === state.redCupCycle) {
        found.push(violation("no-thanks-once-per-cycle", `${reactor.name} is offered Non merci twice this cycle`));
      }
    }
  }

  return found;
}

function newLogTexts(previous: GameState, next: GameState): string[] {
  const texts: string[] = [];
  for (const entry of next.log) {
    if (entry.id === previous.log[0]?.id) break;
    texts.push(entry.text);
  }
  return texts;
}

/** Expected balance after a single coin change, including the Casque and the −300 reset. */
function expectedBalance(player: Player, delta: number): number {
  let balance = player.currency + delta;
  const hasHelmet = player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "helmet");
  if (delta < 0 && balance < 0 && hasHelmet) balance = 0;
  if (balance <= CURRENCY_RESET_THRESHOLD) balance = 0;
  return balance;
}

function checkMovement(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const movement = next.lastMovement;
  if (!movement || movement.seq === previous.lastMovement?.seq) return;

  const mover = findPlayer(previous, movement.playerId);
  const moved = findPlayer(next, movement.playerId);
  if (!mover || !moved) return;
  const logs = newLogTexts(previous, next);

  if (movement.from !== mover.position) {
    found.push(violation("move-from-position", `${mover.name} left ${movement.from} but stood on ${mover.position}`));
  }
  if (movement.path.length !== previous.moveDistance) {
    found.push(violation("move-distance", `${mover.name} walked ${movement.path.length} tiles`));
  }

  const rebel = logs.some((text) => text.includes("Délinquant"));
  let from = movement.from;
  for (const step of movement.path) {
    const allowed = getNeighbors(from, rebel && mover.passiveId === "delinquent");
    if (!allowed.includes(step)) {
      found.push(violation("move-follows-roads", `${mover.name} went ${from} → ${step} against the board`));
    }
    from = step;
  }

  const destination = movement.path[movement.path.length - 1];
  if (moved.position !== destination) {
    found.push(violation("move-lands", `${mover.name} should stand on ${destination}, not ${moved.position}`));
  }

  const passedStart = earnsStartBonus(movement.from, movement.path);
  const gotBonus = logs.some((text) => text.includes("passe par le départ"));
  if (passedStart && mover.passiveId !== "im-cups" && !gotBonus) {
    found.push(violation("start-bonus", `${mover.name} crossed the start without the 200 coins`));
  }
  if (gotBonus && (!passedStart || mover.passiveId === "im-cups")) {
    found.push(violation("start-bonus-undue", `${mover.name} got the start bonus without earning it`));
  }

  const interrupted = ["discard", "reposition", "passive-choice", "duel", "finished"].includes(next.turnStage);
  if (!interrupted) {
    const expected: TurnStage = isShopNode(destination)
      ? "shop"
      : getTileWheel(destination)
        ? "tile-wheel"
        : "turn-end";
    if (next.turnStage !== expected) {
      found.push(violation("arrival-stage", `landing on ${destination} led to ${next.turnStage}, not ${expected}`));
    }
  }
}

function checkWheelResolution(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const wheel = previous.pendingWheel;
  if (!wheel || next.pendingWheel?.id === wheel.id || previous.turnStage !== "wheel-result") return;
  if (newLogTexts(previous, next).some((text) => text.includes("Gomme"))) return;

  const before = findPlayer(previous, wheel.playerId);
  const after = findPlayer(next, wheel.playerId);
  if (!before || !after) return;
  const amount = wheel.result.amount ?? 0;
  const moneyOutcomes: Record<string, number> = {
    "lose-100": -amount,
    "lose-200": -amount,
    "lose-400": -amount,
    "gain-100": amount,
    "gain-200": amount,
    "gain-300": amount,
    "gain-400": amount,
    "gain-500": amount,
  };
  const delta = moneyOutcomes[wheel.result.id];
  if (delta !== undefined && after.currency !== expectedBalance(before, delta)) {
    found.push(
      violation("wheel-money", `${before.name}: ${wheel.result.id} took ${before.currency} to ${after.currency}`),
    );
  }
  if (wheel.result.id === "go-to-hell" && after.position !== HELL_NODE_ID) {
    found.push(violation("wheel-hell", `${before.name} dodged the trip to Hell`));
  }
  if (["skip-turn", "hell-skip"].includes(wheel.result.id) && after.skippedTurns !== before.skippedTurns + 1) {
    found.push(violation("wheel-skip", `${before.name} did not get a skipped turn`));
  }
  if (wheel.result.id === "escape" && before.position === HELL_NODE_ID && after.position !== START_NODE_ID) {
    found.push(violation("wheel-escape", `${before.name} escaped Hell to tile ${after.position} instead of 0`));
  }
}

function checkTileWheelSpin(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (previous.turnStage === "tile-wheel" && next.pendingWheel) {
    const spinner = findPlayer(previous, next.pendingWheel.playerId);
    const expected = spinner ? getTileWheel(spinner.position) : null;
    if (next.pendingWheel.wheelId !== expected) {
      found.push(
        violation("tile-wheel-color", `tile ${spinner?.position} spun the ${next.pendingWheel.wheelId} wheel`),
      );
    }
  }

  // Walking, being pulled, swapped or teleported: landing on green or red always owes a wheel.
  if (next.phase !== "playing") return;
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before || before.position === player.position || getTileWheel(player.position) === null) continue;
    const queued = next.pendingTileWheels.some(
      (entry) => entry.playerId === player.id && entry.nodeId === player.position,
    );
    if (!queued)
      found.push(violation("arrival-wheel", `${player.name} reached tile ${player.position} without a wheel`));
  }
}

function checkTurnChange(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const changed = previous.activePlayerIndex !== next.activePlayerIndex || previous.round !== next.round;
  if (!changed || !["move", "hell"].includes(next.turnStage)) return;

  const logs = newLogTexts(previous, next);
  const count = previous.players.length;
  let index = (previous.activePlayerIndex + 1) % count;
  let guard = 0;
  while (index !== next.activePlayerIndex && guard < count) {
    const before = previous.players[index];
    // Bullet Bill moves at the end of the round and may stun a player right before their turn.
    const stunnedNow = logs.some((text) => text.includes(`Bullet Bill percute ${before.name}`));
    const announced = logs.includes(`${before.name} passe son tour.`);
    if (!announced || (before.skippedTurns < 1 && !stunnedNow)) {
      found.push(violation("turn-order", `${before.name} was skipped without a skipped turn to consume`));
    }
    index = (index + 1) % count;
    guard += 1;
  }
}

function checkNoThanksUsage(previous: GameState, next: GameState, found: RuleViolation[]): void {
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before || before.noThanksUsedCycle === player.noThanksUsedCycle) continue;
    const pending = previous.pendingReaction;
    const legal =
      previous.turnStage === "reaction" &&
      pending !== null &&
      pending.reactorIds.includes(player.id) &&
      pending.actorId !== player.id &&
      player.passiveId === "no-thanks" &&
      before.noThanksUsedCycle !== previous.redCupCycle &&
      player.noThanksUsedCycle === previous.redCupCycle;
    if (!legal) found.push(violation("no-thanks-usage", `${player.name} spent Non merci illegally`));
  }

  const pending = previous.pendingReaction;
  const actorBefore = findPlayer(previous, pending?.actorId);
  const actorAfter = findPlayer(next, pending?.actorId);
  const cancelled = newLogTexts(previous, next).some((text) => text.includes("utilise Non merci"));
  if (pending && cancelled && actorBefore && actorAfter) {
    if (actorAfter.position !== actorBefore.position) {
      found.push(violation("no-thanks-cancels", `${actorBefore.name} still moved after Non merci`));
    }
    if (next.turnStage !== "turn-end") {
      found.push(violation("no-thanks-ends-action", `after Non merci the stage is ${next.turnStage}`));
    }
  }
}

function checkCupRelocation(previous: GameState, next: GameState, found: RuleViolation[]): void {
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before) continue;
    if (countRedCups(player) < countRedCups(before)) {
      found.push(violation("cups-are-kept", `${player.name} lost a Red Cup`));
    }
    if (countRedCups(player) > countRedCups(before) && next.phase === "playing") {
      const spot = next.redCupNodeId ?? next.pendingCupRevealNodeId;
      if (spot === previous.redCupNodeId || spot === START_NODE_ID) {
        found.push(violation("cup-respawn", `new Red Cup appeared on tile ${spot}`));
      }
    }
  }
}

/** Item use the checker should verify, when the runner knows which item was applied. */
export interface AppliedItem {
  itemId: ItemId;
  userId: PlayerId;
  targetPlayerId?: PlayerId;
}

function checkItemEffect(previous: GameState, next: GameState, item: AppliedItem, found: RuleViolation[]): void {
  if (next.turnStage === "reaction") return;
  const user = findPlayer(previous, item.userId);
  const userAfter = findPlayer(next, item.userId);
  const target = findPlayer(previous, item.targetPlayerId);
  const targetAfter = findPlayer(next, item.targetPlayerId);
  if (!user || !userAfter) return;
  const label = `${user.name} used ${item.itemId}`;

  const copiesItBack = user.passiveId === "i-take-notes" && target?.id === user.id;
  if (!copiesItBack && countItemCopies(userAfter, item.itemId) !== countItemCopies(user, item.itemId) - 1) {
    found.push(violation("item-consumed", `${label} but the bag did not lose it`));
  }

  const tank = target?.passiveId === "built-like-a-tank";
  switch (item.itemId) {
    case "hollow-purple":
      if (targetAfter?.position !== HELL_NODE_ID)
        found.push(violation("hollow-purple", `${label}: target not in Hell`));
      break;
    case "middle-finger":
      if (target && targetAfter && targetAfter.skippedTurns !== target.skippedTurns + 1) {
        found.push(violation("middle-finger", `${label}: target keeps its next turn`));
      }
      break;
    case "rope":
      if (target && targetAfter && !tank && targetAfter.position !== user.position) {
        found.push(violation("rope", `${label}: target ended on ${targetAfter.position}, not ${user.position}`));
      }
      break;
    case "monopoly-man":
      if (target && targetAfter && !tank) {
        if (userAfter.position !== target.position || targetAfter.position !== user.position) {
          found.push(violation("monopoly-man", `${label}: positions were not swapped`));
        }
      } else if (target && targetAfter && tank && targetAfter.position !== target.position) {
        found.push(violation("monopoly-man-tank", `${label}: Baraqué was moved anyway`));
      }
      break;
    case "draven":
      if (next.players.some((player) => player.position !== HELL_NODE_ID)) {
        found.push(violation("draven", `${label}: someone escaped the trip to Hell`));
      }
      for (const player of next.players) {
        const before = findPlayer(previous, player.id);
        if (
          before &&
          countItemCopies(player, "draven") > countItemCopies(before, "draven") - (player.id === user.id ? 1 : 0)
        ) {
          found.push(violation("draven-no-copy", `${player.name} got a Draven copy through Je note`));
        }
      }
      break;
    case "mud":
      if (!next.mudTraps.some((trap) => trap.nodeId === user.position && trap.ownerId === user.id)) {
        found.push(violation("mud", `${label}: no mud on tile ${user.position}`));
      }
      break;
    case "water-bottle":
      if (userAfter.position === HELL_NODE_ID) found.push(violation("water-bottle", `${label}: still in Hell`));
      break;
    case "ndoye":
      if (next.pendingWheel?.wheelId !== "misfortune" || next.pendingWheel.playerId !== item.targetPlayerId) {
        found.push(violation("ndoye", `${label}: no wheel of misfortune for the target`));
      }
      break;
    default:
      break;
  }
}

/** Checks the consequences of one action, comparing the table before and after. */
/** Nobody stays in Hell past their sentence, and nobody is let out early. */
function checkHellSentence(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const changed = previous.activePlayerIndex !== next.activePlayerIndex || previous.round !== next.round;
  if (!changed || next.phase !== "playing") return;

  const outgoing = getActivePlayer(previous);
  const outgoingAfter = outgoing && findPlayer(next, outgoing.id);
  if (outgoing?.position === HELL_NODE_ID && outgoing.hellTurns >= HELL_TURN_LIMIT && outgoingAfter) {
    if (outgoingAfter.position !== START_NODE_ID) {
      found.push(violation("hell-release", `${outgoing.name} served ${HELL_TURN_LIMIT} Hell turns but stayed`));
    }
  }

  const logs = newLogTexts(previous, next);
  for (const player of previous.players) {
    if (!logs.some((text) => text.startsWith(`${player.name} a purgé`))) continue;
    // A skipped turn counts too, so the release may come one turn after the last spin.
    if (player.position !== HELL_NODE_ID || player.hellTurns < HELL_TURN_LIMIT - 1) {
      found.push(violation("hell-early-release", `${player.name} left Hell after ${player.hellTurns} turns`));
    }
  }
}

export function checkTransition(previous: GameState, next: GameState, appliedItem?: AppliedItem): RuleViolation[] {
  if (previous.phase !== "playing") return [];
  const found: RuleViolation[] = [];
  if (appliedItem) checkItemEffect(previous, next, appliedItem, found);
  checkMovement(previous, next, found);
  checkWheelResolution(previous, next, found);
  checkTileWheelSpin(previous, next, found);
  checkTurnChange(previous, next, found);
  checkHellSentence(previous, next, found);
  checkNoThanksUsage(previous, next, found);
  checkCupRelocation(previous, next, found);
  return found;
}
