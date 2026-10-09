import { useEffect, useState, type ReactNode } from "react";
import { getPlayersToPick } from "../../game/draft";
import { useGameStore } from "../../game/store";
import type { Player } from "../../game/types";
import { getServerNow, useLocalPlayerId } from "../../net/room-store";
import { FlowShell } from "../components/flow-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { UiIcon } from "../icons/ui-icon";
import { useClockBeeps } from "../hud/use-clock-beeps";
import { DraftInspector } from "./draft-inspector";

/**
 * The draft before the game, on its own page now instead of a dialog over the board.
 * First every player picks an actif among two cards — the card in 3D on the left, its whole rule
 * written large on the right — then each player is shown the passif drawn for them (never the same
 * as another player's) and confirms they read it. Online, every device shows its own cards and who
 * is ready, under the clock. A local table hands the screen from player to player, cards hidden.
 */
export function DraftScreen() {
  const localPlayerId = useLocalPlayerId();
  useClockBeeps();
  return localPlayerId === null ? <LocalDraft /> : <OnlineDraft playerId={localPlayerId} />;
}

/** The page frame shared by the local and online draft: the flow's shell, the chapter stepper above. */
function DraftPage({ corner, children }: { corner?: ReactNode; children: ReactNode }) {
  return (
    <FlowShell step="draft" corner={corner}>
      <div className="draft">{children}</div>
    </FlowShell>
  );
}

/** The table's progress, as a row of avatars: who is done, who is on, who waits. */
function DraftRoster({ players, doneIds, currentId }: { players: Player[]; doneIds: Set<string>; currentId: string }) {
  return (
    <ul className="draft-strip" aria-label="Progression de la table">
      {players.map((player) => {
        const isDone = doneIds.has(player.id);
        return (
          <li
            key={player.id}
            className={`draft-strip__player${isDone ? " is-done" : ""}${player.id === currentId ? " is-current" : ""}`}
          >
            <span className="draft-strip__avatar">
              <PlayerAvatar color={player.color} size={36} />
              {isDone && (
                <span className="draft-strip__check">
                  <UiIcon name="check" size={12} strokeWidth={3.4} />
                </span>
              )}
            </span>
            <span className="draft-strip__name">{player.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Whose turn it is, read at a glance above the cards. */
function DraftWho({ player, text, children }: { player: Player; text: string; children?: ReactNode }) {
  return (
    <div className="draft__top">
      <p className="draft__who">
        <PlayerAvatar color={player.color} size={44} />
        <span>
          <strong>{player.name}</strong>
          <small>{text}</small>
        </span>
      </p>
      {children}
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

  const remainingIds = new Set(getPlayersToPick(game).map((player) => player.id));
  const doneIds = new Set(game.players.filter((player) => !remainingIds.has(player.id)).map((player) => player.id));

  if (readyKey !== key) {
    return (
      <DraftPage>
        <div className="handover">
          <span className="handover__pedestal" aria-hidden="true">
            <span className="handover__ripple" />
            <span className="handover__ripple handover__ripple--late" />
            <span className="handover__avatar">
              <PlayerAvatar color={chooser.color} size={132} />
            </span>
          </span>
          <p className="handover__line">
            <small>Passe l’écran à</small>
            <strong>{chooser.name}</strong>
          </p>
          <p className="handover__hint">
            {isActifStage
              ? "Ses Cups Power doivent rester secrets. Tourne l’écran s’il faut."
              : "Son passif doit rester secret."}
          </p>
          <button type="button" className="btn btn--cup btn--large" onClick={() => setReadyKey(key)} data-autofocus>
            <UiIcon name="eye" size={22} /> Je suis {chooser.name}
          </button>
        </div>
      </DraftPage>
    );
  }

  return (
    <DraftPage>
      <DraftWho player={chooser} text={isActifStage ? "choisit son Cups Power" : "découvre son passif"}>
        <DraftRoster players={game.players} doneIds={doneIds} currentId={chooser.id} />
      </DraftWho>
      {isActifStage ? (
        <DraftInspector
          kind="actif"
          cards={game.draft.offers[chooser.id] ?? []}
          onPick={(passiveId) => pickPassive(chooser.id, passiveId)}
          confirmLabel="Choisir ce Cups Power"
          note="Les autres joueurs ne voient pas ton Cups Power : garde l’écran pour toi."
        />
      ) : (
        <DraftInspector
          kind="passif"
          cards={[game.draft.offers[chooser.id]?.[0] ?? "lambda"]}
          onPick={(passiveId) => pickPassive(chooser.id, passiveId)}
          confirmLabel={remainingIds.size === 1 ? "Lancer la partie" : "J’ai compris"}
          note={
            remainingIds.size === 1
              ? "Tout le monde a ses atouts : la partie démarre dès que tu valides."
              : "Personne d’autre à la table n’a le même passif que toi."
          }
        />
      )}
    </DraftPage>
  );
}

/** Online: this device's cards, the table's progress and the minute left. */
function OnlineDraft({ playerId }: { playerId: string }) {
  const draft = useGameStore((state) => state.draft);
  const players = useGameStore((state) => state.players);
  const pickPassive = useGameStore((state) => state.pickPassive);
  if (!draft) return null;
  const me = players.find((player) => player.id === playerId);
  const picked = draft.picks[playerId];
  const isActifStage = draft.stage === "actif";
  const dealtPassif = draft.offers[playerId]?.[0];

  return (
    <DraftPage corner={<DraftTimer deadline={draft.deadline ?? null} />}>
      {me && (
        <DraftWho
          player={me}
          text={isActifStage ? "choisit son Cups Power" : picked ? "a lu son passif" : "découvre son passif"}
        >
          <DraftRoster
            players={players}
            doneIds={new Set(players.filter((player) => draft.picks[player.id] !== undefined).map((p) => p.id))}
            currentId={me.id}
          />
        </DraftWho>
      )}
      {isActifStage || !dealtPassif ? (
        <DraftInspector
          kind="actif"
          cards={draft.offers[playerId] ?? []}
          pickedId={picked}
          onPick={(passiveId) => pickPassive(playerId, passiveId)}
          confirmLabel={picked === undefined ? "Choisir ce Cups Power" : "Changer pour celui-ci"}
          note={
            picked
              ? "Tu peux encore changer d’avis tant que la table n’a pas fini."
              : "Sans choix à la fin du temps, un de tes Cups Power est tiré au hasard."
          }
        />
      ) : (
        <DraftInspector
          kind="passif"
          cards={[dealtPassif]}
          pickedId={picked}
          onPick={(passiveId) => pickPassive(playerId, passiveId)}
          confirmLabel={picked !== undefined ? "C’est noté" : "J’ai compris mon passif"}
          confirmDisabled={picked !== undefined}
          note="Personne d’autre n’a le même passif que toi. La partie démarre quand tout le monde est prêt."
        />
      )}
    </DraftPage>
  );
}

/** The clock owns its own ticking state, so the cards on the page do not re-render four times a second. */
function DraftTimer({ deadline }: { deadline: number | null }) {
  const seconds = useSecondsLeft(deadline);
  if (seconds === null) return null;
  return (
    <span className={`draft-timer${seconds <= 10 ? " is-low" : ""}`} role="timer" aria-label="Temps restant">
      <UiIcon name="clock" size={18} /> {seconds}
      <span className="draft-timer__unit">s</span>
    </span>
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
