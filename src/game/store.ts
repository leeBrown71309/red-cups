import { create } from "zustand";
import { persist } from "zustand/middleware";
import { NORMAL_NODE_IDS } from "./board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_ORDER } from "./catalog";
import {
  addCupCycleEffects,
  addStartBonus,
  beginNextTurn,
  finishCupCollection,
  itemCopyForPassive,
  settleBoard,
  normalizeResumeStage,
  queueTileWheel,
  sendPlayerToHell,
  startDuel,
  startWheel,
  validTileWheels,
} from "./game-effects";
import { createGameSaveOptions } from "./game-save";
import {
  canAddItem,
  canUseDelinquent,
  getItemPrice,
  getTileWheel,
  getUniqueLegalDestinations,
  isShopNode,
} from "./rules";
import {
  addLog,
  appendItem,
  applyCurrencyChange,
  findPlayer,
  getActivePlayer,
  getItemEntry,
  makeLog,
  randomChoice,
  removeInventoryEntry,
  shuffle,
  placeInHell,
  updatePlayer,
} from "./state-utils";
import {
  applyItemUse,
  applyMove,
  cancelDeclaredAction,
  carryOutDeclaredAction,
  openReactionWindow,
  planItemUse,
  planMove,
} from "./turn-actions";
import type { GameState, ItemId, NodeId, Player, PlayerId, TurnStage, WheelId } from "./types";
import {
  EMPTY_GAME_STATE,
  HELL_NODE_ID,
  INITIAL_RED_CUP_NODE_ID,
  PLAYER_COLORS,
  STARTING_CURRENCY,
  START_NODE_ID,
} from "./types";

interface GameActions {
  startGame: (playerNames: string[]) => void;
  resetGame: () => void;
  /** Declares a move; it may wait in a Non merci reaction window before applying. */
  movePlayer: (destination: NodeId, ignoreArrows?: boolean) => void;
  prepareBoot: (entryId: string) => void;
  buyItem: (itemId: ItemId) => void;
  /** Declares an item use; it may wait in a Non merci reaction window before applying. */
  useItem: (entryId: string, targetPlayerId?: PlayerId) => void;
  /** A Non merci holder cancels the declared action, or null lets it happen. */
  resolveReaction: (reactorId: PlayerId | null) => void;
  endTurn: () => void;
  spinHellWheel: () => void;
  spinTileWheel: () => void;
  spinWheel: (wheelId: WheelId, playerId: PlayerId, resumeStage: TurnStage, sourceItemId?: ItemId) => void;
  resolveWheel: () => void;
  cancelWheel: () => void;
  challengePlayer: (targetPlayerId: PlayerId) => void;
  resolveDuel: (winnerId: PlayerId) => void;
  discardInventoryEntry: (entryId: string) => void;
  repositionBeforeCup: (destination: NodeId) => void;
  resolveCalmDown: (useEffect: boolean) => void;
}

export type GameStore = GameState & GameActions;

function createPlayers(playerNames: string[]): Player[] {
  const names = playerNames.slice(0, 8).map((name, index) => name.trim() || `Joueur ${index + 1}`);
  const passives = shuffle(PASSIVE_ORDER).slice(0, names.length);
  return names.map((name, index) => ({
    id: crypto.randomUUID(),
    name,
    color: PLAYER_COLORS[index],
    position: START_NODE_ID,
    currency: STARTING_CURRENCY,
    inventory: [],
    passiveId: passives[index],
    skippedTurns: 0,
    hellTurns: 0,
    noThanksUsedCycle: -1,
  }));
}

/** Applies one wheel outcome to its player; chained and interactive outcomes are handled by the caller. */
function applyWheelOutcome(
  state: GameState,
  player: Player,
  wheelId: WheelId,
  outcomeId: string,
  amount: number,
): GameState {
  switch (outcomeId) {
    case "lose-100":
    case "lose-200":
    case "lose-400":
      return applyCurrencyChange(state, player.id, -amount);
    case "gain-100":
    case "gain-200":
    case "gain-300":
    case "gain-400":
    case "gain-500":
      return applyCurrencyChange(state, player.id, amount);
    case "lose-item": {
      const entry = randomChoice(player.inventory.filter((candidate) => candidate.kind === "item"));
      if (!entry) return applyCurrencyChange(state, player.id, -100);
      const nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entry.id));
      return addLog(nextState, `${player.name} perd un objet.`, "bad");
    }
    case "skip-turn":
    case "hell-skip": {
      const nextState = updatePlayer(state, player.id, (current) => ({
        ...current,
        skippedTurns: current.skippedTurns + 1,
      }));
      return addLog(nextState, `${player.name} devra passer son prochain tour.`, "bad");
    }
    case "go-to-hell":
      return sendPlayerToHell(state, player.id);
    case "escape": {
      if (wheelId === "fortune" && player.position !== HELL_NODE_ID)
        return applyCurrencyChange(state, player.id, amount);
      const freed = updatePlayer(state, player.id, (current) => ({ ...current, position: START_NODE_ID }));
      return addStartBonus(addLog(freed, `${player.name} sort de l’Enfer et revient en case 0.`, "good"), player.id);
    }
    case "free-item": {
      const options = ITEM_ORDER.filter(
        (itemId) => itemId !== "bullet-bill" && ITEM_CATALOG[itemId].price <= 300 && canAddItem(player, itemId),
      );
      const freeItem = randomChoice(options);
      if (!freeItem) return applyCurrencyChange(state, player.id, 200);
      const nextState = updatePlayer(state, player.id, (current) => appendItem(current, freeItem));
      return addLog(nextState, `${player.name} reçoit ${ITEM_CATALOG[freeItem].name} gratuitement.`, "good");
    }
    default:
      return addLog(state, "La roue ne produit aucun effet.");
  }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_GAME_STATE,

      startGame: (playerNames) => {
        if (playerNames.length < 2) return;
        set({
          ...EMPTY_GAME_STATE,
          phase: "playing",
          turnStage: "move",
          players: createPlayers(playerNames),
          redCupNodeId: INITIAL_RED_CUP_NODE_ID,
          log: [makeLog("La partie commence. La première Red Cup est en case 8.", "event")],
        });
      },

      resetGame: () => set({ ...EMPTY_GAME_STATE }),

      movePlayer: (destination, ignoreArrows = false) => {
        const state = get();
        const plan = planMove(state, destination, ignoreArrows);
        if (!plan) return;
        const waiting = openReactionWindow(state, { type: "move", destination, ignoreArrows });
        set(waiting ?? applyMove(state, destination, plan));
      },

      prepareBoot: (entryId) => {
        const state = get();
        const player = getActivePlayer(state);
        if (!player || state.turnStage !== "move" || state.moveDistance !== 1) return;
        if (getItemEntry(player, entryId) !== "boot") return;

        let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
        nextState = { ...nextState, moveDistance: 2 };
        set(addLog(nextState, `${player.name} prépare la Botte pour un déplacement de deux cases.`, "event"));
      },

      buyItem: (itemId) => {
        const state = get();
        const player = getActivePlayer(state);
        if (!player || state.turnStage !== "shop" || !isShopNode(player.position)) return;

        const price = getItemPrice(itemId, state.bootPrice);
        if (player.currency < price) return;

        if (itemId === "bullet-bill") {
          if (state.bulletBill) return;
          let nextState = applyCurrencyChange(state, player.id, -price);
          nextState = {
            ...nextState,
            bulletBill: { status: "waiting", position: START_NODE_ID, spawnRound: state.round + 1 },
          };
          set(addLog(nextState, `${player.name} achète Bullet Bill pour ${price} pièces.`, "event"));
          return;
        }

        if (!canAddItem(player, itemId)) return;
        let nextState = applyCurrencyChange(state, player.id, -price);
        nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, itemId));
        if (itemId === "boot" && !state.bootFirstPurchased) {
          nextState = { ...nextState, bootFirstPurchased: true, bootLastPriceRound: state.round };
        }
        set(addLog(nextState, `${player.name} achète ${ITEM_CATALOG[itemId].name} pour ${price} pièces.`, "good"));
      },

      useItem: (entryId, targetPlayerId) => {
        const state = get();
        const plan = planItemUse(state, entryId, targetPlayerId);
        if (!plan) return;
        const waiting = openReactionWindow(state, {
          type: "item",
          entryId,
          itemId: plan.itemId,
          targetPlayerId: plan.target?.id,
        });
        set(waiting ?? applyItemUse(state, entryId, plan));
      },

      resolveReaction: (reactorId) => {
        const state = get();
        const pending = state.pendingReaction;
        if (!pending || state.turnStage !== "reaction") return;
        if (reactorId === null) {
          set(carryOutDeclaredAction(state, pending));
          return;
        }
        if (!pending.reactorIds.includes(reactorId)) return;
        set(cancelDeclaredAction(state, pending, reactorId));
      },

      endTurn: () => {
        const state = get();
        if (state.phase !== "playing") return;
        const activePlayer = getActivePlayer(state);
        const noLegalMove =
          state.turnStage === "move" &&
          activePlayer !== undefined &&
          getUniqueLegalDestinations(activePlayer, state.moveDistance, canUseDelinquent(activePlayer)).length === 0;
        if (!["shop", "turn-end"].includes(state.turnStage) && !noLegalMove) return;
        set(beginNextTurn({ ...state, turnStage: "turn-end" }));
      },

      spinHellWheel: () => {
        const state = get();
        const player = getActivePlayer(state);
        if (!player || state.turnStage !== "hell" || player.position !== HELL_NODE_ID) return;
        set(startWheel(state, "hell", player.id, "turn-end", { origin: "hell" }));
      },

      spinTileWheel: () => {
        const current = get();
        if (current.turnStage !== "tile-wheel") return;
        const state = validTileWheels(current);
        const [next, ...rest] = state.pendingTileWheels;
        const wheelId = next ? getTileWheel(next.nodeId) : null;
        if (!next || !wheelId) {
          set({ ...state, turnStage: state.tileWheelResumeStage });
          return;
        }
        const queueRest = { ...state, pendingTileWheels: rest };
        set(startWheel(queueRest, wheelId, next.playerId, state.tileWheelResumeStage, { origin: "tile" }));
      },

      spinWheel: (wheelId, playerId, resumeStage, sourceItemId) => {
        set(startWheel(get(), wheelId, playerId, resumeStage, { sourceItemId }));
      },

      resolveWheel: () => {
        const state = get();
        const pending = state.pendingWheel;
        const player = findPlayer(state, pending?.playerId);
        if (!pending || !player) return;

        if (pending.result.id === "spin-fortune") {
          set(
            startWheel(state, "fortune", pending.playerId, pending.resumeStage, {
              sourceItemId: pending.sourceItemId,
              origin: "chain",
            }),
          );
          return;
        }

        if (pending.result.id === "challenge") {
          let nextState: GameState = {
            ...state,
            pendingWheel: null,
            pendingChallenge: { playerId: pending.playerId, resumeStage: pending.resumeStage },
            turnStage: "target",
          };
          if (pending.sourceItemId) nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId);
          set(nextState);
          return;
        }

        let nextState: GameState = { ...state, pendingWheel: null, turnStage: pending.resumeStage };
        nextState = applyWheelOutcome(
          nextState,
          player,
          pending.wheelId,
          pending.result.id,
          pending.result.amount ?? 0,
        );
        if (pending.sourceItemId) nextState = itemCopyForPassive(nextState, pending.playerId, pending.sourceItemId);
        if (nextState.pendingDiscard) {
          set(nextState);
          return;
        }
        set(settleBoard(nextState, pending.resumeStage));
      },

      cancelWheel: () => {
        const state = get();
        const pending = state.pendingWheel;
        const player = findPlayer(state, pending?.playerId);
        const eraser = player?.inventory.find((entry) => entry.kind === "item" && entry.itemId === "eraser");
        if (!pending || !player || !eraser) return;

        let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, eraser.id));
        nextState = { ...nextState, pendingWheel: null, turnStage: pending.resumeStage };
        nextState = addLog(nextState, `${player.name} utilise la Gomme et annule l’effet.`, "good");
        set(settleBoard(nextState, pending.resumeStage));
      },

      challengePlayer: (targetPlayerId) => {
        const state = get();
        const pending = state.pendingChallenge;
        const target = findPlayer(state, targetPlayerId);
        if (!pending || !target || pending.playerId === targetPlayerId) return;

        let nextState = updatePlayer(state, targetPlayerId, placeInHell);
        nextState = { ...nextState, pendingChallenge: null };
        nextState = addLog(nextState, `${target.name} est appelé en Enfer pour un duel.`, "event");
        set(startDuel(nextState, pending.playerId, targetPlayerId, pending.resumeStage));
      },

      resolveDuel: (winnerId) => {
        const state = get();
        const duel = state.pendingDuel;
        if (!duel || ![duel.playerOneId, duel.playerTwoId].includes(winnerId)) return;
        if (duel.mode === "coin-flip" && duel.coinWinnerId !== winnerId) return;
        const loserId = winnerId === duel.playerOneId ? duel.playerTwoId : duel.playerOneId;
        const winner = findPlayer(state, winnerId);
        const loser = findPlayer(state, loserId);
        if (!winner || !loser) return;

        let nextState = updatePlayer(state, winnerId, (player) => ({ ...player, position: START_NODE_ID }));
        nextState = { ...nextState, pendingDuel: null };
        nextState = addLog(
          nextState,
          `${winner.name} gagne le duel et retourne en case 0. ${loser.name} reste en Enfer.`,
          "good",
        );
        set(settleBoard(nextState, duel.resumeStage));
      },

      discardInventoryEntry: (entryId) => {
        const state = get();
        const pending = state.pendingDiscard;
        const player = findPlayer(state, pending?.playerId);
        const entry = player?.inventory.find((candidate) => candidate.id === entryId);
        if (!pending || !player || !entry || entry.kind === "red-cup") return;

        let nextState = updatePlayer(state, player.id, (current) => removeInventoryEntry(current, entryId));
        nextState = { ...nextState, pendingDiscard: null, turnStage: pending.resumeStage };
        nextState = addLog(nextState, `${player.name} abandonne ${ITEM_CATALOG[entry.itemId].name}.`, "bad");

        if (pending.reason === "red-cup" && pending.cupNodeId !== undefined) {
          nextState = finishCupCollection(nextState, player.id, pending.cupNodeId);
        } else if (pending.reason === "forced-item" && pending.itemId) {
          const copiedItem = pending.itemId;
          nextState = updatePlayer(nextState, player.id, (current) => appendItem(current, copiedItem));
          nextState = addLog(
            nextState,
            `${player.name} reçoit ${ITEM_CATALOG[copiedItem].name} grâce à Je note.`,
            "event",
          );
        }

        const waitsForDecision = ["reposition", "passive-choice"].includes(nextState.turnStage);
        if (nextState.phase !== "playing" || waitsForDecision) {
          set(nextState);
          return;
        }
        set(settleBoard(nextState, nextState.turnStage));
      },

      repositionBeforeCup: (destination) => {
        const state = get();
        const playerId = state.pendingCupRepositionPlayerId;
        const player = findPlayer(state, playerId);
        if (!playerId || !player || state.pendingCupRevealNodeId === null || !NORMAL_NODE_IDS.includes(destination)) {
          return;
        }

        let nextState = updatePlayer(state, playerId, (current) => ({ ...current, position: destination }));
        nextState = queueTileWheel(nextState, playerId);
        nextState = {
          ...nextState,
          redCupNodeId: state.pendingCupRevealNodeId,
          pendingCupRepositionPlayerId: null,
          pendingCupRevealNodeId: null,
          pendingCupRepositionResumeStage: null,
          pendingCupCollectorId: null,
        };
        nextState = {
          ...nextState,
          turnStage: normalizeResumeStage(nextState, state.pendingCupRepositionResumeStage ?? "turn-end"),
        };
        nextState = addLog(nextState, `${player.name} se repositionne avant l’apparition de la Cup.`, "event");
        if (state.pendingCupCollectorId) nextState = addCupCycleEffects(nextState, state.pendingCupCollectorId);
        if (nextState.turnStage === "passive-choice") {
          set(nextState);
          return;
        }
        set(settleBoard(nextState, nextState.turnStage));
      },

      resolveCalmDown: (useEffect) => {
        const state = get();
        const pending = state.pendingCalmDown;
        const holder = findPlayer(state, pending?.passivePlayerId);
        const collector = findPlayer(state, pending?.collectorId);
        if (!pending || !holder || !collector) return;

        let nextState: GameState = { ...state, pendingCalmDown: null };
        if (useEffect) {
          nextState = updatePlayer(nextState, collector.id, (player) => ({
            ...player,
            position: pending.retreatNodeId,
          }));
          nextState = queueTileWheel(nextState, collector.id);
          nextState = addLog(
            nextState,
            `${holder.name} active Calme-toi : ${collector.name} recule de trois cases.`,
            "event",
          );
        } else {
          nextState = addLog(nextState, `${holder.name} laisse passer Calme-toi.`);
        }
        set(settleBoard(nextState, pending.resumeStage));
      },
    }),
    createGameSaveOptions<GameStore>(),
  ),
);

export { getActivePlayer } from "./state-utils";
export { canUseDelinquent } from "./rules";
