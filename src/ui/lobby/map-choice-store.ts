import { create } from "zustand";
import { DEFAULT_MAP_ID, isMapChoice, isMapId, resolveMapChoice, type MapChoice } from "../../game/maps/map-registry";
import { DEFAULT_WORLD_STYLE, isWorldStyle, resolveWorldStyle } from "../../game/maps/world-style";
import type { MapId, WorldStyle } from "../../game/types";
import { readStorage, writeStorage } from "../../utils/safe-local-storage";

const MAP_CHOICE_KEY = "red-cups-map";
const WORLD_STYLE_KEY = "red-cups-world-style";

interface MapChoiceState {
  /** What the lobby will start: one map, or a draw at kickoff. */
  choice: MapChoice;
  /** Map shown behind the lobby: the picked one, or the last one looked at when the choice is random. */
  previewMapId: MapId;
  /** Which version of a map to play, for the maps that come in two (boxed or open): remembered like the map. */
  worldStyle: WorldStyle;
  setWorldStyle: (style: WorldStyle) => void;
  setChoice: (choice: MapChoice) => void;
  /** Shows a map behind the lobby without choosing it, e.g. while browsing with "random" picked. */
  previewMap: (mapId: MapId) => void;
}

function readSavedChoice(): MapChoice {
  const saved = readStorage(MAP_CHOICE_KEY);
  return isMapChoice(saved) ? saved : DEFAULT_MAP_ID;
}

function readSavedWorldStyle(): WorldStyle {
  const saved = readStorage(WORLD_STYLE_KEY);
  return isWorldStyle(saved) ? saved : DEFAULT_WORLD_STYLE;
}

const initialChoice = readSavedChoice();

/** Lobby-only preference, remembered on this device like the table of names. */
export const useMapChoiceStore = create<MapChoiceState>((set) => ({
  choice: initialChoice,
  previewMapId: isMapId(initialChoice) ? initialChoice : DEFAULT_MAP_ID,
  worldStyle: readSavedWorldStyle(),
  setWorldStyle: (worldStyle) => {
    writeStorage(WORLD_STYLE_KEY, worldStyle);
    set({ worldStyle });
  },
  setChoice: (choice) => {
    writeStorage(MAP_CHOICE_KEY, choice);
    set((state) => ({ choice, previewMapId: isMapId(choice) ? choice : state.previewMapId }));
  },
  previewMap: (previewMapId) => set({ previewMapId }),
}));

/** Draws the map now when the choice is random, so the start action always names one. */
export function drawChosenMap(playerCount?: number): MapId {
  return resolveMapChoice(useMapChoiceStore.getState().choice, Math.random, playerCount);
}

/** The version of `mapId` the lobby will start: the remembered one if the map has an open version, else the original. */
export function getChosenWorldStyle(mapId: MapId): WorldStyle {
  return resolveWorldStyle(mapId, useMapChoiceStore.getState().worldStyle);
}
