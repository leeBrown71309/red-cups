import type { CSSProperties, ReactNode } from "react";
import { CARD_KINDS } from "../../game/cards";
import { PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import type { PassiveId } from "../../game/types";
import { PassiveIcon } from "../icons/passive-icon";

/**
 * A passive drawn as a tarot card: a numeral on top, an emblem, the name on a
 * ribbon, the rule below and the suit at the bottom. The roles and the
 * passives with their own victory are the major arcana; the others are dealt
 * from the three suits by what they touch.
 */

type TarotSuit = "arcana" | "coins" | "swords" | "wands";

const SUIT_LABELS: Record<TarotSuit, string> = {
  arcana: "Arcane majeur",
  coins: "Deniers",
  swords: "Épées",
  wands: "Bâtons",
};

/** The accent colour of each suit, taken from the game palette. */
const SUIT_ACCENTS: Record<TarotSuit, string> = {
  arcana: "var(--gold-deep)",
  coins: "var(--orange-deep)",
  swords: "var(--sky-deep)",
  wands: "var(--mint-deep)",
};

const PASSIVE_SUITS: Record<PassiveId, TarotSuit> = {
  devil: "arcana",
  "guardian-angel": "arcana",
  greedy: "arcana",
  "nepo-baby": "coins",
  eshop: "coins",
  goblin: "coins",
  thief: "coins",
  corrupter: "coins",
  "double-or-nothing": "coins",
  "built-like-a-tank": "swords",
  "no-thanks": "swords",
  "i-take-notes": "swords",
  "blind-luck": "swords",
  "tomato-enjoyer": "swords",
  "red-bull": "wands",
  roller: "wands",
  "red-light-green-light": "wands",
  "calm-down": "wands",
  "new-cup-new-me": "wands",
  lambda: "wands",
};

const ROMAN_NUMERALS: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRomanNumeral(value: number): string {
  let rest = value;
  let numeral = "";
  for (const [amount, symbol] of ROMAN_NUMERALS) {
    while (rest >= amount) {
      numeral += symbol;
      rest -= amount;
    }
  }
  return numeral;
}

interface PassiveCardProps {
  passiveId: PassiveId;
  /** Draft: the card is a button, and shows whether it is the chosen one. */
  onPick?: () => void;
  selected?: boolean;
  children?: ReactNode;
}

export function PassiveCard({ passiveId, onPick, selected = false, children }: PassiveCardProps) {
  const passive = PASSIVE_CATALOG[passiveId];
  const suit = PASSIVE_SUITS[passiveId];
  const numeral = toRomanNumeral(PASSIVE_ORDER.indexOf(passiveId) + 1);
  const style = { "--card-accent": SUIT_ACCENTS[suit] } as CSSProperties;
  const className = ["tarot-card", `tarot-card--${suit}`, selected && "is-selected", onPick && "is-pickable"]
    .filter(Boolean)
    .join(" ");

  const face = (
    <>
      <span className="tarot-card__numeral">{numeral}</span>
      <span className="tarot-card__art" aria-hidden="true">
        <PassiveIcon passiveId={passiveId} size={58} />
      </span>
      <strong className="tarot-card__name">{passive.name}</strong>
      {/* Long rules scroll inside the card, so every card keeps the same height. */}
      <span className="tarot-card__text scroll-block" tabIndex={0}>
        {passive.description}
      </span>
      <span className="tarot-card__suit">
        {CARD_KINDS[passiveId] === "actif" ? "Actif" : "Passif"} · {SUIT_LABELS[suit]}
      </span>
      {children}
    </>
  );

  if (!onPick) {
    return (
      <article className={className} style={style}>
        {face}
      </article>
    );
  }
  return (
    <button type="button" className={className} style={style} aria-pressed={selected} onClick={onPick}>
      {face}
    </button>
  );
}
