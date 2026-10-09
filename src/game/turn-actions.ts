import { hasCard } from "./cards";
import { createEngineId, drawEngineRandom } from "./engine-random";
import { earnsStartBonus, getBoard, getOpenBoard, isBlockedRoad, getShortestPath, isIce } from "./board";
import { launchBulletBill } from "./bullet-bill";
import { carryOffIce, drawSlide, recordSlide, toPathBumps } from "./ice";
import { ITEM_CATALOG } from "./catalog";
import { teleportToMark } from "./black-mage";
import { canTeleport, findMark } from "./mage-queries";
import { castBlackCup, dropBlackCup, openPortals, passSentence, startDoomsday, triggerPortal } from "./devil";
import { isInvisible } from "./mist";
import { startArmWrestle } from "./arm-wrestle";
import { canAffordItem, canAffordMove, getItemEnergyCost, spendAllEnergy, spendEnergy } from "./energy";
import {
  addRedGreenBonuses,
  addStartBonus,
  collectCupOrRoll,
  itemCopyForPassive,
  queueTileWheel,
  queueWheelsForMovedPlayers,
  settleBoard,
  stealFromKnockedOut,
  randomNormalNode,
  sendPlayerToHell,
  startWheel,
  triggerMud,
} from "./game-effects";
import {
  canTargetPlayer,
  canUseItemKind,
  getTomatoStunChance,
  isDoomed,
  isImmuneToItems,
  throwsOneStackPerTurn,
  TOMATO_ENJOYER_HIT_REWARD,
  mustWaitForMudToBeSteppedOn,
} from "./passive-rules";
import { canUseCorrupter, canUseNoThanks, getTurnMoveOptions, opensShop } from "./rules";
import {
  addLog,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  getItemEntry,
  getEntryUnits,
  spendItemEntry,
  placeInHell,
  updatePlayer,
  loseTurns,
} from "./state-utils";
import type { DeclaredAction, GameState, ItemId, NodeId, PendingReaction, Player, PlayerId, TurnStage } from "./types";
import {
  BARRIER_TURNS,
  CANCELLED_ITEM_IS_CONSUMED,
  CORRUPTER_COST,
  HELL_NODE_ID,
  MAX_BARRIERS,
  MADE_IN_HEAVEN_CUP_NODE_ID,
  NO_THANKS_COOLDOWN_ROUNDS,
  START_NODE_ID,
} from "./types";

/**
 * What a player does on their turn — use items, then move — split into "plan"
 * (validation, no change) and "apply" (effects), so the Non merci reaction
 * window can sit in between an item and the player it targets. Items cost
 * energy and leave the turn going; the move takes the energy left and ends it.
 */

export interface MovePlan {
  path: NodeId[];
  /** True when the move goes against an arrow thanks to Corrupteur. */
  rebel: boolean;
  /** Taupe: the move is a dig (`dug`) or a crossing of a tunnel, a single hop that follows no road. */
  tunnel?: { id: string; dug: boolean };
}

export function planMove(state: GameState, destination: NodeId, ignoreArrows: boolean): MovePlan | null {
  const player = getActivePlayer(state);
  if (state.phase !== "playing" || state.turnStage !== "move" || !player || !canAffordMove(state)) return null;

  const findPath = (ignore: boolean) =>
    getTurnMoveOptions(state, player, ignore).find((path) => path[path.length - 1] === destination) ?? null;
  const regularPath = findPath(false);
  if (regularPath) return { path: regularPath, rebel: false };

  // Corrupteur only pays when the destination really requires going against an arrow.
  if (!ignoreArrows || !canUseCorrupter(player, state.round)) return null;
  const rebelPath = findPath(true);
  return rebelPath ? { path: rebelPath, rebel: true } : null;
}

/** A blue tile opens the shop at the end of a walk; for eShop, any tile does; during Doomsday, none. */
function getArrivalStage(state: GameState, player: Player, nodeId: NodeId): TurnStage {
  return opensShop(state, player, nodeId) ? "shop" : "turn-end";
}

/**
 * Plays a walk. At Banquise a walk that ends on ice slides on at random
 * (`drawSlide`): the player's final tile is where the slide stops, or, when
 * falling ice caught them, the ice tile they were leaving; they then wait
 * there, halfway down the road, until their next turn.
 */
export function applyMove(state: GameState, walkEnd: NodeId, plan: MovePlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;

  let nextState = state;
  if (plan.rebel) {
    nextState = addLog(nextState, `${player.name} ignore les flèches grâce à Corrupteur.`, "event");
    nextState = applyCurrencyChange(nextState, player.id, -CORRUPTER_COST, { gamble: false });
  }

  const board = getBoard(state);
  const slide = isIce(board, walkEnd) ? drawSlide(state, player.position, plan.path) : null;
  const path = slide ? [...plan.path, ...slide.slide] : plan.path;
  const destination = path[path.length - 1];
  const interruptedTo = slide?.interruptedTo ?? null;

  nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
  nextState = addLog(
    nextState,
    plan.tunnel
      ? `${player.name} ${plan.tunnel.dug ? "creuse un tunnel" : "traverse un tunnel"} jusqu’en case ${walkEnd}.`
      : `${player.name} se déplace en case ${walkEnd}.`,
    plan.tunnel ? "event" : "neutral",
  );
  if (slide) nextState = recordSlide(nextState, player.id, slide, destination);
  nextState = addRedGreenBonuses(nextState, player.id, path);
  // Doomsday: the start pays nothing.
  // A tunnel is no road: going down it to the start earns nothing.
  if (!plan.tunnel && earnsStartBonus(board, player.position, path) && !isDoomed(state, player)) {
    nextState = addStartBonus(nextState, player.id);
  }

  nextState = {
    ...spendAllEnergy(nextState),
    moveDistance: 1,
    diceRoll: null,
    turnStage: interruptedTo === null ? getArrivalStage(state, player, destination) : "turn-end",
    lastMovement: {
      seq: (state.lastMovement?.seq ?? 0) + 1,
      playerId: player.id,
      from: player.position,
      path,
      ...(slide && slide.slide.length + (interruptedTo === null ? 0 : 1) > 0 ? { slideStart: plan.path.length } : {}),
      ...(slide && slide.bumps.length > 0 ? { bumps: toPathBumps(plan.path.length, slide.bumps) } : {}),
      ...(interruptedTo === null ? {} : { interruptedTo }),
      ...(plan.tunnel ? { tunnel: plan.tunnel } : {}),
    },
  };

  // Stuck in the ice: nothing is reached yet; the slide ends when the player's next turn comes.
  if (interruptedTo !== null) return nextState;

  nextState = stealFromKnockedOut(nextState, player.id);
  // Queued first, spun last: mud and the Red Cup resolve before the tile's wheel.
  nextState = queueTileWheel(nextState, player.id);
  nextState = triggerMud(nextState, player.id, destination, path[path.length - 2] ?? player.position);
  // Chance aveugle may have stepped back out of the mud: the Red Cup is only reached on its tile.
  const cupAhead = findPlayer(nextState, player.id)?.position === destination && nextState.redCupNodeId === destination;
  // A Portail swallows the player first, and the Red Cup on its tile is picked up on the way down (report 2026-10-08).
  nextState = triggerPortal(nextState, player.id);
  if (cupAhead && nextState.phase === "playing") {
    nextState = collectCupOrRoll(nextState, player.id, destination);
  }

  const waitsForDecision = ["discard", "reposition", "passive-choice"].includes(nextState.turnStage);
  if (nextState.phase !== "playing" || waitsForDecision) return nextState;
  return settleBoard(nextState, nextState.turnStage);
}

export interface ItemPlan {
  itemId: ItemId;
  target?: Player;
  /** Tomates thrown in one go; one for every other item. */
  count: number;
  /** Draven: players who cancelled it for themselves with Non merci. */
  sparedIds?: PlayerId[];
  /** The Barrière: the two tiles of the road it closes. */
  road?: [NodeId, NodeId];
  /** The target's Miroir sent it back: its effects fall on the user instead. */
  reflected?: boolean;
}

/** Items a Miroir sends back to whoever used them. */
export const REFLECTABLE_ITEMS: ItemId[] = ["ndoye", "hollow-purple", "rope", "middle-finger"];

/** The Gomme and the Casque trigger on their own; the Botte is prepared through its own action. */
const NOT_USED_FROM_BAG: ItemId[] = [
  "eraser",
  "helmet",
  "boot",
  "hell-touch",
  "shield",
  "wake-up",
  "parachute",
  "mirror",
];

/** Pulled by the Corde, swapped by the Monopoly Man, rewound by Made In Heaven: moved, but no wheel for it. */
const MOVES_WITHOUT_ARRIVAL: ItemId[] = ["rope", "monopoly-man", "made-in-heaven"];

/**
 * Le diable's items that need the table in a given state: a single Doomsday,
 * a single Black Cup, and only while the Red Cup stands on the board.
 */
function canCastNow(state: GameState, itemId: ItemId): boolean {
  if (itemId === "doomsday") return state.doomsday === null;
  if (itemId === "black-cup") return state.blackCup === null && state.redCupNodeId !== null;
  return true;
}

/**
 * Thrown for free and as often as the stack allows, without going through
 * Non merci: the Tomate is only for fun.
 */
const THROWN_ITEMS: ItemId[] = ["tomato"];

export function isThrownItem(itemId: ItemId): boolean {
  return THROWN_ITEMS.includes(itemId);
}

export function planItemUse(
  state: GameState,
  entryId: string,
  targetPlayerId?: PlayerId,
  requestedCount = 1,
  targetRoad?: [NodeId, NodeId],
): ItemPlan | null {
  const player = getActivePlayer(state);
  if (!player || state.phase !== "playing") return null;

  const inHell = player.position === HELL_NODE_ID;
  // Roller: once the die is thrown, only the move is left.
  if (state.turnStage !== (inHell ? "hell" : "move") || state.diceRoll !== null) return null;

  const itemId = getItemEntry(player, entryId);
  if (!itemId || NOT_USED_FROM_BAG.includes(itemId) || !canAffordItem(state, itemId)) return null;
  // L'Ange-Gardien may harm nobody, even with an item won on a wheel.
  if (!canUseItemKind(player, itemId) || !canCastNow(state, itemId)) return null;
  if (itemId === "water-bottle" && !inHell) return null;
  // Nobody walks into Hell, so mud placed there could never be stepped on.
  if (itemId === "mud" && (inHell || state.mudPlacedThisTurn || mustWaitForMudToBeSteppedOn(state, player)))
    return null;
  // A single Bullet Bill flies at a time.
  if (itemId === "bullet-bill" && state.bulletBill) return null;

  // Only a stack can be thrown several at a time, and never more than it holds.
  const entry = player.inventory.find((candidate) => candidate.id === entryId);
  // A stack counts as one item: the Tomates of a turn all come from the same one, but for Tomato Enjoyer.
  const otherStackThrown = state.thrownStackId !== null && state.thrownStackId !== entryId;
  if (isThrownItem(itemId) && otherStackThrown && throwsOneStackPerTurn(player)) return null;
  const count = isThrownItem(itemId) && entry ? requestedCount : 1;
  if (!Number.isInteger(count) || count < 1 || (entry && count > getEntryUnits(entry))) return null;

  const definition = ITEM_CATALOG[itemId];
  if (definition.target === "road") {
    // One Barrière each, two on the board at most, on any open road.
    if (!canPlaceBarrier(state, player.id) || targetRoad === undefined) return null;
    return getBarrierRoads(state).some((road) => isSameRoad(road, targetRoad))
      ? { itemId, count, road: targetRoad }
      : null;
  }
  if (definition.target !== "player") return { itemId, count };

  const target = findPlayer(state, targetPlayerId);
  if (!target || !canTargetPlayer(state, player, target)) return null;
  if (target.id === player.id && !definition.canTargetSelf) return null;
  // Hollow Purple sends its target down: nobody aims at a player already in Hell (report 2026-10-08).
  if (itemId === "hollow-purple" && target.position === HELL_NODE_ID) return null;
  return { itemId, target, count };
}

/** Whether `playerId` may set a Barrière down: none of theirs stands, and the board holds fewer than the most. */
export function canPlaceBarrier(state: GameState, playerId: PlayerId): boolean {
  return state.barriers.length < MAX_BARRIERS && !state.barriers.some((barrier) => barrier.ownerId === playerId);
}

function isSameRoad(left: [NodeId, NodeId], right: [NodeId, NodeId]): boolean {
  return (left[0] === right[0] && left[1] === right[1]) || (left[0] === right[1] && left[1] === right[0]);
}

/**
 * The roads a Barrière may close: every road of the board that is still open,
 * tunnels and the way into Hell aside, arrows or not. One entry per road.
 */
export function getBarrierRoads(state: GameState): [NodeId, NodeId][] {
  const board = getBoard(state);
  const roads: [NodeId, NodeId][] = [];
  for (const edge of getOpenBoard(state).edges) {
    if (edge.kind === "tunnel" || edge.from === HELL_NODE_ID || edge.to === HELL_NODE_ID) continue;
    const road: [NodeId, NodeId] = [edge.from, edge.to];
    if (isBlockedRoad(board, edge.from, edge.to) || roads.some((known) => isSameRoad(known, road))) continue;
    roads.push(road);
  }
  return roads;
}

/** Items whose use already writes a line naming the player (patch 0.1.5 journal). */
const SELF_ANNOUNCED_ITEMS: ItemId[] = ["ndoye", "bullet-bill", "mud", "tomato", "barrier"];

export function applyItemUse(state: GameState, entryId: string, plan: ItemPlan): GameState {
  const player = getActivePlayer(state);
  if (!player) return state;
  const { itemId, target, count } = plan;
  // Reflected by a Miroir, the item hurts its user and the aimed player is the one who acts.
  const victim = plan.reflected ? player : target;
  const aggressor = plan.reflected ? target : player;

  // The turn goes on in the stage it was in: more items, then the move.
  let nextState = spendEnergy(state, getItemEnergyCost(itemId));
  for (let spent = 0; spent < count; spent += 1) {
    nextState = updatePlayer(nextState, player.id, (currentPlayer) => spendItemEntry(currentPlayer, entryId));
  }
  if (itemId === "mud") nextState = { ...nextState, mudPlacedThisTurn: true };
  if (isThrownItem(itemId)) nextState = { ...nextState, thrownStackId: entryId };
  // Every use shows in the journal; the items below announce themselves in their own words.
  if (!SELF_ANNOUNCED_ITEMS.includes(itemId)) {
    const on = target ? ` sur ${target.name}` : "";
    nextState = addLog(nextState, `${player.name} utilise ${ITEM_CATALOG[itemId].name}${on}.`, "event");
  }

  switch (itemId) {
    case "ndoye":
      if (!target || !victim) return state;
      nextState = addLog(nextState, `${player.name} active Ndoye sur ${target.name}.`, "event");
      // Je note copies Ndoye when the wheel resolves, through the wheel's source item.
      return startWheel(nextState, "misfortune", victim.id, state.turnStage, {
        ...(plan.reflected ? {} : { sourceItemId: "ndoye" as const }),
        origin: "item",
      });

    case "hollow-purple":
      if (!target || !victim) return state;
      nextState = sendPlayerToHell(nextState, victim.id);
      if (!plan.reflected) nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "rope":
      if (!target || !victim || !aggressor) return state;
      nextState = pullWithRope(nextState, aggressor, victim);
      if (!plan.reflected) nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "bullet-bill":
      nextState = launchBulletBill(nextState);
      nextState = addLog(
        nextState,
        `${player.name} lance Bullet Bill : il attend au départ et fonce au prochain tour.`,
        "event",
      );
      break;

    case "barrier":
      if (plan.road === undefined) return state;
      nextState = {
        ...nextState,
        barriers: [
          ...nextState.barriers,
          { ownerId: player.id, a: plan.road[0], b: plan.road[1], turnsLeft: BARRIER_TURNS },
        ],
      };
      nextState = addLog(
        nextState,
        `${player.name} pose une Barrière sur la route entre les cases ${plan.road[0]} et ${plan.road[1]}.`,
        "event",
      );
      break;

    case "mud":
      nextState = {
        ...nextState,
        mudTraps: [...nextState.mudTraps, { id: createEngineId(), nodeId: player.position, ownerId: player.id }],
      };
      nextState = addLog(nextState, `${player.name} pose de la Boue en case ${player.position}.`, "event");
      break;

    case "middle-finger":
      if (!target || !victim) return state;
      nextState = updatePlayer(nextState, victim.id, (currentPlayer) => loseTurns(currentPlayer));
      nextState = addLog(nextState, `${victim.name} devra passer son prochain tour.`, "bad");
      if (!plan.reflected) nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      // Sent back by a Miroir, it leaves its user nothing but the end of their turn: no other item, no move.
      if (plan.reflected) nextState = { ...nextState, turnStage: "turn-end", turnActionTaken: true };
      break;

    case "monopoly-man":
      if (!target) return state;
      // Baraqué does not let go: an arm wrestle decides (patch 0.1.4).
      if (hasCard(target, "built-like-a-tank")) return startArmWrestle(nextState, player, target);
      // A swap into Hell is a trip to Hell: L'Ange-Gardien then stays put and loses a turn.
      nextState = {
        ...nextState,
        players: nextState.players.map((candidate) => {
          if (candidate.id === player.id) return moveTo(candidate, target.position);
          if (candidate.id === target.id) return moveTo(candidate, player.position);
          return candidate;
        }),
      };
      // Swapped onto a player held by the ice, the ice carries them on.
      nextState = carryOffIce(carryOffIce(nextState, player.id, player.position), target.id, target.position);
      nextState = addLog(nextState, `${player.name} échange sa place avec ${target.name}.`, "event");
      nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      break;

    case "water-bottle": {
      // A tile to stand on: never on ice, which nobody stays on.
      const destination = randomNormalNode(getBoard(state), undefined, true);
      nextState = updatePlayer(nextState, player.id, (currentPlayer) => ({ ...currentPlayer, position: destination }));
      nextState = addLog(nextState, `${player.name} sort de l’Enfer et atterrit en case ${destination}.`, "good");
      if (nextState.redCupNodeId === destination) {
        nextState = collectCupOrRoll(nextState, player.id, destination);
      }
      break;
    }

    case "tomato":
      if (!target) return state;
      nextState = throwTomatoes(nextState, player, target, count);
      // Je note keeps one per Tomate received, until its stack is full or it has to make room first.
      for (let copied = 0; copied < count && !nextState.pendingDiscard; copied += 1) {
        nextState = itemCopyForPassive(nextState, target.id, itemId, player.id);
      }
      break;

    case "draven": {
      // Non merci spares its holder; Chance aveugle and whoever Mi-vu, Mi-vue hides are spared anyway.
      const spared = plan.sparedIds ?? [];
      nextState = {
        ...nextState,
        players: nextState.players.map((candidate) =>
          spared.includes(candidate.id) || isImmuneToItems(candidate) || isInvisible(state, candidate)
            ? candidate
            : placeInHell(candidate),
        ),
      };
      nextState = addLog(nextState, "Draven envoie toute la table en Enfer.", "bad");
      break;
    }

    case "made-in-heaven":
      nextState = rewindToStart(nextState, player.id);
      break;

    case "portal":
      nextState = openPortals(nextState, player.id);
      break;

    case "black-cup":
      nextState = castBlackCup(nextState, player.id);
      break;

    case "sentence":
      nextState = passSentence(nextState, player.id);
      break;

    case "doomsday":
      nextState = startDoomsday(nextState, player.id);
      break;

    default:
      return state;
  }

  if (nextState.phase !== "playing") return nextState;
  // Teleported onto a green or red tile, the wheel spins all the same; a pull or a swap never earns one.
  if (!MOVES_WITHOUT_ARRIVAL.includes(itemId)) nextState = queueWheelsForMovedPlayers(state, nextState);
  return settleBoard(nextState, nextState.turnStage);
}

/**
 * A volley of Tomates in the face, for fun. Each one has its own small chance
 * to knock the target out; knocked out once or several times, it is a single
 * skipped turn.
 */
function throwTomatoes(state: GameState, thrower: Player, target: Player, count: number): GameState {
  let stunned = false;
  const stunChance = getTomatoStunChance(thrower);
  for (let thrown = 0; thrown < count; thrown += 1) {
    if (drawEngineRandom() < stunChance) stunned = true;
  }
  const volley = count === 1 ? "une Tomate" : `${count} Tomates`;
  let nextState: GameState = {
    ...state,
    lastTomatoThrow: {
      seq: (state.lastTomatoThrow?.seq ?? 0) + 1,
      throwerId: thrower.id,
      targetId: target.id,
      count,
      stunned,
    },
  };
  // Tomato Enjoyer loves every one of them.
  if (hasCard(target, "tomato-enjoyer")) {
    nextState = applyCurrencyChange(nextState, target.id, TOMATO_ENJOYER_HIT_REWARD * count);
  }
  if (!stunned) return addLog(nextState, `${thrower.name} lance ${volley} sur ${target.name}. Splat !`, "event");
  nextState = updatePlayer(nextState, target.id, (current) => loseTurns(current));
  return addLog(
    nextState,
    `${thrower.name} lance ${volley} sur ${target.name}, qui est assommé : il passera son prochain tour !`,
    "bad",
  );
}

/**
 * Made In Heaven: everybody else is back on the start, out of Hell too, with
 * neither the start bonus nor an arrival, and the Red Cup stands on tile 8.
 * A Cup never lies on ice: Banquise's blizzard ice on that tile melts.
 */
function rewindToStart(state: GameState, userId: PlayerId): GameState {
  // The tile the Cup leaves becomes its previous one, as when a new Cup appears.
  const cupMoves = state.redCupNodeId !== MADE_IN_HEAVEN_CUP_NODE_ID;
  const meltsIce = state.iceTileNodeId === MADE_IN_HEAVEN_CUP_NODE_ID;
  let nextState: GameState = {
    // A Cup waiting in Hell under the Black Cup comes up too.
    ...dropBlackCup(state),
    redCupNodeId: MADE_IN_HEAVEN_CUP_NODE_ID,
    iceTileNodeId: meltsIce ? null : state.iceTileNodeId,
    previousRedCupNodeId: cupMoves ? state.redCupNodeId : state.previousRedCupNodeId,
    players: state.players.map((candidate) =>
      candidate.id === userId || isImmuneToItems(candidate) || candidate.position === START_NODE_ID
        ? candidate
        : { ...candidate, position: START_NODE_ID, hellTurns: 0 },
    ),
  };
  nextState = addLog(
    nextState,
    `Made In Heaven : le temps s’accélère ! Tout le monde revient au Départ, et la Red Cup se pose en case ${MADE_IN_HEAVEN_CUP_NODE_ID}.`,
    "event",
  );
  // A start frozen by the blizzard carries them on.
  nextState = state.players.reduce((current, player) => carryOffIce(current, player.id, player.position), nextState);
  return meltsIce
    ? addLog(nextState, `La glace de la case ${MADE_IN_HEAVEN_CUP_NODE_ID} fond sous la Red Cup.`, "event")
    : nextState;
}

/** Sets a player down on `nodeId`; Hell goes through the usual trip there. */
function moveTo(player: Player, nodeId: NodeId): Player {
  return nodeId === HELL_NODE_ID ? placeInHell(player) : { ...player, position: nodeId };
}

/** Corde pulls the target onto the user's tile; Baraqué only moves half the way. */
function pullWithRope(state: GameState, user: Player, target: Player): GameState {
  if (!hasCard(target, "built-like-a-tank")) {
    // Pulled from Hell into Hell: a trip there, which L'Ange-Gardien never makes.
    const nextState = updatePlayer(state, target.id, (currentPlayer) => moveTo(currentPlayer, user.position));
    return addLog(nextState, `${target.name} est tiré sur la case de ${user.name}.`, "event");
  }

  const path = getShortestPath(getOpenBoard(state), target.position, user.position, true) ?? [];
  const steps = Math.ceil(path.length / 2);
  const nextState = updatePlayer(state, target.id, (currentPlayer) => ({
    ...currentPlayer,
    position: steps > 0 ? path[steps - 1] : currentPlayer.position,
  }));
  // Pulled halfway onto ice, the ice carries them on.
  return carryOffIce(
    addLog(nextState, `${target.name} résiste à la Corde grâce à Baraqué.`, "event"),
    target.id,
    target.position,
  );
}

/**
 * Who an item would hurt: its single target, or for Draven everyone else.
 * The Tomate is only for fun and never asks.
 */
function getItemVictims(state: GameState, actorId: PlayerId, itemId: ItemId, targetPlayerId?: PlayerId): PlayerId[] {
  if (itemId === "draven") {
    return state.players
      .filter((player) => player.id !== actorId && !isImmuneToItems(player) && !isInvisible(state, player))
      .map((player) => player.id);
  }
  if (ITEM_CATALOG[itemId].target !== "player" || isThrownItem(itemId)) return [];
  return targetPlayerId && targetPlayerId !== actorId ? [targetPlayerId] : [];
}

/** Holders of a ready Non merci among the players an item would hurt. */
export function getNoThanksReactors(state: GameState, victimIds: PlayerId[]): PlayerId[] {
  return state.players
    .filter((player) => victimIds.includes(player.id) && canUseNoThanks(player, state.round))
    .map((player) => player.id);
}

/** Mage noir: the victims who hold a mark and a chance, and may teleport out of the item's way. */
export function getTeleportReactors(state: GameState, victimIds: PlayerId[]): PlayerId[] {
  return state.players
    .filter(
      (player) =>
        victimIds.includes(player.id) &&
        canTeleport(state, player) &&
        findMark(state, player.id)?.nodeId !== player.position,
    )
    .map((player) => player.id);
}

/** L'Ange-Gardien holding a Bouclier, when a single-target item is aimed at their protégé by someone else. */
function getShieldBearers(state: GameState, actorId: PlayerId, action: DeclaredAction): PlayerId[] {
  const guardian = state.guardian;
  if (!guardian || action.type !== "item" || action.itemId === "draven") return [];
  if (action.targetPlayerId !== guardian.protegeId || actorId === guardian.angelId) return [];
  const angel = findPlayer(state, guardian.angelId);
  return angel && holdsShield(angel) ? [angel.id] : [];
}

function holdsShield(player: Player): boolean {
  return player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "shield");
}

/**
 * Non merci (patch 0.1.4): an item used against its holder waits for their
 * answer, as it does for L'Ange-Gardien's Bouclier when it targets their
 * protégé; null when nobody can cancel it.
 */
export function openReactionWindow(state: GameState, action: DeclaredAction): GameState | null {
  const actor = getActivePlayer(state);
  if (!actor || action.type !== "item") return null;
  const victimIds = getItemVictims(state, actor.id, action.itemId, action.targetPlayerId);
  const reactorIds = [
    ...new Set([
      ...getNoThanksReactors(state, victimIds),
      ...getTeleportReactors(state, victimIds),
      ...getShieldBearers(state, actor.id, action),
    ]),
  ];
  if (reactorIds.length === 0) return null;

  const pendingReaction: PendingReaction = { actorId: actor.id, action, reactorIds, resumeStage: state.turnStage };
  return addLog({ ...state, turnStage: "reaction", pendingReaction }, `${actor.name} annonce son action…`, "event");
}

/** Spends the holder's Non merci: it recharges `NO_THANKS_COOLDOWN_ROUNDS` rounds after `round`. */
export function spendNoThanks(state: GameState, holderId: PlayerId, round: number): GameState {
  return updatePlayer(state, holderId, (player) => ({
    ...player,
    noThanksReadyRound: round + NO_THANKS_COOLDOWN_ROUNDS,
  }));
}

/**
 * A cancelled item is lost with its energy, but the actor's turn goes on.
 * Draven still sends the rest of the table to Hell: Non merci only spares its
 * holder. A Mage noir may answer by teleporting to their mark instead (`teleport`): the item is cancelled for them
 * all the same, they pay a chance, and they land on the mark.
 */
export function cancelDeclaredAction(
  state: GameState,
  pending: PendingReaction,
  reactorId: PlayerId,
  teleport = false,
): GameState {
  const reactor = findPlayer(state, reactorId);
  const actor = findPlayer(state, pending.actorId);
  const { action } = pending;
  if (!reactor || !actor || action.type !== "item") return state;
  if (teleport && (!canTeleport(state, reactor) || findMark(state, reactor.id)?.nodeId === reactor.position))
    return state;

  // L'Ange-Gardien raises their Bouclier, which is then spent; anybody else answers with Non merci, and the mage
  // with a teleport, which costs a chance and no cooldown.
  const shield = !teleport && hasCard(reactor, "guardian-angel");
  // A reactor who answers with neither a Bouclier nor a teleport must hold a ready Non merci (a mage is listed for
  // their mark alone).
  if (!teleport && !shield && !canUseNoThanks(reactor, state.round)) return state;
  const shieldEntry = reactor.inventory.find((entry) => entry.kind === "item" && entry.itemId === "shield");
  let nextState = teleport
    ? state
    : shield
      ? updatePlayer(state, reactor.id, (player) => spendItemEntry(player, shieldEntry?.id ?? ""))
      : spendNoThanks(state, reactor.id, state.round);
  const base: GameState = { ...nextState, pendingReaction: null, turnStage: pending.resumeStage };
  const teleportAfter = (current: GameState): GameState =>
    teleport && current.phase === "playing"
      ? settleBoard(teleportToMark(current, reactor.id, "reaction"), current.turnStage)
      : current;
  if (action.itemId === "draven" && !shield) {
    const plan = planItemUse(base, action.entryId);
    if (!plan) return base;
    const spared = addLog(
      base,
      teleport
        ? `${reactor.name} se téléporte : Draven l’épargne.`
        : `${reactor.name} utilise Non merci : Draven l’épargne.`,
      "event",
    );
    // The mage slips away first and arrives on their mark; Draven then strikes the others. One settling at the end, so
    // that what the arrival opened (a Red Cup to place, a wheel) and the duels in Hell wait for each other.
    const dodged = teleport && spared.phase === "playing" ? teleportToMark(spared, reactor.id, "reaction") : spared;
    return applyItemUse(dodged, action.entryId, { ...plan, sparedIds: [reactor.id] });
  }

  nextState = base;
  if (CANCELLED_ITEM_IS_CONSUMED) {
    nextState = updatePlayer(nextState, actor.id, (player) => spendItemEntry(player, action.entryId));
  }
  nextState = spendEnergy(nextState, getItemEnergyCost(action.itemId));
  const itemName = ITEM_CATALOG[action.itemId].name;
  const answer = teleport ? "se téléporte" : shield ? "lève son Bouclier" : "utilise Non merci";
  nextState = addLog(
    nextState,
    `${reactor.name} ${answer} : l’objet de ${actor.name} (${itemName}) est annulé.`,
    "event",
  );
  return teleportAfter(nextState);
}

/** Re-plays the declared item once nobody reacted, from the stage it was declared in. */
export function carryOutDeclaredAction(state: GameState, pending: PendingReaction): GameState {
  const base: GameState = { ...state, pendingReaction: null, turnStage: pending.resumeStage };
  const { action } = pending;
  if (action.type !== "item") return base;
  const plan = planItemUse(base, action.entryId, action.targetPlayerId);
  return plan ? applyItemUse(base, action.entryId, plan) : base;
}
