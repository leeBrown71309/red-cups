import type { PassiveId, Player } from "./types";

/**
 * Every player holds two cards (patch 0.1.6): an actif, which carries them
 * towards victory all game long, and a passif, which helps in one kind of
 * situation. Both are drawn from the same list of ids; `CARD_KINDS` says which
 * slot a card belongs to. `Player.passiveId` is the actif's slot, `Player.passifId` the passif's.
 *
 * Since patch 0.2.3 the players read « Cups Power » (CP) where the code says actif: every
 * identifier keeps its name, only the words on screen changed.
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
  mime: "actif",
  mole: "actif",
  "black-mage": "actif",
  "half-seen": "actif",
  "ghost-sister": "actif",
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
  hermit: "passif",
  insurer: "passif",
};

/** What decides a player's powers: their own two cards, and the actif the Mime copied for the turn. */
type CardHolder = Pick<Player, "passiveId" | "passifId" | "mimicId">;

/** The two cards a player was dealt: their actif, then their passif if they have one. A copy is not one of them. */
export function getOwnCards(player: Pick<Player, "passiveId" | "passifId">): PassiveId[] {
  return player.passifId ? [player.passiveId, player.passifId] : [player.passiveId];
}

/** The cards a player plays with right now: their own, and the actif the Mime copied for the turn. */
export function getCards(player: CardHolder): PassiveId[] {
  const own = getOwnCards(player);
  return player.mimicId ? [...own, player.mimicId] : own;
}

/**
 * Whether `player` holds `cardId`: as actif, as passif or, for the Mime, as the actif they copied for the turn.
 * Accepts nobody, for optional lookups.
 */
export function hasCard(player: CardHolder | null | undefined, cardId: PassiveId): boolean {
  return (
    player !== null &&
    player !== undefined &&
    (player.passiveId === cardId || player.passifId === cardId || player.mimicId === cardId)
  );
}

/** Whether `cardId` is one of the two cards the player was dealt: a copy does not count. */
export function ownsCard(
  player: Pick<Player, "passiveId" | "passifId"> | null | undefined,
  cardId: PassiveId,
): boolean {
  return player !== null && player !== undefined && (player.passiveId === cardId || player.passifId === cardId);
}

/** Puts `cardId` in its slot, leaving the other one alone. */
export function withCard<T extends Pick<Player, "passiveId" | "passifId">>(player: T, cardId: PassiveId): T {
  return CARD_KINDS[cardId] === "actif" ? { ...player, passiveId: cardId } : { ...player, passifId: cardId };
}
