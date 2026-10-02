import { PASSIVE_ORDER } from "./catalog";
import { announceDevil } from "./devil";
import { getEnergyCapacity } from "./energy";
import { assignGuardian } from "./guardian";
import { getStartingCurrency } from "./passive-rules";
import { addLog, randomChoice, shuffle } from "./state-utils";
import type { GameState, PassiveDraft, PassiveId, Player, PlayerId } from "./types";
import { GUARDIAN_MIN_PLAYERS } from "./types";

/**
 * The passive draft (patch 0.1.4): before the game, every player picks one of
 * the passive cards dealt to them, no card dealt twice at the table. Online
 * the table has a minute; a local table has no clock (Q15).
 */

/** One minute for the whole table, online. */
export const DRAFT_TIME_MS = 60_000;
/** Up to this many players, three cards each; two beyond. */
const SMALL_TABLE = 6;

export function getDraftOfferSize(playerCount: number): number {
  return playerCount <= SMALL_TABLE ? 3 : 2;
}

/** Passives that may be dealt at a table this size: L'Ange-Gardien only from four players on. */
export function getDraftPool(playerCount: number): PassiveId[] {
  return PASSIVE_ORDER.filter((passiveId) => passiveId !== "guardian-angel" || playerCount >= GUARDIAN_MIN_PLAYERS);
}

/** Deals every player their cards from one shuffled deck, so no card shows twice at the table. */
export function createDraft(players: Player[], deadline: number | null): PassiveDraft {
  const size = getDraftOfferSize(players.length);
  const deck = shuffle(getDraftPool(players.length));
  const offers = Object.fromEntries(
    players.map((player, index) => [player.id, deck.slice(index * size, index * size + size)]),
  );
  return { offers, picks: {}, deadline };
}

/** A pick may change until the draft closes; the last one missing closes it. */
export function pickPassive(state: GameState, playerId: PlayerId, passiveId: PassiveId): GameState {
  const draft = state.draft;
  if (state.phase !== "draft" || !draft || !draft.offers[playerId]?.includes(passiveId)) return state;
  if (draft.picks[playerId] === passiveId) return state;
  const nextState: GameState = { ...state, draft: { ...draft, picks: { ...draft.picks, [playerId]: passiveId } } };
  return hasEveryonePicked(nextState) ? closeDraft(nextState) : nextState;
}

export function hasEveryonePicked(state: GameState): boolean {
  return state.players.every((player) => state.draft?.picks[player.id] !== undefined);
}

/**
 * Closes the draft: whoever has not picked gets one of their cards at random.
 * The passives then take effect as at any start (coins, the first gauge,
 * L'Ange-Gardien's protégé, le diable's announcement), and the game begins.
 */
export function closeDraft(state: GameState): GameState {
  const draft = state.draft;
  if (state.phase !== "draft" || !draft) return state;
  const players = state.players.map((player) => {
    const passiveId = draft.picks[player.id] ?? randomChoice(draft.offers[player.id] ?? []) ?? player.passiveId;
    return { ...player, passiveId, currency: getStartingCurrency(passiveId) };
  });
  const active = players[state.activePlayerIndex];
  let nextState: GameState = {
    ...state,
    phase: "playing",
    turnStage: "move",
    draft: null,
    players,
    energyLeft: active ? getEnergyCapacity(active) : state.energyLeft,
  };
  nextState = addLog(nextState, "Les passifs sont choisis : la partie commence !", "event");
  return announceDevil(assignGuardian(nextState));
}

/** Players still to pick, in seat order: the local table hands the screen to them one after the other. */
export function getPlayersToPick(state: GameState): Player[] {
  return state.players.filter((player) => state.draft?.picks[player.id] === undefined);
}
