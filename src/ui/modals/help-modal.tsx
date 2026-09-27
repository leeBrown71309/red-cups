import { useState } from "react";
import { getStartBonusNodeIds, hasCarousel, resolveBoard } from "../../game/board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import { getBoardMap } from "../../game/maps/map-registry";
import type { RoadLegendEntry } from "../../game/maps/map-types";
import { useGameStore } from "../../game/store";
import type { MapId } from "../../game/types";
import { HELL_TURN_LIMIT, HELL_EXIT_TOLL, START_BONUS } from "../../game/types";
import { BoardMap } from "../components/board-map";
import { ModalShell } from "../components/modal-shell";
import { formatCurrency, getTileLegend } from "../display/game-display";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { useMapChoiceStore } from "../lobby/map-choice-store";
import { DetailCarousel } from "../components/detail-carousel";

type HelpTab = "board" | "turn" | "items" | "passives";

const TABS: { id: HelpTab; label: string }[] = [
  { id: "board", label: "Plateau" },
  { id: "turn", label: "Un tour" },
  { id: "items", label: "Objets" },
  { id: "passives", label: "Passifs" },
];

const ROAD_SWATCH_CLASSES: Record<RoadLegendEntry["style"], string> = {
  arrow: "legend-road legend-road--oneway",
  road: "legend-road",
  tunnel: "legend-road legend-road--tunnel",
  carousel: "legend-road legend-road--carousel",
};

/** The rules of a turn; the start bonus and the carousel depend on the board. */
function getTurnSteps(mapId: MapId): string[] {
  const board = resolveBoard(mapId);
  const bonusTiles = getStartBonusNodeIds(board).join(" ou ");
  const steps = [
    "À ton tour, fais une seule action : avancer d’une case ou utiliser un objet.",
    "La Botte se prépare et la Boue se pose avant de bouger : elles ne comptent pas comme ton action.",
    "Tu t’arrêtes sur une case verte ? Roue du bonheur. Rouge ? Roue du malheur. Téléporté ou reculé, ça compte ; " +
      "tiré par la Corde, échangé par le Monopoly Man ou replacé par New Cup, non.",
    "Sur une case bleue, la boutique s’ouvre : achète tant que ton solde et ton sac le permettent. " +
      "Deux exemplaires au plus d’un même objet, une seule Gomme.",
    "Ramasse 3 Red Cups pour gagner. Chaque Cup prend une place de ton sac (4 places, 5 avec Penta) ; " +
      "sac plein, tu jettes un objet, jamais une Cup.",
    `Entrer au Départ depuis la case ${bonusTiles}, dans le sens de la flèche : +${START_BONUS} pièces. ` +
      "À −300 pièces, ton solde repart à 0 et tu sautes ton tour.",
    "En Enfer, à chaque tour, tu tournes sa roue ou tu utilises un objet. Deux joueurs en Enfer = duel : " +
      `le gagnant repart du Départ avec ${START_BONUS} pièces.`,
    `Toujours en Enfer après ${HELL_TURN_LIMIT} tours, tours sautés compris ? Tu sors en case 0 avec les ` +
      `${START_BONUS} du départ, mais tu paies ${HELL_EXIT_TOLL} pièces.`,
    "Non merci : quand un joueur annonce un déplacement ou un objet, le détenteur du passif peut l’annuler, " +
      "puis attend 3 tours de table.",
    "Bullet Bill attend au départ dès son achat, puis fonce de 2 cases vers le joueur le plus proche à chaque " +
      "tour de table : −200 pièces et un tour passé pour sa victime.",
    "Toute la table à 0 pièce ou moins ? Tour de Bénédiction : chacun tourne la roue du bonheur.",
    "Quelqu’un doit partir ? Menu pause, puis « Abandonner » : les autres continuent la partie.",
  ];
  if (hasCarousel(board)) {
    steps.push(
      `${board.map.name} : le carrousel tourne dans un seul sens et s’inverse à chaque nouvelle Red Cup. ` +
        "Délinquant peut le prendre à contresens.",
    );
  }
  return steps;
}

/**
 * The one board the help explains: the game's board during a game, the one
 * shown behind the lobby before. Only that map is drawn, however many exist.
 */
function useHelpMapId(): MapId {
  const phase = useGameStore((state) => state.phase);
  const gameMapId = useGameStore((state) => state.mapId);
  const previewMapId = useMapChoiceStore((state) => state.previewMapId);
  return phase === "setup" ? previewMapId : gameMapId;
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>("board");
  const shownMapId = useHelpMapId();
  const phase = useGameStore((state) => state.phase);
  const carouselReversed = useGameStore((state) => state.carouselReversed);
  const inGame = phase !== "setup";
  const shownMap = getBoardMap(shownMapId);

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
          <div className="help-board__plan">
            <h3 className="help-board__title">{shownMap.name}</h3>
            <BoardMap mapId={shownMapId} carouselReversed={inGame && carouselReversed} />
            <p className="help-board__tagline">{shownMap.tagline}</p>
          </div>
          <div className="help-board__legend">
            <ul className="legend-list">
              {getTileLegend(shownMapId).map((entry) => (
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
              {shownMap.roadLegend.map((entry) => (
                <li key={entry.title}>
                  <span className={ROAD_SWATCH_CLASSES[entry.style]} aria-hidden="true">
                    {entry.style === "road" ? "" : "›››"}
                  </span>
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{entry.description}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "turn" && (
        <ol className="help-steps">
          {getTurnSteps(shownMapId).map((step, index) => (
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
                  <DetailCarousel details={item.details} label={item.name} />
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
                <DetailCarousel details={passive.details} label={passive.name} />
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}
