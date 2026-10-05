import { create } from "zustand";

/**
 * Which page of the home flow shows while no game is under way: the game's
 * menu, the new-game lobby, or the changelog. The menu comes first.
 */
export type HomeView = "menu" | "setup" | "changelog";

interface HomeState {
  view: HomeView;
  setView: (view: HomeView) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  view: "menu",
  setView: (view) => set({ view }),
}));
