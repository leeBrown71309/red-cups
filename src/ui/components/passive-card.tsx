import type { ReactNode } from "react";
import { CARD_KINDS } from "../../game/cards";
import { PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import type { PassiveId } from "../../game/types";
import { CardFaceDecor, getCardStyle, MedallionShape } from "../cards/card-art";
import { CARD_DESIGNS } from "../cards/card-design";
import { PassiveIcon } from "../icons/passive-icon";

/**
 * A Cups Power drawn as a tarot card: a numeral on top, an emblem in a medallion, the name on a ribbon and the rule
 * below. Every card has a design of its own (texture, colours, medallion, corner glyphs, frame; see `card-design.ts`),
 * laid out the same way, and its back (`CardBack`) carries the same design. The passifs are talismans (see
 * `PassiveTalisman`).
 */

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
  const numeral = toRomanNumeral(PASSIVE_ORDER.indexOf(passiveId) + 1);
  const className = ["tarot-card", selected && "is-selected", onPick && "is-pickable"].filter(Boolean).join(" ");
  const style = getCardStyle(passiveId);

  const face = (
    <>
      <CardFaceDecor passiveId={passiveId} />
      <span className="tarot-card__numeral">{numeral}</span>
      <span className="tarot-card__art" aria-hidden="true">
        <MedallionShape shape={CARD_DESIGNS[passiveId].shape} passiveId={passiveId} />
        <PassiveIcon passiveId={passiveId} size={58} />
      </span>
      <strong className="tarot-card__name">{passive.name}</strong>
      {/* Long rules scroll inside the card, so every card keeps the same height. */}
      <span className="tarot-card__text scroll-block" tabIndex={0}>
        {passive.description}
      </span>
      <span className="tarot-card__kind">{CARD_KINDS[passiveId] === "actif" ? "Cups Power" : "Passif"}</span>
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
