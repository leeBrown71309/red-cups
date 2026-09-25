import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { canUseDelinquent, useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import { useUiStore } from "../../feedback/ui-store";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { commitDestination, useActivePlayer, useDecidingPlayer, useLegalMoves } from "../game-hooks";
import { CoinIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { getAvatarExpression } from "./players-bar";

interface ActionDockProps {
  onOpenShop: () => void;
}

/** Tells the active player, in plain words, what to do right now. */
export function ActionDock({ onOpenShop }: ActionDockProps) {
  const activePlayer = useActivePlayer();
  const turnStage = useGameStore((state) => state.turnStage);
  const phase = useGameStore((state) => state.phase);
  const decider = useDecidingPlayer();
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
        </div>
      </div>
      <div className="action-dock__content">
        <StageContent player={activePlayer} stage={turnStage} onOpenShop={onOpenShop} />
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

function StageContent({ player, stage, onOpenShop }: { player: Player; stage: string; onOpenShop: () => void }) {
  const endTurn = useGameStore((state) => state.endTurn);
  const spinHellWheel = useGameStore((state) => state.spinHellWheel);
  const players = useGameStore((state) => state.players);
  const activePlayerIndex = useGameStore((state) => state.activePlayerIndex);

  switch (stage) {
    case "move":
      return <MoveContent player={player} />;
    case "reposition":
      return <RepositionContent />;
    case "hell": {
      const hasBottle = player.inventory.some((entry) => entry.kind === "item" && entry.itemId === "water-bottle");
      return (
        <DockPrompt
          title="Bienvenue en Enfer…"
          hint={
            hasBottle
              ? "Tourne la roue, ou bois ta Bouteille d’eau depuis ton sac."
              : "Tourne la roue pour tenter de t’échapper."
          }
        >
          <button type="button" className="btn btn--grape" onClick={spinHellWheel}>
            <UiIcon name="flame" size={20} /> Tourner la roue
          </button>
        </DockPrompt>
      );
    }
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
      return <DockPrompt title="Un passif se réveille…" hint="Une décision est attendue." />;
    case "target":
      return <DockPrompt title="Duel en vue" hint="Choisis l’adversaire qui te rejoint en Enfer." />;
    case "discard":
      return <DockPrompt title="Sac plein !" hint="Choisis l’objet à abandonner." />;
    case "wheel-result":
      return <DockPrompt title="La roue tourne…" hint="Croise les doigts." />;
    case "duel":
      return <DockPrompt title="Duel en Enfer !" hint="Un seul en ressortira." />;
    default:
      return null;
  }
}

function MoveContent({ player }: { player: Player }) {
  const moveDistance = useGameStore((state) => state.moveDistance);
  const redCupCycle = useGameStore((state) => state.redCupCycle);
  const players = useGameStore((state) => state.players);
  const endTurn = useGameStore((state) => state.endTurn);
  const cancelWithNoThanks = useGameStore((state) => state.resolvePassiveVote);
  const ignoreArrows = useUiStore((state) => state.ignoreArrows);
  const setIgnoreArrows = useUiStore((state) => state.setIgnoreArrows);
  const previewNodeId = useUiStore((state) => state.previewNodeId);
  const setPreviewNodeId = useUiStore((state) => state.setPreviewNodeId);
  const setHoveredChipNodeId = useUiStore((state) => state.setHoveredChipNodeId);
  const legalMoves = useLegalMoves();
  const destinations = [...legalMoves.paths.keys()].sort((left, right) => left - right);
  const [armedInterrupt, setArmedInterrupt] = useState<string | null>(null);

  useEffect(() => {
    if (!armedInterrupt) return undefined;
    const timer = window.setTimeout(() => setArmedInterrupt(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [armedInterrupt]);

  const interrupters = players.filter(
    (candidate) =>
      candidate.passiveId === "no-thanks" && candidate.id !== player.id && candidate.noThanksUsedCycle !== redCupCycle,
  );
  const isDelinquent = player.passiveId === "delinquent";

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
      : moveDistance === 2
        ? "Botte chaussée : 2 cases !"
        : "Choisis ta route";
  const hint =
    previewNodeId !== null
      ? "Touche à nouveau la case ou confirme."
      : "Touche une case surlignée, ou utilise un objet à la place.";

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
      {isDelinquent && (
        <button
          type="button"
          className={`btn btn--small ${ignoreArrows ? "btn--gold" : "btn--cream"}`}
          onClick={() => setIgnoreArrows(!ignoreArrows)}
          disabled={!canUseDelinquent(player)}
          aria-pressed={ignoreArrows}
          title="Délinquant : 200 pièces par flèche ignorée"
        >
          {ignoreArrows ? "Flèches ignorées" : "Ignorer les flèches"} · −200
        </button>
      )}
      {interrupters.map((interrupter) => (
        <button
          key={interrupter.id}
          type="button"
          className={`btn btn--small ${armedInterrupt === interrupter.id ? "btn--grape" : "btn--cream"}`}
          onClick={() => {
            if (armedInterrupt === interrupter.id) cancelWithNoThanks(interrupter.id, true);
            else setArmedInterrupt(interrupter.id);
          }}
          title={`${interrupter.name} peut annuler l’action (Non merci)`}
        >
          <UiIcon name="hand" size={16} />
          {armedInterrupt === interrupter.id ? `Confirmer (${interrupter.name})` : `Non merci · ${interrupter.name}`}
        </button>
      ))}
    </DockPrompt>
  );
}

function RepositionContent() {
  const repositionerId = useGameStore((state) => state.pendingCupRepositionPlayerId);
  const players = useGameStore((state) => state.players);
  const previewNodeId = useUiStore((state) => state.previewNodeId);
  const repositioner = players.find((player) => player.id === repositionerId);

  return (
    <DockPrompt
      title={`${repositioner?.name ?? "New Cup"}, choisis ta case`}
      hint="New Cup, New Me : place-toi avant que la nouvelle Red Cup n’apparaisse."
    >
      {previewNodeId !== null && (
        <button type="button" className="btn btn--cup" onClick={() => commitDestination(previewNodeId)}>
          <UiIcon name="check" size={20} /> Case {previewNodeId}
        </button>
      )}
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
