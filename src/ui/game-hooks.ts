import { useMemo } from "react";
import { getForwardTiles } from "../game/game-actions";
import { getCalmDownTiles } from "../game/game-effects";
import { getDigTargets } from "../game/mole";
import { isBlindToRedCup } from "../game/passive-rules";
import { getDecidingPlayer, getTurnMoveOptions } from "../game/rules";
import { canUseCorrupter, useGameStore } from "../game/store";
import type { GameState, NodeId, Player } from "../game/types";
import { isCountdownRunning, useCountdownRunning, useUiStore } from "../feedback/ui-store";
import { getLocalPlayerId, useLocalPlayerId } from "../net/room-store";
import { soundEffects } from "../audio/sound-effects";

export { getDecidingPlayer };

export interface LegalMoves {
  /** Tile the previewed paths start from; null when paths are not walks. */
  origin: NodeId | null;
  paths: Map<NodeId, NodeId[]>;
}

export function useActivePlayer(): Player | undefined {
  return useGameStore((state) => state.players[state.activePlayerIndex]);
}

export function useDecidingPlayer(): Player | undefined {
  return useGameStore(getDecidingPlayer);
}

export function computeLegalMoves(state: GameState, ignoreArrows: boolean, digMode = false): LegalMoves {
  const activePlayer = state.players[state.activePlayerIndex];
  const paths = new Map<NodeId, NodeId[]>();
  if (state.phase !== "playing" || !activePlayer) return { origin: null, paths };

  // Calme-toi: the holder sets a player down three steps from the new Red Cup.
  if (state.turnStage === "passive-choice") {
    for (const nodeId of getCalmDownTiles(state)) paths.set(nodeId, [nodeId]);
    return { origin: null, paths };
  }

  // Wheel of fortune: the spinner, active or not, steps onto a neighbouring tile.
  const walker = state.players.find((player) => player.id === state.pendingAdvance?.playerId);
  if (state.turnStage === "advance" && walker) {
    for (const nodeId of getForwardTiles(state, walker)) paths.set(nodeId, [nodeId]);
    return { origin: walker.position, paths };
  }

  if (state.turnStage !== "move") return { origin: null, paths };
  // Taupe: the tiles a tunnel may be dug to, shown instead of the walks while the player chooses.
  if (digMode) {
    for (const nodeId of getDigTargets(state, activePlayer)) paths.set(nodeId, [nodeId]);
    return { origin: activePlayer.position, paths };
  }
  const canIgnoreArrows = ignoreArrows && canUseCorrupter(activePlayer, state.round);
  for (const path of getTurnMoveOptions(state, activePlayer, canIgnoreArrows)) {
    const destination = path[path.length - 1];
    if (!paths.has(destination)) paths.set(destination, path);
  }
  return { origin: activePlayer.position, paths };
}

/**
 * Chance aveugle never sees the Red Cup: online on their own device, and on a
 * shared screen whenever they are the one deciding.
 */
export function isRedCupHiddenFor(state: GameState, localPlayerId: string | null): boolean {
  const viewer =
    localPlayerId === null ? getDecidingPlayer(state) : state.players.find((player) => player.id === localPlayerId);
  return viewer !== undefined && state.phase === "playing" && isBlindToRedCup(viewer);
}

export function useRedCupHidden(): boolean {
  const localPlayerId = useLocalPlayerId();
  return useGameStore((state) => isRedCupHiddenFor(state, localPlayerId));
}

/** In an online game, only the device of the deciding player sees and walks the paths. */
function isLocalDecider(state: GameState, localPlayerId: string | null): boolean {
  return localPlayerId === null || getDecidingPlayer(state)?.id === localPlayerId;
}

export function useLegalMoves(): LegalMoves {
  const game = useGameStore();
  const ignoreArrows = useUiStore((state) => state.ignoreArrows);
  const digMode = useUiStore((state) => state.digMode);
  const countdownRunning = useCountdownRunning();
  const localPlayerId = useLocalPlayerId();
  return useMemo(
    () =>
      isLocalDecider(game, localPlayerId) && !countdownRunning
        ? computeLegalMoves(game, ignoreArrows, digMode)
        : { origin: null, paths: new Map<NodeId, NodeId[]>() },
    [game, ignoreArrows, digMode, localPlayerId, countdownRunning],
  );
}

/** Commits a move (or a step won on a wheel, or where Calme-toi sets a player down) to the chosen tile. */
export function commitDestination(nodeId: NodeId): void {
  const game = useGameStore.getState();
  const ui = useUiStore.getState();
  const legal = computeLegalMoves(game, ui.ignoreArrows, ui.digMode);
  if (isCountdownRunning() || !isLocalDecider(game, getLocalPlayerId()) || !legal.paths.has(nodeId)) {
    soundEffects.error();
    return;
  }

  ui.setPreviewNodeId(null);
  ui.setHoveredChipNodeId(null);
  if (game.turnStage === "passive-choice") {
    game.resolveCalmDown(nodeId, ui.calmTargetId ?? undefined);
    ui.setCalmTargetId(null);
    return;
  }
  if (game.turnStage === "advance") {
    game.advanceOneTile(nodeId);
    return;
  }
  // Taupe: the chosen tile is where the tunnel leads.
  if (ui.digMode) {
    ui.setDigMode(false);
    game.digTunnel(nodeId);
    return;
  }
  game.movePlayer(nodeId, ui.ignoreArrows);
  ui.setIgnoreArrows(false);
}

/**
 * Mouse users see the path on hover and move with one click. On touch
 * screens a first tap previews the path and a second tap confirms it.
 */
export function selectDestinationFromBoard(nodeId: NodeId, pointerType: string): void {
  const ui = useUiStore.getState();
  if (pointerType !== "mouse" && ui.previewNodeId !== nodeId) {
    ui.setPreviewNodeId(nodeId);
    soundEffects.softPop();
    return;
  }
  commitDestination(nodeId);
}
