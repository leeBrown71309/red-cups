import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { canTeleportFromWheel } from "../../game/mage-queries";
import { canUseNoThanks } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { START_BONUS } from "../../game/types";
import type { PendingWheel, WheelOutcomeId, WheelResult } from "../../game/types";
import { soundEffects } from "../../audio/sound-effects";
import { useCanActFor } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { WaitingNote } from "../components/waiting-note";
import { PlayerAvatar } from "../components/player-avatar";
import { WheelDial } from "../components/wheel-dial";
import { WHEEL_TITLES, getWheelSegments, isPositiveOutcome, type WheelSegment } from "../display/game-display";
import { ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

const SPIN_DURATION_MS = 4_200;
const REDUCED_SPIN_DURATION_MS = 900;
const FULL_TURNS = 6;

function getWheelEyebrow(pending: PendingWheel): string {
  if (pending.sourceItemId === "ndoye") return "Ndoye a frappé";
  if (pending.origin === "tile") return pending.wheelId === "fortune" ? "Case verte" : "Case rouge";
  if (pending.origin === "chain") return "Encore une roue !";
  if (pending.origin === "double") return "Deuxième roue";
  if (pending.origin === "hell") return "Depuis l’Enfer";
  if (pending.origin === "blessing") return "Tour de Bénédiction";
  return "La roue tourne";
}

/** Results that hand over to another wheel say so on their button. */
const CHAINED_WHEEL_ACTIONS: Partial<Record<WheelOutcomeId, string>> = {
  "spin-fortune": "Tourner la roue du bonheur",
  "spin-misfortune": "Tourner la roue du malheur",
};

/** Remounts for every spin so chained wheels (malheur → bonheur) replay the animation. */
export function WheelModal() {
  const pending = useGameStore((state) => state.pendingWheel);
  if (!pending) return null;
  return <WheelSpin key={pending.id} pending={pending} />;
}

interface WheelSpinState {
  rotation: number;
  done: boolean;
  targetIndex: number;
  finalRotation: number;
}

/**
 * The engine already drew the result; the wheel only has to land on a matching wedge. A wheel that
 * was spun beside another one earlier (`instant`) is shown already at rest.
 */
function useWheelSpin(
  segments: WheelSegment[],
  result: WheelResult | null,
  skipRef: RefObject<boolean>,
  instant: boolean,
): WheelSpinState {
  const resultId = result?.id;
  const { targetIndex, finalRotation } = useMemo(() => {
    const candidates = segments.flatMap((segment, index) => (segment.outcomeId === resultId ? [index] : []));
    const index = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    const segmentAngle = 360 / segments.length;
    const jitter = (Math.random() - 0.5) * segmentAngle * 0.6;
    return { targetIndex: index, finalRotation: FULL_TURNS * 360 - (index + 0.5) * segmentAngle + jitter };
  }, [segments, resultId]);
  const [rotation, setRotation] = useState(instant ? finalRotation : 0);
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (instant || resultId === undefined) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? REDUCED_SPIN_DURATION_MS : SPIN_DURATION_MS;
    const segmentAngle = 360 / segments.length;
    const start = performance.now();
    let lastSegment = 0;
    let frame = 0;

    const step = (now: number) => {
      const progress = skipRef.current ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 4;
      const current = finalRotation * eased;
      setRotation(current);

      const segmentCount = Math.floor(current / segmentAngle);
      if (segmentCount !== lastSegment && !skipRef.current) {
        lastSegment = segmentCount;
        soundEffects.wheelTick(4 * (1 - progress) ** 3);
      }

      if (progress < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      setDone(true);
      soundEffects.wheelStop(isPositiveOutcome(resultId));
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [finalRotation, segments.length, resultId, instant, skipRef]);

  return { rotation, done, targetIndex, finalRotation };
}

/** The wheels of a spin: one, or two side by side (Main verte, Main rouge, Touché angélique, Touché funeste). */
function getSpunResults(pending: PendingWheel): WheelResult[] {
  // « Va au Départ »: a single dial, and the Départ/rien choice offered under it.
  if (pending.randomFallback) return [pending.result];
  if (pending.choices) return [...pending.choices];
  const parallel = pending.repeats?.[0];
  if (parallel && parallel.wheelId === pending.wheelId && !pending.preSpun) return [pending.result, parallel.result];
  return [pending.result];
}

function WheelSpin({ pending }: { pending: PendingWheel }) {
  const player = useGameStore((state) => state.players.find((candidate) => candidate.id === pending.playerId));
  const round = useGameStore((state) => state.round);
  const resolveWheel = useGameStore((state) => state.resolveWheel);
  const pickWheelResult = useGameStore((state) => state.pickWheelResult);
  const cancelWheel = useGameStore((state) => state.cancelWheel);
  // Everybody watches the wheel; only its player applies the result or rubs it out.
  const canAct = useCanActFor([pending.playerId]);
  const passiveId = player?.passiveId;
  const segments = useMemo(
    () => getWheelSegments(pending.wheelId, passiveId && { passiveId }),
    [pending.wheelId, passiveId],
  );
  const skipRef = useRef(false);
  const spun = getSpunResults(pending);
  const isDuo = spun.length === 2;
  const instant = pending.preSpun === true;
  const left = useWheelSpin(segments, spun[0], skipRef, instant);
  const right = useWheelSpin(segments, spun[1] ?? null, skipRef, instant);
  const done = left.done && (!isDuo || right.done);
  const spins = isDuo ? [left, right] : [left];

  const mustChoose = pending.choices !== undefined && pending.chosen === undefined;
  const hasEraser = player?.inventory.some((entry) => entry.kind === "item" && entry.itemId === "eraser") ?? false;
  // Non merci cancels any wheel spun for its holder, once recharged.
  const hasNoThanks = player !== undefined && canUseNoThanks(player, round);
  // Mage noir: a wheel that would move them gives way to their pentagram.
  const canSlip = useGameStore((state) => canTeleportFromWheel(state, player));
  const positive = isPositiveOutcome(pending.result.id);

  return (
    <ModalShell
      title={WHEEL_TITLES[pending.wheelId]}
      eyebrow={getWheelEyebrow(pending)}
      tone={pending.wheelId === "fortune" ? "gold" : "grape"}
      size="large"
      className={`wheel-modal ${isDuo ? "wheel-modal--duo" : ""}`}
    >
      <div className={`wheel-layout ${isDuo ? "wheel-layout--duo" : ""}`}>
        <div className={isDuo ? "wheel-duo" : "wheel-single"}>
          {spins.map((spin, index) => {
            const picked = pending.chosen === index;
            const result = spun[index];
            return (
              <div key={index} className="wheel-duo__side">
                <div className={`wheel-stage ${spin.done ? "is-done" : ""}`}>
                  <WheelDial
                    wheelId={pending.wheelId}
                    segments={segments}
                    rotation={spin.rotation}
                    restRotation={spin.finalRotation}
                    highlightIndex={spin.done ? spin.targetIndex : null}
                  />
                </div>
                {isDuo && spin.done && (
                  <div className={`wheel-pick ${isPositiveOutcome(result.id) ? "is-positive" : "is-negative"}`}>
                    {pending.choices ? (
                      <button
                        type="button"
                        className={`wheel-pick__button ${picked ? "is-picked" : ""}`}
                        disabled={!canAct}
                        aria-pressed={picked}
                        onClick={() => pickWheelResult(index as 0 | 1)}
                      >
                        <span className="wheel-pick__eyebrow">{picked ? "Gardé" : "Garder celui-ci"}</span>
                        <strong>{result.label}</strong>
                      </button>
                    ) : (
                      <div className="wheel-pick__button">
                        <span className="wheel-pick__eyebrow">{index === 0 ? "D’abord" : "Ensuite"}</span>
                        <strong>{result.label}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="wheel-side">
          {player && (
            <div className="wheel-side__player">
              <PlayerAvatar color={player.color} size={54} expression={done && !positive ? "worried" : "happy"} />
              <span>
                Pour <strong>{player.name}</strong>
              </span>
            </div>
          )}

          {done ? (
            <div className={`wheel-result ${positive ? "is-positive" : "is-negative"}`}>
              {isDuo ? (
                <>
                  <span className="wheel-result__eyebrow">
                    {pending.choices ? (mustChoose ? "Deux résultats" : "Résultat gardé") : "Deux roues"}
                  </span>
                  {!mustChoose && <strong className="wheel-result__label">{pending.result.label}</strong>}
                  <small className="wheel-result__aside">
                    {pending.choices
                      ? mustChoose
                        ? "Touche l’une des deux roues : tu n’en gardes qu’une."
                        : "L’autre résultat est écarté."
                      : "Un seul clic : les deux résultats s’appliquent l’un après l’autre, celui de gauche d’abord."}
                  </small>
                </>
              ) : mustChoose && pending.randomFallback ? (
                <>
                  <span className="wheel-result__eyebrow">La roue indique</span>
                  <strong className="wheel-result__label">{pending.choices?.[0].label}</strong>
                  <small className="wheel-result__aside">Tu choisis : y aller, ou que rien ne se passe.</small>
                </>
              ) : (
                <>
                  <span className="wheel-result__eyebrow">Résultat</span>
                  <strong className="wheel-result__label">{pending.result.label}</strong>
                </>
              )}
              {canAct ? (
                <div className="wheel-result__actions">
                  {mustChoose && pending.randomFallback ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--cup btn--block"
                        onClick={() => pickWheelResult(0)}
                        data-autofocus
                      >
                        <UiIcon name="flag" size={20} /> Aller au Départ · +{START_BONUS}
                      </button>
                      <button type="button" className="btn btn--cream btn--block" onClick={() => pickWheelResult(1)}>
                        Rien ne se passe
                      </button>
                    </>
                  ) : (
                    <>
                      {!mustChoose && (
                        <button type="button" className="btn btn--cup btn--block" onClick={resolveWheel} data-autofocus>
                          <UiIcon name="check" size={20} /> {CHAINED_WHEEL_ACTIONS[pending.result.id] ?? "Appliquer"}
                        </button>
                      )}
                      {hasEraser && !mustChoose && (
                        <button type="button" className="btn btn--cream btn--block" onClick={() => cancelWheel()}>
                          <ItemIcon itemId="eraser" size={24} /> Effacer avec la Gomme
                        </button>
                      )}
                      {hasNoThanks && !mustChoose && (
                        <button type="button" className="btn btn--grape btn--block" onClick={() => cancelWheel(true)}>
                          <UiIcon name="hand" size={20} /> Non merci !
                        </button>
                      )}
                      {canSlip && !mustChoose && (
                        <button
                          type="button"
                          className="btn btn--grape btn--block"
                          onClick={() => cancelWheel(false, true)}
                          title="Tu perds un pentagramme : la roue est mise de côté et tu atterris sur ton pentagramme"
                        >
                          <UiIcon name="flag" size={20} /> Te téléporter sur ton pentagramme (−1 pentagramme)
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <WaitingNote player={player} />
              )}
            </div>
          ) : (
            <div className="wheel-waiting">
              <p>Suspense…</p>
              {/* Only the table's player of this wheel may hurry it along. */}
              {canAct && (
                <button
                  type="button"
                  className="btn btn--cream btn--small"
                  onClick={() => (skipRef.current = true)}
                  data-silent
                >
                  Passer l’animation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
