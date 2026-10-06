import { useState } from "react";
import { getStartBonusNodeIds, resolveBoard } from "../../game/board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import { getBoardMap } from "../../game/maps/map-registry";
import type { RoadLegendEntry } from "../../game/maps/map-types";
import { useGameStore } from "../../game/store";
import type { ItemId, MapId, PassiveId } from "../../game/types";
import { BASE_ENERGY, HELL_EXIT_TOLL, HELL_TURN_LIMIT, START_BONUS } from "../../game/types";
import { BoardMap, TileArrowSwatch } from "../components/board-map";
import { CatalogBrowser } from "../components/catalog-browser";
import { ItemDetail } from "../components/item-detail";
import { TiltCard } from "../components/tilt-card";
import { PassiveIcon } from "../icons/passive-icon";
import { ModalShell } from "../components/modal-shell";
import { CARD_KINDS, type CardKind } from "../../game/cards";
import { PassiveCard } from "../components/passive-card";
import { formatCurrency, getTileLegend } from "../display/game-display";
import { getMapMechanics, type MapMechanic } from "../display/map-mechanics";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
import { UiIcon, type UiIconName } from "../icons/ui-icon";
import { useMapChoiceStore } from "../lobby/map-choice-store";

type HelpTab = "rules" | "board" | "items" | "passives";

/** The basic rules come first, then the board, the items and the passives. */
const TABS: { id: HelpTab; label: string }[] = [
  { id: "rules", label: "Règles" },
  { id: "board", label: "Plateau" },
  { id: "items", label: "Objets" },
  { id: "passives", label: "Cartes" },
];

const ROAD_SWATCH_CLASSES: Record<Exclude<RoadLegendEntry["style"], "arrow">, string> = {
  road: "legend-road",
  tunnel: "legend-road legend-road--tunnel",
  carousel: "legend-road legend-road--carousel",
  ice: "legend-road legend-road--ice",
};

interface RuleSection {
  id: string;
  title: string;
  icon: UiIconName;
  paragraphs: string[];
}

/** The basic rules of the game, by subject; the start bonus depends on the board. */
function getRuleSections(mapId: MapId): RuleSection[] {
  const board = resolveBoard(mapId);
  const bonusTiles = getStartBonusNodeIds(board).join(" ou ");
  const sections: RuleSection[] = [
    {
      id: "game",
      title: "Le jeu",
      icon: "dice",
      paragraphs: [
        "Red Cups est un jeu de plateau chaotique pour 2 à 8 joueurs. On avance de case en case, on achète des " +
          "objets, on tourne des roues, et on fait en sorte que ça tourne mal pour les autres.",
        "Chacun joue à son tour. Quand tout le monde a joué, un nouveau tour de table commence.",
      ],
    },
    {
      id: "goal",
      title: "Le but",
      icon: "crown",
      paragraphs: [
        "Le premier joueur à ramasser 3 Red Cups gagne. Une Cup attend sur une case du plateau : arrive dessus pour " +
          "la prendre, et une nouvelle apparaît ailleurs.",
        "Chaque Cup prend une place de ton sac (4 places). Sac plein, tu jettes un objet, jamais une Cup.",
        "Quelques passifs ont leur propre victoire : Cupide à 6 000 pièces, le diable quand les autres ont passé " +
          "assez de tours en Enfer, L’Ange-Gardien avec son protégé.",
      ],
    },
    {
      id: "move",
      title: "Se déplacer",
      icon: "arrowRight",
      paragraphs: [
        "À ton tour, tu avances d’une case voisine : touche une case en surbrillance sur le plateau, ou un bouton " +
          "de destination. Le déplacement termine ton tour.",
        "Une case fléchée ne se quitte que par sa flèche ; on peut y entrer par n’importe quelle route. Une route " +
          "sans flèche se parcourt dans les deux sens.",
        "La Botte te fait avancer de deux cases au lieu d’une, une seule fois par tour.",
      ],
    },
    {
      id: "turn",
      title: "Ton tour et l’énergie",
      icon: "clock",
      paragraphs: [
        `À ton tour, tu as ${BASE_ENERGY} points d’énergie. Utilise d’abord tes objets : chacun coûte son énergie, ` +
          "affichée sur l’objet. La Tomate, la Gomme et le Casque sont gratuits.",
        "Puis avance : il faut au moins 1 point, le déplacement prend tout ce qui reste et termine ton tour. Après " +
          "un objet, ou sans assez d’énergie pour bouger, tu peux aussi finir ton tour sur place.",
        "La Botte coûte 1 point et en garde 1 pour ton déplacement. Une seule Boue par tour.",
      ],
    },
    {
      id: "tiles",
      title: "Les cases",
      icon: "target",
      paragraphs: [
        "Case verte : roue du bonheur. Case rouge : roue du malheur. Téléporté, reculé ou déplacé par une roue " +
          "(« Avance d’une case », « Retourne d’où tu viens »), ça compte, boutique comprise ; tiré par la Corde, " +
          "échangé par le Monopoly Man, envoyé au Départ par New Cup ou replacé par Calme-toi, non.",
        `Entrer au Départ depuis la case ${bonusTiles}, dans le sens de la flèche : +${START_BONUS} pièces.`,
        "Sur une case bleue, la boutique s’ouvre. Toute la table à 0 pièce ou moins ? Tour de Bénédiction : chacun " +
          "tourne la roue du bonheur.",
      ],
    },
    {
      id: "money",
      title: "Pièces et boutique",
      icon: "shop",
      paragraphs: [
        "Tout le monde commence avec des pièces (2 000 en général, selon le passif). Dans la boutique, achète tant " +
          "que ton solde et ton sac le permettent, sans énergie. Ce que tu achètes sert à partir de ton prochain tour.",
        "Deux exemplaires au plus d’un même objet, une seule Gomme. Les Tomates s’empilent par 5 : une pile compte " +
          "comme un exemplaire, et tu ne lances qu’une pile par tour.",
        "À −300 pièces, ton solde repart à 0 et tu sautes ton tour.",
      ],
    },
    {
      id: "hell",
      title: "L’Enfer et les duels",
      icon: "flame",
      paragraphs: [
        "En Enfer, sa roue remplace le déplacement : au moins 1 point, et elle prend le reste. Tes objets passent " +
          "avant.",
        `Deux joueurs en Enfer : duel. Le gagnant repart du Départ avec ${START_BONUS} pièces, l’autre reste en Enfer.`,
        "Le mini-jeu du duel est tiré au sort : pile ou face, pierre-feuille-ciseaux, vote de la table, Basket ou " +
          "Blackjack. Au Basket, chacun a 15 secondes pour marquer le plus de paniers ; au Blackjack, le plus proche " +
          "de 21 sans le dépasser gagne. Égalité : la pièce départage.",
        `Toujours en Enfer après ${HELL_TURN_LIMIT} tours, tours sautés compris ? Tu sors en case 0 avec les ` +
          `${START_BONUS} du départ, mais tu paies ${HELL_EXIT_TOLL} pièces.`,
      ],
    },
    {
      id: "reactions",
      title: "Réactions et pièges",
      icon: "hand",
      paragraphs: [
        "Non merci : son détenteur peut annuler un objet utilisé contre lui, une roue tournée pour lui (après le " +
          "résultat) ou Bullet Bill qui fonce sur lui, puis attend 5 tours de table. Contre Draven, il ne protège que " +
          "lui. Les déplacements et les Tomates ne s’annulent pas.",
        "Bullet Bill se lance depuis ton sac : il attend au départ, puis avance d’une case vers le joueur le plus " +
          "proche à chaque tour de table. Celui qu’il atteint perd 200 pièces et passe son prochain tour.",
      ],
    },
    {
      id: "before",
      title: "Avant et pendant la partie",
      icon: "users",
      paragraphs: [
        "Avant la partie, chacun choisit son passif parmi ses cartes (3, ou 2 au-delà de 6 joueurs), jamais les " +
          "mêmes que celles des autres. En ligne, la table a une minute ; en local, l’écran passe de main en main.",
        "En ligne, ton tour dure 45 secondes, et les décisions des autres 20 : à la fin, le choix par défaut " +
          "s’applique. Le chrono s’arrête pendant les duels et les roues, pas dans la boutique. Un tour passé sans " +
          "rien faire te coûte une chance ; à la troisième, tu déclares forfait. L’hôte peut mettre la partie en pause " +
          "et exclure un joueur.",
        "Quelqu’un doit partir ? Menu pause, puis « Abandonner » : les autres continuent la partie.",
      ],
    },
  ];
  // The board's own rules (ice, carousel, ghost) are presented on the board tab.
  if (getMapMechanics(mapId).length > 0) {
    sections.push({
      id: "map",
      title: board.map.name,
      icon: "globe",
      paragraphs: [`${board.map.name} a ses propres règles : elles sont présentées dans l’onglet Plateau.`],
    });
  }
  return sections;
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
  const [tab, setTab] = useState<HelpTab>("rules");
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

      <div className={`help-content ${tab === "items" || tab === "passives" ? "help-content--catalog" : ""}`}>
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

        {tab === "rules" && (
          <div className="rules">
            {getRuleSections(shownMapId).map((section) => (
              <section key={section.id} className="rules-section">
                <h3 className="rules-section__title">
                  <span className="rules-section__icon" aria-hidden="true">
                    <UiIcon name={section.icon} size={18} strokeWidth={2.6} />
                  </span>
                  {section.title}
                </h3>
                <ul className="rules-section__list">
                  {section.paragraphs.map((paragraph) => (
                    <li key={paragraph}>{paragraph}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {tab === "items" && <ItemsCatalog />}

        {tab === "passives" && <CardsCatalog />}
      </div>
    </ModalShell>
  );
}

/** Every item, as in the shop: the miniatures scroll on the left, the selected one stays on the right. */
function ItemsCatalog() {
  const [selectedId, setSelectedId] = useState<string>(ITEM_ORDER[0]);
  const entries = ITEM_ORDER.map((itemId) => ({
    id: itemId,
    name: ITEM_CATALOG[itemId].name,
    keywords: ITEM_CATALOG[itemId].description,
  }));
  const itemId = (ITEM_ORDER.find((candidate) => candidate === selectedId) ?? ITEM_ORDER[0]) as ItemId;
  const item = ITEM_CATALOG[itemId];

  return (
    <CatalogBrowser
      entries={entries}
      selectedId={itemId}
      onSelect={setSelectedId}
      searchLabel="Chercher un objet"
      renderMini={(entry) => (
        <>
          <ItemIcon itemId={entry.id as ItemId} size={34} />
          <span className="catalog__mini-name">{entry.name}</span>
          <span className="price-chip">
            <CoinIcon size={14} />
            {formatCurrency(ITEM_CATALOG[entry.id as ItemId].price)}
          </span>
        </>
      )}
      detail={
        <ItemDetail itemId={itemId} item={item} price={item.price} pricePrefix={itemId === "boot" ? "dès " : ""} />
      }
    />
  );
}

type CardFilter = "all" | CardKind;

const CARD_FILTERS: { id: CardFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "actif", label: "Actifs" },
  { id: "passif", label: "Passifs" },
];

/** Every card: the miniatures on the left, and the tarot card itself on the right, held in 3D. */
function CardsCatalog() {
  const [filter, setFilter] = useState<CardFilter>("all");
  const [selectedId, setSelectedId] = useState<PassiveId>(PASSIVE_ORDER[0]);
  const shownIds = PASSIVE_ORDER.filter((passiveId) => filter === "all" || CARD_KINDS[passiveId] === filter);
  const entries = shownIds.map((passiveId) => ({
    id: passiveId,
    name: PASSIVE_CATALOG[passiveId].name,
    keywords: `${PASSIVE_CATALOG[passiveId].description} ${CARD_KINDS[passiveId]}`,
  }));
  const passiveId = shownIds.includes(selectedId) ? selectedId : (shownIds[0] ?? selectedId);

  return (
    <CatalogBrowser
      className="catalog--cards"
      entries={entries}
      selectedId={passiveId}
      onSelect={(id) => setSelectedId(id as PassiveId)}
      searchLabel="Chercher une carte"
      filters={
        <div className="segmented segmented--compact" role="group" aria-label="Type de carte">
          {CARD_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`segmented__option ${filter === option.id ? "is-active" : ""}`}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
      renderMini={(entry) => (
        <>
          <PassiveIcon passiveId={entry.id as PassiveId} size={34} />
          <span className="catalog__mini-name">{entry.name}</span>
          <span className="catalog__mini-kind">
            {CARD_KINDS[entry.id as PassiveId] === "actif" ? "Actif" : "Passif"}
          </span>
        </>
      )}
      detail={
        <TiltCard key={passiveId}>
          <PassiveCard passiveId={passiveId} />
        </TiltCard>
      }
    />
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
