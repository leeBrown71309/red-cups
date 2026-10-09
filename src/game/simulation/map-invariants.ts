import { getBoard, isIce } from "../board";
import { getNodeKindOf } from "../board";
import { getBoardMap } from "../maps/map-registry";
import { getNextFerryQuay } from "../tide";
import type { GameState } from "../types";
import { CARAVAN_STEP, HELL_NODE_ID } from "../types";
import { violation, type RuleViolation } from "./invariant-helpers";

/**
 * Map rules that every feature must respect, whatever moved the player: the
 * checks hold on the three boards, so a new item, wheel or passive that
 * forgets a map's mechanic shows up on that map's campaign.
 */

/**
 * Banquise: nobody stands on ice. Whatever set a player down there (a walk, a
 * wheel, a pull, a swap, a trip to a frozen start) slides them on; only a
 * player caught by falling ice waits on it, halfway down the road.
 */
export function checkMapState(state: GameState, found: RuleViolation[]): void {
  checkArchipelState(state, found);
  checkDesertState(state, found);
  const board = getBoard(state);
  for (const player of state.players) {
    if (!isIce(board, player.position)) continue;
    const stuck = state.frozenSlides.some((entry) => entry.playerId === player.id && entry.from === player.position);
    if (!stuck) found.push(violation("no-rest-on-ice", `${player.name} stands on the ice of tile ${player.position}`));
  }
}

/**
 * Names the action that left a player on ice, and checks le diable's Portail
 * only opens where a player can stop: never on ice, which nobody stops on.
 */
export function checkMapTransition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  checkArchipelTransition(previous, next, found);
  checkDesertTransition(previous, next, found);
  const board = getBoard(next);
  for (const player of next.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    const stuck = next.frozenSlides.some((entry) => entry.playerId === player.id && entry.from === player.position);
    if (!isIce(board, player.position) || stuck) continue;
    if (before?.position !== player.position) {
      found.push(violation("lands-on-ice", `${player.name} was left on the ice of tile ${player.position}`));
    } else if (!isIce(getBoard(previous), player.position)) {
      found.push(violation("ice-under-player", `tile ${player.position} froze under ${player.name}`));
    }
  }
  for (const portal of next.hellPortals) {
    if (previous.hellPortals.some((candidate) => candidate.id === portal.id)) continue;
    if (isIce(board, portal.nodeId)) {
      found.push(violation("portal-on-ice", `a Portail opened on the ice of tile ${portal.nodeId}`));
    }
  }
}

/**
 * Archipel des Marées: a quay holds one player, nobody rests on a whirlpool or a drowned causeway, the Red Cup never
 * lies on a tile nobody can stop on, and the ferry stays on its circuit.
 */
function checkArchipelState(state: GameState, found: RuleViolation[]): void {
  const map = getBoardMap(state.mapId);
  if (!map.tidal) {
    if (state.ferryQuayId !== null) found.push(violation("ferry-off-map", "a ferry on a map without tide"));
    return;
  }
  const board = getBoard(state);
  for (const player of state.players) {
    if (player.position === HELL_NODE_ID) continue;
    const kind = getNodeKindOf(map, player.position);
    if (kind === "whirlpool") found.push(violation("rest-on-whirlpool", `${player.name} stands on a whirlpool`));
    if (board.flooded.includes(player.position)) {
      found.push(violation("rest-on-drowned-causeway", `${player.name} stands on drowned tile ${player.position}`));
    }
  }
  for (const quayId of map.tidal.ferryQuays) {
    const holders = state.players.filter((player) => player.position === quayId);
    if (holders.length > 1) found.push(violation("crowded-quay", `${holders.length} players stand on quay ${quayId}`));
  }
  const cupKind = state.redCupNodeId === null ? undefined : getNodeKindOf(map, state.redCupNodeId);
  if (cupKind === "quay" || cupKind === "causeway" || cupKind === "whirlpool") {
    found.push(violation("cup-on-water", `the Red Cup lies on ${cupKind} ${state.redCupNodeId}`));
  }
  if (state.ferryQuayId === null || !map.tidal.ferryQuays.includes(state.ferryQuayId)) {
    found.push(violation("ferry-lost", `the ferry is moored at ${state.ferryQuayId}`));
  }
}

/** Archipel: the ferry moves one quay at every new round, and only then; a whirlpool leaves its victim on a foreign quay. */
function checkArchipelTransition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const map = getBoardMap(next.mapId);
  if (!map.tidal || previous.ferryQuayId === null) return;
  const expected = next.round > previous.round ? getNextFerryQuay(map, previous.ferryQuayId) : previous.ferryQuayId;
  if (next.round - previous.round > 1) return;
  if (next.ferryQuayId !== expected) {
    found.push(violation("ferry-off-circuit", `the ferry went from ${previous.ferryQuayId} to ${next.ferryQuayId}`));
  }
  const seen = previous.lastArchipelEvents.reduce((highest, record) => Math.max(highest, record.seq), 0);
  for (const record of next.lastArchipelEvents.filter((entry) => entry.seq > seen)) {
    if (record.kind !== "whirlpool") continue;
    const here = map.tidal.islands.findIndex((tiles) => tiles.includes(record.from));
    const there = map.tidal.islands.findIndex((tiles) => tiles.includes(record.to));
    if (here === there) found.push(violation("whirlpool-same-island", `a whirlpool left a player on island ${here}`));
  }
}

/**
 * Désert des Mirages: two Cups at all times (the real one in `redCupNodeId`, the mirage beside it, never on the same
 * tile), none on an oasis, a well, a pass or the start, one traveller on each oasis, nobody on a shut pass, the caravan
 * on its loop; and nothing of this on any other map.
 */
function checkDesertState(state: GameState, found: RuleViolation[]): void {
  const map = getBoardMap(state.mapId);
  const desert = map.desert;
  if (!desert) {
    if (state.mirageNodeId !== null) found.push(violation("mirage-off-map", "a mirage on a map without desert"));
    if (state.caravanNodeId !== null) found.push(violation("caravan-off-map", "a caravan on a map without desert"));
    return;
  }
  const board = getBoard(state);
  const { redCupNodeId, mirageNodeId } = state;
  // The Black Cup takes both Cups to Hell together (the mirage is put aside until they come back).
  // New Cup, New Me hides the real one for a moment while its owner chooses.
  if (state.phase === "playing" && state.blackCup === null && state.pendingCupRepositionPlayerId === null) {
    if (redCupNodeId === null || mirageNodeId === null) {
      found.push(violation("two-cups", `the pair of Cups is ${redCupNodeId} and ${mirageNodeId}`));
    } else if (redCupNodeId === mirageNodeId) {
      found.push(violation("cups-together", `both Cups lie on tile ${redCupNodeId}`));
    }
  }
  for (const cup of [redCupNodeId, mirageNodeId]) {
    const kind = cup === null ? undefined : getNodeKindOf(map, cup);
    // (A sister may set a Cup down on the start: the swap lands it on the tile the player leaves.)
    if (kind === "oasis" || kind === "well" || kind === "pass") {
      found.push(violation("cup-on-landmark", `a Cup lies on ${kind} ${cup}`));
    }
  }
  for (const oasisId of desert.oases) {
    const holders = state.players.filter((player) => player.position === oasisId);
    if (holders.length > 1)
      found.push(violation("crowded-oasis", `${holders.length} players stand on oasis ${oasisId}`));
  }
  for (const player of state.players) {
    if (player.position !== HELL_NODE_ID && board.flooded.includes(player.position)) {
      found.push(violation("rest-on-shut-pass", `${player.name} stands on the shut pass ${player.position}`));
    }
  }
  if (state.caravanNodeId === null || !desert.outerLoop.includes(state.caravanNodeId)) {
    found.push(violation("caravan-lost", `the caravan stands on ${state.caravanNodeId}`));
  }
}

/** Désert: the caravan walks two tiles at each new round; after a pair is resolved, no old Cup tile holds a Cup. */
function checkDesertTransition(previous: GameState, next: GameState, found: RuleViolation[]): void {
  const desert = getBoardMap(next.mapId).desert;
  if (!desert) return;
  if (previous.caravanNodeId !== null && next.round - previous.round === 1) {
    const at = desert.outerLoop.indexOf(previous.caravanNodeId);
    const expected = desert.outerLoop[(at + CARAVAN_STEP) % desert.outerLoop.length];
    if (next.caravanNodeId !== expected) {
      found.push(
        violation("caravan-off-pace", `the caravan went from ${previous.caravanNodeId} to ${next.caravanNodeId}`),
      );
    }
  } else if (next.round === previous.round && next.caravanNodeId !== previous.caravanNodeId) {
    found.push(violation("caravan-moves-alone", "the caravan moved within a round"));
  }
  if (next.cupPairId > previous.cupPairId && next.blackCup === null) {
    // A new pair: neither of the tiles of the pair that went away holds a Cup again, or the one that did not move
    // would be the real one.
    const oldTiles = [previous.redCupNodeId, previous.mirageNodeId].filter((id): id is number => id !== null);
    const newTiles = [next.redCupNodeId, next.mirageNodeId].filter((id): id is number => id !== null);
    if (next.cupPairId - previous.cupPairId === 1 && newTiles.some((tile) => oldTiles.includes(tile))) {
      found.push(
        violation("pair-keeps-a-tile", `the new pair ${newTiles.join("/")} kept a tile of ${oldTiles.join("/")}`),
      );
    }
  } else if (
    next.phase === "playing" &&
    next.cupPairId === previous.cupPairId &&
    previous.blackCup === null &&
    next.blackCup === null &&
    previous.pendingCupRepositionPlayerId === null &&
    next.pendingCupRepositionPlayerId === null
  ) {
    // Nothing resolved: both Cups stay where they were (but for a sister's swap, which carries a Cup with her).
    const sisterSwapped = next.lastPowerEvent?.seq !== previous.lastPowerEvent?.seq;
    if (
      !sisterSwapped &&
      (previous.redCupNodeId !== next.redCupNodeId || previous.mirageNodeId !== next.mirageNodeId)
    ) {
      found.push(violation("cups-drift", "a Cup moved without a pair being drawn"));
    }
  }
}
