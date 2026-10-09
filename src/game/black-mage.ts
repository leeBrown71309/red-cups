import { abandonPlayer, canAbandon } from "./abandon";
import { ownsCard } from "./cards";
import { drawEngineRandom } from "./engine-random";
import { arriveOnTile } from "./game-effects";
import { slideOnArrival } from "./ice";
import { getLuck, spendLuck } from "./mage-luck";
import { canPlaceMark, canTeleport, findMark, type TeleportReason } from "./mage-queries";
import { withPowerEvent } from "./power-event";
import { addLog, findPlayer, getActivePlayer, sendPlayerToHell, updatePlayer } from "./state-utils";
import type { BlackMark, GameState, PlayerId } from "./types";
import { HELL_NODE_ID, MAGE_MAX_LUCK, MARK_HELL_CHANCE, MARK_MUD_HELL_CHANCE } from "./types";

/**
 * Mage noir (patch 0.2.3): lays a pentagram on the tile they stand on, one at a time, and may teleport to it at any
 * time: in their own turn, when an item aims at them, or instead of a move a wheel would make them take. Each
 * teleport costs a chance. Teleporting goes over roads, Barrières and arrows alike. The questions (may they?) are
 * in `mage-queries.ts`; the deeds are here.
 */

export function placeMark(state: GameState): GameState {
  const player = getActivePlayer(state);
  if (!player || !canPlaceMark(state, player)) return state;
  const mark: BlackMark = { ownerId: player.id, nodeId: player.position };
  const nextState = withPowerEvent(
    { ...state, blackMarks: [...state.blackMarks, mark], turnActionTaken: true },
    { kind: "mark-place", playerId: player.id, nodeId: mark.nodeId },
  );
  return addLog(nextState, `${player.name} trace un pentagramme sur la case ${mark.nodeId}.`, "event");
}

/**
 * The teleport itself, without what follows it (the table settling, the stage it resumes). The mage lands on their
 * mark, arriving there like on any tile. A Boue lying on the mark may drop them into Hell, and each other player
 * standing on it too; a mark that sent somebody to Hell stays, any other is spent. `arrive: false` sets them down
 * without the tile acting (a mage who slips away from Bullet Bill as the round turns has no turn to arrive in).
 */
export function teleportToMark(
  state: GameState,
  playerId: PlayerId,
  reason: TeleportReason,
  { arrive = true }: { arrive?: boolean } = {},
): GameState {
  const mage = findPlayer(state, playerId);
  const mark = findMark(state, playerId);
  if (!canTeleport(state, mage) || !mark) return state;
  const from = mage.position;
  const to = mark.nodeId;
  const mudOnMark = state.mudTraps.find((trap) => trap.nodeId === to);
  const mudFall = mudOnMark !== undefined && drawEngineRandom() < MARK_MUD_HELL_CHANCE;
  // Everybody standing on the mark is rolled for, in seat order, before anybody moves.
  const doomedIds = state.players
    .filter((other) => other.id !== playerId && other.position === to)
    .filter(() => drawEngineRandom() < MARK_HELL_CHANCE)
    .map((other) => other.id);

  let nextState = updatePlayer(state, playerId, (current) => ({
    ...spendLuck(current, state.round),
    position: to,
    hellTurns: 0,
  }));
  const luckLeft = getLuck(findPlayer(nextState, playerId) ?? mage);
  nextState = addLog(
    nextState,
    `${mage.name} se téléporte sur son pentagramme, case ${to} (${luckLeft}/${MAGE_MAX_LUCK} chances).`,
    "event",
  );

  const victimIds: PlayerId[] = [];
  for (const victimId of doomedIds) {
    nextState = sendPlayerToHell(nextState, victimId);
    if (findPlayer(nextState, victimId)?.position === HELL_NODE_ID) victimIds.push(victimId);
  }
  if (victimIds.length > 0) {
    nextState = addLog(nextState, "Le pentagramme réclame son dû : l’Enfer s’ouvre sous eux.", "bad");
  }
  // Standing still (a mark on their own tile, used to dodge) is no arrival: the tile does not act twice. Nor is a
  // teleport that answers an item or Bullet Bill: it lands in the middle of somebody else's action, and the tile
  // must not open a wheel, a shop or a pick-up over it.
  const arrives = arrive && from !== to && reason !== "reaction";
  // Banquise: a mark that froze over slides the mage on, and they arrive where the slide stops.
  if (arrives) nextState = arriveOnTile(slideOnArrival(nextState, playerId, from), playerId);
  // The mud under the mark may swallow the mage on top of what it costs them: they fall through it into Hell.
  let mudHell = false;
  if (arrives && mudFall && mudOnMark && findPlayer(nextState, playerId)?.position === to) {
    nextState = { ...nextState, mudTraps: nextState.mudTraps.filter((trap) => trap.id !== mudOnMark.id) };
    nextState = addLog(nextState, `${mage.name} plonge de la Boue de son pentagramme jusqu’en Enfer.`, "bad");
    nextState = sendPlayerToHell(nextState, playerId);
    mudHell = findPlayer(nextState, playerId)?.position === HELL_NODE_ID;
  }

  const kept = victimIds.length > 0;
  return withPowerEvent(
    {
      ...nextState,
      blackMarks: kept ? nextState.blackMarks : nextState.blackMarks.filter((entry) => entry.ownerId !== playerId),
    },
    { kind: "mark-teleport", playerId, from, to, reason, mudHell, victimIds, kept, luckLeft },
  );
}

/**
 * Run after every action. A mage out of chances is out of the game, as soon as the table is at rest (a decision
 * left hanging holds the departure back); the mark of a player who left the table is wiped away.
 */
export function eliminateFallenMages(state: GameState): GameState {
  let nextState = state;
  const orphaned = nextState.blackMarks.filter((mark) => findPlayer(nextState, mark.ownerId) === undefined);
  if (orphaned.length > 0) {
    nextState = { ...nextState, blackMarks: nextState.blackMarks.filter((mark) => !orphaned.includes(mark)) };
  }
  for (const mage of state.players) {
    if (!ownsCard(mage, "black-mage") || getLuck(mage) > 0 || !canAbandon(nextState)) continue;
    const fallen = withPowerEvent(nextState, { kind: "mage-fallen", playerId: mage.id, nodeId: mage.position });
    nextState = abandonPlayer(fallen, mage.id, "luck");
    nextState = { ...nextState, blackMarks: nextState.blackMarks.filter((mark) => mark.ownerId !== mage.id) };
  }
  return nextState;
}
