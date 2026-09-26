import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reduceGame, type GameAction } from "./game-actions";
import { createGameSaveOptions, pickGameState } from "./game-save";
import type { GameState, ItemId, NodeId, PlayerId, RpsChoice, TurnStage, WheelId } from "./types";
import { EMPTY_GAME_STATE } from "./types";

interface GameActions {
  /** Every action goes through here: straight to the engine, or to the online room when one is attached. */
  dispatch: (action: GameAction) => void;
  /** Runs an action on this device only; the online room calls it for every action it receives. */
  applyLocally: (action: GameAction) => GameState;
  /** Replaces the game with a snapshot, e.g. the one stored by the online room. */
  adoptGame: (state: GameState) => void;

  /** Starts a local game; an online game passes the room's seed so every device draws the same. */
  startGame: (playerNames: string[], seed?: number) => void;
  resetGame: () => void;
  /** Declares a move; it may wait in a Non merci reaction window before applying. */
  movePlayer: (destination: NodeId, ignoreArrows?: boolean) => void;
  prepareBoot: (entryId: string) => void;
  buyItem: (itemId: ItemId) => void;
  /** Declares an item use; it may wait in a Non merci reaction window before applying. */
  useItem: (entryId: string, targetPlayerId?: PlayerId) => void;
  /** A Non merci holder cancels the declared action, or null lets it happen. */
  resolveReaction: (reactorId: PlayerId | null) => void;
  /** Ends the turn; when every player is broke, the Tour de Bénédiction runs first. */
  endTurn: () => void;
  spinHellWheel: () => void;
  spinTileWheel: () => void;
  spinBlessingWheel: () => void;
  /** The player leaves the game; the others play on. */
  abandonGame: (playerId: PlayerId) => void;
  spinWheel: (wheelId: WheelId, playerId: PlayerId, resumeStage: TurnStage, sourceItemId?: ItemId) => void;
  resolveWheel: () => void;
  cancelWheel: () => void;
  challengePlayer: (targetPlayerId: PlayerId) => void;
  flipDuelCoin: () => void;
  pickDuelHand: (playerId: PlayerId, choice: RpsChoice) => void;
  castDuelVote: (voterId: PlayerId, candidateId: PlayerId) => void;
  resolveDuel: (winnerId: PlayerId) => void;
  discardInventoryEntry: (entryId: string) => void;
  repositionBeforeCup: (destination: NodeId) => void;
  resolveCalmDown: (useEffect: boolean) => void;
}

export type GameStore = GameState & GameActions;

/** Receives the actions of an online game instead of the local engine. */
export type ActionRelay = (action: GameAction) => void;

let actionRelay: ActionRelay | null = null;

/** Attaches (or with null, detaches) the online room. */
export function setActionRelay(relay: ActionRelay | null): void {
  actionRelay = relay;
}

export const useGameStore = create<GameStore>()(
  persist((set, get) => {
    const dispatch = (action: GameAction) => {
      if (actionRelay) {
        actionRelay(action);
        return;
      }
      get().applyLocally(action);
    };

    return {
      ...EMPTY_GAME_STATE,

      dispatch,
      applyLocally: (action) => {
        const state = pickGameState(get());
        const nextState = reduceGame(state, action);
        // A refused action leaves the store untouched, so subscribers are not woken for nothing.
        if (nextState !== state) set(nextState);
        return nextState;
      },
      adoptGame: (state) => set({ ...EMPTY_GAME_STATE, ...pickGameState(state) }),

      // Setting up and leaving a game stay on this device: an online room builds its own start.
      startGame: (playerNames, seed) => get().applyLocally({ type: "startGame", playerNames, seed }),
      resetGame: () => set({ ...EMPTY_GAME_STATE }),

      movePlayer: (destination, ignoreArrows = false) => dispatch({ type: "movePlayer", destination, ignoreArrows }),
      prepareBoot: (entryId) => dispatch({ type: "prepareBoot", entryId }),
      buyItem: (itemId) => dispatch({ type: "buyItem", itemId }),
      useItem: (entryId, targetPlayerId) => dispatch({ type: "useItem", entryId, targetPlayerId }),
      resolveReaction: (reactorId) => dispatch({ type: "resolveReaction", reactorId }),
      endTurn: () => dispatch({ type: "endTurn" }),
      spinHellWheel: () => dispatch({ type: "spinHellWheel" }),
      spinTileWheel: () => dispatch({ type: "spinTileWheel" }),
      spinBlessingWheel: () => dispatch({ type: "spinBlessingWheel" }),
      abandonGame: (playerId) => dispatch({ type: "abandonGame", playerId }),
      spinWheel: (wheelId, playerId, resumeStage, sourceItemId) =>
        dispatch({ type: "spinWheel", wheelId, playerId, resumeStage, sourceItemId }),
      resolveWheel: () => dispatch({ type: "resolveWheel" }),
      cancelWheel: () => dispatch({ type: "cancelWheel" }),
      challengePlayer: (targetPlayerId) => dispatch({ type: "challengePlayer", targetPlayerId }),
      flipDuelCoin: () => dispatch({ type: "flipDuelCoin" }),
      pickDuelHand: (playerId, choice) => dispatch({ type: "pickDuelHand", playerId, choice }),
      castDuelVote: (voterId, candidateId) => dispatch({ type: "castDuelVote", voterId, candidateId }),
      resolveDuel: (winnerId) => dispatch({ type: "resolveDuel", winnerId }),
      discardInventoryEntry: (entryId) => dispatch({ type: "discardInventoryEntry", entryId }),
      repositionBeforeCup: (destination) => dispatch({ type: "repositionBeforeCup", destination }),
      resolveCalmDown: (useEffect) => dispatch({ type: "resolveCalmDown", useEffect }),
    };
  }, createGameSaveOptions<GameStore>()),
);

export { getActivePlayer } from "./state-utils";
export { canUseDelinquent } from "./rules";
