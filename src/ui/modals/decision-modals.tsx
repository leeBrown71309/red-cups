import { ITEM_CATALOG } from "../../game/catalog";
import { useGameStore } from "../../game/store";
import type { ItemId, Player, PlayerId } from "../../game/types";
import { HELL_NODE_ID } from "../../game/types";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { formatCurrency } from "../display/game-display";
import { CoinIcon, ItemIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { getAvatarExpression } from "../hud/players-bar";

function PlayerPickList({
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
  if (!pending || !challenger) return null;

  return (
    <ModalShell title="Choisis ton adversaire" eyebrow={`${challenger.name} appelle en duel`} tone="grape">
      <p className="modal-lead">L’adversaire te rejoint en Enfer. Le gagnant repart du Départ.</p>
      <PlayerPickList players={players.filter((player) => player.id !== challenger.id)} onPick={challengePlayer} />
    </ModalShell>
  );
}

export function DiscardModal() {
  const pending = useGameStore((state) => state.pendingDiscard);
  const players = useGameStore((state) => state.players);
  const discard = useGameStore((state) => state.discardInventoryEntry);
  const player = players.find((candidate) => candidate.id === pending?.playerId);
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

export function CalmDownModal() {
  const pending = useGameStore((state) => state.pendingCalmDown);
  const players = useGameStore((state) => state.players);
  const resolveCalmDown = useGameStore((state) => state.resolveCalmDown);
  const holder = players.find((player) => player.id === pending?.passivePlayerId);
  const collector = players.find((player) => player.id === pending?.collectorId);
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
      <div className="modal-actions">
        <button type="button" className="btn btn--cream" onClick={() => resolveCalmDown(false)}>
          Laisser passer
        </button>
        <button type="button" className="btn btn--cup" onClick={() => resolveCalmDown(true)} data-autofocus>
          Recule !
        </button>
      </div>
    </ModalShell>
  );
}
