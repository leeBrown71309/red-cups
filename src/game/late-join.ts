import { PASSIVE_CATALOG } from "./catalog";
import { getDraftOfferSize, getDraftPool } from "./draft";
import { getStartingCurrency } from "./passive-rules";
import { addLog, randomChoice, shuffle } from "./state-utils";
import type { GameState, PassiveId, Player, PlayerColor, PlayerId } from "./types";
import { FIRST_ROUND, START_NODE_ID } from "./types";

/**
 * Joining a room after the kickoff (patch 0.1.5): open from the draft until the
 * first round of the table is over, for the seats left. The newcomer sits last
 * in the turn order.
 */

export const MAX_TABLE_SIZE = 8;

/** Roles that are announced at the start: they cannot be handed out once the game runs. */
const ROLE_PASSIVES: PassiveId[] = ["devil", "guardian-angel"];

/** Whether a newcomer may still sit down at this table. */
export function canJoinLate(state: GameState): boolean {
  return (
    (state.phase === "draft" || state.phase === "playing") &&
    state.round <= FIRST_ROUND &&
    state.players.length < MAX_TABLE_SIZE
  );
}

/** Cards the newcomer chooses from during the draft: the ones nobody else was dealt. */
function dealLateOffer(state: GameState): PassiveId[] {
  const dealt = new Set(Object.values(state.draft?.offers ?? {}).flat());
  const free = shuffle(getDraftPool(state.players.length + 1).filter((passiveId) => !dealt.has(passiveId)));
  const offer = free.slice(0, getDraftOfferSize(state.players.length + 1));
  return offer.length > 0 ? offer : ["lambda"];
}

/** The passive a newcomer gets once the draft is over: one nobody holds, and not a public role. */
function drawLatePassive(state: GameState): PassiveId {
  const held = new Set(state.players.map((player) => player.passiveId));
  const free = Object.keys(PASSIVE_CATALOG).filter(
    (passiveId) => !held.has(passiveId as PassiveId) && !ROLE_PASSIVES.includes(passiveId as PassiveId),
  ) as PassiveId[];
  return randomChoice(free) ?? "lambda";
}

export function joinLatePlayer(state: GameState, playerId: PlayerId, name: string, color: PlayerColor): GameState {
  if (!canJoinLate(state) || state.players.some((player) => player.id === playerId)) return state;
  const offer = state.draft ? dealLateOffer(state) : null;
  const passiveId = offer ? offer[0] : drawLatePassive(state);
  const player: Player = {
    id: playerId,
    name: name.trim() || `Joueur ${state.players.length + 1}`,
    color,
    position: START_NODE_ID,
    currency: getStartingCurrency(passiveId),
    inventory: [],
    passiveId,
    skippedTurns: 0,
    hellTurns: 0,
    noThanksReadyRound: FIRST_ROUND,
    previousNodeId: null,
  };
  const draft = state.draft && offer ? { ...state.draft, offers: { ...state.draft.offers, [playerId]: offer } } : null;
  const nextState: GameState = { ...state, players: [...state.players, player], draft: draft ?? state.draft };
  return addLog(nextState, `${player.name} rejoint la partie.`, "event");
}
