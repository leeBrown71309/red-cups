import { countRedCups } from "../game/rules";
import { useGameStore } from "../game/store";
import type { BulletFlight, GameState } from "../game/types";
import { HELL_NODE_ID } from "../game/types";
import {
  BULLET_IMPACT_PAUSE_MS,
  BULLET_LANDING_PAUSE_MS,
  CUP_CELEBRATION_MS,
  estimateBulletFlightMs,
  estimateMovementMs,
} from "../theme/timing";
import { emitFeedback, type FeedbackEvent } from "./event-bus";
import { useUiStore } from "./ui-store";

/** Lets the camera fly from the lobby orbit to the board before the first turn banner. */
const GAME_INTRO_MS = 950;

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
    const walkDuration = walked && movement ? estimateMovementMs(movement.from, movement.path) : 0;
    const gameJustStarted = previous.phase !== "playing" && state.phase === "playing";
    const introDelay = gameJustStarted ? GAME_INTRO_MS : 0;
    const flight = getNewBulletFlight(state, previous);
    const flightMs = flight ? estimateBulletFlightMs(flight.path) : 0;
    const impactPauseMs = flight ? (flight.victimId ? BULLET_IMPACT_PAUSE_MS : BULLET_LANDING_PAUSE_MS) : 0;

    // Timeline: the walk (or the camera intro), Bullet Bill's charge, its impact, then the next turn.
    const startsAt = Math.max(gameJustStarted ? 0 : ui.boardBusyUntil, now + walkDuration + introDelay);
    const impactAt = startsAt + flightMs;
    const nextTurnAt = impactAt + impactPauseMs;
    const events = collectEvents(state, previous, walked ? (movement?.playerId ?? null) : null, flight);
    const celebrates = events.some((event) => event.type === "cup-collected");

    if (flight) schedule([{ type: "bullet-flight", flight }], startsAt - now);
    schedule(
      events.filter((event) => event.type !== "turn-start"),
      impactAt - now,
    );
    schedule(
      events.filter((event) => event.type === "turn-start"),
      nextTurnAt - now,
    );

    // Only real animations hold modals back: moving the deadline to "now" would unmount an open
    // modal for a frame (the shop used to blink after every purchase).
    const settlesAt = nextTurnAt + (celebrates ? CUP_CELEBRATION_MS : 0);
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

  for (const player of state.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    if (!before) continue;

    const delta = player.currency - before.currency;
    if (delta !== 0) events.push({ type: "currency", playerId: player.id, delta });

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

  const previousActive = previous.players.find((player) => player.id === activePlayer?.id);
  const boughtItem =
    state.turnStage === "shop" &&
    previous.turnStage === "shop" &&
    activePlayer !== undefined &&
    previousActive !== undefined &&
    (activePlayer.inventory.length > previousActive.inventory.length ||
      (state.bulletBill !== null && previous.bulletBill === null));
  if (boughtItem && activePlayer) events.push({ type: "purchase", playerId: activePlayer.id });

  const cancelled = newLogEntries.some((entry) => entry.text.includes("utilise Non merci"));
  if (state.pendingReaction && !previous.pendingReaction) events.push({ type: "reaction-opened" });
  if (cancelled) events.push({ type: "action-cancelled" });

  const usedItem =
    !walkerId &&
    !cancelled &&
    state.turnActionTaken &&
    !previous.turnActionTaken &&
    ["move", "hell", "reaction"].includes(previous.turnStage);
  if (usedItem) events.push({ type: "item-used" });

  if (state.pendingDuel && !previous.pendingDuel) events.push({ type: "duel-started" });

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
