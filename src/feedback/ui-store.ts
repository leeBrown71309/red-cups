import { useEffect, useState } from "react";
import { create } from "zustand";
import type { GameLogEntry, NodeId, PlayerId } from "../game/types";

export interface Toast {
  id: string;
  text: string;
  tone: GameLogEntry["tone"];
}

/** Table-wide announcement (Bullet Bill, Tour de Bénédiction) that nobody should miss. */
export interface AlertBanner {
  key: number;
  /** Picks the banner's colours and icon: Bullet Bill for "danger", le diable's face for "devil"… */
  tone: "danger" | "devil" | "chances" | "blessing" | "carousel" | "blizzard" | "ghost" | "roller";
  eyebrow: string;
  title: string;
  detail: string;
}

interface UiState {
  /** Timestamp (performance.now) until which the board is still animating. */
  boardBusyUntil: number;
  /** Timestamp (performance.now) the countdown after the draft ends at. */
  countdownUntil: number;
  toasts: Toast[];
  splash: { playerId: PlayerId; key: number } | null;
  alert: AlertBanner | null;
  followActivePlayer: boolean;
  /** Luna Park: the ghost's loot window, opened by clicking the ghost on the board. */
  ghostLootOpen: boolean;
  /** The Barrière being set down: its bag entry while the player taps the road on the board to close. */
  roadPickEntryId: string | null;
  /** Taupe: the player is choosing the visited tile to dig a tunnel to, on the board. */
  digMode: boolean;
  /** Corrupteur toggle for the current move. */
  ignoreArrows: boolean;
  /** Calme-toi: the player the holder has chosen to set down, among those offered. */
  calmTargetId: PlayerId | null;
  /** Destination selected by a first tap on touch screens, waiting for confirmation. */
  previewNodeId: NodeId | null;
  /** Destination hovered in the HUD chips, highlighted on the board without selecting it. */
  hoveredChipNodeId: NodeId | null;
  setBoardBusyUntil: (timestamp: number) => void;
  setCountdownUntil: (timestamp: number) => void;
  setRoadPickEntryId: (entryId: string | null) => void;
  setDigMode: (digMode: boolean) => void;
  setIgnoreArrows: (ignoreArrows: boolean) => void;
  setCalmTargetId: (playerId: PlayerId | null) => void;
  setPreviewNodeId: (nodeId: NodeId | null) => void;
  setHoveredChipNodeId: (nodeId: NodeId | null) => void;
  pushToast: (toast: Toast) => void;
  dismissToast: (id: string) => void;
  showSplash: (playerId: PlayerId) => void;
  hideSplash: () => void;
  showAlert: (alert: Omit<AlertBanner, "key">) => void;
  hideAlert: (key: number) => void;
  toggleFollowActivePlayer: () => void;
  setGhostLootOpen: (open: boolean) => void;
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
  countdownUntil: 0,
  toasts: [],
  splash: null,
  alert: null,
  followActivePlayer: prefersFollowCamera(),
  ghostLootOpen: false,
  roadPickEntryId: null,
  digMode: false,
  ignoreArrows: false,
  calmTargetId: null,
  previewNodeId: null,
  hoveredChipNodeId: null,
  setDigMode: (digMode) => set({ digMode, previewNodeId: null }),
  setCalmTargetId: (calmTargetId) => set({ calmTargetId }),
  setRoadPickEntryId: (roadPickEntryId) => set({ roadPickEntryId }),
  setBoardBusyUntil: (boardBusyUntil) => set({ boardBusyUntil }),
  setCountdownUntil: (countdownUntil) => set({ countdownUntil }),
  setIgnoreArrows: (ignoreArrows) => set({ ignoreArrows, previewNodeId: null }),
  setPreviewNodeId: (previewNodeId) => set({ previewNodeId, hoveredChipNodeId: null }),
  setHoveredChipNodeId: (hoveredChipNodeId) => set({ hoveredChipNodeId }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts.filter((existing) => existing.id !== toast.id), toast].slice(-MAX_TOASTS),
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  showSplash: (playerId) => set((state) => ({ splash: { playerId, key: (state.splash?.key ?? 0) + 1 } })),
  hideSplash: () => set({ splash: null }),
  // A newer announcement replaces the current one: the impact takes over from the charge.
  showAlert: (alert) => set((state) => ({ alert: { ...alert, key: (state.alert?.key ?? 0) + 1 } })),
  hideAlert: (key) => set((state) => (state.alert?.key === key ? { alert: null } : state)),
  toggleFollowActivePlayer: () => set((state) => ({ followActivePlayer: !state.followActivePlayer })),
  setGhostLootOpen: (ghostLootOpen) => set({ ghostLootOpen }),
  resetUi: () =>
    set({
      boardBusyUntil: 0,
      countdownUntil: 0,
      toasts: [],
      splash: null,
      alert: null,
      ghostLootOpen: false,
      roadPickEntryId: null,
      digMode: false,
      ignoreArrows: false,
      calmTargetId: null,
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
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setNow(performance.now()), remaining + 16);
    return () => window.clearTimeout(timer);
  }, [busyUntil]);

  // The live clock covers a deadline already behind us, so an open modal never blinks off for a render.
  return now >= busyUntil || performance.now() >= busyUntil;
}

/** True while the countdown after the draft is still running: nobody may play yet. */
export function isCountdownRunning(): boolean {
  return performance.now() < useUiStore.getState().countdownUntil;
}

export function useCountdownRunning(): boolean {
  const countdownUntil = useUiStore((state) => state.countdownUntil);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const remaining = countdownUntil - performance.now();
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setNow(performance.now()), remaining + 16);
    return () => window.clearTimeout(timer);
  }, [countdownUntil]);

  return now < countdownUntil && performance.now() < countdownUntil;
}
