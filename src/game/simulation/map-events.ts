import { findEdge, getBoard } from "../board";
import type { GameState } from "../types";
import { countItemUnits } from "../rules";
import { hasCard } from "../cards";
import { isInvisible } from "../mist";
import { isHermitPrimeActive } from "../passive-rules";
import { findPlayer } from "../state-utils";
import { newLogTexts, newPowerEvent } from "./invariant-helpers";

/**
 * Counts what each map's own mechanics did during one action, so a campaign
 * can prove every map really played its rules alongside everything else:
 * slides and falls of ice, the blizzard and the snowballs at Banquise, the
 * carousel, the ghost train and the ghost at Luna Park, the tunnel of the
 * classic board. `actionLabel` tells which action led to a slide, so moves
 * other than a walk (a wheel, a pull, a swap) show up when they end on ice.
 */
export function countMapEvents(
  previous: GameState,
  next: GameState,
  actionLabel: string,
  counts: Record<string, number>,
): void {
  const add = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  const movement = next.lastMovement;
  if (movement && movement.seq !== previous.lastMovement?.seq) {
    if (movement.thawed) add("thaw");
    if (movement.slideStart !== undefined && movement.path.length > movement.slideStart) add(`slide:${actionLabel}`);
    const board = getBoard(previous);
    let from = movement.from;
    for (const step of movement.path) {
      if (findEdge(board, from, step)?.kind === "tunnel") add("tunnel");
      from = step;
    }
  }
  if (next.lastIceFall && next.lastIceFall.seq !== previous.lastIceFall?.seq) {
    add(next.lastIceFall.hit ? "ice-fall:hit" : "ice-fall:miss");
  }
  if (next.lastBlizzard && next.lastBlizzard.seq !== previous.lastBlizzard?.seq) add("blizzard");
  if (next.lastSnowball && next.lastSnowball.seq !== previous.lastSnowball?.seq) {
    add(next.lastSnowball.frozen ? "snowball:freeze" : next.lastSnowball.hit ? "snowball:hit" : "snowball:miss");
  }
  if (next.lastGhostEvent && next.lastGhostEvent.seq !== previous.lastGhostEvent?.seq) {
    add(`ghost:${next.lastGhostEvent.kind}`);
  }
  if (next.pendingDuel?.ghost && !previous.pendingDuel?.ghost) add("ghost:duel");
  if (next.carouselReversed !== previous.carouselReversed) add("carousel-flip");
  if (next.lastBulletFlight && next.lastBulletFlight.seq !== previous.lastBulletFlight?.seq) add("bullet-bill");
  const logs = newLogTexts(previous, next);
  if (logs.some((text) => text.includes("passe par le départ"))) add("start-bonus");
  // Set down on ice some other way than walking, a player is carried away by it, the blizzard's freezing
  // their tile included.
  if (logs.some((text) => text.startsWith("La glace emporte"))) {
    add(`ice-carry:${next.lastBlizzard?.seq !== previous.lastBlizzard?.seq ? "blizzard" : actionLabel}`);
  }
  // Items that work on their own, without being used: le diable's Toucher d'Enfer, the angel's Bouclier.
  if (logs.some((text) => text.includes("active son Toucher d’Enfer"))) add("item:hell-touch");
  if (logs.some((text) => text.includes("lève son Bouclier"))) add("item:shield");
  // The automatic items show when they leave a bag: they were spent without being used by hand.
  for (const before of previous.players) {
    const after = next.players.find((player) => player.id === before.id);
    for (const itemId of ["wake-up", "parachute", "mirror"] as const) {
      if (after && countItemUnits(after, itemId) < countItemUnits(before, itemId)) add(`item:${itemId}`);
    }
  }
  if (next.barriers.length > previous.barriers.length) add("item:barrier");

  // The Cups Power and passifs of patch 0.2.3.
  const power = newPowerEvent(previous, next);
  if (power) add(`power:${power.kind}`);
  if (next.lastMovement?.sister && next.lastMovement.seq !== previous.lastMovement?.seq) {
    const { sister } = next.lastMovement;
    if (sister.path.some((tile, index) => tile !== (sister.path[index - 1] ?? sister.from))) add("sister-mirror");
  }
  if (
    next.players.some((player) => isInvisible(next, player) && !isInvisible(previous, findPlayer(previous, player.id)))
  ) {
    add("invisible");
  }
  if (next.players.some((player) => hasCard(player, "hermit") && isHermitPrimeActive(next, player)))
    add("hermit-prime");
  if (logs.some((text) => text.includes("pièces de la banque"))) add("insurer-paid");
}
