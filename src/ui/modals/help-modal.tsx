import { useState } from "react";
import { getStartBonusNodeIds, hasCarousel, hasIce, resolveBoard } from "../../game/board";
import { ITEM_CATALOG, ITEM_ORDER, PASSIVE_CATALOG, PASSIVE_ORDER } from "../../game/catalog";
import { getBoardMap } from "../../game/maps/map-registry";
import type { RoadLegendEntry } from "../../game/maps/map-types";
import { useGameStore } from "../../game/store";
import type { MapId } from "../../game/types";
import {
  BASE_ENERGY,
  GHOST_COOLDOWN_ROUNDS,
  GHOST_EMPTY_LOOT_REWARD,
  GHOST_LOOT_COINS,
  GHOST_MAX_DRIFT_STEPS,
  GHOST_STEAL_COINS,
  HELL_EXIT_TOLL,
  HELL_TURN_LIMIT,
  SNOWBALL_HITS_TO_FREEZE,
  START_BONUS,
} from "../../game/types";
import { BoardMap, TileArrowSwatch } from "../components/board-map";
import { EnergyCost } from "../components/energy-meter";
import { ModalShell } from "../components/modal-shell";
import { formatCurrency, getTileLegend } from "../display/game-display";
import { CoinIcon, ItemIcon } from "../icons/item-icon";
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

/** The rules of a turn; the start bonus and the carousel depend on the board. */
function getTurnSteps(mapId: MapId): string[] {
  const board = resolveBoard(mapId);
  const bonusTiles = getStartBonusNodeIds(board).join(" ou ");
  const steps = [
    `À ton tour, tu as ${BASE_ENERGY} points d’énergie. Utilise d’abord tes objets : chacun coûte son énergie, ` +
      "affichée sur l’objet. La Tomate, la Gomme et le Casque sont gratuits.",
    "Puis avance d’une case : il faut au moins 1 point, le déplacement prend tout ce qui reste et termine ton " +
      "tour. Après avoir utilisé un objet, ou sans assez d’énergie pour bouger, tu peux aussi finir ton tour sur place.",
    "La Botte coûte 1 point et en garde 1 pour ton déplacement de deux cases : une seule par tour. " +
      "Une seule Boue par tour aussi.",
    "Tu t’arrêtes sur une case verte ? Roue du bonheur. Rouge ? Roue du malheur. Téléporté, reculé ou déplacé " +
      "par une roue (« Avance d’une case », « Retourne d’où tu viens »), ça compte, boutique comprise ; tiré par la " +
      "Corde, échangé par le Monopoly Man ou replacé par New Cup, non.",
    "Sur une case bleue, la boutique s’ouvre : achète tant que ton solde et ton sac le permettent, sans " +
      "énergie. Ce que tu achètes sert à partir de ton prochain tour. Deux exemplaires au plus d’un même objet, " +
      "une seule Gomme. Les Tomates s’empilent par 5 : une pile compte comme un exemplaire, et tu ne lances " +
      "qu’une pile par tour.",
    "Ramasse 3 Red Cups pour gagner. Chaque Cup prend une place de ton sac (4 places, 5 avec Penta) ; " +
      "sac plein, tu jettes un objet, jamais une Cup.",
    `Entrer au Départ depuis la case ${bonusTiles}, dans le sens de la flèche : +${START_BONUS} pièces. ` +
      "À −300 pièces, ton solde repart à 0 et tu sautes ton tour.",
    "En Enfer, sa roue remplace le déplacement : au moins 1 point, et elle prend le reste. Tes objets passent " +
      `avant. Deux joueurs en Enfer = duel : le gagnant repart du Départ avec ${START_BONUS} pièces.`,
    "Le mini-jeu du duel est tiré au sort : pile ou face, pierre-feuille-ciseaux, vote de la table ou Basket. " +
      "Au Basket, chacun a 15 secondes pour marquer le plus de paniers ; égalité, la pièce départage.",
    `Toujours en Enfer après ${HELL_TURN_LIMIT} tours, tours sautés compris ? Tu sors en case 0 avec les ` +
      `${START_BONUS} du départ, mais tu paies ${HELL_EXIT_TOLL} pièces.`,
    "Non merci : quand un joueur annonce un déplacement ou un objet, le détenteur du passif peut l’annuler, " +
      "puis attend 3 tours de table.",
    "Bullet Bill se lance depuis ton sac : il attend au départ, puis avance d’une case vers le joueur le plus " +
      "proche à chaque tour de table. Celui qu’il atteint perd 200 pièces et passe son prochain tour.",
    "Toute la table à 0 pièce ou moins ? Tour de Bénédiction : chacun tourne la roue du bonheur.",
    "Quelqu’un doit partir ? Menu pause, puis « Abandonner » : les autres continuent la partie.",
  ];
  if (hasIce(board)) {
    steps.push(
      `${board.map.name} : arrivé sur la glace, tu glisses au hasard vers l’une de ses autres routes, jusqu’à une ` +
        "case sans glace. Seule la case d’arrivée compte (roue, boutique, Boue, Red Cup).",
      "Tombée de glace : si ta glissade file vers la Red Cup, la glace a 80 % de chances de te tomber dessus. Tu " +
        "restes pris sur la route et tu arrives sur la Red Cup au début de ton tour suivant, avant de jouer.",
      "Blizzard : une troisième case glissante apparaît au hasard, le Départ compris, et se déplace tous les deux " +
        "tours de table. Un Départ gelé ne paie pas les 200 pièces.",
    );
  }
  if (board.map.snowballs) {
    steps.push(
      "Pingouins : dès qu’une Red Cup a été ramassée, ils lancent une boule de neige sur un joueur au hasard à " +
        `chaque fin de tour (jamais en Enfer), et un tiers ratent. À la ${SNOWBALL_HITS_TO_FREEZE}ᵉ boule reçue, tu ` +
        "gèles sur place et tu passes ton prochain tour.",
    );
  }
  if (hasCarousel(board)) {
    steps.push(
      `${board.map.name} : le carrousel tourne dans un seul sens et s’inverse à chaque nouvelle Red Cup. ` +
        "Délinquant peut le prendre à contresens.",
    );
  }
  if (board.map.haunted) {
    steps.push(
      "Le fantôme rôde sur tout le plateau, sans respecter les routes : à chaque fin de tour, il glisse de 1 à " +
        `${GHOST_MAX_DRIFT_STEPS} cases, en s’arrêtant sur le premier joueur qu’il croise, ou disparaît pour ` +
        "réapparaître au loin. S’il tombe sur toi, ou si tu t’arrêtes sur sa case, c’est le duel. Jamais en Enfer.",
      `Perdu : il t’emporte en Enfer, ou te vole ${GHOST_STEAL_COINS} pièces ou un objet, qu’il garde dans son ` +
        `butin. Gagné : tu reprends un morceau de ce butin (un objet ou ${GHOST_LOOT_COINS} pièces), ou ` +
        `${GHOST_EMPTY_LOOT_REWARD} pièces s’il est vide, et il disparaît ${GHOST_COOLDOWN_ROUNDS} tours de table.`,
      "Clique sur le fantôme pour voir son butin.",
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
                <span className="help-item__chips">
                  <span className="price-chip">
                    <CoinIcon size={16} />
                    {itemId === "boot" ? "dès " : ""}
                    {formatCurrency(item.price)}
                  </span>
                  <EnergyCost cost={item.energyCost} />
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
