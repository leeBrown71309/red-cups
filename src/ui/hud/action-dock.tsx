import type { CSSProperties, ReactNode } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { canEndTurn, getEnergyCapacity } from "../../game/energy";
import { formatGambleAmount } from "../../game/gamble";
import { canRescueProtege } from "../../game/guardian";
import { getTileWheelFor } from "../../game/rules";
import { useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import {
  CALM_DOWN_DISTANCE,
  CORRUPTER_COST,
  HELL_EXIT_TOLL,
  HELL_TURN_LIMIT,
  MOVE_MINIMUM_ENERGY,
  START_BONUS,
} from "../../game/types";
import { useUiStore } from "../../feedback/ui-store";
import { useCanActFor } from "../../net/room-store";
import { EnergyGauge } from "../components/energy-meter";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { getCorrupterHint } from "../display/item-availability";
import { commitDestination, useActivePlayer, useDecidingPlayer, useLegalMoves } from "../game-hooks";
import { CoinIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { getAvatarExpression } from "./players-bar";
import { TurnTimer } from "./turn-timer";

interface ActionDockProps {
  onOpenShop: () => void;
}

/** Tells the active player, in plain words, what to do right now. */
export function ActionDock({ onOpenShop }: ActionDockProps) {
  const activePlayer = useActivePlayer();
  const turnStage = useGameStore((state) => state.turnStage);
  const phase = useGameStore((state) => state.phase);
  const decider = useDecidingPlayer();
  const energyLeft = useGameStore((state) => state.energyLeft);
  const canAct = useCanActFor([decider?.id]);
  if (!activePlayer || !decider || phase !== "playing") return null;

  const passive = PASSIVE_CATALOG[decider.passiveId];

  return (
    <section
      className="action-dock panel"
      aria-live="polite"
      style={{ "--player-color": decider.color } as CSSProperties}
    >
      <div className="action-dock__who">
        <PlayerAvatar color={decider.color} size={56} expression={getAvatarExpression(decider)} />
        <div className="action-dock__identity">
          <strong>{decider.name}</strong>
          <span className="action-dock__passive" title={passive.description}>
            <UiIcon name="sparkle" size={12} /> {passive.name}
          </span>
          <span className="action-dock__wallet">
            <CoinIcon size={15} />
            {formatCurrency(decider.currency)}
          </span>
          {decider.id === activePlayer.id && (
            <EnergyGauge left={energyLeft} capacity={getEnergyCapacity(activePlayer)} />
          )}
          <TurnTimer />
        </div>
      </div>
      <div className="action-dock__content">
        {canAct ? (
          <StageContent player={activePlayer} stage={turnStage} onOpenShop={onOpenShop} />
        ) : (
          <DockPrompt title={`Au tour de ${decider.name}`} hint="Regarde bien : ton tour arrive." />
        )}
      </div>
    </section>
  );
}

function DockPrompt({ title, hint, children }: { title: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="dock-prompt">
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
      {children && <div className="dock-actions">{children}</div>}
    </>
  );
}

/** Offered before moving once an item was used, or when the gauge is too low to move. */
function EndTurnButton({ primary = false }: { primary?: boolean }) {
  const endTurn = useGameStore((state) => state.endTurn);
  const allowed = useGameStore(canEndTurn);
  if (!allowed) return null;
  return (
    <button
      type="button"
      className={`btn ${primary ? "btn--cup btn--pulse" : "btn--cream"}`}
      onClick={endTurn}
      data-autofocus={primary || undefined}
    >
      Fin du tour <UiIcon name="arrowRight" size={20} />
    </button>
  );
}

function StageContent({ player, stage, onOpenShop }: { player: Player; stage: string; onOpenShop: () => void }) {
  const endTurn = useGameStore((state) => state.endTurn);
  const spinTileWheel = useGameStore((state) => state.spinTileWheel);
  const tileWheels = useGameStore((state) => state.pendingTileWheels);
  const players = useGameStore((state) => state.players);
  const activePlayerIndex = useGameStore((state) => state.activePlayerIndex);
  // Doomsday turns every tile into a wheel of misfortune.
  const spinnerFortune = useGameStore((state) => {
    const spinner = state.players.find((candidate) => candidate.id === state.pendingTileWheels[0]?.playerId) ?? player;
    return getTileWheelFor(state, spinner, spinner.position) === "fortune";
  });
  const ghostDuel = useGameStore(
    (state) => state.pendingDuel?.ghost !== undefined && state.pendingDuel?.ghost !== null,
  );

  switch (stage) {
    case "move":
      return <MoveContent player={player} />;
    case "reposition":
      return <NewCupContent />;
    case "advance":
      return <AdvanceContent />;
    case "hell":
      return <HellContent player={player} />;
    case "tile-wheel": {
      const spinner = players.find((candidate) => candidate.id === tileWheels[0]?.playerId) ?? player;
      const fortune = spinnerFortune;
      const pushedThere = spinner.id !== player.id;
      return (
        <DockPrompt
          title={fortune ? "Case verte : roue du bonheur !" : "Case rouge : roue du malheur…"}
          hint={
            pushedThere
              ? `${spinner.name} a atterri en case ${spinner.position} : à lui de tourner la roue.`
              : fortune
                ? "Tourne la roue, la chance te sourit peut-être."
                : "Tourne la roue et croise les doigts."
          }
        >
          <button
            type="button"
            className={`btn ${fortune ? "btn--mint" : "btn--grape"} btn--pulse`}
            onClick={spinTileWheel}
            data-autofocus
          >
            <UiIcon name="sparkle" size={20} /> Tourner la roue
          </button>
        </DockPrompt>
      );
    }
    case "blessing":
      return <BlessingContent />;
    case "reaction":
      return <ReactionContent />;
    case "shop":
      return (
        <DockPrompt title="La boutique est ouverte" hint="Achète autant que tu veux, puis termine ton tour.">
          <button type="button" className="btn btn--sky" onClick={onOpenShop}>
            <UiIcon name="shop" size={20} /> Boutique
          </button>
          <button type="button" className="btn btn--cup" onClick={endTurn}>
            Fin du tour <UiIcon name="arrowRight" size={20} />
          </button>
        </DockPrompt>
      );
    case "turn-end": {
      const next = findNextPlayer(players, activePlayerIndex);
      return (
        <DockPrompt
          title="Action terminée !"
          hint={
            next ? (
              <>
                Au tour de <strong>{next.name}</strong> ensuite.
              </>
            ) : (
              "Passe la main."
            )
          }
        >
          <button type="button" className="btn btn--cup btn--pulse" onClick={endTurn} data-autofocus>
            Fin du tour <UiIcon name="arrowRight" size={20} />
          </button>
        </DockPrompt>
      );
    }
    case "passive-choice":
      return <CalmDownContent />;
    case "gamble":
      return <GambleContent />;
    case "target":
      return <DockPrompt title="Duel en vue" hint="Choisis l’adversaire qui te rejoint en Enfer." />;
    case "discard":
      return <DockPrompt title="Sac plein !" hint="Choisis l’objet à abandonner." />;
    case "wheel-result":
      return <DockPrompt title="La roue tourne…" hint="Croise les doigts." />;
    case "duel":
      return ghostDuel ? (
        <DockPrompt title="Le fantôme attaque !" hint="Bats-le pour reprendre son butin." />
      ) : (
        <DockPrompt title="Duel en Enfer !" hint="Un seul en ressortira." />
      );
    default:
      return null;
  }
}

function BlessingContent() {
  const queue = useGameStore((state) => state.blessingQueue);
  const players = useGameStore((state) => state.players);
  const spinBlessingWheel = useGameStore((state) => state.spinBlessingWheel);
  const spinner = players.find((player) => player.id === queue[0]);
  const after = queue.length - 1;

  return (
    <DockPrompt
      title="Tour de Bénédiction !"
      hint={
        <>
          Toute la table est fauchée. À <strong>{spinner?.name}</strong> de tourner la roue du bonheur
          {after > 0 ? `, puis encore ${after} joueur${after > 1 ? "s" : ""}.` : ", le dernier avant de reprendre."}
        </>
      }
    >
      <button type="button" className="btn btn--mint btn--pulse" onClick={spinBlessingWheel} data-autofocus>
        <UiIcon name="sparkle" size={20} /> Tourner la roue
      </button>
    </DockPrompt>
  );
}

/** In Hell the wheel stands for the move: it needs a point and takes the rest. */
function HellContent({ player }: { player: Player }) {
  const spinHellWheel = useGameStore((state) => state.spinHellWheel);
  const leaveHell = useGameStore((state) => state.leaveHell);
  const tired = useGameStore((state) => state.energyLeft < MOVE_MINIMUM_ENERGY);
  const hasBottle = player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "water-bottle");
  const lastTurn = player.hellTurns >= HELL_TURN_LIMIT;
  const countdown = lastTurn
    ? `Dernier tour : sans évasion, tu sors en case 0 contre ${HELL_EXIT_TOLL} pièces.`
    : `Tour ${player.hellTurns}/${HELL_TURN_LIMIT} : au bout de ${HELL_TURN_LIMIT}, tu sors contre ${HELL_EXIT_TOLL} pièces.`;
  const advice = tired
    ? "Plus d’énergie pour la roue : elle t’attend au prochain tour."
    : hasBottle
      ? "Tourne la roue, ou bois ta Bouteille d’eau depuis ton sac."
      : "Utilise tes objets d’abord si tu veux, puis tourne la roue pour tenter de t’échapper.";

  return (
    <DockPrompt title="Bienvenue en Enfer…" hint={`${advice} ${countdown}`}>
      {player.passiveId === "devil" && (
        <button
          type="button"
          className="btn btn--cup"
          onClick={leaveHell}
          title="Retour en case 0, sans les 200 pièces"
        >
          <UiIcon name="flag" size={20} /> Sortir de l’Enfer
        </button>
      )}
      <button type="button" className="btn btn--grape" onClick={spinHellWheel} disabled={tired}>
        <UiIcon name="flame" size={20} /> Tourner la roue
      </button>
      <EndTurnButton primary={tired} />
    </DockPrompt>
  );
}

function MoveContent({ player }: { player: Player }) {
  const moveDistance = useGameStore((state) => state.moveDistance);
  const round = useGameStore((state) => state.round);
  const mudPlaced = useGameStore((state) => state.mudPlacedThisTurn);
  const tired = useGameStore((state) => state.energyLeft < MOVE_MINIMUM_ENERGY);
  const diceRoll = useGameStore((state) => state.diceRoll);
  const rollDice = useGameStore((state) => state.rollDice);
  const endTurn = useGameStore((state) => state.endTurn);
  const rescueProtege = useGameStore((state) => state.rescueProtege);
  const canRescue = useGameStore(canRescueProtege);
  const protegeName = useGameStore(
    (state) => state.players.find((candidate) => candidate.id === state.guardian?.protegeId)?.name,
  );
  const ignoreArrows = useUiStore((state) => state.ignoreArrows);
  const setIgnoreArrows = useUiStore((state) => state.setIgnoreArrows);
  const previewNodeId = useUiStore((state) => state.previewNodeId);
  const setPreviewNodeId = useUiStore((state) => state.setPreviewNodeId);
  const setHoveredChipNodeId = useUiStore((state) => state.setHoveredChipNodeId);
  const legalMoves = useLegalMoves();
  const destinations = [...legalMoves.paths.keys()].sort((left, right) => left - right);
  const isCorrupter = player.passiveId === "corrupter";
  const corrupterHint = getCorrupterHint(player, round);

  if (tired) {
    return (
      <DockPrompt title="Plus d’énergie" hint="Tes objets ont pris toute ton énergie : ton tour s’arrête là.">
        <EndTurnButton primary />
      </DockPrompt>
    );
  }

  // Roller: the die comes first, then the walk it allows.
  if (player.passiveId === "roller" && diceRoll === null) {
    return (
      <DockPrompt
        title="Lance le dé"
        hint="Utilise d’abord tes objets si tu veux : une fois le dé lancé, il ne reste que le déplacement."
      >
        <button type="button" className="btn btn--gold btn--pulse" onClick={rollDice} data-autofocus>
          <UiIcon name="dice" size={20} /> Lancer le dé
        </button>
        <EndTurnButton />
      </DockPrompt>
    );
  }

  if (destinations.length === 0) {
    return (
      <DockPrompt title="Aucune route possible" hint="Utilise un objet de ton sac ou passe ton tour.">
        <button type="button" className="btn btn--cream" onClick={endTurn}>
          Passer mon tour
        </button>
      </DockPrompt>
    );
  }

  const title =
    previewNodeId !== null
      ? `Aller en case ${previewNodeId} ?`
      : diceRoll !== null
        ? `Dé : ${diceRoll} ! Choisis ta route`
        : moveDistance === 2
          ? "Botte chaussée : 2 cases !"
          : "Choisis ta route";
  const hint =
    previewNodeId !== null
      ? "Touche à nouveau la case ou confirme."
      : diceRoll !== null
        ? "Sans repasser par une case ; sans route assez longue, tu vas le plus loin possible."
        : mudPlaced
          ? "Boue posée ! Utilise un autre objet, ou déplace-toi pour finir ton tour."
          : "Utilise d’abord tes objets si tu veux, puis touche une case : le déplacement finit ton tour.";

  return (
    <DockPrompt title={title} hint={hint}>
      {previewNodeId !== null ? (
        <>
          <button type="button" className="btn btn--cup" onClick={() => commitDestination(previewNodeId)}>
            <UiIcon name="check" size={20} /> Confirmer
          </button>
          <button type="button" className="btn btn--cream" onClick={() => setPreviewNodeId(null)}>
            Annuler
          </button>
        </>
      ) : (
        <div className="destination-chips" role="group" aria-label="Destinations possibles">
          {destinations.map((nodeId) => (
            <button
              key={nodeId}
              type="button"
              className="destination-chip"
              onClick={() => commitDestination(nodeId)}
              onPointerEnter={() => setHoveredChipNodeId(nodeId)}
              onPointerLeave={() => setHoveredChipNodeId(null)}
            >
              <UiIcon name="arrowRight" size={16} /> {nodeId}
            </button>
          ))}
        </div>
      )}
      {previewNodeId === null && <EndTurnButton />}
      {canRescue && previewNodeId === null && (
        <button
          type="button"
          className="btn btn--small btn--gold"
          onClick={rescueProtege}
          title="Il te rejoint sur ta case ; tu perds tes 2 prochains tours"
        >
          <UiIcon name="sparkle" size={16} /> Libérer {protegeName}
        </button>
      )}
      {isCorrupter && (
        <button
          type="button"
          className={`btn btn--small ${ignoreArrows ? "btn--gold" : "btn--cream"}`}
          onClick={() => setIgnoreArrows(!ignoreArrows)}
          disabled={corrupterHint !== null}
          aria-pressed={ignoreArrows}
          title={
            corrupterHint?.full ??
            `Corrupteur : ${CORRUPTER_COST} pièces pour ce déplacement, quel que soit le nombre de sens interdits`
          }
        >
          {ignoreArrows ? "Flèches ignorées" : "Ignorer les flèches"} ·{" "}
          {corrupterHint ? corrupterHint.short : `−${CORRUPTER_COST}`}
        </button>
      )}
    </DockPrompt>
  );
}

/** Non merci holds an item, or Bullet Bill, until the player it would hit answers in the reaction window. */
function ReactionContent() {
  const bullet = useGameStore((state) => state.pendingReaction?.action.type === "bullet-bill");
  return bullet ? (
    <DockPrompt title="Bullet Bill fonce…" hint="Sa cible peut encore répondre « Non merci »." />
  ) : (
    <DockPrompt title="Objet annoncé…" hint="Sa cible peut encore répondre « Non merci »." />
  );
}

/** New Cup, New Me: before the new Red Cup appears, off to the start or stay. */
function NewCupContent() {
  const holderId = useGameStore((state) => state.pendingCupRepositionPlayerId);
  const players = useGameStore((state) => state.players);
  const resolveNewCup = useGameStore((state) => state.resolveNewCup);
  const holder = players.find((player) => player.id === holderId);

  return (
    <DockPrompt
      title={`${holder?.name ?? "New Cup"}, une nouvelle Cup arrive`}
      hint="New Cup, New Me : file au Départ pour 200 pièces, ou reste où tu es, avant qu’elle apparaisse."
    >
      <button type="button" className="btn btn--cup" onClick={() => resolveNewCup(true)} data-autofocus>
        <UiIcon name="flag" size={20} /> Départ · +{START_BONUS}
      </button>
      <button type="button" className="btn btn--cream" onClick={() => resolveNewCup(false)}>
        Rester
      </button>
    </DockPrompt>
  );
}

/** Calme-toi: the holder sets a player down three tiles from the new Red Cup, or lets them be. */
function CalmDownContent() {
  const pending = useGameStore((state) => state.pendingCalmDown);
  const players = useGameStore((state) => state.players);
  const resolveCalmDown = useGameStore((state) => state.resolveCalmDown);
  const setHoveredChipNodeId = useUiStore((state) => state.setHoveredChipNodeId);
  const legalMoves = useLegalMoves();
  const tiles = [...legalMoves.paths.keys()].sort((left, right) => left - right);
  const target = players.find((player) => player.id === pending?.targetIds[0]);
  const waiting = (pending?.targetIds.length ?? 1) - 1;

  return (
    <DockPrompt
      title={`Calme-toi : où replacer ${target?.name ?? "ce joueur"} ?`}
      hint={`Choisis une case à ${CALM_DOWN_DISTANCE} cases de la Red Cup : il n’en tirera rien.${
        waiting > 0 ? ` Encore ${waiting} joueur${waiting > 1 ? "s" : ""} ensuite.` : ""
      }`}
    >
      <div className="destination-chips" role="group" aria-label="Cases où le replacer">
        {tiles.map((nodeId) => (
          <button
            key={nodeId}
            type="button"
            className="destination-chip"
            onClick={() => commitDestination(nodeId)}
            onPointerEnter={() => setHoveredChipNodeId(nodeId)}
            onPointerLeave={() => setHoveredChipNodeId(null)}
          >
            <UiIcon name="arrowRight" size={16} /> {nodeId}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--cream" onClick={() => resolveCalmDown(null)}>
        Laisser passer
      </button>
    </DockPrompt>
  );
}

/** Double or nothing: the holder stakes a gain or a loss of coins on a coin flip, or keeps it. */
function GambleContent() {
  const gamble = useGameStore((state) => state.pendingGambles[0]);
  const players = useGameStore((state) => state.players);
  const resolveGamble = useGameStore((state) => state.resolveGamble);
  const holder = players.find((player) => player.id === gamble?.playerId);
  if (!gamble) return null;
  const gain = gamble.amount > 0;

  return (
    <DockPrompt
      title={`${holder?.name ?? "Double or nothing"} : ${formatGambleAmount(gamble.amount)}`}
      hint={
        gain
          ? "Double or nothing : une chance sur deux que ce gain double, sinon il est annulé."
          : "Double or nothing : une chance sur deux que cette perte soit annulée, sinon elle double."
      }
    >
      <button type="button" className="btn btn--cup" onClick={() => resolveGamble(true)} data-autofocus>
        <UiIcon name="sparkle" size={20} /> Tenter le 50/50
      </button>
      <button type="button" className="btn btn--cream" onClick={() => resolveGamble(false)}>
        Garder
      </button>
    </DockPrompt>
  );
}

/** Wheel of fortune: the spinner picks the tile they step forward onto. */
function AdvanceContent() {
  const walkerId = useGameStore((state) => state.pendingAdvance?.playerId);
  const players = useGameStore((state) => state.players);
  const setHoveredChipNodeId = useUiStore((state) => state.setHoveredChipNodeId);
  const legalMoves = useLegalMoves();
  const destinations = [...legalMoves.paths.keys()].sort((left, right) => left - right);
  const walker = players.find((player) => player.id === walkerId);

  return (
    <DockPrompt
      title={`${walker?.name ?? "Joueur"}, avance d’une case`}
      hint="Choisis la case voisine : sa roue, sa boutique, sa Boue et sa Red Cup t’y attendent."
    >
      <div className="destination-chips" role="group" aria-label="Cases où avancer">
        {destinations.map((nodeId) => (
          <button
            key={nodeId}
            type="button"
            className="destination-chip"
            onClick={() => commitDestination(nodeId)}
            onPointerEnter={() => setHoveredChipNodeId(nodeId)}
            onPointerLeave={() => setHoveredChipNodeId(null)}
          >
            <UiIcon name="arrowRight" size={16} /> {nodeId}
          </button>
        ))}
      </div>
    </DockPrompt>
  );
}

function findNextPlayer(players: Player[], activeIndex: number): Player | undefined {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(activeIndex + offset) % players.length];
    if (candidate.skippedTurns === 0) return candidate;
  }
  return players[(activeIndex + 1) % players.length];
}
