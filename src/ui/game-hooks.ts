import { useMemo } from "react";
import { getBoard } from "../game/board";
import { getForwardTiles } from "../game/game-actions";
import { getDecidingPlayer, getLegalMoveOptions } from "../game/rules";
import { canUseDelinquent, useGameStore } from "../game/store";
import type { GameState, NodeId, Player } from "../game/types";
import { useUiStore } from "../feedback/ui-store";
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

export function computeLegalMoves(state: GameState, ignoreArrows: boolean): LegalMoves {
  const activePlayer = state.players[state.activePlayerIndex];
  const paths = new Map<NodeId, NodeId[]>();
  if (state.phase !== "playing" || !activePlayer) return { origin: null, paths };

  if (state.turnStage === "reposition") {
    for (const nodeId of getBoard(state).normalNodeIds) paths.set(nodeId, [nodeId]);
    return { origin: null, paths };
  }

  // Wheel of fortune: the spinner, active or not, steps onto a neighbouring tile.
  const walker = state.players.find((player) => player.id === state.pendingAdvance?.playerId);
  if (state.turnStage === "advance" && walker) {
    for (const nodeId of getForwardTiles(state, walker)) paths.set(nodeId, [nodeId]);
    return { origin: walker.position, paths };
  }

  if (state.turnStage !== "move") return { origin: null, paths };
  const canIgnoreArrows = ignoreArrows && canUseDelinquent(activePlayer, state.round);
  for (const path of getLegalMoveOptions(getBoard(state), activePlayer, state.moveDistance, canIgnoreArrows)) {
    const destination = path[path.length - 1];
    if (!paths.has(destination)) paths.set(destination, path);
  }
  return { origin: activePlayer.position, paths };
}

/** In an online game, only the device of the deciding player sees and walks the paths. */
function isLocalDecider(state: GameState, localPlayerId: string | null): boolean {
  return localPlayerId === null || getDecidingPlayer(state)?.id === localPlayerId;
}

export function useLegalMoves(): LegalMoves {
  const game = useGameStore();
  const ignoreArrows = useUiStore((state) => state.ignoreArrows);
  const localPlayerId = useLocalPlayerId();
  return useMemo(
    () =>
      isLocalDecider(game, localPlayerId)
        ? computeLegalMoves(game, ignoreArrows)
        : { origin: null, paths: new Map<NodeId, NodeId[]>() },
    [game, ignoreArrows, localPlayerId],
  );
}

/** Commits a move (or a New Cup, New Me repositioning, or a step won on a wheel) to the chosen tile. */
export function commitDestination(nodeId: NodeId): void {
  const game = useGameStore.getState();
  const ui = useUiStore.getState();
  const legal = computeLegalMoves(game, ui.ignoreArrows);
  if (!isLocalDecider(game, getLocalPlayerId()) || !legal.paths.has(nodeId)) {
    soundEffects.error();
    return;
  }

  ui.setPreviewNodeId(null);
  ui.setHoveredChipNodeId(null);
  if (game.turnStage === "reposition") {
    game.repositionBeforeCup(nodeId);
    return;
  }
  if (game.turnStage === "advance") {
    game.advanceOneTile(nodeId);
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
