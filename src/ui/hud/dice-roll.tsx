import { useEffect, useRef, useState } from "react";
import { hasCard } from "../../game/cards";
import { useGameStore } from "../../game/store";
import { ROLLER_CUP_ATTEMPTS, ROLLER_CUP_FACE, ROLLER_DIE_FACES } from "../../game/types";
import { onFeedback } from "../../feedback/event-bus";
import { useUiStore } from "../../feedback/ui-store";
import { CUP_ROLL_THROW_MS } from "../../theme/timing";
import { useLocalPlayerId } from "../../net/room-store";

const TUMBLE_MS = 900;
const TUMBLE_TICK_MS = 80;
const RESULT_HOLD_MS = 800;

function drawFace(): number {
  return 1 + Math.floor(Math.random() * ROLLER_DIE_FACES);
}

/**
 * The Roller's die: it tumbles, then lands on the roll. Only the roller sees it: online, on their own
 * device; on a shared screen, whenever the roller is the one playing.
 */
export function DiceRollAnimation() {
  const diceRoll = useGameStore((state) => state.diceRoll);
  const isRollerTurn = useGameStore((state) => {
    const active = state.players[state.activePlayerIndex];
    return active !== undefined && hasCard(active, "roller");
  });
  const activePlayerId = useGameStore((state) => state.players[state.activePlayerIndex]?.id);
  const localPlayerId = useLocalPlayerId();
  const isViewer = localPlayerId === null || localPlayerId === activePlayerId;
  const previousRoll = useRef<number | null>(diceRoll);
  const [face, setFace] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const justRolled = previousRoll.current === null && diceRoll !== null;
    previousRoll.current = diceRoll;
    if (!justRolled || !isRollerTurn || !isViewer) return undefined;

    setLanded(false);
    setFace(drawFace());
    const tumble = window.setInterval(() => setFace(drawFace()), TUMBLE_TICK_MS);
    const land = window.setTimeout(() => {
      window.clearInterval(tumble);
      setFace(diceRoll);
      setLanded(true);
    }, TUMBLE_MS);
    const hide = window.setTimeout(() => setFace(null), TUMBLE_MS + RESULT_HOLD_MS);
    return () => {
      window.clearInterval(tumble);
      window.clearTimeout(land);
      window.clearTimeout(hide);
    };
  }, [diceRoll, isRollerTurn, isViewer]);

  if (face === null) return null;
  return (
    <div className="dice-roll" role="status" aria-live="polite">
      <div className={`dice-roll__die ${landed ? "is-landed" : "is-tumbling"}`}>{face}</div>
    </div>
  );
}

const CUP_TUMBLE_MS = 900;

interface CupThrow {
  key: number;
  playerName: string;
  rolls: number[];
  success: boolean;
  /** Index of the throw on show. */
  index: number;
  face: number;
  landed: boolean;
}

/**
 * Roller: the throws for the Red Cup, for the whole table (not only the roller's screen). Each die tumbles then
 * lands, in turn; once the series is over the result is announced on the banner.
 */
export function CupRollAnimation() {
  const showAlert = useUiStore((state) => state.showAlert);
  const [shown, setShown] = useState<CupThrow | null>(null);

  useEffect(() => {
    const timers = new Set<number>();
    const later = (run: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, delay);
      timers.add(timer);
    };
    let tumbling: number | null = null;
    let key = 0;

    const stopTumble = () => {
      if (tumbling !== null) window.clearInterval(tumbling);
      tumbling = null;
    };

    const unsubscribe = onFeedback((event) => {
      if (event.type !== "cup-roll") return;
      const playerName =
        useGameStore.getState().players.find((player) => player.id === event.playerId)?.name ?? "Le Roller";
      key += 1;
      const series = key;
      event.rolls.forEach((roll, index) => {
        later(() => {
          stopTumble();
          setShown({
            key: series,
            playerName,
            rolls: event.rolls,
            success: event.success,
            index,
            face: drawFace(),
            landed: false,
          });
          tumbling = window.setInterval(
            () =>
              setShown((current) => (current && current.key === series ? { ...current, face: drawFace() } : current)),
            TUMBLE_TICK_MS,
          );
        }, index * CUP_ROLL_THROW_MS);
        later(
          () => {
            stopTumble();
            setShown((current) =>
              current && current.key === series ? { ...current, face: roll, landed: true } : current,
            );
          },
          index * CUP_ROLL_THROW_MS + CUP_TUMBLE_MS,
        );
      });
      later(() => {
        stopTumble();
        setShown(null);
        const attempts = event.rolls.length;
        showAlert(
          event.success
            ? {
                tone: "roller",
                eyebrow: "Roller",
                title: `${playerName} décroche la Red Cup !`,
                detail: `Un ${ROLLER_CUP_FACE} ${attempts === 1 ? "du premier coup" : "au deuxième lancer"}.`,
              }
            : {
                tone: "roller",
                eyebrow: "Roller",
                title: `${playerName} rate la Red Cup !`,
                detail: `Pas de ${ROLLER_CUP_FACE} (${event.rolls.join(" et ")}) : elle l’attend à son prochain tour.`,
              },
        );
      }, event.rolls.length * CUP_ROLL_THROW_MS);
    });

    return () => {
      unsubscribe();
      stopTumble();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [showAlert]);

  if (shown === null) return null;
  const isSix = shown.landed && shown.face === ROLLER_CUP_FACE;
  return (
    <div className="dice-roll dice-roll--cup" role="status" aria-live="polite">
      <div className="dice-roll__stage">
        <p className="dice-roll__caption">
          <strong>{shown.playerName}</strong> tente la Red Cup : il faut un {ROLLER_CUP_FACE}
          <small>
            Lancer {shown.index + 1} sur {ROLLER_CUP_ATTEMPTS}
          </small>
        </p>
        <div className={`dice-roll__die ${shown.landed ? "is-landed" : "is-tumbling"}${isSix ? " is-six" : ""}`}>
          {shown.face}
        </div>
      </div>
    </div>
  );
}
