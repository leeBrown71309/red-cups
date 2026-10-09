import { getBoard } from "../game/board";
import { ITEM_ORDER } from "../game/catalog";
import { IDLE_STRIKES_WARNING } from "../game/turn-clock";
import { countBagUnits, countItemUnits, countRedCups } from "../game/rules";
import { useGameStore } from "../game/store";
import type { BulletFlight, GameState, ItemId, Player } from "../game/types";
import { GAME_COUNTDOWN_MS, GHOST_ID, HELL_NODE_ID } from "../game/types";
import {
  ALERT_BANNER_MS,
  BULLET_IMPACT_PAUSE_MS,
  BULLET_LANDING_PAUSE_MS,
  CUP_CELEBRATION_MS,
  CUP_ROLL_THROW_MS,
  estimateBulletFlightMs,
  estimateMovementMs,
} from "../theme/timing";
import { emitFeedback, type FeedbackEvent } from "./event-bus";
import { useUiStore } from "./ui-store";

/** Lets the camera fly from the lobby orbit to the board before the first turn banner. */
const GAME_INTRO_MS = 950;

/** Items whose use already has its own feedback: the mud splash and the Tomate's throw. */
const ITEMS_WITH_OWN_FEEDBACK: ItemId[] = ["mud", "tomato"];

/** The item a player's bag lost between two states, if any. */
function findSpentItem(before: Player, after: Player): ItemId | null {
  return ITEM_ORDER.find((itemId) => countItemUnits(after, itemId) < countItemUnits(before, itemId)) ?? null;
}

/**
 * Turns raw state transitions into presentation events. Events caused by a
 * walk are delayed until the pawn lands, so coins pop above the right tile.
 */
export function startGameFeedback(): () => void {
  const pendingTimers = new Set<number>();

  const schedule = (events: FeedbackEvent[], delay: number) => {
    if (events.length === 0) return;
    if (delay <= 0) {
      events.forEach(emitFeedback);
      return;
    }
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      events.forEach(emitFeedback);
    }, delay);
    pendingTimers.add(timer);
  };

  const unsubscribe = useGameStore.subscribe((state, previous) => {
    if (state.phase === "setup") {
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      pendingTimers.clear();
      useUiStore.getState().resetUi();
      return;
    }

    const ui = useUiStore.getState();
    const now = performance.now();
    const movement = state.lastMovement;
    const walked = movement !== null && movement.seq !== previous.lastMovement?.seq;
    // Timed on the board the walk was played on: a Cup picked up on arrival may flip the carousel.
    const walkDuration = walked && movement ? estimateMovementMs(getBoard(previous), movement) : 0;
    const gameJustStarted = previous.phase !== "playing" && state.phase === "playing";
    // After a draft, the table first reads a five-second countdown.
    const afterDraft = gameJustStarted && previous.phase === "draft";
    const introDelay = gameJustStarted ? GAME_INTRO_MS + (afterDraft ? GAME_COUNTDOWN_MS : 0) : 0;
    if (afterDraft) ui.setCountdownUntil(now + GAME_COUNTDOWN_MS);
    const flight = getNewBulletFlight(state, previous);
    const flightMs = flight ? estimateBulletFlightMs(flight.path) : 0;
    const impactPauseMs = flight ? (flight.victimId ? BULLET_IMPACT_PAUSE_MS : BULLET_LANDING_PAUSE_MS) : 0;

    // Timeline: the walk (or the camera intro), Bullet Bill's charge, its impact, then the next turn.
    const startsAt = Math.max(gameJustStarted ? 0 : ui.boardBusyUntil, now + walkDuration + introDelay);
    const impactAt = startsAt + flightMs;
    const nextTurnAt = impactAt + impactPauseMs;
    const events = collectEvents(state, previous, walked ? (movement?.playerId ?? null) : null, flight);
    const celebrates = events.some((event) => event.type === "cup-collected");
    // The shop, the wheels and the other dialogs wait until the whole table has read the map's banner.
    const announcesMapEvent = events.some((event) =>
      [
        "carousel-flipped",
        "blizzard",
        "ice-fall",
        "ghost-appeared",
        "ghost-attack",
        "doomsday-started",
        "black-cup-cast",
      ].includes(event.type),
    );

    // Roller: the throws for the Red Cup play first, and what follows (the pickup, the next turn) waits for them.
    const cupRoll = state.lastCupRoll && state.lastCupRoll.seq !== previous.lastCupRoll?.seq ? state.lastCupRoll : null;
    const cupRollMs = cupRoll ? cupRoll.rolls.length * CUP_ROLL_THROW_MS : 0;
    if (cupRoll) {
      const { playerId, rolls, success } = cupRoll;
      schedule([{ type: "cup-roll", playerId, rolls, success }], impactAt - now);
    }

    if (flight) schedule([{ type: "bullet-flight", flight }], startsAt - now);
    schedule(
      events.filter((event) => event.type !== "turn-start"),
      impactAt + cupRollMs - now,
    );
    schedule(
      events.filter((event) => event.type === "turn-start"),
      nextTurnAt + cupRollMs - now,
    );

    // Only real animations hold modals back: moving the deadline to "now" would unmount an open
    // modal for a frame (the shop used to blink after every purchase).
    const settlesAt = Math.max(
      nextTurnAt + cupRollMs + (cupRoll ? ALERT_BANNER_MS : 0) + (celebrates ? CUP_CELEBRATION_MS : 0),
      announcesMapEvent ? impactAt + ALERT_BANNER_MS : 0,
    );
    if (settlesAt > now && settlesAt > ui.boardBusyUntil) ui.setBoardBusyUntil(settlesAt);
  });

  return () => {
    unsubscribe();
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
  };
}

function getNewBulletFlight(state: GameState, previous: GameState): BulletFlight | null {
  const flight = state.lastBulletFlight;
  return flight && flight.seq !== previous.lastBulletFlight?.seq ? flight : null;
}

/** Luna Park: what the ghost did, from its last recorded deed and the duel it starts. */
function collectGhostEvents(state: GameState, previous: GameState): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  const deed = state.lastGhostEvent;
  if (deed && deed.seq !== previous.lastGhostEvent?.seq && previous.phase === "playing") {
    if (deed.kind === "appear" && deed.to !== null) events.push({ type: "ghost-appeared", nodeId: deed.to });
    if (deed.kind === "move" && deed.from !== null && deed.to !== null) {
      events.push({ type: "ghost-moved", from: deed.from, to: deed.to, path: deed.path ?? [deed.to] });
    }
    if (deed.kind === "teleport" && deed.from !== null && deed.to !== null) {
      events.push({ type: "ghost-teleported", from: deed.from, to: deed.to });
    }
    if (deed.kind === "vanish") events.push({ type: "ghost-vanished", nodeId: deed.from });
    if (deed.kind === "fling" && deed.playerId && deed.from !== null) {
      events.push({ type: "ghost-flung", playerId: deed.playerId, from: deed.from });
    }
  }

  const duel = state.pendingDuel;
  const newDuel =
    duel !== null && (previous.pendingDuel === null || previous.pendingDuel.playerOneId !== duel.playerOneId);
  if (duel?.ghost && newDuel && state.ghost?.nodeId != null) {
    events.push({ type: "ghost-attack", playerId: duel.playerOneId, nodeId: state.ghost.nodeId });
  }

  const settled = previous.pendingDuel?.ghost;
  const ghostWon = settled && previous.pendingDuel?.winnerId === GHOST_ID && state.pendingDuel !== previous.pendingDuel;
  if (settled && ghostWon && settled.penalty.kind !== "hell" && previous.pendingDuel) {
    events.push({ type: "ghost-stole", playerId: previous.pendingDuel.playerOneId });
  }
  return events;
}

function collectEvents(
  state: GameState,
  previous: GameState,
  walkerId: string | null,
  flight: BulletFlight | null,
): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  const activePlayer = state.players[state.activePlayerIndex];

  for (const player of previous.players) {
    if (!state.players.some((candidate) => candidate.id === player.id)) {
      events.push({ type: "player-left", playerId: player.id });
    }
  }

  const newLogEntries = [];
  const previousNewestId = previous.log[0]?.id;
  for (const entry of state.log) {
    if (entry.id === previousNewestId) break;
    newLogEntries.push(entry);
  }
  newLogEntries.reverse().forEach((entry) => events.push({ type: "log", entry }));

  const previousActive = previous.players.find((player) => player.id === activePlayer?.id);
  const inShop = state.turnStage === "shop" && previous.turnStage === "shop" && activePlayer !== undefined;
  const boughtItem =
    inShop &&
    previousActive !== undefined &&
    // A Tomate bought onto its stack adds no slot: the bag's units tell a purchase.
    countBagUnits(activePlayer) > countBagUnits(previousActive);

  for (const player of state.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    if (!before) continue;

    const delta = player.currency - before.currency;
    // Whatever leaves the purse inside the shop is a price: it must never be shown, a Tomate stack included.
    const purchase = inShop && player.id === activePlayer?.id && delta < 0;
    if (delta !== 0) events.push({ type: "currency", playerId: player.id, delta, purchase });

    if (countRedCups(player) > countRedCups(before)) {
      events.push({ type: "cup-collected", playerId: player.id, nodeId: player.position });
    }

    if (player.position !== before.position) {
      if (player.position === HELL_NODE_ID) events.push({ type: "hell-entered", playerId: player.id });
      else if (before.position === HELL_NODE_ID) events.push({ type: "hell-escaped", playerId: player.id });
      else if (player.id !== walkerId) events.push({ type: "teleport", playerId: player.id });
    }

    if (player.skippedTurns < before.skippedTurns) events.push({ type: "turn-skipped" });
  }

  if (state.redCupNodeId !== null && state.redCupNodeId !== previous.redCupNodeId && previous.phase === "playing") {
    events.push({ type: "cup-spawned", nodeId: state.redCupNodeId });
  }

  if (state.turnStage === "shop" && previous.turnStage !== "shop" && activePlayer) {
    events.push({ type: "shop-opened", playerId: activePlayer.id });
  }

  if (boughtItem && activePlayer) events.push({ type: "purchase", playerId: activePlayer.id });

  const cancelled = newLogEntries.some((entry) => entry.text.includes("utilise Non merci"));
  if (state.pendingReaction && !previous.pendingReaction) events.push({ type: "reaction-opened" });
  if (cancelled) events.push({ type: "action-cancelled" });

  // Several items may be used in one turn: each one shows by the bag it left.
  const spentItem = activePlayer && previousActive ? findSpentItem(previousActive, activePlayer) : null;
  const usedItem =
    !walkerId &&
    !cancelled &&
    spentItem !== null &&
    !ITEMS_WITH_OWN_FEEDBACK.includes(spentItem) &&
    ["move", "hell", "reaction"].includes(previous.turnStage);
  if (usedItem) events.push({ type: "item-used" });

  if (state.pendingDuel && !previous.pendingDuel) events.push({ type: "duel-started" });

  const gamble = state.lastGambleResult;
  if (gamble && gamble.seq !== previous.lastGambleResult?.seq) {
    events.push({ type: "gamble-result", playerId: gamble.playerId, doubled: gamble.doubled });
  }

  if (state.mudTraps.length > previous.mudTraps.length) {
    const trap = state.mudTraps[state.mudTraps.length - 1];
    events.push({ type: "mud-placed", nodeId: trap.nodeId });
  } else if (state.mudTraps.length < previous.mudTraps.length) {
    const triggered = previous.mudTraps.find((trap) => !state.mudTraps.some((candidate) => candidate.id === trap.id));
    if (triggered) events.push({ type: "mud-triggered", nodeId: triggered.nodeId });
  }

  if (state.bulletBill && !previous.bulletBill) events.push({ type: "bullet-launched" });
  if (flight?.victimId) {
    const nodeId = flight.path[flight.path.length - 1] ?? flight.from;
    events.push({ type: "bullet-hit", playerId: flight.victimId, nodeId });
  }

  if (state.turnStage === "blessing" && previous.blessingQueue.length === 0) events.push({ type: "blessing-started" });
  if (state.doomsday && !previous.doomsday) events.push({ type: "doomsday-started" });
  const opening = state.players[state.activePlayerIndex];
  const newTurn =
    opening && (opening.id !== previous.players[previous.activePlayerIndex]?.id || state.round !== previous.round);
  if (newTurn && (state.idleStrikes[opening.id] ?? 0) >= IDLE_STRIKES_WARNING) {
    events.push({ type: "last-chance", playerId: opening.id });
  }
  if (state.blackCup && !previous.blackCup) events.push({ type: "black-cup-cast" });
  if (state.lastBlizzard && state.lastBlizzard.seq !== previous.lastBlizzard?.seq && previous.phase === "playing") {
    events.push({ type: "blizzard", from: state.lastBlizzard.from, to: state.lastBlizzard.to });
  }
  if (state.lastIceFall && state.lastIceFall.seq !== previous.lastIceFall?.seq) {
    const { playerId, from, to, hit } = state.lastIceFall;
    events.push({ type: "ice-fall", playerId, from, to, hit });
  }
  events.push(...collectGhostEvents(state, previous));
  const snowball = state.lastSnowball;
  if (snowball && snowball.seq !== previous.lastSnowball?.seq) {
    events.push({ type: "snowball-thrown", targetId: snowball.targetId, hit: snowball.hit, frozen: snowball.frozen });
  }
  const tomato = state.lastTomatoThrow;
  if (tomato && tomato.seq !== previous.lastTomatoThrow?.seq) {
    events.push({
      type: "tomato-thrown",
      throwerId: tomato.throwerId,
      targetId: tomato.targetId,
      count: tomato.count ?? 1,
      stunned: tomato.stunned,
    });
  }
  if (state.carouselReversed !== previous.carouselReversed && previous.phase === "playing") {
    events.push({ type: "carousel-flipped", reversed: state.carouselReversed });
  }

  // Compared by player, not by seat: seats shift when someone before the active player leaves.
  const previousActiveId = previous.players[previous.activePlayerIndex]?.id;
  const turnChanged =
    state.phase === "playing" &&
    (previous.phase !== "playing" ||
      activePlayer?.id !== previousActiveId ||
      state.round !== previous.round ||
      (["turn-end", "shop"].includes(previous.turnStage) && ["move", "hell"].includes(state.turnStage)));
  if (turnChanged && activePlayer) events.push({ type: "turn-start", playerId: activePlayer.id });

  if (state.phase === "finished" && previous.phase !== "finished" && state.winnerId) {
    events.push({ type: "victory", playerId: state.winnerId });
  }

  return events;
}
