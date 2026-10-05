import { abandonPlayer, canAbandon } from "./abandon";
import { closeDraft, hasEveryonePicked } from "./draft";
import { getHostPlayerId } from "./pause";
import { addLog, findPlayer } from "./state-utils";
import type { GameState, PlayerId } from "./types";

/**
 * The host sends a player away from the table (patch 0.1.5). During the
 * draft the seat is simply emptied; during the game the player leaves like one
 * who abandons, which only happens while the table is at rest, so no wheel or
 * duel is left waiting for somebody who is gone.
 */

export function canKickPlayer(state: GameState, hostId: PlayerId, targetId: PlayerId): boolean {
  if (hostId !== getHostPlayerId(state) || hostId === targetId || !findPlayer(state, targetId)) return false;
  return state.phase === "draft" ? state.players.length > 1 : canAbandon(state);
}

export function kickPlayer(state: GameState, hostId: PlayerId, targetId: PlayerId): GameState {
  if (!canKickPlayer(state, hostId, targetId)) return state;
  if (state.phase === "playing") return abandonPlayer(state, targetId, "kick");
  return kickFromDraft(state, targetId);
}

function kickFromDraft(state: GameState, targetId: PlayerId): GameState {
  const draft = state.draft;
  const leaver = findPlayer(state, targetId);
  if (!draft || !leaver) return state;
  const { [targetId]: _offer, ...offers } = draft.offers;
  const { [targetId]: _pick, ...picks } = draft.picks;
  const { [targetId]: _actif, ...actifs } = draft.actifs;
  const players = state.players.filter((player) => player.id !== targetId);
  const next = addLog(
    {
      ...state,
      players,
      abandonedPlayers: [...state.abandonedPlayers, leaver],
      draft: { ...draft, offers, picks, actifs },
    },
    `${leaver.name} est exclu de la partie par l’hôte.`,
    "bad",
  );
  if (players.length === 1) {
    const [winner] = players;
    const won = { ...next, phase: "finished" as const, turnStage: "finished" as const, winnerId: winner.id };
    return addLog({ ...won, winReason: "forfeit", draft: null }, `${winner.name} reste seul à table.`, "good");
  }
  return hasEveryonePicked(next) ? closeDraft(next) : next;
}
