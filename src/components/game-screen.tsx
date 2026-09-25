import { lazy, Suspense, useMemo, useState } from "react";
import { BOARD_NODES, NORMAL_NODE_IDS } from "../game/board";
import {
  ITEM_CATALOG,
  ITEM_ORDER,
  PASSIVE_CATALOG,
} from "../game/catalog";
import {
  countRedCups,
  getInventoryCapacity,
  getItemPrice,
  getUniqueLegalDestinations,
} from "../game/rules";
import {
  getActivePlayer,
  getAvailablePurchaseIds,
  getInventoryName,
  useGameStore,
} from "../game/store";
import {
  HELL_NODE_ID,
  RED_CUP_GOAL,
} from "../game/types";
import type {
  DuelMode,
  InventoryEntry,
  ItemId,
  Player,
  PlayerId,
  RpsChoice,
  WheelId,
} from "../game/types";

const BoardScene = lazy(() => import("./board-scene"));

interface GameScreenProps {
  onExit: () => void;
}

const TARGETED_ITEMS: ItemId[] = [
  "ndoye",
  "hollow-purple",
  "rope",
  "middle-finger",
  "monopoly-man",
];

const RPS_CHOICES: { id: RpsChoice; label: string; symbol: string }[] = [
  { id: "rock", label: "Pierre", symbol: "✊" },
  { id: "paper", label: "Feuille", symbol: "✋" },
  { id: "scissors", label: "Ciseaux", symbol: "✌" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function wheelName(wheelId: WheelId): string {
  if (wheelId === "hell") return "ROUE DE L’ENFER";
  if (wheelId === "fortune") return "ROUE DU BONHEUR";
  return "ROUE DU MALHEUR";
}

function getWinnerFromRps(
  first: RpsChoice,
  second: RpsChoice,
  firstPlayerId: PlayerId,
  secondPlayerId: PlayerId,
): PlayerId | null {
  if (first === second) return null;
  const winningChoices: Record<RpsChoice, RpsChoice> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };
  return winningChoices[first] === second ? firstPlayerId : secondPlayerId;
}

function Header({ onExit }: { onExit: () => void }) {
  const state = useGameStore();
  const activePlayer = getActivePlayer(state);

  return (
    <header className="game-header">
      <div className="game-header__brand">
        <span className="brand-mark" aria-hidden="true">RC</span>
        <span>RED CUPS</span>
        <span className="header-divider" />
        <span className="host-badge"><i /> PARTIE HÔTE</span>
      </div>
      <div className="game-header__status">
        <span className="round-pill">TOUR DE TABLE {String(state.round).padStart(2, "0")}</span>
        {activePlayer && (
          <span className="active-turn-label">
            <i style={{ backgroundColor: activePlayer.color }} />
            {activePlayer.name}
          </span>
        )}
      </div>
      <button className="button button--quiet header-exit" onClick={onExit}>
        Nouvelle partie <span aria-hidden="true">↻</span>
      </button>
    </header>
  );
}

function PlayerStrip() {
  const players = useGameStore((state) => state.players);
  const activePlayerIndex = useGameStore((state) => state.activePlayerIndex);
  const pendingDuel = useGameStore((state) => state.pendingDuel);

  return (
    <div className="player-strip" aria-label="État des joueurs">
      {players.map((player, index) => {
        const cups = countRedCups(player);
        const isDueling = pendingDuel
          ? [pendingDuel.playerOneId, pendingDuel.playerTwoId].includes(player.id)
          : false;
        return (
          <div
            className={`player-chip ${index === activePlayerIndex ? "is-active" : ""} ${
              player.position === HELL_NODE_ID ? "is-hell" : ""
            } ${isDueling ? "is-dueling" : ""}`}
            key={player.id}
          >
            <span className="player-chip__token" style={{ backgroundColor: player.color }} />
            <span className="player-chip__name">{player.name}</span>
            <span className="player-chip__currency">◈ {formatCurrency(player.currency)}</span>
            <span className="player-chip__cups">{cups}/3 <span aria-hidden="true">●</span></span>
          </div>
        );
      })}
    </div>
  );
}

function WheelResultDialog() {
  const pendingWheel = useGameStore((state) => state.pendingWheel);
  const players = useGameStore((state) => state.players);
  const resolveWheel = useGameStore((state) => state.resolveWheel);
  const cancelWheel = useGameStore((state) => state.cancelWheel);
  if (!pendingWheel) return null;

  const player = players.find((candidate) => candidate.id === pendingWheel.playerId);
  const hasEraser = player?.inventory.some(
    (entry) => entry.kind === "item" && entry.itemId === "eraser",
  );

  return (
    <div className="modal-backdrop">
      <section className="modal-card wheel-dialog" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
        <div className="wheel-dialog__dial" aria-hidden="true">
          <span>↻</span>
        </div>
        <span className="eyebrow">{wheelName(pendingWheel.wheelId)}</span>
        <h2 id="wheel-title">{pendingWheel.result.label}</h2>
        <p>
          {player?.name} {pendingWheel.wheelId === "hell" ? "affronte sa roue de l’Enfer." : "doit subir le résultat."}
        </p>
        <div className="modal-actions">
          {hasEraser && (
            <button className="button button--outline" onClick={cancelWheel}>
              Utiliser la Gomme
            </button>
          )}
          <button className="button button--primary" onClick={resolveWheel}>
            Appliquer l’effet <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function DuelDialog() {
  const duel = useGameStore((state) => state.pendingDuel);
  const players = useGameStore((state) => state.players);
  const resolveDuel = useGameStore((state) => state.resolveDuel);
  const [firstChoice, setFirstChoice] = useState<RpsChoice | null>(null);
  const [secondChoice, setSecondChoice] = useState<RpsChoice | null>(null);
  const [voterIndex, setVoterIndex] = useState(0);
  const [votes, setVotes] = useState<PlayerId[]>([]);
  const [tieCount, setTieCount] = useState(0);

  if (!duel) return null;
  const playerOne = players.find((player) => player.id === duel.playerOneId);
  const playerTwo = players.find((player) => player.id === duel.playerTwoId);
  if (!playerOne || !playerTwo) return null;

  const voters = players.filter(
    (player) => player.id !== duel.playerOneId && player.id !== duel.playerTwoId,
  );
  const modeName: Record<DuelMode, string> = {
    "coin-flip": "PILE OU FACE",
    "rock-paper-scissors": "PIERRE-FEUILLE-CISEAUX",
    "player-vote": "VOTE DE LA TABLE",
  };

  const chooseRps = (choice: RpsChoice) => {
    if (!firstChoice) {
      setFirstChoice(choice);
      return;
    }

    setSecondChoice(choice);
    const winnerId = getWinnerFromRps(
      firstChoice,
      choice,
      playerOne.id,
      playerTwo.id,
    );
    if (winnerId) {
      resolveDuel(winnerId);
      return;
    }

    setTieCount((count) => count + 1);
    setFirstChoice(null);
    setSecondChoice(null);
  };

  const submitVote = (winnerId: PlayerId) => {
    const nextVotes = [...votes, winnerId];
    setVotes(nextVotes);
    if (nextVotes.length < voters.length) {
      setVoterIndex((index) => index + 1);
      return;
    }

    const oneVotes = nextVotes.filter((vote) => vote === playerOne.id).length;
    const twoVotes = nextVotes.filter((vote) => vote === playerTwo.id).length;
    resolveDuel(oneVotes === twoVotes
      ? (Math.random() < 0.5 ? playerOne.id : playerTwo.id)
      : oneVotes > twoVotes ? playerOne.id : playerTwo.id);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal-card duel-dialog" role="dialog" aria-modal="true" aria-labelledby="duel-title">
        <div className="duel-dialog__topline">
          <span className="eyebrow">DUEL EN ENFER</span>
          <span className="duel-mode-pill">{modeName[duel.mode]}</span>
        </div>
        <h2 id="duel-title">Un seul repart.</h2>
        <div className="duel-contestants">
          <div><i style={{ backgroundColor: playerOne.color }} />{playerOne.name}</div>
          <span>VS</span>
          <div><i style={{ backgroundColor: playerTwo.color }} />{playerTwo.name}</div>
        </div>

        {duel.mode === "coin-flip" && (
          <div className="duel-content">
            <div className="coin-token" aria-hidden="true">RC</div>
            <p>Le tirage au sort a choisi <strong>{duel.coinWinnerId === playerOne.id ? playerOne.name : playerTwo.name}</strong>.</p>
            <button className="button button--primary" onClick={() => duel.coinWinnerId && resolveDuel(duel.coinWinnerId)}>
              Confirmer le résultat <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}

        {duel.mode === "rock-paper-scissors" && (
          <div className="duel-content">
            <p>
              {!firstChoice
                ? `Choix secret de ${playerOne.name}`
                : !secondChoice
                  ? `Passe l’écran à ${playerTwo.name}`
                  : "Égalité — on recommence"}
            </p>
            {tieCount > 0 && <span className="tie-note">Égalité n°{tieCount} — nouvelle manche</span>}
            <div className="rps-choices">
              {RPS_CHOICES.map((choice) => (
                <button className="rps-choice" key={choice.id} onClick={() => chooseRps(choice.id)}>
                  <span>{choice.symbol}</span>
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {duel.mode === "player-vote" && (
          <div className="duel-content">
            {voters.length === 0 ? (
              <p>Pas d’autre joueur pour voter. Le tirage au sort départage le duel.</p>
            ) : (
              <>
                <p>
                  Vote de {voters[Math.min(voterIndex, voters.length - 1)]?.name} ·
                  <span> {votes.length}/{voters.length}</span>
                </p>
                <div className="vote-choices">
                  <button className="button button--outline" onClick={() => submitVote(playerOne.id)}>
                    {playerOne.name}
                  </button>
                  <button className="button button--outline" onClick={() => submitVote(playerTwo.id)}>
                    {playerTwo.name}
                  </button>
                </div>
                <span className="tie-note">Les votes précédents restent cachés jusqu’à la fin.</span>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DiscardDialog() {
  const pendingDiscard = useGameStore((state) => state.pendingDiscard);
  const players = useGameStore((state) => state.players);
  const discardInventoryEntry = useGameStore((state) => state.discardInventoryEntry);
  const player = players.find((candidate) => candidate.id === pendingDiscard?.playerId);
  if (!pendingDiscard || !player) return null;

  const isCup = pendingDiscard.reason === "red-cup";
  return (
    <div className="modal-backdrop">
      <section className="modal-card discard-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title">
        <span className="eyebrow">INVENTAIRE PLEIN</span>
        <h2 id="discard-title">Une place pour la Cup.</h2>
        <p>
          {isCup
            ? `${player.name}, choisis l’objet que tu abandonnes pour prendre la Red Cup.`
            : `${player.name}, choisis l’objet à sacrifier pour recevoir l’effet.`}
        </p>
        <div className="discard-options">
          {player.inventory.filter((entry) => entry.kind === "item").map((entry) => (
            <button className="discard-option" key={entry.id} onClick={() => discardInventoryEntry(entry.id)}>
              <span>{ITEM_CATALOG[entry.kind === "item" ? entry.itemId : "ndoye"].symbol}</span>
              <strong>{getInventoryName(entry)}</strong>
              <i aria-hidden="true">×</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShopPanel({ activePlayer }: { activePlayer: Player }) {
  const state = useGameStore();
  const buyItem = useGameStore((store) => store.buyItem);
  const availableIds = useMemo(() => getAvailablePurchaseIds(state), [state]);

  return (
    <section className="shop-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ARRÊT BOUTIQUE</span>
          <h3>Fais le plein.</h3>
        </div>
        <span className="shop-currency">◈ {formatCurrency(activePlayer.currency)}</span>
      </div>
      <p className="panel-subtitle">Tu peux acheter plusieurs objets avant de terminer ton tour.</p>
      <div className="shop-items">
        {ITEM_ORDER.map((itemId) => {
          const item = ITEM_CATALOG[itemId];
          const price = getItemPrice(itemId, state.bootPrice);
          const available = availableIds.includes(itemId);
          const isBulletAlreadyActive = itemId === "bullet-bill" && state.bulletBill !== null;
          return (
            <article className={`shop-item ${available ? "" : "is-disabled"}`} key={itemId}>
              <span className={`shop-item__symbol shop-item__symbol--${itemId}`} aria-hidden="true">{item.symbol}</span>
              <span className="shop-item__details">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <button
                className="shop-item__buy"
                disabled={!available}
                onClick={() => buyItem(itemId)}
                aria-label={`Acheter ${item.name} pour ${price} pièces`}
              >
                {isBulletAlreadyActive ? "ACTIF" : `${formatCurrency(price)} ◈`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PlayerInventory({
  activePlayer,
  onUseItem,
  onTargetItem,
  targetingEntryId,
  onCancelTarget,
}: {
  activePlayer: Player;
  onUseItem: (entry: InventoryEntry, targetPlayerId?: PlayerId) => void;
  onTargetItem: (entry: InventoryEntry) => void;
  targetingEntryId: string | null;
  onCancelTarget: () => void;
}) {
  const state = useGameStore();
  const canAct = state.turnStage === "move" || state.turnStage === "hell";
  const capacity = getInventoryCapacity(activePlayer);
  const emptySlots = Math.max(0, capacity - activePlayer.inventory.length);
  const hasPendingWheel = state.pendingWheel !== null;

  return (
    <section className="inventory-panel">
      <div className="panel-heading panel-heading--compact">
        <div>
          <span className="eyebrow">SAC DE {activePlayer.name.toUpperCase()}</span>
          <h3>Inventaire</h3>
        </div>
        <span className="inventory-count">{activePlayer.inventory.length}/{capacity}</span>
      </div>
      <div className="inventory-grid">
        {activePlayer.inventory.map((entry) => {
          const item = entry.kind === "item" ? ITEM_CATALOG[entry.itemId] : null;
          const canUseWater = entry.kind === "item" && entry.itemId === "water-bottle" && activePlayer.position === HELL_NODE_ID;
          const isEraserReaction = entry.kind === "item" && entry.itemId === "eraser" && hasPendingWheel;
          const isBoot = entry.kind === "item" && entry.itemId === "boot";
          const isHelmet = entry.kind === "item" && entry.itemId === "helmet";
          const isTargeted = entry.kind === "item" && TARGETED_ITEMS.includes(entry.itemId);
          const useIsAllowed =
            !isHelmet &&
            (isBoot
              ? state.turnStage === "move"
              : entry.kind === "item" && entry.itemId === "water-bottle"
                ? canUseWater
                : entry.kind === "item" && entry.itemId === "eraser"
                  ? isEraserReaction
                  : canAct && !hasPendingWheel);

          return (
            <article className={`inventory-slot ${entry.kind === "red-cup" ? "inventory-slot--cup" : ""}`} key={entry.id}>
              <span className="inventory-slot__symbol" aria-hidden="true">
                {entry.kind === "red-cup" ? "RC" : item?.symbol}
              </span>
              <strong>{getInventoryName(entry)}</strong>
              {entry.kind === "red-cup" ? (
                <span className="inventory-slot__tag">TROPHÉE</span>
              ) : isHelmet ? (
                <span className="inventory-slot__tag">AUTO</span>
              ) : (
                <button
                  className="inventory-slot__action"
                  disabled={!useIsAllowed}
                  onClick={() => isTargeted ? onTargetItem(entry) : onUseItem(entry)}
                >
                  {targetingEntryId === entry.id
                    ? "Choisir une cible"
                    : isEraserReaction
                      ? "Réagir"
                      : isBoot
                        ? "Préparer"
                        : canUseWater
                          ? "Sortir"
                          : "Utiliser"}
                </button>
              )}
            </article>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div className="inventory-slot inventory-slot--empty" key={`empty-${index}`}>
            <span className="inventory-slot__symbol" aria-hidden="true">＋</span>
            <strong>Emplacement libre</strong>
            <span className="inventory-slot__tag">VIDE</span>
          </div>
        ))}
      </div>
      {targetingEntryId && (
        <div className="target-picker">
          <div className="target-picker__heading">
            <span>Choisis une cible</span>
            <button onClick={onCancelTarget} aria-label="Annuler le choix de cible">×</button>
          </div>
          {state.players.map((player) => (
            <button
              className="target-picker__player"
              key={player.id}
              onClick={() => {
                const entry = activePlayer.inventory.find((item) => item.id === targetingEntryId);
                if (entry) onUseItem(entry, player.id);
              }}
            >
              <i style={{ backgroundColor: player.color }} />
              {player.name}
              <span>{player.position === HELL_NODE_ID ? "ENFER" : `CASE ${player.position}`}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CurrentPlayerCard({ activePlayer }: { activePlayer: Player }) {
  const cups = countRedCups(activePlayer);
  const passive = PASSIVE_CATALOG[activePlayer.passiveId];
  const usePassive = useGameStore((state) => state.resolvePassiveVote);
  const state = useGameStore();
  const availableNoThanks = state.players.filter(
    (player) =>
      player.passiveId === "no-thanks" &&
      player.id !== activePlayer.id &&
      player.noThanksUsedCycle !== state.redCupCycle,
  );

  return (
    <section className="current-player-card">
      <div className="current-player-card__top">
        <div className="current-player-identity">
          <span className="large-token" style={{ backgroundColor: activePlayer.color }}>
            {activePlayer.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <span className="eyebrow">JOUEUR ACTIF</span>
            <h2>{activePlayer.name}</h2>
          </div>
        </div>
        <span className={`location-tag ${activePlayer.position === HELL_NODE_ID ? "is-hell" : ""}`}>
          {activePlayer.position === HELL_NODE_ID ? "ENFER" : `CASE ${activePlayer.position}`}
        </span>
      </div>

      <div className="current-player-card__stats">
        <div className="wallet-stat">
          <span>PORTEFEUILLE</span>
          <strong><i>◈</i> {formatCurrency(activePlayer.currency)}</strong>
        </div>
        <div className="cups-stat">
          <span>RED CUPS</span>
          <strong>{cups}<small>/{RED_CUP_GOAL}</small></strong>
          <div className="cup-progress" aria-label={`${cups} sur 3 Red Cups`}>
            {Array.from({ length: RED_CUP_GOAL }, (_, index) => (
              <i className={index < cups ? "is-filled" : ""} key={index} />
            ))}
          </div>
        </div>
      </div>

      <div className="passive-card">
        <span className="passive-card__icon" aria-hidden="true">✦</span>
        <div>
          <span className="eyebrow">PASSIF</span>
          <strong>{passive.name}</strong>
          <p>{passive.description}</p>
        </div>
      </div>

      {availableNoThanks.map((player) => (
        <button
          className="interrupt-action"
          key={player.id}
          disabled={state.turnStage !== "move"}
          onClick={() => usePassive(player.id, true)}
        >
          <span>✦</span>
          {player.name} · annuler l’action
        </button>
      ))}
    </section>
  );
}

function TurnAction({
  activePlayer,
  legalDestinations,
  onSelectDestination,
}: {
  activePlayer: Player;
  legalDestinations: number[];
  onSelectDestination: (nodeId: number) => void;
}) {
  const state = useGameStore();
  const endTurn = useGameStore((store) => store.endTurn);
  const spinHellWheel = useGameStore((store) => store.spinHellWheel);
  const resolveCalmDown = useGameStore((store) => store.resolveCalmDown);
  const legalMoves = legalDestinations;

  if (state.turnStage === "move") {
    return (
      <section className="turn-action turn-action--move">
        <div className="turn-action__icon" aria-hidden="true">↗</div>
        <div>
          <span className="eyebrow">À TOI DE JOUER</span>
          <h3>{state.moveDistance === 2 ? "La Botte est prête." : "Choisis ta route."}</h3>
          <p>
            {legalMoves.length > 0
              ? `Clique sur une case mise en évidence pour avancer de ${state.moveDistance} ${state.moveDistance === 1 ? "case" : "cases"}.`
              : "Aucune destination légale n’est disponible."}
          </p>
          {legalMoves.length > 0 && (
            <div className="quick-moves" aria-label="Destinations accessibles">
              {legalMoves.map((nodeId) => (
                <button key={nodeId} onClick={() => onSelectDestination(nodeId)}>
                  Case {nodeId} <span>↗</span>
                </button>
              ))}
            </div>
          )}
          {legalMoves.length === 0 && (
            <button className="button button--outline button--small" onClick={endTurn}>
              Passer mon tour
            </button>
          )}
        </div>
      </section>
    );
  }

  if (state.turnStage === "hell") {
    const bottle = activePlayer.inventory.some(
      (entry) => entry.kind === "item" && entry.itemId === "water-bottle",
    );
    return (
      <section className="turn-action turn-action--hell">
        <div className="turn-action__icon" aria-hidden="true">☄</div>
        <div>
          <span className="eyebrow">TU ES EN ENFER</span>
          <h3>La roue décide.</h3>
          <p>Tourne la roue à chaque tour jusqu’à ta libération.</p>
          <div className="turn-action__buttons">
            <button className="button button--danger" onClick={spinHellWheel}>Tourner la roue</button>
            {bottle && <span className="item-hint">Ou utilise ta Bouteille d’eau dans l’inventaire.</span>}
          </div>
        </div>
      </section>
    );
  }

  if (state.turnStage === "shop") {
    return (
      <section className="turn-action turn-action--shop">
        <div className="turn-action__icon" aria-hidden="true">$</div>
        <div>
          <span className="eyebrow">ARRÊT BOUTIQUE</span>
          <h3>Le shop est ouvert.</h3>
          <p>Achète ce que tu veux, puis termine ton tour.</p>
          <button className="button button--primary button--small" onClick={endTurn}>Terminer mon tour</button>
        </div>
      </section>
    );
  }

  if (state.turnStage === "turn-end") {
    return (
      <section className="turn-action turn-action--end">
        <div className="turn-action__icon" aria-hidden="true">✓</div>
        <div>
          <span className="eyebrow">ACTION TERMINÉE</span>
          <h3>À la personne suivante.</h3>
          <p>Vérifie les effets, puis passe le tour.</p>
          <button className="button button--primary button--small" onClick={endTurn}>Terminer mon tour <span>↗</span></button>
        </div>
      </section>
    );
  }

  if (state.turnStage === "reposition") {
    const repositioner = state.players.find(
      (player) => player.id === state.pendingCupRepositionPlayerId,
    );
    return (
      <section className="turn-action turn-action--move">
        <div className="turn-action__icon" aria-hidden="true">✦</div>
        <div>
          <span className="eyebrow">NEW CUP, NEW ME</span>
          <h3>{repositioner?.name ?? "Le joueur passif"} change de place.</h3>
          <p>Choisis ta nouvelle case avant que la Red Cup soit révélée.</p>
          <div className="quick-moves" aria-label="Cases possibles pour le repositionnement">
            {legalMoves.map((nodeId) => (
              <button key={nodeId} onClick={() => onSelectDestination(nodeId)}>
                Case {nodeId} <span>↗</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (state.turnStage === "passive-choice" && state.pendingCalmDown) {
    const passivePlayer = state.players.find(
      (player) => player.id === state.pendingCalmDown?.passivePlayerId,
    );
    const collector = state.players.find(
      (player) => player.id === state.pendingCalmDown?.collectorId,
    );
    return (
      <section className="turn-action turn-action--move">
        <div className="turn-action__icon" aria-hidden="true">✦</div>
        <div>
          <span className="eyebrow">PASSIF · CALME-TOI</span>
          <h3>{passivePlayer?.name ?? "Un joueur"}, tu interviens ?</h3>
          <p>{collector?.name ?? "Le joueur"} est proche de la prochaine Red Cup. Tu peux le faire reculer de trois cases.</p>
          <div className="calm-down-actions">
            <button className="button button--outline button--small" onClick={() => resolveCalmDown(false)}>
              Laisser passer
            </button>
            <button className="button button--primary button--small" onClick={() => resolveCalmDown(true)}>
              Le faire reculer
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (state.turnStage === "target") {
    return (
      <section className="turn-action turn-action--move">
        <div className="turn-action__icon" aria-hidden="true">⚔</div>
        <div>
          <span className="eyebrow">DÉFI EN ENFER</span>
          <h3>Choisis ton adversaire.</h3>
          <p>Le perdant reste en Enfer ; le gagnant repart en case 0.</p>
        </div>
      </section>
    );
  }

  return null;
}

function GameLog() {
  const log = useGameStore((state) => state.log);
  return (
    <section className="game-log">
      <div className="panel-heading panel-heading--compact">
        <div>
          <span className="eyebrow">LA TABLE SE SOUVIENT</span>
          <h3>Journal</h3>
        </div>
        <span className="log-count">{String(log.length).padStart(2, "0")}</span>
      </div>
      <ol>
        {log.slice(0, 8).map((entry) => (
          <li className={`game-log__entry game-log__entry--${entry.tone}`} key={entry.id}>
            <span className="game-log__dot" />
            <span>{entry.text}</span>
          </li>
        ))}
        {log.length === 0 && <li className="game-log__empty">Les premières actions apparaîtront ici.</li>}
      </ol>
    </section>
  );
}

export default function GameScreen({ onExit }: GameScreenProps) {
  const state = useGameStore();
  const activePlayer = getActivePlayer(state);
  const movePlayer = useGameStore((store) => store.movePlayer);
  const useItem = useGameStore((store) => store.useItem);
  const prepareBoot = useGameStore((store) => store.prepareBoot);
  const challengePlayer = useGameStore((store) => store.challengePlayer);
  const repositionBeforeCup = useGameStore((store) => store.repositionBeforeCup);
  const [ignoreArrows, setIgnoreArrows] = useState(false);
  const [targetingEntryId, setTargetingEntryId] = useState<string | null>(null);

  const legalDestinations = useMemo(() => {
    if (state.turnStage === "reposition") return NORMAL_NODE_IDS;
    if (!activePlayer || state.turnStage !== "move") return [];
    const shouldIgnoreArrows = ignoreArrows && activePlayer.passiveId === "delinquent";
    return getUniqueLegalDestinations(activePlayer, state.moveDistance, shouldIgnoreArrows);
  }, [activePlayer, ignoreArrows, state.moveDistance, state.turnStage]);

  const onNodeClick = (nodeId: number) => {
    if (state.turnStage === "reposition") {
      repositionBeforeCup(nodeId);
      return;
    }
    movePlayer(nodeId, ignoreArrows);
    setIgnoreArrows(false);
  };

  const handleUseItem = (entry: InventoryEntry, targetPlayerId?: PlayerId) => {
    if (entry.kind !== "item") return;
    if (entry.itemId === "boot") {
      prepareBoot(entry.id);
      setTargetingEntryId(null);
      return;
    }
    if (entry.itemId === "eraser") {
      useGameStore.getState().cancelWheel();
      setTargetingEntryId(null);
      return;
    }
    if (TARGETED_ITEMS.includes(entry.itemId) && !targetPlayerId) {
      setTargetingEntryId(entry.id);
      return;
    }
    useItem(entry.id, targetPlayerId);
    setTargetingEntryId(null);
  };

  if (!activePlayer) return null;

  const winner = state.players.find((player) => player.id === state.winnerId);
  const activePlayerOnShop = BOARD_NODES.find((node) => node.id === activePlayer.position)?.kind === "shop";
  const pendingChallenge = state.pendingChallenge;

  return (
    <main className="game-shell">
      <Header onExit={onExit} />
      <section className="game-workspace">
        <div className="game-main-column">
          <section className="board-panel">
            <div className="board-panel__topline">
              <div>
                <span className="eyebrow">PLATEAU DE JEU</span>
                <h1>La route des Red Cups</h1>
              </div>
              <div className="board-panel__stats">
                <span><i className="legend-dot legend-dot--red" /> −100 sur rouge</span>
                <span><i className="legend-dot legend-dot--green" /> +100 sur vert</span>
              </div>
            </div>

            <Suspense fallback={<div className="board-loading">Préparation du plateau…</div>}>
              <BoardScene
                game={state}
                legalDestinations={legalDestinations}
                onNodeClick={onNodeClick}
              />
            </Suspense>

            <div className="board-panel__hint">
              <span className="board-panel__hint-icon" aria-hidden="true">i</span>
              <span>
                {state.turnStage === "reposition"
                  ? "Clique sur n’importe quelle case hors Enfer pour te repositionner."
                  : state.turnStage === "move"
                    ? "Les cases lumineuses sont les destinations légales. Les flèches indiquent le sens imposé."
                    : "Passe l’écran à la personne indiquée avant de poursuivre la partie."}
              </span>
              {activePlayer.passiveId === "delinquent" && state.turnStage === "move" && (
                <label className="ignore-arrows-toggle">
                  <input
                    checked={ignoreArrows}
                    onChange={(event) => setIgnoreArrows(event.target.checked)}
                    type="checkbox"
                  />
                  Ignorer une flèche · −200 ◈
                </label>
              )}
            </div>
          </section>

          <PlayerStrip />
        </div>

        <aside className="game-sidebar">
          <CurrentPlayerCard activePlayer={activePlayer} />
        <TurnAction
          activePlayer={activePlayer}
          legalDestinations={legalDestinations}
          onSelectDestination={onNodeClick}
        />

          {pendingChallenge && (
            <section className="challenge-picker">
              <span className="eyebrow">CHOISIS TON ADVERSAIRE</span>
              {state.players
                .filter((player) => player.id !== pendingChallenge.playerId)
                .map((player) => (
                  <button key={player.id} onClick={() => challengePlayer(player.id)}>
                    <i style={{ backgroundColor: player.color }} />
                    {player.name}
                    <span>{player.position === HELL_NODE_ID ? "DÉJÀ EN ENFER" : "APPELER EN ENFER"}</span>
                  </button>
                ))}
            </section>
          )}

          {activePlayerOnShop && state.turnStage === "shop" && <ShopPanel activePlayer={activePlayer} />}

          <PlayerInventory
            activePlayer={activePlayer}
            onUseItem={handleUseItem}
            onTargetItem={(entry) => handleUseItem(entry)}
            targetingEntryId={targetingEntryId}
            onCancelTarget={() => setTargetingEntryId(null)}
          />

          <GameLog />
        </aside>
      </section>

      <footer className="game-footer">
        <span>RED CUPS · PARTIE LOCALE</span>
        <span>LE PREMIER À TROIS CUPS GAGNE</span>
        <button onClick={onExit}>Abandonner la partie</button>
      </footer>

      {state.pendingWheel && <WheelResultDialog />}
      {state.pendingDuel && <DuelDialog key={`${state.pendingDuel.playerOneId}-${state.pendingDuel.playerTwoId}-${state.pendingDuel.mode}`} />}
      {state.pendingDiscard && <DiscardDialog />}
      {state.phase === "finished" && winner && (
        <div className="modal-backdrop">
          <section className="modal-card victory-dialog" role="dialog" aria-modal="true" aria-labelledby="victory-title">
            <span className="victory-cup" aria-hidden="true">RC</span>
            <span className="eyebrow">TROIS CUPS. UNE LÉGENDE.</span>
            <h2 id="victory-title">{winner.name} remporte la table.</h2>
            <p>La partie est terminée. Les autres peuvent contester le résultat autour d’un verre.</p>
            <button className="button button--primary" onClick={onExit}>
              Rejouer <span aria-hidden="true">↻</span>
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
