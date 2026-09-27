import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../../game/store";
import type { PendingWheel, WheelOutcomeId } from "../../game/types";
import { soundEffects } from "../../audio/sound-effects";
import { useCanActFor } from "../../net/room-store";
import { ModalShell } from "../components/modal-shell";
import { WaitingNote } from "../components/waiting-note";
import { PlayerAvatar } from "../components/player-avatar";
import { WheelDial } from "../components/wheel-dial";
import { WHEEL_TITLES, getWheelSegments, isPositiveOutcome } from "../display/game-display";
import { ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

const SPIN_DURATION_MS = 4_200;
const REDUCED_SPIN_DURATION_MS = 900;
const FULL_TURNS = 6;

function getWheelEyebrow(pending: PendingWheel): string {
  if (pending.sourceItemId === "ndoye") return "Ndoye a frappé";
  if (pending.origin === "tile") return pending.wheelId === "fortune" ? "Case verte" : "Case rouge";
  if (pending.origin === "chain") return "Encore une roue !";
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

function WheelSpin({ pending }: { pending: PendingWheel }) {
  const player = useGameStore((state) => state.players.find((candidate) => candidate.id === pending.playerId));
  const resolveWheel = useGameStore((state) => state.resolveWheel);
  const cancelWheel = useGameStore((state) => state.cancelWheel);
  // Everybody watches the wheel; only its player applies the result or rubs it out.
  const canAct = useCanActFor([pending.playerId]);
  const segments = useMemo(() => getWheelSegments(pending.wheelId), [pending.wheelId]);
  const [rotation, setRotation] = useState(0);
  const [done, setDone] = useState(false);
  const skipRef = useRef(false);

  // The engine already chose the result; the wheel only has to land on a matching wedge.
  const { targetIndex, finalRotation } = useMemo(() => {
    const candidates = segments.flatMap((segment, index) => (segment.outcomeId === pending.result.id ? [index] : []));
    const index = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
    const segmentAngle = 360 / segments.length;
    const jitter = (Math.random() - 0.5) * segmentAngle * 0.6;
    return { targetIndex: index, finalRotation: FULL_TURNS * 360 - (index + 0.5) * segmentAngle + jitter };
  }, [segments, pending.result.id]);

  useEffect(() => {
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
      soundEffects.wheelStop(isPositiveOutcome(pending.result.id));
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [finalRotation, segments.length, pending.result.id]);

  const hasEraser = player?.inventory.some((entry) => entry.kind === "item" && entry.itemId === "eraser") ?? false;
  const positive = isPositiveOutcome(pending.result.id);

  return (
    <ModalShell
      title={WHEEL_TITLES[pending.wheelId]}
      eyebrow={getWheelEyebrow(pending)}
      tone={pending.wheelId === "fortune" ? "gold" : "grape"}
      size="large"
      className="wheel-modal"
    >
      <div className="wheel-layout">
        <div className={`wheel-stage ${done ? "is-done" : ""}`}>
          <WheelDial
            wheelId={pending.wheelId}
            segments={segments}
            rotation={rotation}
            restRotation={finalRotation}
            highlightIndex={done ? targetIndex : null}
          />
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
              <span className="wheel-result__eyebrow">Résultat</span>
              <strong className="wheel-result__label">{pending.result.label}</strong>
              {canAct ? (
                <div className="wheel-result__actions">
                  <button type="button" className="btn btn--cup btn--block" onClick={resolveWheel} data-autofocus>
                    <UiIcon name="check" size={20} /> {CHAINED_WHEEL_ACTIONS[pending.result.id] ?? "Appliquer"}
                  </button>
                  {hasEraser && (
                    <button type="button" className="btn btn--cream btn--block" onClick={cancelWheel}>
                      <ItemIcon itemId="eraser" size={24} /> Effacer avec la Gomme
                    </button>
                  )}
                </div>
              ) : (
                <WaitingNote player={player} />
              )}
            </div>
          ) : (
            <div className="wheel-waiting">
              <p>Suspense…</p>
              <button
                type="button"
                className="btn btn--cream btn--small"
                onClick={() => (skipRef.current = true)}
                data-silent
              >
                Passer l’animation
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
