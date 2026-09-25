import { countRedCups } from "../game/rules";
import { useGameStore } from "../game/store";
import type { GameState } from "../game/types";
import { HELL_NODE_ID } from "../game/types";
import { CUP_CELEBRATION_MS, estimateMovementMs } from "../theme/timing";
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
    const busyUntil = Math.max(gameJustStarted ? 0 : ui.boardBusyUntil, now + walkDuration + introDelay);
    const events = collectEvents(state, previous, walked ? (movement?.playerId ?? null) : null);
    const celebrates = events.some((event) => event.type === "cup-collected");

    ui.setBoardBusyUntil(busyUntil + (celebrates ? CUP_CELEBRATION_MS : 0));
    schedule(events, busyUntil - now);
  });

  return () => {
    unsubscribe();
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
  };
}

function collectEvents(state: GameState, previous: GameState, walkerId: string | null): FeedbackEvent[] {
  const events: FeedbackEvent[] = [];
  const activePlayer = state.players[state.activePlayerIndex];

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

  const usedItem =
    !walkerId && state.turnActionTaken && !previous.turnActionTaken && ["move", "hell"].includes(previous.turnStage);
  if (usedItem) events.push({ type: "item-used" });

  if (state.pendingDuel && !previous.pendingDuel) events.push({ type: "duel-started" });

  if (state.mudTraps.length > previous.mudTraps.length) {
    const trap = state.mudTraps[state.mudTraps.length - 1];
    events.push({ type: "mud-placed", nodeId: trap.nodeId });
  } else if (state.mudTraps.length < previous.mudTraps.length) {
    const triggered = previous.mudTraps.find((trap) => !state.mudTraps.some((candidate) => candidate.id === trap.id));
    if (triggered) events.push({ type: "mud-triggered", nodeId: triggered.nodeId });
  }

  if (state.bulletBill?.status === "active" && previous.bulletBill?.status === "waiting") {
    events.push({ type: "bullet-spawned" });
  }
  if (previous.bulletBill?.status === "active" && state.bulletBill === null) {
    const victim = state.players.find((player) => {
      const before = previous.players.find((candidate) => candidate.id === player.id);
      return before !== undefined && player.skippedTurns > before.skippedTurns;
    });
    if (victim) events.push({ type: "bullet-hit", playerId: victim.id });
  }

  const turnChanged =
    state.phase === "playing" &&
    (previous.phase !== "playing" ||
      state.activePlayerIndex !== previous.activePlayerIndex ||
      state.round !== previous.round ||
      (["turn-end", "shop"].includes(previous.turnStage) && ["move", "hell"].includes(state.turnStage)));
  if (turnChanged && activePlayer) events.push({ type: "turn-start", playerId: activePlayer.id });

  if (state.phase === "finished" && previous.phase !== "finished" && state.winnerId) {
    events.push({ type: "victory", playerId: state.winnerId });
  }

  return events;
}
