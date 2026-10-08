import { useEffect, useState } from "react";
import { getPlayersToPick } from "../../game/draft";
import { useGameStore } from "../../game/store";
import type { PassiveId, Player } from "../../game/types";
import { getServerNow, useLocalPlayerId } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { PassiveCard } from "../components/passive-card";
import { PassiveTalisman } from "../components/passive-talisman";
import { PlayerAvatar } from "../components/player-avatar";
import { TiltCard } from "../components/tilt-card";
import { UiIcon } from "../icons/ui-icon";
import { useClockBeeps } from "../hud/use-clock-beeps";

/**
 * The draft before the game. First every player picks an actif among two cards; then each player is shown the
 * passif drawn for them (never the same as another player's) and confirms they read it. Online, every device
 * shows its own cards and who is ready, under the clock. A local table hands the screen from player to player,
 * cards hidden, with no clock.
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
      {offers.map((passiveId, index) => {
        const selected = picked === passiveId;
        return (
          <li key={passiveId}>
            <TiltCard delayMs={250 + index * 220} scrollable>
              <PassiveCard passiveId={passiveId} selected={selected} onPick={() => onPick(passiveId)}>
                {selected && (
                  <span className="tarot-card__picked">
                    <UiIcon name="check" size={14} /> Choisi
                  </span>
                )}
              </PassiveCard>
            </TiltCard>
          </li>
        );
      })}
    </ul>
  );
}

/** The passif drawn for the player, with the button that says they have read it. */
function PassifReveal({
  passiveId,
  ready,
  onConfirm,
}: {
  passiveId: PassiveId;
  ready: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="draft-reveal">
      <PassiveTalisman passiveId={passiveId} delayMs={250} />
      <button type="button" className="btn btn--gold draft-reveal__confirm" onClick={onConfirm} disabled={ready}>
        <UiIcon name="check" size={20} /> {ready ? "C’est noté" : "J’ai compris"}
      </button>
    </div>
  );
}

/** One screen for the whole table: each player takes it in turn, then hands it on. */
function LocalDraft() {
  const game = useGameStore();
  const pickPassive = useGameStore((state) => state.pickPassive);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [chooser] = getPlayersToPick(game);
  if (!game.draft || !chooser) return null;
  const isActifStage = game.draft.stage === "actif";
  // One hand-over per player and per stage: the second stage starts again with the first seat.
  const key = `${game.draft.stage}:${chooser.id}`;

  if (readyKey !== key) {
    return (
      <ModalShell
        title={isActifStage ? "Choix des actifs" : "Tirage des passifs"}
        eyebrow="Avant la partie"
        tone="grape"
        className="draft-modal"
      >
        <div className="draft-handover">
          <PlayerAvatar color={chooser.color} size={72} />
          <p>
            Passe l’écran à <strong>{chooser.name}</strong> : {isActifStage ? "ses cartes restent" : "son passif reste"}{" "}
            secret{isActifStage ? "es" : ""}.
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
      title={isActifStage ? `${chooser.name}, choisis ton actif` : `${chooser.name}, voici ton passif`}
      eyebrow="Avant la partie"
      tone="grape"
      size="large"
      className="draft-modal"
    >
      {isActifStage ? (
        <PassiveCards
          offers={game.draft.offers[chooser.id] ?? []}
          picked={undefined}
          onPick={(passiveId) => pickPassive(chooser.id, passiveId)}
        />
      ) : (
        <PassifReveal
          passiveId={game.draft.offers[chooser.id]?.[0] ?? "lambda"}
          ready={false}
          onConfirm={() => pickPassive(chooser.id, game.draft?.offers[chooser.id]?.[0] ?? "lambda")}
        />
      )}
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
  const isActifStage = draft.stage === "actif";
  const dealtPassif = draft.offers[playerId]?.[0];

  return (
    <ModalShell
      title={isActifStage ? "Choisis ton actif" : "Ton passif est tiré au sort"}
      eyebrow={`${isActifStage ? "Étape 1/2" : "Étape 2/2"}${seconds === null ? "" : ` · ${seconds} s`}`}
      tone="grape"
      size="large"
      className="draft-modal"
    >
      {isActifStage || !dealtPassif ? (
        <PassiveCards
          offers={draft.offers[playerId] ?? []}
          picked={picked}
          onPick={(passiveId) => pickPassive(playerId, passiveId)}
        />
      ) : (
        <PassifReveal
          passiveId={dealtPassif}
          ready={picked !== undefined}
          onConfirm={() => pickPassive(playerId, dealtPassif)}
        />
      )}
      <p className="draft-note">
        {!isActifStage
          ? picked
            ? "En attente du reste de la table…"
            : "Personne d’autre n’a le même passif que toi. La partie démarre quand tout le monde est prêt."
          : picked
            ? "Tu peux encore changer d’avis tant que la table n’a pas fini."
            : "Sans choix à la fin du temps, une de tes cartes est tirée au hasard."}
      </p>
      <ul className="draft-roster" aria-label="Choix de la table">
        {players.map((player) => (
          <DraftRosterEntry
            key={player.id}
            player={player}
            picked={draft.picks[player.id] !== undefined}
            isActifStage={isActifStage}
          />
        ))}
      </ul>
    </ModalShell>
  );
}

function DraftRosterEntry({
  player,
  picked,
  isActifStage,
}: {
  player: Player;
  picked: boolean;
  isActifStage: boolean;
}) {
  return (
    <li className={picked ? "is-picked" : ""}>
      <PlayerAvatar color={player.color} size={28} />
      <span>{player.name}</span>
      <small>
        {picked ? (isActifStage ? "a choisi ✓" : "est prêt ✓") : isActifStage ? "réfléchit…" : "lit son passif…"}
      </small>
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
