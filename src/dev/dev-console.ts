import { withCard } from "../game/cards";
import type { GameAction } from "../game/game-actions";
import { getStartingCurrency } from "../game/passive-rules";
import { useGameStore } from "../game/store";
import { pickGameState } from "../game/game-save";
import type { GameState, MapId, NodeId, PassiveId } from "../game/types";
import { getEnergyCapacity } from "../game/energy";

/**
 * Dev only: `window.redCupsDev` sets a local game up in a given situation, so that a Cups Power (or anything else)
 * can be played and looked at without going through the draft. It is dropped from the production build.
 *
 *   redCupsDev.start({ players: 3, mapId: "classic", cards: { 0: ["mole"], 1: ["mime", "hermit"] } })
 *   redCupsDev.act({ type: "digTunnel", destination: 2 })
 *   redCupsDev.patch((state) => ({ redCupNodeId: 5 }))
 *   redCupsDev.place(1, 4)
 */
export interface StartOptions {
  players?: number;
  mapId?: MapId;
  seed?: number;
  /** Cards forced on a seat (0-based): the actif and/or the passif, in any order. */
  cards?: Record<number, PassiveId[]>;
  /** Tile each seat starts on. */
  positions?: Record<number, NodeId>;
}

export interface RedCupsDev {
  start: (options?: StartOptions) => GameState;
  act: (action: GameAction) => GameState;
  patch: (change: (state: GameState) => Partial<GameState>) => GameState;
  place: (seat: number, nodeId: NodeId) => GameState;
  state: () => GameState;
}

declare global {
  interface Window {
    redCupsDev?: RedCupsDev;
  }
}

export function installDevConsole(): void {
  const store = useGameStore;
  const snapshot = () => pickGameState(store.getState());
  const apply = (state: GameState): GameState => {
    store.setState(state);
    return snapshot();
  };

  window.redCupsDev = {
    start: ({ players = 3, mapId = "classic", seed = 7, cards = {}, positions = {} } = {}) => {
      store.getState().resetGame();
      store.getState().startGame(
        Array.from({ length: players }, (_, index) => `Joueur ${index + 1}`),
        seed,
        mapId,
      );
      const started = snapshot();
      const forced = started.players.map((player, seat) => {
        const dealt = (cards[seat] ?? []).reduce((current, cardId) => withCard(current, cardId), player);
        const moved = positions[seat] === undefined ? dealt : { ...dealt, position: positions[seat] };
        return { ...moved, currency: getStartingCurrency(moved.passiveId, moved.passifId) };
      });
      const state = { ...started, players: forced };
      return apply({ ...state, energyLeft: getEnergyCapacity(forced[state.activePlayerIndex], state) });
    },
    act: (action) => {
      store.getState().applyLocally(action);
      return snapshot();
    },
    patch: (change) => apply({ ...snapshot(), ...change(snapshot()) }),
    place: (seat, nodeId) => {
      const state = snapshot();
      return apply({
        ...state,
        players: state.players.map((player, index) => (index === seat ? { ...player, position: nodeId } : player)),
      });
    },
    state: snapshot,
  };
}
