import { useMemo } from "react";
import { NORMAL_NODE_IDS } from "../game/board";
import { getLegalMoveOptions } from "../game/rules";
import { canUseDelinquent, useGameStore } from "../game/store";
import type { GameState, NodeId, Player, PlayerId } from "../game/types";
import { useUiStore } from "../feedback/ui-store";
import { soundEffects } from "../audio/sound-effects";

export interface LegalMoves {
  /** Tile the previewed paths start from; null when paths are not walks. */
  origin: NodeId | null;
  paths: Map<NodeId, NodeId[]>;
}

export function useActivePlayer(): Player | undefined {
  return useGameStore((state) => state.players[state.activePlayerIndex]);
}

/**
 * Player who must act right now: usually the active one, except for New Cup,
 * New Me, a tile wheel owed by someone who was teleported or pushed there,
 * and the next spinner of a Tour de Bénédiction.
 */
export function getDecidingPlayer(state: GameState): Player | undefined {
  const deciderIds: Partial<Record<GameState["turnStage"], PlayerId | null | undefined>> = {
    reposition: state.pendingCupRepositionPlayerId,
    "tile-wheel": state.pendingTileWheels[0]?.playerId,
    blessing: state.blessingQueue[0],
  };
  const deciderId = deciderIds[state.turnStage];
  return state.players.find((player) => player.id === deciderId) ?? state.players[state.activePlayerIndex];
}

export function useDecidingPlayer(): Player | undefined {
  return useGameStore(getDecidingPlayer);
}

export function computeLegalMoves(state: GameState, ignoreArrows: boolean): LegalMoves {
  const activePlayer = state.players[state.activePlayerIndex];
  const paths = new Map<NodeId, NodeId[]>();
  if (state.phase !== "playing" || !activePlayer) return { origin: null, paths };

  if (state.turnStage === "reposition") {
    for (const nodeId of NORMAL_NODE_IDS) paths.set(nodeId, [nodeId]);
    return { origin: null, paths };
  }

  if (state.turnStage !== "move") return { origin: null, paths };
  const canIgnoreArrows = ignoreArrows && canUseDelinquent(activePlayer, state.round);
  for (const path of getLegalMoveOptions(activePlayer, state.moveDistance, canIgnoreArrows)) {
    const destination = path[path.length - 1];
    if (!paths.has(destination)) paths.set(destination, path);
  }
  return { origin: activePlayer.position, paths };
}

export function useLegalMoves(): LegalMoves {
  const game = useGameStore();
  const ignoreArrows = useUiStore((state) => state.ignoreArrows);
  return useMemo(() => computeLegalMoves(game, ignoreArrows), [game, ignoreArrows]);
}

/** Commits a move (or a New Cup, New Me repositioning) to the chosen tile. */
export function commitDestination(nodeId: NodeId): void {
  const game = useGameStore.getState();
  const ui = useUiStore.getState();
  const legal = computeLegalMoves(game, ui.ignoreArrows);
  if (!legal.paths.has(nodeId)) {
    soundEffects.error();
    return;
  }

  ui.setPreviewNodeId(null);
  ui.setHoveredChipNodeId(null);
  if (game.turnStage === "reposition") {
    game.repositionBeforeCup(nodeId);
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
