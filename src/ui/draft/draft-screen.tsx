import { useEffect, useState } from "react";
import { getPlayersToPick } from "../../game/draft";
import { useGameStore } from "../../game/store";
import type { PassiveId, Player } from "../../game/types";
import { getServerNow, useLocalPlayerId } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { PassiveCard } from "../components/passive-card";
import { PlayerAvatar } from "../components/player-avatar";
import { UiIcon } from "../icons/ui-icon";
import { useClockBeeps } from "../hud/use-clock-beeps";

/**
 * The passive draft before the game. Online, every device shows its own cards
 * and who has picked, under the table's minute. A local table hands the
 * screen from player to player, cards hidden, with no clock.
 */
export function DraftScreen() {
  const localPlayerId = useLocalPlayerId();
  useClockBeeps();
  return localPlayerId === null ? <LocalDraft /> : <OnlineDraft playerId={localPlayerId} />;
}

function PassiveCards({
  offers,
  picked,
  onPick,
}: {
  offers: PassiveId[];
  picked: PassiveId | undefined;
  onPick: (passiveId: PassiveId) => void;
}) {
  return (
    <ul className="draft-cards" aria-label="Passifs proposés">
      {offers.map((passiveId) => {
        const selected = picked === passiveId;
        return (
          <li key={passiveId}>
            <PassiveCard passiveId={passiveId} selected={selected} onPick={() => onPick(passiveId)}>
              {selected && (
                <span className="tarot-card__picked">
                  <UiIcon name="check" size={14} /> Choisi
                </span>
              )}
            </PassiveCard>
          </li>
        );
      })}
    </ul>
  );
}

/** One screen for the whole table: each player takes it in turn, then hands it on. */
function LocalDraft() {
  const game = useGameStore();
  const pickPassive = useGameStore((state) => state.pickPassive);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [chooser] = getPlayersToPick(game);
  if (!game.draft || !chooser) return null;
  const stageLabel = game.draft.stage === "actif" ? "actif" : "passif";
  // One hand-over per player and per stage: the second stage starts again with the first seat.
  const key = `${game.draft.stage}:${chooser.id}`;

  if (readyKey !== key) {
    return (
      <ModalShell title={`Choix des ${stageLabel}s`} eyebrow="Avant la partie" tone="grape" className="draft-modal">
        <div className="draft-handover">
          <PlayerAvatar color={chooser.color} size={72} />
          <p>
            Passe l’écran à <strong>{chooser.name}</strong> : ses cartes restent secrètes.
          </p>
          <button type="button" className="btn btn--gold" onClick={() => setReadyKey(key)} data-autofocus>
            <UiIcon name="eye" size={20} /> Je suis {chooser.name}
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={`${chooser.name}, choisis ton ${stageLabel}`}
      eyebrow="Avant la partie"
      tone="grape"
      size="large"
      className="draft-modal"
    >
      <PassiveCards
        offers={game.draft.offers[chooser.id] ?? []}
        picked={undefined}
        onPick={(passiveId) => pickPassive(chooser.id, passiveId)}
      />
    </ModalShell>
  );
}

/** Online: this device's cards, the table's progress and the minute left. */
function OnlineDraft({ playerId }: { playerId: string }) {
  const draft = useGameStore((state) => state.draft);
  const players = useGameStore((state) => state.players);
  const pickPassive = useGameStore((state) => state.pickPassive);
  const seconds = useSecondsLeft(draft?.deadline ?? null);
  if (!draft) return null;
  const picked = draft.picks[playerId];

  return (
    <ModalShell
      title={`Choisis ton ${draft.stage === "actif" ? "actif" : "passif"}`}
      eyebrow={`${draft.stage === "actif" ? "Étape 1/2" : "Étape 2/2"}${seconds === null ? "" : ` · ${seconds} s`}`}
      tone="grape"
      size="large"
      className="draft-modal"
    >
      <PassiveCards
        offers={draft.offers[playerId] ?? []}
        picked={picked}
        onPick={(passiveId) => pickPassive(playerId, passiveId)}
      />
      <p className="draft-note">
        {picked
          ? "Tu peux encore changer d’avis tant que la table n’a pas fini."
          : "Sans choix à la fin du temps, une de tes cartes est tirée au hasard."}
      </p>
      <ul className="draft-roster" aria-label="Choix de la table">
        {players.map((player) => (
          <DraftRosterEntry key={player.id} player={player} picked={draft.picks[player.id] !== undefined} />
        ))}
      </ul>
    </ModalShell>
  );
}

function DraftRosterEntry({ player, picked }: { player: Player; picked: boolean }) {
  return (
    <li className={picked ? "is-picked" : ""}>
      <PlayerAvatar color={player.color} size={28} />
      <span>{player.name}</span>
      <small>{picked ? "a choisi ✓" : "réfléchit…"}</small>
    </li>
  );
}

function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = window.setInterval(() => setNow(getServerNow()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1_000));
}
