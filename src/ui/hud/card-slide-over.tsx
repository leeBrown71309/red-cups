import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { hasCard } from "../../game/cards";
import type { GameState, PassiveId, Player } from "../../game/types";
import { describeCupPowerState } from "../display/cup-power-state";
import { PassiveIcon } from "../icons/passive-icon";
import { UiIcon } from "../icons/ui-icon";

/** One of the two cards of a player, as the tiles and the slide-over show it. */
export interface CardEntry {
  label: string;
  cardId: PassiveId;
  /** What the card is doing right now (a cooldown, the chances left...), under its rules. */
  note?: ReactNode;
}

/** The cards of `player` that a viewer may see, with what each is doing right now (a cooldown, the reserve...). */
export function buildCardEntries(
  game: GameState,
  player: Player,
  cards: { actif: PassiveId | null; passif: PassiveId | null },
): CardEntry[] {
  const noThanksNote = !hasCard(player, "no-thanks")
    ? null
    : player.noThanksReadyRound <= game.round
      ? "Prêt à servir."
      : `De retour au tour ${player.noThanksReadyRound}.`;
  return [
    ...(cards.actif
      ? [{ label: "Cups Power", cardId: cards.actif, note: describeCupPowerState(game, player, cards.actif) }]
      : []),
    ...(cards.passif ? [{ label: "Passif", cardId: cards.passif, note: noThanksNote }] : []),
  ];
}

/**
 * A player's two cards (Cups Power, passif) as two small tiles: the icon and the name, one under the other. The rules
 * are read in the slide-over, so a long text never stretches the details card.
 */
export function CardTiles({
  entries,
  openLabel,
  onOpen,
}: {
  entries: CardEntry[];
  openLabel: string | null;
  onOpen: (label: string | null) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="card-tiles">
      {entries.map((entry) => {
        const open = entry.label === openLabel;
        return (
          <button
            key={entry.label}
            type="button"
            className={`card-tile ${open ? "is-open" : ""}`}
            aria-expanded={open}
            onClick={() => onOpen(open ? null : entry.label)}
          >
            <PassiveIcon passiveId={entry.cardId} size={40} />
            <span className="card-tile__text">
              <span className="eyebrow">{entry.label}</span>
              <strong>{PASSIVE_CATALOG[entry.cardId].name}</strong>
            </span>
            <UiIcon name="chevronRight" size={18} />
          </button>
        );
      })}
    </div>
  );
}

/** The veil stops above the action dock, so its buttons stay within reach while a card is open. */
function useClearanceAboveDock(): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const measure = () => {
      const dock = document.querySelector(".action-dock");
      const top = dock?.getBoundingClientRect().top;
      setBottom(top === undefined ? 0 : Math.max(0, Math.round(window.innerHeight - top)));
    };
    measure();
    const dock = document.querySelector(".action-dock");
    const observer = dock ? new ResizeObserver(measure) : null;
    if (dock) observer?.observe(dock);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return bottom;
}

/**
 * The rules of the opened card, on a dark veil that fades out to the left: it covers the right of the screen only, as
 * much as the icon, the title and the text need. The arrows go from the Cups Power to the passif and back.
 */
export function CardSlideOver({
  entries,
  openLabel,
  onOpen,
}: {
  entries: CardEntry[];
  openLabel: string;
  onOpen: (label: string | null) => void;
}) {
  const index = entries.findIndex((entry) => entry.label === openLabel);
  const entry = entries[index];
  const bottom = useClearanceAboveDock();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpen(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onOpen]);

  if (!entry) return null;
  const card = PASSIVE_CATALOG[entry.cardId];
  const previous = entries[index - 1];
  const next = entries[index + 1];

  return createPortal(
    <aside className="card-slide-over" role="dialog" aria-label={`${entry.label} : ${card.name}`} style={{ bottom }}>
      <div className="card-slide-over__body" key={entry.label}>
        <header className="card-slide-over__head">
          <PassiveIcon passiveId={entry.cardId} size={76} />
          <div>
            <span className="eyebrow">{entry.label}</span>
            <h2>{card.name}</h2>
          </div>
          <button
            type="button"
            className="icon-button card-slide-over__close"
            onClick={() => onOpen(null)}
            aria-label="Fermer"
          >
            <UiIcon name="close" size={16} strokeWidth={3} />
          </button>
        </header>
        <div className="card-slide-over__text scroll-block" tabIndex={0}>
          <p>{card.description}</p>
          {entry.note && <p className="card-slide-over__note">{entry.note}</p>}
        </div>
        {entries.length > 1 && (
          <nav className="card-slide-over__nav" aria-label="Changer de carte">
            <button type="button" disabled={!previous} onClick={() => previous && onOpen(previous.label)}>
              <UiIcon name="chevronLeft" size={18} /> {previous?.label ?? ""}
            </button>
            <button type="button" disabled={!next} onClick={() => next && onOpen(next.label)}>
              {next?.label ?? ""} <UiIcon name="chevronRight" size={18} />
            </button>
          </nav>
        )}
      </div>
    </aside>,
    document.body,
  );
}
