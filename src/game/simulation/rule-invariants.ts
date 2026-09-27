import { earnsStartBonus, getBoard, getNeighbors, hasCarousel, isIce } from "../board";
import { ITEM_CATALOG, ITEM_ORDER } from "../catalog";
import {
  countItemCopies,
  countItemUnits,
  countRedCups,
  getInventoryCapacity,
  getTileWheel,
  isShopNode,
} from "../rules";
import { findPlayer, getActivePlayer } from "../state-utils";
import type { GameState, ItemId, NodeId, Player, PlayerId, PlayerMovement, TurnStage } from "../types";
import {
  CURRENCY_RESET_THRESHOLD,
  FIRST_ROUND,
  HELL_NODE_ID,
  HELL_TURN_LIMIT,
  NO_THANKS_COOLDOWN_ROUNDS,
  RED_CUP_GOAL,
  GHOST_ID,
  GHOST_MAX_DRIFT_STEPS,
  START_NODE_ID,
} from "../types";
import { getBoardMap } from "../maps/map-registry";
import { checkAbandon, checkBlessing, checkBulletBill, checkMudReward } from "./event-invariants";
import { expectedBalance, newLogTexts, turnChanged, violation, type RuleViolation } from "./invariant-helpers";

export type { RuleViolation } from "./invariant-helpers";

/**
 * Rule checks run by the bots after every single action. Each violation names
 * the rule it breaks, so a failing campaign reads like a bug report.
 */

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
const RESTING_STAGES: TurnStage[] = ["move", "hell", "shop", "tile-wheel", "turn-end", "blessing"];

/** Normal play; a Tour de Bénédiction in progress must be over before any of these. */
const NORMAL_PLAY_STAGES: TurnStage[] = ["move", "hell", "shop", "tile-wheel", "turn-end"];

/** A pull or a swap moves players without earning a wheel. */
const MOVES_WITHOUT_ARRIVAL: ItemId[] = ["rope", "monopoly-man"];

/** What an arrival on a tile can open; moves without arrival must lead to neither. */
const ARRIVAL_STAGES: TurnStage[] = ["tile-wheel", "shop"];

function checkPlayer(state: GameState, player: Player): RuleViolation[] {
  const found: RuleViolation[] = [];
  const name = player.name;

  if (!getBoard(state).nodes.some((node) => node.id === player.position)) {
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
    const stackLimit = ITEM_CATALOG[itemId].stackLimit;
    if (stackLimit && copies > 1) found.push(violation("one-stack", `${name} fills ${copies} slots with ${itemId}`));
    if (stackLimit && countItemUnits(player, itemId) > stackLimit) {
      found.push(violation("stack-limit", `${name} piles ${countItemUnits(player, itemId)} × ${itemId}`));
    }
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
    if (state.turnStage === "shop" && !isShopNode(getBoard(state), active.position)) {
      found.push(violation("shop-stage", `${active.name} shops on tile ${active.position}`));
    }
    const nextWheel = state.pendingTileWheels[0];
    if (state.turnStage === "tile-wheel" && (!nextWheel || getTileWheel(getBoard(state), nextWheel.nodeId) === null)) {
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
    // A skip drawn while breaking free of Banquise's ice, at the start of the turn, is for the next one.
    const thawedNow = state.lastMovement?.thawed === true && state.lastMovement.playerId === active.id;
    if (active.skippedTurns > 0 && ["move", "hell"].includes(state.turnStage) && !state.turnActionTaken && !thawedNow) {
      found.push(violation("skipped-player-plays", `${active.name} plays despite a skipped turn`));
    }
    if (state.turnStage === "blessing" && state.blessingQueue.length === 0) {
      found.push(violation("blessing-stage", "Tour de Bénédiction with nobody left to spin"));
    }
    if (state.blessingQueue.length > 0 && NORMAL_PLAY_STAGES.includes(state.turnStage)) {
      found.push(violation("blessing-unfinished", `play resumed with ${state.blessingQueue.length} blessing(s) owed`));
    }
    if (state.blessingQueue.some((playerId) => !findPlayer(state, playerId))) {
      found.push(violation("blessing-seats", "an unknown player waits for the Tour de Bénédiction"));
    }
  }

  const bullet = state.bulletBill;
  const bulletAway = bullet?.status === "waiting" && bullet.position !== START_NODE_ID;
  if (bullet && (!getBoard(state).normalNodeIds.includes(bullet.position) || bulletAway)) {
    found.push(violation("bullet-tile", `Bullet Bill ${bullet.status} on tile ${bullet.position}`));
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
  const wonByForfeit = state.winReason === "forfeit" && state.players.length === 1;
  if (state.phase === "finished" && champions.length === 0 && !wonByForfeit) {
    found.push(violation("victory-needs-cups", "the game ended without a 3-Cup winner or a forfeit"));
  }
  if (state.winReason === "forfeit" && state.players.length !== 1) {
    found.push(violation("forfeit-last-player", `a forfeit win with ${state.players.length} players left`));
  }

  if (state.bootPrice < 100 || state.bootPrice > 500 || state.bootPrice % 50 !== 0) {
    found.push(violation("boot-price", `boot costs ${state.bootPrice}`));
  }
  const board = getBoard(state);
  if (state.redCupNodeId !== null && isIce(board, state.redCupNodeId)) {
    found.push(violation("cup-on-ice", `the Red Cup lies on the ice of tile ${state.redCupNodeId}`));
  }
  if (state.iceTileNodeId !== null && board.map.nodes.find((node) => node.id === state.iceTileNodeId)?.ice) {
    found.push(violation("blizzard-tile", `the blizzard froze tile ${state.iceTileNodeId}, already ice`));
  }
  if (state.mudTraps.some((trap) => !getBoard(state).normalNodeIds.includes(trap.nodeId))) {
    found.push(violation("mud-tile", "mud lies outside the walkable tiles"));
  }

  if (state.pendingReaction) {
    for (const reactorId of state.pendingReaction.reactorIds) {
      const reactor = findPlayer(state, reactorId);
      if (!reactor || reactor.passiveId !== "no-thanks") {
        found.push(violation("reactor-has-passive", `${reactor?.name ?? reactorId} is offered Non merci`));
      } else if (reactor.id === state.pendingReaction.actorId) {
        found.push(violation("no-self-reaction", `${reactor.name} may cancel their own action`));
      } else if (reactor.noThanksReadyRound > state.round) {
        found.push(violation("no-thanks-cooldown", `${reactor.name} is offered Non merci before it recharged`));
      }
    }
  }

  checkGhost(state, found);
  return found;
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
  if (movement.thawed) {
    checkThaw(previous, movement, found);
    return;
  }
  if (movement.flungByGhost) {
    checkGhostFling(previous, next, movement, found);
    return;
  }
  // The walk itself is exactly the move's distance; anything after it was slid on ice.
  const walkedLength = movement.slideStart ?? movement.path.length;
  if (walkedLength !== previous.moveDistance) {
    found.push(violation("move-distance", `${mover.name} walked ${walkedLength} tiles`));
  }
  checkSlide(previous, next, movement, found);

  const rebel = logs.some((text) => text.includes("Délinquant"));
  if (rebel && previous.round <= FIRST_ROUND && movement.from === START_NODE_ID) {
    found.push(violation("delinquent-first-round", `${mover.name} broke out of the start on the first round`));
  }
  // The walk follows the board as it stood before the move: a Cup picked up on arrival may flip the carousel.
  const board = getBoard(previous);
  let from = movement.from;
  for (const step of movement.path) {
    const allowed = getNeighbors(board, from, rebel && mover.passiveId === "delinquent");
    if (!allowed.includes(step)) {
      found.push(violation("move-follows-roads", `${mover.name} went ${from} → ${step} against the board`));
    }
    from = step;
  }

  const destination = movement.path[movement.path.length - 1];
  if (moved.position !== destination) {
    found.push(violation("move-lands", `${mover.name} should stand on ${destination}, not ${moved.position}`));
  }

  const passedStart = earnsStartBonus(board, movement.from, movement.path);
  const gotBonus = logs.some((text) => text.includes("passe par le départ"));
  if (passedStart && mover.passiveId !== "im-cups" && !gotBonus) {
    found.push(violation("start-bonus", `${mover.name} crossed the start without the 200 coins`));
  }
  if (gotBonus && (!passedStart || mover.passiveId === "im-cups")) {
    found.push(violation("start-bonus-undue", `${mover.name} got the start bonus without earning it`));
  }

  const interrupted =
    movement.interruptedTo !== undefined ||
    ["discard", "reposition", "passive-choice", "duel", "finished"].includes(next.turnStage);
  if (!interrupted) {
    const expected: TurnStage = isShopNode(board, destination)
      ? "shop"
      : getTileWheel(board, destination)
        ? "tile-wheel"
        : "turn-end";
    if (next.turnStage !== expected) {
      found.push(violation("arrival-stage", `landing on ${destination} led to ${next.turnStage}, not ${expected}`));
    }
  }
}

/** Banquise: every slid step leaves an ice tile by a real road, never back where it came from. */
function checkSlide(previous: GameState, next: GameState, movement: PlayerMovement, found: RuleViolation[]): void {
  const board = getBoard(previous);
  const start = movement.slideStart ?? movement.path.length;
  const tiles = [movement.from, ...movement.path];
  for (let index = start; index < movement.path.length; index += 1) {
    const iceTile = tiles[index];
    const cameFrom = tiles[index - 1];
    const step = movement.path[index];
    if (!isIce(board, iceTile) || step === cameFrom || !getNeighbors(board, iceTile).includes(step)) {
      found.push(violation("ice-slide", `slid ${iceTile} → ${step} after coming from ${cameFrom}`));
    }
  }

  const to = movement.interruptedTo;
  if (to === undefined) return;
  const stuckOn = movement.path[movement.path.length - 1];
  const frozen = next.frozenSlides.find((entry) => entry.playerId === movement.playerId);
  if (!frozen || frozen.from !== stuckOn || frozen.to !== to) {
    found.push(violation("ice-fall-frozen", `the slide towards ${to} was not put on hold`));
  }
  if (to !== previous.redCupNodeId || !next.lastIceFall?.hit) {
    found.push(violation("ice-fall-cup", `ice fell on a slide towards ${to}, not the Red Cup`));
  }
  if (!isIce(board, stuckOn)) found.push(violation("ice-fall-on-ice", `stuck on tile ${stuckOn}, which is not ice`));
}

/** Luna Park: only a ghost that won a duel carries its opponent off to Hell, from the ghost's own tile. */
function checkGhostFling(previous: GameState, next: GameState, movement: PlayerMovement, found: RuleViolation[]): void {
  const duel = previous.pendingDuel;
  const wonByGhost = duel?.ghost?.penalty.kind === "hell" && duel.winnerId === GHOST_ID;
  if (!wonByGhost || duel.playerOneId !== movement.playerId || previous.ghost?.nodeId !== movement.from) {
    found.push(violation("ghost-fling", `the ghost carried ${movement.playerId} to Hell without winning a duel`));
  }
  if (findPlayer(next, movement.playerId)?.position !== HELL_NODE_ID) {
    found.push(violation("ghost-fling-hell", `${movement.playerId} was flung but is not in Hell`));
  }
}

/** Luna Park: the ghost stays out of Hell, keeps real loot and never duels a player twice in a row. */
function checkGhost(state: GameState, found: RuleViolation[]): void {
  const ghost = state.ghost;
  const tiles = getBoard(state).normalNodeIds;
  if (!getBoardMap(state.mapId).haunted) {
    if (ghost) found.push(violation("ghost-map", `a ghost haunts ${state.mapId}`));
    return;
  }
  if (state.phase === "playing" && !ghost) found.push(violation("ghost-exists", "Luna Park lost its ghost"));
  if (!ghost) return;
  if (ghost.nodeId !== null && !tiles.includes(ghost.nodeId)) {
    found.push(violation("ghost-tile", `the ghost stands on tile ${ghost.nodeId}, off the board`));
  }
  if (ghost.loot.coins < 0) found.push(violation("ghost-loot", `the ghost holds ${ghost.loot.coins} coins`));
  const duel = state.pendingDuel;
  if (duel?.ghost && (duel.playerTwoId !== GHOST_ID || ghost.nodeId === null)) {
    found.push(violation("ghost-duel", "a duel against the ghost without the ghost on the board"));
  }
  if (duel && duel.playerTwoId === GHOST_ID && !duel.ghost) {
    found.push(violation("ghost-stakes", "the ghost duels with nothing at stake"));
  }
}

/** Luna Park: a drift follows real roads (either way, 1 to 3 of them); a teleport really goes somewhere else. */
function checkGhostMove(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const deed = next.lastGhostEvent;
  if (!deed || deed.seq === previous.lastGhostEvent?.seq) return;
  if (deed.kind === "teleport" && (deed.from === deed.to || deed.to === HELL_NODE_ID)) {
    found.push(violation("ghost-teleport", `the ghost teleported from ${deed.from} to ${deed.to}`));
  }
  if (deed.kind !== "move") return;
  const path = deed.path ?? [];
  const edges = getBoard(previous).edges;
  const linked = (a: NodeId, b: NodeId) =>
    edges.some((edge) => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a));
  let from = deed.from;
  for (const step of path) {
    if (from === null || step === HELL_NODE_ID || !linked(from, step)) {
      found.push(violation("ghost-drift", `the ghost drifted ${from} → ${step} off the roads`));
    }
    from = step;
  }
  if (path.length < 1 || path.length > GHOST_MAX_DRIFT_STEPS || path[path.length - 1] !== deed.to) {
    found.push(violation("ghost-drift-length", `the ghost drifted ${path.length} tiles`));
  }
}

/** Luna Park: beaten, the ghost leaves; the loot only grows by what it stole and shrinks by what it gave back. */
function checkGhostDuelResult(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const duel = previous.pendingDuel;
  if (!duel?.ghost || next.pendingDuel === duel || !previous.ghost || !next.ghost) return;
  if (next.pendingDuel?.playerOneId === duel.playerOneId && next.pendingDuel.ghost) return;
  const lootItems = (state: GameState) => state.ghost?.loot.items.length ?? 0;
  if (duel.winnerId === duel.playerOneId) {
    if (next.ghost.nodeId !== null && next.lastGhostEvent?.kind !== "appear") {
      found.push(violation("ghost-vanish", "the ghost stayed on the board after losing"));
    }
    const { reward } = duel.ghost;
    const coinsBack = reward.kind === "coins" && reward.fromLoot ? reward.amount : 0;
    const itemsBack = reward.kind === "item" ? 1 : 0;
    if (
      next.ghost.loot.coins !== previous.ghost.loot.coins - coinsBack ||
      lootItems(next) !== lootItems(previous) - itemsBack
    ) {
      found.push(violation("ghost-reward", "the loot changed by something else than the reward"));
    }
  } else if (duel.winnerId === GHOST_ID) {
    const grown = next.ghost.loot.coins - previous.ghost.loot.coins + (lootItems(next) - lootItems(previous));
    if (duel.ghost.penalty.kind === "hell" && grown !== 0) {
      found.push(violation("ghost-penalty", "the ghost took loot along with the trip to Hell"));
    }
    if (duel.ghost.penalty.kind !== "hell" && grown < 0) {
      found.push(violation("ghost-penalty", "the ghost's loot shrank after it won"));
    }
  }
}

/** Banquise: breaking free finishes exactly the slide that was put on hold. */
function checkThaw(previous: GameState, movement: PlayerMovement, found: RuleViolation[]): void {
  const frozen = previous.frozenSlides.find((entry) => entry.playerId === movement.playerId);
  if (!frozen || frozen.from !== movement.from || movement.path.join(",") !== String(frozen.to)) {
    found.push(violation("ice-thaw", `thawed ${movement.from} → ${movement.path.join(" → ")} without a matching hold`));
  }
}

function checkWheelResolution(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const wheel = previous.pendingWheel;
  if (!wheel || next.pendingWheel?.id === wheel.id || previous.turnStage !== "wheel-result") return;
  if (newLogTexts(previous, next).some((text) => text.includes("Gomme"))) return;
  // The last wheel of a Tour de Bénédiction can open the next round, where Bullet Bill may strike too.
  if (next.lastBulletFlight?.seq !== previous.lastBulletFlight?.seq) return;

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

/** Pulled, swapped or repositioned players: they moved, but the move earns nothing on arrival. */
function playersMovedWithoutArrival(previous: GameState, appliedItem?: AppliedItem): Set<PlayerId> {
  const exempt = new Set<PlayerId>();
  if (appliedItem && MOVES_WITHOUT_ARRIVAL.includes(appliedItem.itemId)) {
    exempt.add(appliedItem.userId);
    if (appliedItem.targetPlayerId) exempt.add(appliedItem.targetPlayerId);
  }
  if (previous.turnStage === "reposition" && previous.pendingCupRepositionPlayerId) {
    exempt.add(previous.pendingCupRepositionPlayerId);
  }
  return exempt;
}

function checkTileWheelSpin(
  previous: GameState,
  next: GameState,
  found: RuleViolation[],
  appliedItem?: AppliedItem,
): void {
  if (previous.turnStage === "tile-wheel" && next.pendingWheel) {
    const spinner = findPlayer(previous, next.pendingWheel.playerId);
    const expected = spinner ? getTileWheel(getBoard(previous), spinner.position) : null;
    if (next.pendingWheel.wheelId !== expected) {
      found.push(
        violation("tile-wheel-color", `tile ${spinner?.position} spun the ${next.pendingWheel.wheelId} wheel`),
      );
    }
  }

  // Walking, being teleported or pushed back: landing on green or red owes a wheel. A pull, a swap or
  // a New Cup, New Me repositioning never does.
  if (next.phase !== "playing") return;
  const exempt = playersMovedWithoutArrival(previous, appliedItem);
  // Caught by falling ice halfway down a road: nothing is reached until the next turn.
  const movement = next.lastMovement;
  if (movement?.interruptedTo !== undefined && movement.seq !== previous.lastMovement?.seq)
    exempt.add(movement.playerId);
  for (const player of next.players) {
    const before = findPlayer(previous, player.id);
    if (!before || before.position === player.position || getTileWheel(getBoard(next), player.position) === null) {
      continue;
    }
    const queued = next.pendingTileWheels.some(
      (entry) => entry.playerId === player.id && entry.nodeId === player.position,
    );
    if (exempt.has(player.id) && queued) {
      found.push(violation("no-arrival-wheel", `${player.name} spins on tile ${player.position} after being moved`));
    } else if (!exempt.has(player.id) && !queued) {
      found.push(violation("arrival-wheel", `${player.name} reached tile ${player.position} without a wheel`));
    }
  }
}

/** New Cup, New Me moves the player before the Cup appears; the new tile's shop does not open for it. */
function checkReposition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const repositionerId = previous.pendingCupRepositionPlayerId;
  if (previous.turnStage !== "reposition" || !repositionerId) return;
  const before = findPlayer(previous, repositionerId);
  const after = findPlayer(next, repositionerId);
  const isActive = getActivePlayer(previous)?.id === repositionerId;
  if (before && after && before.position !== after.position && isActive && next.turnStage === "shop") {
    found.push(violation("reposition-no-shop", `${before.name} shops on tile ${after.position} after repositioning`));
  }
}

function checkTurnChange(previous: GameState, next: GameState, found: RuleViolation[]): void {
  // Seats shift when a player leaves; checkAbandon covers that turn change.
  if (previous.players.length !== next.players.length) return;
  if (!turnChanged(previous, next) || !["move", "hell"].includes(next.turnStage)) return;

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
    if (!before || before.noThanksReadyRound === player.noThanksReadyRound) continue;
    const pending = previous.pendingReaction;
    const legal =
      previous.turnStage === "reaction" &&
      pending !== null &&
      pending.reactorIds.includes(player.id) &&
      pending.actorId !== player.id &&
      player.passiveId === "no-thanks" &&
      before.noThanksReadyRound <= previous.round &&
      player.noThanksReadyRound === previous.round + NO_THANKS_COOLDOWN_ROUNDS;
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
    // Mud is laid before the turn's action: cancelling it leaves the actor their turn.
    const cancelledMud = pending.action.type === "item" && pending.action.itemId === "mud";
    const expectedStage = cancelledMud ? pending.resumeStage : "turn-end";
    if (next.turnStage !== expectedStage) {
      found.push(violation("no-thanks-ends-action", `after Non merci the stage is ${next.turnStage}`));
    }
  }
}

function checkCupRelocation(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (next.mapId !== previous.mapId) found.push(violation("map-fixed", `the board changed to ${next.mapId}`));
  const newCup = next.redCupCycle > previous.redCupCycle;
  const flipped = next.carouselReversed !== previous.carouselReversed;
  if (flipped !== (newCup && hasCarousel(getBoard(previous)))) {
    found.push(violation("carousel-flip", `carousel flipped: ${String(flipped)}, new Red Cup: ${String(newCup)}`));
  }
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
  /** Tomates thrown at once. */
  count?: number;
}

function checkItemEffect(previous: GameState, next: GameState, item: AppliedItem, found: RuleViolation[]): void {
  if (next.turnStage === "reaction") return;
  const user = findPlayer(previous, item.userId);
  const userAfter = findPlayer(next, item.userId);
  const target = findPlayer(previous, item.targetPlayerId);
  const targetAfter = findPlayer(next, item.targetPlayerId);
  if (!user || !userAfter) return;
  const label = `${user.name} used ${item.itemId}`;

  // Je note never copies an item its holder used on themselves: the bag always loses it (one of a stack).
  if (countItemUnits(userAfter, item.itemId) !== countItemUnits(user, item.itemId) - (item.count ?? 1)) {
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
      if (ARRIVAL_STAGES.includes(next.turnStage)) {
        found.push(violation("rope-no-arrival", `${label}: the pull led to ${next.turnStage}`));
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
      if (ARRIVAL_STAGES.includes(next.turnStage)) {
        found.push(violation("monopoly-man-no-arrival", `${label}: the swap led to ${next.turnStage}`));
      }
      break;
    case "tomato": {
      // Je note may have its holder make room for the copied Tomate first.
      const copyDiscard = next.turnStage === "discard" && next.pendingDiscard?.itemId === "tomato";
      const stageChanged = next.turnStage !== previous.turnStage && !copyDiscard;
      if (stageChanged || next.turnActionTaken !== previous.turnActionTaken) {
        found.push(
          violation("tomato-keeps-turn", `${label}: the turn went from ${previous.turnStage} to ${next.turnStage}`),
        );
      }
      const stunned = next.lastTomatoThrow?.stunned === true;
      const skipped = (targetAfter?.skippedTurns ?? 0) - (target?.skippedTurns ?? 0);
      if (target?.id === user.id || skipped !== (stunned ? 1 : 0)) {
        found.push(violation("tomato", `${label}: target skipped ${skipped} turn(s), stunned ${stunned}`));
      }
      break;
    }
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
    case "mud": {
      if (!next.mudTraps.some((trap) => trap.nodeId === user.position && trap.ownerId === user.id)) {
        found.push(violation("mud", `${label}: no mud on tile ${user.position}`));
      }
      const stageBefore = previous.pendingReaction?.resumeStage ?? previous.turnStage;
      if (next.turnStage !== stageBefore || next.turnActionTaken !== previous.turnActionTaken) {
        found.push(violation("mud-keeps-turn", `${label}: the turn went from ${stageBefore} to ${next.turnStage}`));
      }
      if (!next.mudPlacedThisTurn) found.push(violation("mud-once-per-turn", `${label}: the turn forgot the mud`));
      break;
    }
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

/** Nobody stays in Hell past their sentence, and nobody is let out early. */
function checkHellSentence(previous: GameState, next: GameState, found: RuleViolation[]): void {
  if (!turnChanged(previous, next) || next.phase !== "playing") return;

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

/** Checks the consequences of one action, comparing the table before and after. */
export function checkTransition(previous: GameState, next: GameState, appliedItem?: AppliedItem): RuleViolation[] {
  if (previous.phase !== "playing") return [];
  const found: RuleViolation[] = [];
  // An item announced to a Non merci holder has not happened yet.
  const itemApplied = appliedItem && next.turnStage !== "reaction" ? appliedItem : undefined;
  if (itemApplied) checkItemEffect(previous, next, itemApplied, found);
  checkMovement(previous, next, found);
  checkWheelResolution(previous, next, found);
  checkTileWheelSpin(previous, next, found, itemApplied);
  checkReposition(previous, next, found);
  checkTurnChange(previous, next, found);
  checkHellSentence(previous, next, found);
  checkNoThanksUsage(previous, next, found);
  checkCupRelocation(previous, next, found);
  checkBulletBill(previous, next, found);
  checkBlessing(previous, next, found);
  checkAbandon(previous, next, found);
  checkMudReward(previous, next, found);
  checkGhostDuelResult(previous, next, found);
  checkGhostMove(previous, next, found);
  return found;
}
