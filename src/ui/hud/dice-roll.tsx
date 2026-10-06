import { useEffect, useRef, useState } from "react";
import { hasCard } from "../../game/cards";
import { useGameStore } from "../../game/store";
import { ROLLER_DIE_FACES } from "../../game/types";
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
