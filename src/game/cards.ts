import type { PassiveId, Player } from "./types";

/**
 * Every player holds two cards (patch 0.1.6): an actif, which carries them
 * towards victory all game long, and a passif, which helps in one kind of
 * situation. Both are drawn from the same list of ids; `CARD_KINDS` says which
 * slot a card belongs to. `Player.passiveId` is the actif's slot, `Player.passifId` the passif's.
 */
export type CardKind = "actif" | "passif";

export const CARD_KINDS: Record<PassiveId, CardKind> = {
  // Actifs.
  greedy: "actif",
  devil: "actif",
  "guardian-angel": "actif",
  "red-bull": "actif",
  eshop: "actif",
  "tomato-enjoyer": "actif",
  roller: "actif",
  "blind-luck": "actif",
  "double-or-nothing": "actif",
  // The card of a player with no actif: never dealt, only used to fill the slot.
  lambda: "actif",
  // Passifs.
  "built-like-a-tank": "passif",
  "no-thanks": "passif",
  "i-take-notes": "passif",
  corrupter: "passif",
  thief: "passif",
  "red-light-green-light": "passif",
  "new-cup-new-me": "passif",
  "calm-down": "passif",
  "nepo-baby": "passif",
  goblin: "passif",
  "last-in-class": "passif",
  "hell-regular": "passif",
  "green-hand": "passif",
  "red-hand": "passif",
  "angelic-touch": "passif",
  "devils-hand": "passif",
  "game-master": "passif",
  "junk-dealer": "passif",
  trapper: "passif",
};

/** The cards a player holds: their actif, then their passif if they have one. */
export function getCards(player: Pick<Player, "passiveId" | "passifId">): PassiveId[] {
  return player.passifId ? [player.passiveId, player.passifId] : [player.passiveId];
}

/** Whether `player` holds `cardId`, as actif or as passif. Accepts nobody, for optional lookups. */
export function hasCard(player: Pick<Player, "passiveId" | "passifId"> | null | undefined, cardId: PassiveId): boolean {
  return player !== null && player !== undefined && (player.passiveId === cardId || player.passifId === cardId);
}

/** Puts `cardId` in its slot, leaving the other one alone. */
export function withCard<T extends Pick<Player, "passiveId" | "passifId">>(player: T, cardId: PassiveId): T {
  return CARD_KINDS[cardId] === "actif" ? { ...player, passiveId: cardId } : { ...player, passifId: cardId };
}
