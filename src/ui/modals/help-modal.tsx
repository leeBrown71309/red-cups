import { useState } from "react";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import { BoardMap } from "../components/board-map";
import { ModalShell } from "../components/modal-shell";
import { TILE_LEGEND, formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon } from "../icons/item-icon";

type HelpTab = "board" | "turn" | "items" | "passives";

const TABS: { id: HelpTab; label: string }[] = [
  { id: "board", label: "Plateau" },
  { id: "turn", label: "Un tour" },
  { id: "items", label: "Objets" },
  { id: "passives", label: "Passifs" },
];

const TURN_STEPS = [
  "À ton tour, fais une seule action : avancer d’une case ou utiliser un objet.",
  "La Botte se prépare avant de bouger et te fait avancer de deux cases.",
  "Tu arrives sur une case verte ? Roue du bonheur. Rouge ? Roue du malheur. Même si on t’y a envoyé !",
  "Sur une case bleue, la boutique s’ouvre : achète autant que ton solde et ton sac le permettent.",
  "Ramasse 3 Red Cups pour gagner. Chaque Cup occupe une des 4 places de ton sac.",
  "Arriver au Départ par la case 8 : +200 pièces. À −300 pièces, ton solde repart à 0 et tu sautes ton tour.",
  "En Enfer, tu tournes sa roue à chaque tour. Deux joueurs en Enfer = duel, le gagnant repart du Départ.",
  "Toujours en Enfer après 5 tours ? Tu sors en case 0 avec les 200 du départ, mais tu paies 500 pièces.",
  "Non merci : quand un joueur annonce son action, le détenteur du passif peut l’annuler une fois par Red Cup.",
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>("board");

  return (
    <ModalShell title="Comment jouer" eyebrow="Red Cups" size="large" onClose={onClose} className="help-modal">
      <div className="segmented" role="tablist" aria-label="Rubriques d’aide">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`segmented__option ${tab === entry.id ? "is-active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "board" && (
        <div className="help-board">
          <BoardMap />
          <div className="help-board__legend">
            <ul className="legend-list">
              {TILE_LEGEND.map((entry) => (
                <li key={entry.kind}>
                  <span className="legend-swatch" style={{ background: entry.color }} />
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.description}</small>
                  </span>
                </li>
              ))}
            </ul>
            <ul className="legend-list legend-list--roads">
              <li>
                <span className="legend-road legend-road--oneway" aria-hidden="true">
                  ›››
                </span>
                <span>
                  <strong>Sortie fléchée</strong>
                  <small>
                    Sur une case fléchée, tu dois sortir par sa flèche. On peut y entrer par n’importe quelle route.
                  </small>
                </span>
              </li>
              <li>
                <span className="legend-road" aria-hidden="true" />
                <span>
                  <strong>Chemin libre</strong>
                  <small>Praticable dans les deux sens.</small>
                </span>
              </li>
              <li>
                <span className="legend-road legend-road--tunnel" aria-hidden="true">
                  ›››
                </span>
                <span>
                  <strong>Tunnel 7 → 1</strong>
                  <small>Sors par la gauche, réapparais à droite.</small>
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {tab === "turn" && (
        <ol className="help-steps">
          {TURN_STEPS.map((step, index) => (
            <li key={step}>
              <span className="help-steps__number">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      )}

      {tab === "items" && (
        <ul className="help-items">
          {ITEM_ORDER.map((itemId) => {
            const item = ITEM_CATALOG[itemId];
            return (
              <li key={itemId} className="help-item">
                <ItemIcon itemId={itemId} size={46} />
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                </div>
                <span className="price-chip">
                  <CoinIcon size={16} />
                  {itemId === "boot" ? "dès " : ""}
                  {formatCurrency(item.price)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "passives" && (
        <ul className="help-passives">
          {PASSIVE_ORDER.map((passiveId) => {
            const passive = PASSIVE_CATALOG[passiveId];
            return (
              <li key={passiveId}>
                <strong>{passive.name}</strong>
                <p>{passive.description}</p>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}
