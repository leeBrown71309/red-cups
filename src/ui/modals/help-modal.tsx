import { useState } from "react";
import { getStartBonusNodeIds, resolveBoard } from "../../game/board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import { getBoardMap } from "../../game/maps/map-registry";
import type { RoadLegendEntry } from "../../game/maps/map-types";
import { useGameStore } from "../../game/store";
import type { MapId } from "../../game/types";
import { BASE_ENERGY, HELL_EXIT_TOLL, HELL_TURN_LIMIT, START_BONUS } from "../../game/types";
import { BoardMap, TileArrowSwatch } from "../components/board-map";
import { EnergyCost } from "../components/energy-meter";
import { ModalShell } from "../components/modal-shell";
import { formatCurrency, getTileLegend } from "../display/game-display";
import { getMapMechanics, type MapMechanic } from "../display/map-mechanics";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { useMapChoiceStore } from "../lobby/map-choice-store";

type HelpTab = "board" | "turn" | "items" | "passives";

const TABS: { id: HelpTab; label: string }[] = [
  { id: "board", label: "Plateau" },
  { id: "turn", label: "Un tour" },
  { id: "items", label: "Objets" },
  { id: "passives", label: "Passifs" },
];

const ROAD_SWATCH_CLASSES: Record<Exclude<RoadLegendEntry["style"], "arrow">, string> = {
  road: "legend-road",
  tunnel: "legend-road legend-road--tunnel",
  carousel: "legend-road legend-road--carousel",
  ice: "legend-road legend-road--ice",
};

/** The rules of a turn; the start bonus depends on the board. */
function getTurnSteps(mapId: MapId): string[] {
  const board = resolveBoard(mapId);
  const bonusTiles = getStartBonusNodeIds(board).join(" ou ");
  const steps = [
    "Avant la partie, chacun choisit son passif parmi ses cartes (3, ou 2 au-delà de 6 joueurs), jamais les mêmes " +
      "que celles des autres. En ligne, la table a une minute ; en local, l’écran passe de main en main.",
    "En ligne, ton tour dure 45 secondes, et les décisions des autres 20 : à la fin, le choix par défaut s’applique. " +
      "Un tour passé sans rien faire te coûte une chance ; à la troisième, tu déclares forfait. L’hôte peut " +
      "mettre la partie en pause : tous les chronos s’arrêtent.",
    `À ton tour, tu as ${BASE_ENERGY} points d’énergie. Utilise d’abord tes objets : chacun coûte son énergie, ` +
      "affichée sur l’objet. La Tomate, la Gomme et le Casque sont gratuits.",
    "Puis avance d’une case : il faut au moins 1 point, le déplacement prend tout ce qui reste et termine ton " +
      "tour. Après avoir utilisé un objet, ou sans assez d’énergie pour bouger, tu peux aussi finir ton tour sur place.",
    "La Botte coûte 1 point et en garde 1 pour ton déplacement de deux cases : une seule par tour. " +
      "Une seule Boue par tour aussi.",
    "Tu t’arrêtes sur une case verte ? Roue du bonheur. Rouge ? Roue du malheur. Téléporté, reculé ou déplacé " +
      "par une roue (« Avance d’une case », « Retourne d’où tu viens »), ça compte, boutique comprise ; tiré par la " +
      "Corde, échangé par le Monopoly Man, envoyé au Départ par New Cup ou replacé par Calme-toi, non.",
    "Sur une case bleue, la boutique s’ouvre : achète tant que ton solde et ton sac le permettent, sans " +
      "énergie. Ce que tu achètes sert à partir de ton prochain tour. Deux exemplaires au plus d’un même objet, " +
      "une seule Gomme. Les Tomates s’empilent par 5 : une pile compte comme un exemplaire, et tu ne lances " +
      "qu’une pile par tour.",
    "Ramasse 3 Red Cups pour gagner (Cupide gagne à 5 000 pièces, le diable quand les autres ont passé assez de tours en Enfer, " +
      "L’Ange-Gardien avec son protégé). Chaque Cup prend une place de ton " +
      "sac (4 places) ; " +
      "sac plein, tu jettes un objet, jamais une Cup.",
    `Entrer au Départ depuis la case ${bonusTiles}, dans le sens de la flèche : +${START_BONUS} pièces. ` +
      "À −300 pièces, ton solde repart à 0 et tu sautes ton tour.",
    "En Enfer, sa roue remplace le déplacement : au moins 1 point, et elle prend le reste. Tes objets passent " +
      `avant. Deux joueurs en Enfer = duel : le gagnant repart du Départ avec ${START_BONUS} pièces.`,
    "Le mini-jeu du duel est tiré au sort : pile ou face, pierre-feuille-ciseaux, vote de la table, Basket ou " +
      "Blackjack. Au Basket, chacun a 15 secondes pour marquer le plus de paniers ; au Blackjack, le plus proche de " +
      "21 sans le dépasser gagne. Égalité : la pièce départage.",
    `Toujours en Enfer après ${HELL_TURN_LIMIT} tours, tours sautés compris ? Tu sors en case 0 avec les ` +
      `${START_BONUS} du départ, mais tu paies ${HELL_EXIT_TOLL} pièces.`,
    "Non merci : son détenteur peut annuler un objet utilisé contre lui, une roue tournée pour lui (après le " +
      "résultat) ou Bullet Bill qui fonce sur lui, puis attend 5 tours de table. Contre Draven, il ne protège que " +
      "lui. Les déplacements et les Tomates ne s’annulent pas.",
    "Bullet Bill se lance depuis ton sac : il attend au départ, puis avance d’une case vers le joueur le plus " +
      "proche à chaque tour de table. Celui qu’il atteint perd 200 pièces et passe son prochain tour.",
    "Toute la table à 0 pièce ou moins ? Tour de Bénédiction : chacun tourne la roue du bonheur.",
    "Quelqu’un doit partir ? Menu pause, puis « Abandonner » : les autres continuent la partie.",
  ];
  // The board's own rules (ice, carousel, ghost) are presented on the board tab.
  if (getMapMechanics(mapId).length > 0) {
    steps.push(`${board.map.name} a ses propres règles : elles sont présentées dans l’onglet Plateau.`);
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
  const iceTileNodeId = useGameStore((state) => state.iceTileNodeId);
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
            <BoardMap
              mapId={shownMapId}
              carouselReversed={inGame && carouselReversed}
              iceTileNodeId={inGame ? iceTileNodeId : null}
            />
            <p className="help-board__tagline">{shownMap.tagline}</p>
          </div>
          <div className="help-board__legend">
            <MapMechanicsList mapId={shownMapId} />
            <h4 className="help-section-title">Cases</h4>
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
            <h4 className="help-section-title">Routes</h4>
            <ul className="legend-list legend-list--roads">
              {shownMap.roadLegend.map((entry) => (
                <li key={entry.title}>
                  {entry.style === "arrow" ? (
                    <TileArrowSwatch />
                  ) : (
                    <span className={ROAD_SWATCH_CLASSES[entry.style]} aria-hidden="true">
                      {entry.style === "road" ? "" : entry.style === "ice" ? "❄" : "›››"}
                    </span>
                  )}
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
        <ul className="help-cards">
          {ITEM_ORDER.map((itemId) => {
            const item = ITEM_CATALOG[itemId];
            return (
              <li key={itemId} className="help-card">
                <header className="help-card__head">
                  <span className="help-card__art">
                    <ItemIcon itemId={itemId} size={40} />
                  </span>
                  <div className="help-card__title">
                    <strong>{item.name}</strong>
                    <span className="help-card__chips">
                      <span className="price-chip">
                        <CoinIcon size={14} />
                        {itemId === "boot" ? "dès " : ""}
                        {formatCurrency(item.price)}
                      </span>
                      <EnergyCost cost={item.energyCost} />
                      {item.target === "player" && <span className="help-card__tag">Cible un joueur</span>}
                    </span>
                  </div>
                </header>
                <HelpCardText text={item.description} />
              </li>
            );
          })}
        </ul>
      )}

      {tab === "passives" && (
        <ul className="help-cards">
          {PASSIVE_ORDER.map((passiveId) => {
            const passive = PASSIVE_CATALOG[passiveId];
            return (
              <li key={passiveId} className="help-card help-card--passive">
                <header className="help-card__head">
                  <span className="help-card__art help-card__art--passive" aria-hidden="true">
                    <UiIcon name="sparkle" size={20} strokeWidth={2.6} />
                  </span>
                  <div className="help-card__title">
                    <strong>{passive.name}</strong>
                  </div>
                </header>
                <HelpCardText text={passive.description} />
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}

/** A card's description: long ones scroll inside the card, so every card keeps the same height. */
function HelpCardText({ text }: { text: string }) {
  return (
    <div className="help-card__text scroll-block" tabIndex={0}>
      <p>{text}</p>
    </div>
  );
}

/** The rules only this board has, one card each; nothing on a board without any. */
function MapMechanicsList({ mapId }: { mapId: MapId }) {
  const mechanics = getMapMechanics(mapId);
  if (mechanics.length === 0) return null;
  return (
    <section className="help-mechanics" aria-label="Mécaniques du plateau">
      <h4 className="help-section-title">Mécaniques du plateau</h4>
      <ul className="help-mechanics__list">
        {mechanics.map((mechanic) => (
          <MapMechanicCard key={mechanic.id} mechanic={mechanic} />
        ))}
      </ul>
    </section>
  );
}

function MapMechanicCard({ mechanic }: { mechanic: MapMechanic }) {
  return (
    <li className={`help-mechanic help-mechanic--${mechanic.tone}`}>
      <span className="help-mechanic__icon" aria-hidden="true">
        {mechanic.icon}
      </span>
      <div className="help-mechanic__body">
        <strong>{mechanic.title}</strong>
        {mechanic.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </li>
  );
}
