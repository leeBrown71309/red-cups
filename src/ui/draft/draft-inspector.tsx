import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import type { PassiveId } from "../../game/types";
import { PassiveCard, PASSIVE_SUITS, SUIT_ACCENTS, SUIT_LABELS, toRomanNumeral } from "../components/passive-card";
import { PassiveTalisman } from "../components/passive-talisman";
import { TiltCard } from "../components/tilt-card";
import { PassiveIcon } from "../icons/passive-icon";
import { UiIcon } from "../icons/ui-icon";

interface DraftInspectorProps {
  /** The actifs are tarot cards, the passifs stay talismans: the DA never mixes them. */
  kind: "actif" | "passif";
  /** The cards on the table: two offered actifs, or the one passif dealt. */
  cards: PassiveId[];
  pickedId?: PassiveId;
  /** The CTA picks the focused card (actifs) or confirms the reading (passif). */
  onPick: (passiveId: PassiveId) => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  /** Small line under the CTA: what happens next, or what the clock will do. */
  note?: ReactNode;
}

/**
 * The draft's two-column moment: the cards held in 3D on the left (the one in focus in front, the other
 * leaning behind it, and the focused actif can be turned over to admire its back) and the whole rule written
 * large on the right. Touching the other card, or its name under the stage, swaps them; the big button is
 * what actually picks the card in front.
 */
export function DraftInspector({
  kind,
  cards,
  pickedId,
  onPick,
  confirmLabel,
  confirmDisabled = false,
  note,
}: DraftInspectorProps) {
  const [focusedId, setFocusedId] = useState<PassiveId>(pickedId ?? cards[0] ?? "lambda");
  const [flipped, setFlipped] = useState(false);

  // The offer can change between renders (online): keep the focus on a card that is still here.
  useEffect(() => {
    if (!cards.includes(focusedId) && cards.length > 0) setFocusedId(cards[0]);
  }, [cards, focusedId]);

  // Turning to another card always shows its face again.
  useEffect(() => setFlipped(false), [focusedId]);

  if (cards.length === 0) return null;
  const focused = cards.includes(focusedId) ? focusedId : cards[0];
  const focusedIndex = cards.indexOf(focused);
  const passive = PASSIVE_CATALOG[focused];
  const suit = PASSIVE_SUITS[focused];
  const numeral = toRomanNumeral(PASSIVE_ORDER.indexOf(focused) + 1);
  const accent = { "--card-accent": SUIT_ACCENTS[suit] } as CSSProperties;
  // With two cards, the one behind leans to the side of the card in front.
  const lean = cards.length > 1 ? (focusedIndex === 0 ? 1 : -1) : 0;

  return (
    <div className="draft-inspector">
      <div className="draft-inspector__stage">
        <ul
          className="draft-inspector__hand"
          aria-label={kind === "actif" ? "Cups Power proposés" : "Talisman tiré"}
          style={{ "--lean": lean } as CSSProperties}
        >
          {cards.map((cardId, index) => {
            const isFocused = cardId === focused;
            return (
              <li
                key={cardId}
                className={`draft-inspector__slot${isFocused ? " is-focused" : ""}${
                  pickedId === cardId ? " is-picked" : ""
                }${kind === "passif" ? " draft-inspector__slot--talisman" : ""}`}
                style={
                  {
                    "--rel": isFocused ? 0 : index < focusedIndex ? -1 : 1,
                    "--deal": index,
                  } as CSSProperties
                }
              >
                {kind === "actif" ? (
                  <TiltCard
                    delayMs={260 + index * 180}
                    scrollable
                    flipped={isFocused && flipped}
                    onFlip={() => setFlipped((current) => !current)}
                  >
                    <PassiveCard
                      passiveId={cardId}
                      selected={pickedId === cardId}
                      onPick={() => (isFocused ? setFlipped((current) => !current) : setFocusedId(cardId))}
                    >
                      {pickedId === cardId && (
                        <span className="tarot-card__picked">
                          <UiIcon name="check" size={14} /> Choisi
                        </span>
                      )}
                    </PassiveCard>
                  </TiltCard>
                ) : (
                  <div className="draft-inspector__talisman">
                    <PassiveTalisman passiveId={cardId} delayMs={260} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {kind === "actif" && (
          <div className="draft-inspector__bar">
            {cards.length > 1 && (
              <div className="draft-inspector__choices" role="group" aria-label="Choisir le Cups Power à examiner">
                {cards.map((cardId) => (
                  <button
                    key={cardId}
                    type="button"
                    className={`draft-inspector__choice${cardId === focused ? " is-active" : ""}`}
                    aria-pressed={cardId === focused}
                    onClick={() => setFocusedId(cardId)}
                  >
                    <PassiveIcon passiveId={cardId} size={26} />
                    <span>{PASSIVE_CATALOG[cardId].name}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn--cream btn--small draft-inspector__flip"
              onClick={() => setFlipped((current) => !current)}
            >
              <UiIcon name="rotate" size={18} />
              {flipped ? "Voir la face" : "Voir le dos"}
            </button>
          </div>
        )}
      </div>

      {/* key={focused} remounts the panel so the text cascade replays from card to card. */}
      <aside className="draft-inspector__detail" style={accent} key={focused}>
        <div className="draft-inspector__detail-body">
          <span className="draft-inspector__medallion" aria-hidden="true" style={{ "--i": 0 } as CSSProperties}>
            <PassiveIcon passiveId={focused} size={64} />
          </span>
          <p className="draft-inspector__tags" style={{ "--i": 1 } as CSSProperties}>
            <span className={`draft-inspector__kind draft-inspector__kind--${kind}`}>
              {kind === "actif" ? "Cups Power" : "Passif"}
            </span>
            <span className="draft-inspector__suit">{SUIT_LABELS[suit]}</span>
            <span className="draft-inspector__numeral" aria-hidden="true">
              {numeral}
            </span>
          </p>
          <h2 className="draft-inspector__name" style={{ "--i": 2 } as CSSProperties}>
            {passive.name}
          </h2>
          <p className="draft-inspector__text" style={{ "--i": 3 } as CSSProperties}>
            {passive.description}
          </p>
        </div>
        <footer className="draft-inspector__cta">
          <button
            type="button"
            className={`btn btn--${kind === "actif" ? "cup" : "gold"} btn--large draft-inspector__pick`}
            onClick={() => onPick(focused)}
            disabled={confirmDisabled}
            data-autofocus
          >
            <UiIcon name="check" size={20} /> {confirmLabel}
          </button>
          {note && <p className="draft-inspector__note">{note}</p>}
        </footer>
      </aside>
    </div>
  );
}
