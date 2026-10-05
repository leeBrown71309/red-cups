import { getBarrierRoads } from "../../game/turn-actions";
import { hasCard } from "../../game/cards";
import { useEffect, useState } from "react";
import { ITEM_CATALOG } from "../../game/catalog";
import { canBeChallenged, canTargetPlayer, getTomatoStunChance } from "../../game/passive-rules";
import { useGameStore } from "../../game/store";
import type { DeclaredAction, ItemId, Player, PlayerId } from "../../game/types";
import { HELL_NODE_ID } from "../../game/types";
import { getEntryUnits } from "../../game/state-utils";
import { useCanActFor } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { WaitingNote } from "../components/waiting-note";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { getAvatarExpression } from "../hud/player-status";

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

/**
 * Target selection for Ndoye, Hollow Purple, Corde, Middle Finger, Monopoly
 * Man and the Tomate. A stack of Tomates then asks how many to throw, so a
 * whole volley goes in one go instead of one pick per Tomate.
 */
export function ItemTargetModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const players = useGameStore((state) => state.players);
  const guardian = useGameStore((state) => state.guardian);
  const activePlayer = useGameStore((state) => state.players[state.activePlayerIndex]);
  const useItem = useGameStore((state) => state.useItem);
  const [targetId, setTargetId] = useState<PlayerId | null>(null);
  const [count, setCount] = useState(1);
  const entry = activePlayer?.inventory.find((candidate) => candidate.id === entryId);
  if (!activePlayer || entry?.kind !== "item") return null;
  const item = ITEM_CATALOG[entry.itemId];
  const units = getEntryUnits(entry);
  const target = players.find((player) => player.id === targetId);

  // The Barrière aims at a road, not at a player.
  if (item.target === "road") {
    return (
      <RoadTargetModal
        itemName={item.name}
        description={item.description}
        itemId={entry.itemId}
        fromNodeId={activePlayer.position}
        onPick={(nodeId) => {
          useItem(entry.id, undefined, undefined, nodeId);
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  const throwAt = (playerId: PlayerId, volley: number) => {
    useItem(entry.id, playerId, volley > 1 ? volley : undefined);
    onClose();
  };

  if (target && item.stackLimit) {
    return (
      <ModalShell
        title={`Combien de ${item.name}s ?`}
        eyebrow={`Sur ${target.name}`}
        onClose={onClose}
        className="target-modal"
      >
        <div className="target-modal__item">
          <PlayerAvatar color={target.color} size={46} expression={getAvatarExpression(target)} />
          <p>
            Chaque {item.name} a {Math.round(getTomatoStunChance(activePlayer) * 100)} chances sur 100 d’assommer{" "}
            {target.name}. Tu en as {units}.
          </p>
        </div>
        <div className="volley-picker" role="radiogroup" aria-label={`Nombre de ${item.name}s`}>
          {Array.from({ length: units }, (_, index) => index + 1).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={count === option}
              className={`volley-picker__option ${count === option ? "is-selected" : ""}`}
              onClick={() => setCount(option)}
            >
              <ItemIcon itemId={entry.itemId} size={28} />
              {option}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn--cream" onClick={() => setTargetId(null)}>
            ← Autre cible
          </button>
          <button type="button" className="btn btn--cup" onClick={() => throwAt(target.id, count)} data-autofocus>
            Lancer {count === 1 ? `1 ${item.name}` : `${count} ${item.name}s`} !
          </button>
        </div>
      </ModalShell>
    );
  }

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
      {/* Chance aveugle is out of every item's reach; L'Ange-Gardien only aims at their protégé. */}
      <PlayerPickList
        players={players.filter((player) => canTargetPlayer({ guardian }, activePlayer, player))}
        isDisabled={(player) => (player.id === activePlayer.id && !item.canTargetSelf ? "Pas sur toi" : null)}
        onPick={(playerId) => {
          // A single Tomate needs no count: it flies at once.
          if (item.stackLimit && units > 1) {
            setCount(units);
            setTargetId(playerId);
          } else {
            throwAt(playerId, 1);
          }
        }}
      />
    </ModalShell>
  );
}

/** The Barrière: which road beside the player's tile to close. */
function RoadTargetModal({
  itemName,
  description,
  itemId,
  fromNodeId,
  onPick,
  onClose,
}: {
  itemName: string;
  description: string;
  itemId: ItemId;
  fromNodeId: number;
  onPick: (nodeId: number) => void;
  onClose: () => void;
}) {
  const game = useGameStore();
  const roads = getBarrierRoads(game, fromNodeId).sort((left, right) => left - right);
  return (
    <ModalShell title={`Où poser ${itemName} ?`} eyebrow="Choisis une route" onClose={onClose} className="target-modal">
      <div className="target-modal__item">
        <ItemIcon itemId={itemId} size={46} />
        <p>{description}</p>
      </div>
      <div className="modal-actions">
        {roads.map((nodeId) => (
          <button key={nodeId} type="button" className="btn btn--cream" onClick={() => onPick(nodeId)}>
            <UiIcon name="arrowRight" size={18} /> Route vers la case {nodeId}
          </button>
        ))}
      </div>
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
        <PlayerPickList
          players={players.filter((player) => canBeChallenged(challenger.id, player))}
          onPick={challengePlayer}
        />
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

  // Online, the bag and the item that does not fit are the player's own business.
  if (!canAct) {
    return (
      <ModalShell title="Sac plein !" eyebrow={player.name} tone="gold" className="discard-modal">
        <WaitingNote player={player} text={`${player.name} fait de la place dans son sac…`} />
      </ModalShell>
    );
  }

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
      <div className="discard-grid">
        {player.inventory.map((entry) =>
          entry.kind === "red-cup" ? (
            <span key={entry.id} className="discard-card is-locked" title="Une Red Cup ne se jette pas">
              <RedCupIcon size={42} />
              <small>Red Cup</small>
            </span>
          ) : (
            <button key={entry.id} type="button" className="discard-card" onClick={() => discard(entry.id)}>
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

const REACTION_COUNTDOWN_SECONDS = 15;

/** What is about to hit the Non merci holder, in a sentence. */
function describeDeclaredAction(action: DeclaredAction, actor: Player | undefined, players: Player[]): string {
  const name = (playerId: PlayerId | undefined) => players.find((player) => player.id === playerId)?.name;
  if (action.type === "bullet-bill") return `Bullet Bill fonce sur ${name(action.victimId) ?? "un joueur"} !`;
  const itemName = ITEM_CATALOG[action.itemId].name;
  if (action.itemId === "draven") return `${actor?.name} veut envoyer toute la table en Enfer avec Draven.`;
  return `${actor?.name} veut utiliser ${itemName} sur ${name(action.targetPlayerId) ?? "un joueur"}.`;
}

/**
 * Non merci: an item used against its holder, or Bullet Bill about to hit
 * them, waits for their answer. In local play the host asks them aloud;
 * without an answer it goes through.
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
  if (!pending) return null;
  const reactors = players.filter((player) => pending.reactorIds.includes(player.id));
  // L'Ange-Gardien answers with their Bouclier, everyone else with Non merci.
  const shieldOnly = reactors.every((reactor) => hasCard(reactor, "guardian-angel"));

  return (
    <ModalShell
      title={shieldOnly ? "Bouclier ?" : "Non merci ?"}
      eyebrow="Réaction possible"
      tone="grape"
      className="reaction-modal"
    >
      <div className="reaction" onPointerDown={() => setCountdownActive(false)}>
        <div className="reaction__announce">
          {actor ? (
            <PlayerAvatar color={actor.color} size={54} expression={getAvatarExpression(actor)} />
          ) : (
            <ItemIcon itemId="bullet-bill" size={54} />
          )}
          <p>{describeDeclaredAction(pending.action, actor, players)}</p>
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
                  {hasCard(reactor, "guardian-angel") ? (
                    <>
                      <UiIcon name="shield" size={18} /> Bouclier !
                    </>
                  ) : (
                    <>
                      <UiIcon name="hand" size={18} /> Non merci !
                    </>
                  )}
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
