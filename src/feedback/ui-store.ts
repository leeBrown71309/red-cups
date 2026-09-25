import { useEffect, useState } from "react";
import { create } from "zustand";
import type { GameLogEntry, NodeId, PlayerId } from "../game/types";

export interface Toast {
  id: string;
  text: string;
  tone: GameLogEntry["tone"];
}

interface UiState {
  /** Timestamp (performance.now) until which the board is still animating. */
  boardBusyUntil: number;
  toasts: Toast[];
  splash: { playerId: PlayerId; key: number } | null;
  followActivePlayer: boolean;
  /** Délinquant toggle for the current move. */
  ignoreArrows: boolean;
  /** Destination selected by a first tap on touch screens, waiting for confirmation. */
  previewNodeId: NodeId | null;
  /** Destination hovered in the HUD chips, highlighted on the board without selecting it. */
  hoveredChipNodeId: NodeId | null;
  setBoardBusyUntil: (timestamp: number) => void;
  setIgnoreArrows: (ignoreArrows: boolean) => void;
  setPreviewNodeId: (nodeId: NodeId | null) => void;
  setHoveredChipNodeId: (nodeId: NodeId | null) => void;
  pushToast: (toast: Toast) => void;
  dismissToast: (id: string) => void;
  showSplash: (playerId: PlayerId) => void;
  hideSplash: () => void;
  toggleFollowActivePlayer: () => void;
  resetUi: () => void;
}

const MAX_TOASTS = 4;

/** Big screens show the whole board anyway; phones benefit from the camera following the turn. */
function prefersFollowCamera(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-height: 520px)").matches;
}

/** Presentation-only state. Nothing here affects the rules of the game. */
export const useUiStore = create<UiState>((set) => ({
  boardBusyUntil: 0,
  toasts: [],
  splash: null,
  followActivePlayer: prefersFollowCamera(),
  ignoreArrows: false,
  previewNodeId: null,
  hoveredChipNodeId: null,
  setBoardBusyUntil: (boardBusyUntil) => set({ boardBusyUntil }),
  setIgnoreArrows: (ignoreArrows) => set({ ignoreArrows, previewNodeId: null }),
  setPreviewNodeId: (previewNodeId) => set({ previewNodeId, hoveredChipNodeId: null }),
  setHoveredChipNodeId: (hoveredChipNodeId) => set({ hoveredChipNodeId }),
  pushToast: (toast) => set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  showSplash: (playerId) => set((state) => ({ splash: { playerId, key: (state.splash?.key ?? 0) + 1 } })),
  hideSplash: () => set({ splash: null }),
  toggleFollowActivePlayer: () => set((state) => ({ followActivePlayer: !state.followActivePlayer })),
  resetUi: () =>
    set({
      boardBusyUntil: 0,
      toasts: [],
      splash: null,
      ignoreArrows: false,
      previewNodeId: null,
      hoveredChipNodeId: null,
    }),
}));

/**
 * True once pawns have landed. Modals wait for it so a shop never opens while
 * the player is still hopping towards the shop tile.
 */
export function useBoardSettled(): boolean {
  const busyUntil = useUiStore((state) => state.boardBusyUntil);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const remaining = busyUntil - performance.now();
    if (remaining <= 0) {
      setNow(performance.now());
      return undefined;
    }
    const timer = window.setTimeout(() => setNow(performance.now()), remaining + 16);
    return () => window.clearTimeout(timer);
  }, [busyUntil]);

  return now >= busyUntil;
}
