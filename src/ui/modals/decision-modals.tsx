import { useEffect, useState } from "react";
import { ITEM_CATALOG } from "../../game/catalog";
import { useGameStore } from "../../game/store";
import type { DeclaredAction, ItemId, Player, PlayerId } from "../../game/types";
import { HELL_NODE_ID } from "../../game/types";
import { useCanActFor } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { WaitingNote } from "../components/waiting-note";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { getAvatarExpression } from "../hud/players-bar";

export function PlayerPickList({
  players,
  isDisabled,
  onPick,
}: {
  players: Player[];
  isDisabled?: (player: Player) => string | null;
  onPick: (playerId: PlayerId) => void;
}) {
  return (
    <ul className="player-pick-list">
      {players.map((player) => {
        const disabledReason = isDisabled?.(player) ?? null;
        return (
          <li key={player.id}>
            <button
              type="button"
              className="player-pick"
              disabled={disabledReason !== null}
              onClick={() => onPick(player.id)}
              style={{ borderColor: player.color }}
            >
              <PlayerAvatar color={player.color} size={48} expression={getAvatarExpression(player)} />
              <span className="player-pick__name">{player.name}</span>
              <span className="player-pick__meta">
                {player.position === HELL_NODE_ID ? "En Enfer" : `Case ${player.position}`}
                <span>
                  <CoinIcon size={13} /> {formatCurrency(player.currency)}
                </span>
              </span>
              {disabledReason && <span className="player-pick__reason">{disabledReason}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Target selection for Ndoye, Hollow Purple, Corde, Middle Finger and Monopoly Man. */
export function ItemTargetModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const players = useGameStore((state) => state.players);
  const activePlayer = useGameStore((state) => state.players[state.activePlayerIndex]);
  const useItem = useGameStore((state) => state.useItem);
  const entry = activePlayer?.inventory.find((candidate) => candidate.id === entryId);
  if (!activePlayer || entry?.kind !== "item") return null;
  const item = ITEM_CATALOG[entry.itemId];

  return (
    <ModalShell
      title={`Qui vise ${item.name} ?`}
      eyebrow="Choisis une cible"
      onClose={onClose}
      className="target-modal"
    >
      <div className="target-modal__item">
        <ItemIcon itemId={entry.itemId} size={46} />
        <p>{item.description}</p>
      </div>
      <PlayerPickList
        players={players}
        isDisabled={(player) => (player.id === activePlayer.id && !item.canTargetSelf ? "Pas sur toi" : null)}
        onPick={(playerId) => {
          useItem(entry.id, playerId);
          onClose();
        }}
      />
    </ModalShell>
  );
}

/** Hell wheel "Duel" result: the spinner drags an opponent down for a duel. */
export function ChallengeModal() {
  const pending = useGameStore((state) => state.pendingChallenge);
  const players = useGameStore((state) => state.players);
  const challengePlayer = useGameStore((state) => state.challengePlayer);
  const challenger = players.find((player) => player.id === pending?.playerId);
  const canAct = useCanActFor([pending?.playerId]);
  if (!pending || !challenger) return null;

  return (
    <ModalShell title="Choisis ton adversaire" eyebrow={`${challenger.name} appelle en duel`} tone="grape">
      <p className="modal-lead">L’adversaire te rejoint en Enfer. Le gagnant repart du Départ.</p>
      {canAct ? (
        <PlayerPickList players={players.filter((player) => player.id !== challenger.id)} onPick={challengePlayer} />
      ) : (
        <WaitingNote player={challenger} text={`${challenger.name} choisit son adversaire…`} />
      )}
    </ModalShell>
  );
}

export function DiscardModal() {
  const pending = useGameStore((state) => state.pendingDiscard);
  const players = useGameStore((state) => state.players);
  const discard = useGameStore((state) => state.discardInventoryEntry);
  const player = players.find((candidate) => candidate.id === pending?.playerId);
  const canAct = useCanActFor([pending?.playerId]);
  if (!pending || !player) return null;

  const incoming: ItemId | "red-cup" = pending.reason === "red-cup" ? "red-cup" : (pending.itemId ?? "red-cup");

  return (
    <ModalShell title="Sac plein !" eyebrow={player.name} tone="gold" className="discard-modal">
      <div className="discard-incoming">
        {incoming === "red-cup" ? <RedCupIcon size={54} /> : <ItemIcon itemId={incoming} size={54} />}
        <p>
          {incoming === "red-cup"
            ? "Pour ramasser la Red Cup, abandonne un objet."
            : `Je note : fais de la place pour ${ITEM_CATALOG[incoming].name}.`}
        </p>
      </div>
      {!canAct && <WaitingNote player={player} text={`${player.name} choisit quel objet jeter…`} />}
      <div className="discard-grid">
        {player.inventory.map((entry) =>
          entry.kind === "red-cup" ? (
            <span key={entry.id} className="discard-card is-locked" title="Une Red Cup ne se jette pas">
              <RedCupIcon size={42} />
              <small>Red Cup</small>
            </span>
          ) : (
            <button
              key={entry.id}
              type="button"
              className="discard-card"
              onClick={() => discard(entry.id)}
              disabled={!canAct}
            >
              <ItemIcon itemId={entry.itemId} size={42} />
              <small>{ITEM_CATALOG[entry.itemId].name}</small>
              <span className="discard-card__drop">
                <UiIcon name="trash" size={14} /> Jeter
              </span>
            </button>
          ),
        )}
      </div>
    </ModalShell>
  );
}

export function CalmDownModal() {
  const pending = useGameStore((state) => state.pendingCalmDown);
  const players = useGameStore((state) => state.players);
  const resolveCalmDown = useGameStore((state) => state.resolveCalmDown);
  const holder = players.find((player) => player.id === pending?.passivePlayerId);
  const collector = players.find((player) => player.id === pending?.collectorId);
  const canAct = useCanActFor([pending?.passivePlayerId]);
  if (!pending || !holder || !collector) return null;

  return (
    <ModalShell title="Calme-toi !" eyebrow={`Passif de ${holder.name}`} tone="gold">
      <div className="calm-down">
        <PlayerAvatar color={holder.color} size={64} />
        <UiIcon name="arrowRight" size={28} />
        <PlayerAvatar color={collector.color} size={64} expression="worried" />
      </div>
      <p className="modal-lead">
        <strong>{collector.name}</strong> est trop près de la nouvelle Red Cup. {holder.name}, tu le fais reculer de 3
        cases (case {pending.retreatNodeId}) ?
      </p>
      {canAct ? (
        <div className="modal-actions">
          <button type="button" className="btn btn--cream" onClick={() => resolveCalmDown(false)}>
            Laisser passer
          </button>
          <button type="button" className="btn btn--cup" onClick={() => resolveCalmDown(true)} data-autofocus>
            Recule !
          </button>
        </div>
      ) : (
        <WaitingNote player={holder} text={`${holder.name} décide…`} />
      )}
    </ModalShell>
  );
}

const REACTION_COUNTDOWN_SECONDS = 15;

function describeDeclaredAction(action: DeclaredAction, actorId: PlayerId, players: Player[]): string {
  if (action.type === "move") return `aller en case ${action.destination}`;
  const itemName = ITEM_CATALOG[action.itemId].name;
  if (!action.targetPlayerId) return `utiliser ${itemName}`;
  if (action.targetPlayerId === actorId) return `utiliser ${itemName} sur lui-même`;
  const target = players.find((player) => player.id === action.targetPlayerId);
  return `utiliser ${itemName} sur ${target?.name ?? "un joueur"}`;
}

/**
 * Non merci: before an action applies, its holders may cancel it. In local
 * play the host asks them aloud; without an answer the action goes through.
 */
export function ReactionModal() {
  const pending = useGameStore((state) => state.pendingReaction);
  const players = useGameStore((state) => state.players);
  const resolveReaction = useGameStore((state) => state.resolveReaction);
  const canReact = useCanActFor(pending?.reactorIds ?? []);
  const [secondsLeft, setSecondsLeft] = useState(REACTION_COUNTDOWN_SECONDS);
  const [countdownActive, setCountdownActive] = useState(true);

  useEffect(() => {
    // Online, the clock runs on the holder's device only: the answer is theirs to give.
    if (!countdownActive || !canReact) return undefined;
    if (secondsLeft <= 0) {
      resolveReaction(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [countdownActive, canReact, secondsLeft, resolveReaction]);

  const actor = players.find((player) => player.id === pending?.actorId);
  if (!pending || !actor) return null;
  const reactors = players.filter((player) => pending.reactorIds.includes(player.id));

  return (
    <ModalShell title="Non merci ?" eyebrow="Réaction possible" tone="grape" className="reaction-modal">
      <div className="reaction" onPointerDown={() => setCountdownActive(false)}>
        <div className="reaction__announce">
          <PlayerAvatar color={actor.color} size={54} expression={getAvatarExpression(actor)} />
          <p>
            <strong>{actor.name}</strong> veut {describeDeclaredAction(pending.action, actor.id, players)}.
          </p>
        </div>

        {!canReact && (
          <WaitingNote player={reactors[0]} text={`${reactors.map((reactor) => reactor.name).join(", ")} réfléchit…`} />
        )}
        {canReact && (
          <ul className="reaction__reactors">
            {reactors.map((reactor) => (
              <li key={reactor.id}>
                <PlayerAvatar color={reactor.color} size={44} />
                <span className="reaction__reactor-name">{reactor.name}</span>
                <button type="button" className="btn btn--grape btn--small" onClick={() => resolveReaction(reactor.id)}>
                  <UiIcon name="hand" size={18} /> Non merci !
                </button>
              </li>
            ))}
          </ul>
        )}

        {canReact && (
          <>
            <button
              type="button"
              className="btn btn--cream btn--block"
              onClick={() => resolveReaction(null)}
              data-autofocus
            >
              Laisser faire
              {countdownActive && <span className="reaction__countdown">{secondsLeft}</span>}
            </button>
            <p className="reaction__hint">
              {countdownActive
                ? "Sans réponse, l’action se fait automatiquement."
                : "Compte à rebours en pause : à vous de décider."}
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}
