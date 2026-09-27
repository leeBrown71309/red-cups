import { useCallback, useEffect, useRef, useState } from "react";
import { soundEffects } from "../../audio/sound-effects";
import { getNextBasketShooterId } from "../../game/duel";
import { useGameStore } from "../../game/store";
import type { BasketShot, PendingDuel } from "../../game/types";
import { BASKET_DURATION_MS } from "../../game/types";
import { getBasketRoundKey, shareBasketShot, useBasketLiveStore } from "../../net/basket-live";
import { useCanActFor, useLocalPlayerId } from "../../net/room-store";
import { WaitingNote } from "../components/waiting-note";
import { UiIcon } from "../icons/ui-icon";
import { DuellistAvatar, isGhost, type Duellist } from "./duellists";

/** Time the ball takes to reach the hoop; the next throw waits for it. */
const BALL_FLIGHT_MS = 620;
/** Share of the gauge covered by the green zone. */
const SWEET_ZONE_WIDTH = 0.2;
/** One sweep of the gauge at the start, and at the buzzer: it speeds up as time runs out. */
const GAUGE_PERIOD_START_MS = 1_150;
const GAUGE_PERIOD_END_MS = 850;
/** The last seconds tick down out loud. */
const COUNTDOWN_TICKS_FROM_MS = 3_000;
/** Lets the last ball land before the score is sent. */
const FINISH_DELAY_MS = 700;

interface BasketGameProps {
  duel: PendingDuel;
  first: Duellist;
  second: Duellist;
}

/**
 * Basket: 15 seconds to score as many baskets as possible. Against the ghost
 * both shoot at the same time; between two players each gets their own 15
 * seconds, one after the other. The shooter's device keeps the score and
 * sends it when time is up; online, the others watch the round live.
 */
export function BasketGame({ duel, first, second }: BasketGameProps) {
  const startBasketRound = useGameStore((state) => state.startBasketRound);
  const submitBasketScore = useGameStore((state) => state.submitBasketScore);
  const localPlayerId = useLocalPlayerId();
  const basket = duel.basket;
  const nextShooterId = getNextBasketShooterId(duel);
  const runningId = basket?.shooterId ?? null;
  const canShoot = useCanActFor([runningId ?? nextShooterId]);
  if (!basket) return null;

  const duellists = [first, second];
  const shooter = duellists.find((duellist) => duellist.id === (runningId ?? nextShooterId));
  const opponent = duellists.find((duellist) => duellist.id !== shooter?.id);

  if (duel.winnerId || !shooter || !opponent) {
    return (
      <div className="duel-panel">
        <BasketScoreboard
          left={first}
          right={second}
          leftScore={basket.scores[first.id]}
          rightScore={basket.scores[second.id]}
        />
        {basket.tieBroken && <p>Égalité : la pièce départage…</p>}
      </div>
    );
  }

  if (runningId) {
    return (
      <BasketCourt
        key={getBasketRoundKey(basket.id, shooter.id)}
        roundKey={getBasketRoundKey(basket.id, shooter.id)}
        shooter={shooter}
        opponent={opponent}
        opponentScore={basket.scores[opponent.id]}
        ghostShots={isGhost(opponent) ? basket.ghostShots : null}
        interactive={canShoot}
        onFinish={(score) => submitBasketScore(shooter.id, score)}
      />
    );
  }

  const secondRound = Object.keys(basket.scores).length > 0;
  return (
    <div className="duel-panel basket-intro">
      <BasketScoreboard
        left={shooter}
        right={opponent}
        leftScore={basket.scores[shooter.id]}
        rightScore={basket.scores[opponent.id]}
      />
      <p className="duel-secret">
        {isGhost(opponent)
          ? "15 secondes pour marquer plus de paniers que le fantôme, qui tire en même temps que toi."
          : secondRound
            ? `À ${shooter.name} de tirer : ${opponent.name} a marqué ${basket.scores[opponent.id]} paniers.`
            : `15 secondes chacun, l’un après l’autre. ${shooter.name} commence.`}{" "}
        Tire quand le curseur passe dans la <strong>zone verte</strong>.
      </p>
      {canShoot ? (
        <>
          {localPlayerId === null && secondRound && (
            <p className="duel-secret">
              Passe l’écran à <strong>{shooter.name}</strong>.
            </p>
          )}
          <button type="button" className="btn btn--gold" onClick={() => startBasketRound(shooter.id)} data-autofocus>
            <UiIcon name="play" size={20} /> Commencer le mini-jeu
          </button>
        </>
      ) : (
        <WaitingNote player={undefined} text={`${shooter.name} se prépare à tirer…`} />
      )}
    </div>
  );
}

interface ScoreboardProps {
  left: Duellist;
  right: Duellist;
  leftScore: number | undefined;
  rightScore: number | undefined;
  timeLeftMs?: number;
}

function BasketScoreboard({ left, right, leftScore, rightScore, timeLeftMs }: ScoreboardProps) {
  const seconds = timeLeftMs === undefined ? null : Math.ceil(timeLeftMs / 1000);
  return (
    <div className="basket-scoreboard" aria-live="polite">
      <span className="basket-scoreboard__side">
        <DuellistAvatar duellist={left} size={34} />
        <strong>{leftScore ?? "–"}</strong>
      </span>
      <span className={`basket-scoreboard__clock ${seconds !== null && seconds <= 3 ? "is-hurry" : ""}`}>
        {seconds === null ? "VS" : `${seconds}s`}
      </span>
      <span className="basket-scoreboard__side basket-scoreboard__side--right">
        <strong>{rightScore ?? "–"}</strong>
        <DuellistAvatar duellist={right} size={34} />
      </span>
    </div>
  );
}

interface FlyingBall {
  key: number;
  side: "left" | "right";
  made: boolean;
}

interface CourtProps {
  roundKey: string;
  shooter: Duellist;
  opponent: Duellist;
  /** Between two players: the first shooter's score, already known. */
  opponentScore: number | undefined;
  /** Against the ghost: its round, drawn by the engine, replayed on every device. */
  ghostShots: BasketShot[] | null;
  interactive: boolean;
  onFinish: (score: number) => void;
}

/** Triangle wave between 0 and 1: the gauge's cursor sweeping back and forth. */
function gaugePosition(elapsedMs: number): number {
  const progress = Math.min(1, elapsedMs / BASKET_DURATION_MS);
  const period = GAUGE_PERIOD_START_MS + (GAUGE_PERIOD_END_MS - GAUGE_PERIOD_START_MS) * progress;
  const phase = (elapsedMs % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

function drawSweetZone(): number {
  return Math.random() * (1 - SWEET_ZONE_WIDTH);
}

/**
 * The court: one hoop, the shooter on the left and the ghost (or the waiting
 * opponent) on the right. Balls fly as CSS animations; the gauge cursor is
 * moved straight on the DOM every frame, so the round never re-renders at
 * sixty frames a second.
 */
function BasketCourt({ roundKey, shooter, opponent, opponentScore, ghostShots, interactive, onFinish }: CourtProps) {
  const startedAt = useRef(performance.now());
  // Kept in a ref: a new callback on each render must not restart the round's frame loop.
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const cursorRef = useRef<HTMLSpanElement>(null);
  const zoneStart = useRef(drawSweetZone());
  const [zone, setZone] = useState(zoneStart.current);
  const busyUntil = useRef(0);
  const ballKey = useRef(0);
  const finished = useRef(false);
  const ghostPlayed = useRef(0);
  const liveSeen = useRef(0);
  const lastTick = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const [score, setScore] = useState(0);
  const [ghostScore, setGhostScore] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(BASKET_DURATION_MS);
  const [balls, setBalls] = useState<FlyingBall[]>([]);
  const [lastShot, setLastShot] = useState<"made" | "missed" | null>(null);
  const liveShots = useBasketLiveStore((state) => (state.roundKey === roundKey ? state.shots : null));

  const launchBall = useCallback((side: FlyingBall["side"], made: boolean, scoreSetter: (add: number) => void) => {
    const key = (ballKey.current += 1);
    setBalls((current) => [...current.slice(-5), { key, side, made }]);
    soundEffects.basketShoot();
    window.setTimeout(() => {
      if (made) {
        scoreSetter(1);
        soundEffects.basketSwish();
      } else {
        soundEffects.basketRim();
      }
    }, BALL_FLIGHT_MS);
    window.setTimeout(() => setBalls((current) => current.filter((ball) => ball.key !== key)), BALL_FLIGHT_MS + 500);
  }, []);

  // The clock, the gauge and the ghost's shots, driven by one animation frame loop.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt.current;
      const left = Math.max(0, BASKET_DURATION_MS - elapsed);
      setTimeLeftMs((previous) => (Math.ceil(previous / 100) === Math.ceil(left / 100) ? previous : left));
      if (cursorRef.current) cursorRef.current.style.left = `${gaugePosition(elapsed) * 100}%`;

      if (left <= COUNTDOWN_TICKS_FROM_MS && left > 0) {
        const second = Math.ceil(left / 1000);
        if (lastTick.current !== second) {
          lastTick.current = second;
          soundEffects.basketTick();
        }
      }

      while (ghostShots && ghostPlayed.current < ghostShots.length && ghostShots[ghostPlayed.current].atMs <= elapsed) {
        const shot = ghostShots[ghostPlayed.current];
        ghostPlayed.current += 1;
        launchBall("right", shot.made, (add) => setGhostScore((value) => value + add));
      }

      if (left <= 0) {
        if (!finished.current) {
          finished.current = true;
          soundEffects.basketBuzzer();
          if (interactive) window.setTimeout(() => onFinishRef.current(scoreRef.current), FINISH_DELAY_MS);
        }
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ghostShots, interactive, launchBall]);

  // Watchers replay the shooter's shots as they come in over the network.
  useEffect(() => {
    if (interactive || !liveShots) return;
    for (const shot of liveShots.slice(liveSeen.current)) {
      launchBall("left", shot.made, (add) => setScore((value) => value + add));
    }
    liveSeen.current = liveShots.length;
  }, [interactive, liveShots, launchBall]);

  const shoot = useCallback(() => {
    const elapsed = performance.now() - startedAt.current;
    if (!interactive || finished.current || elapsed >= BASKET_DURATION_MS || elapsed < busyUntil.current) return;
    busyUntil.current = elapsed + BALL_FLIGHT_MS;
    const position = gaugePosition(elapsed);
    const made = position >= zoneStart.current && position <= zoneStart.current + SWEET_ZONE_WIDTH;
    if (made) scoreRef.current += 1;
    setLastShot(made ? "made" : "missed");
    shareBasketShot(roundKey, shooter.id, { atMs: Math.round(elapsed), made });
    launchBall("left", made, (add) => setScore((value) => value + add));
    zoneStart.current = drawSweetZone();
    setZone(zoneStart.current);
  }, [interactive, launchBall, roundKey, shooter.id]);

  useEffect(() => {
    if (!interactive) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== "Enter") return;
      event.preventDefault();
      shoot();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [interactive, shoot]);

  const againstGhost = ghostShots !== null;
  const timeUp = timeLeftMs <= 0;
  return (
    <div className="duel-panel basket-game">
      <BasketScoreboard
        left={shooter}
        right={opponent}
        leftScore={score}
        rightScore={againstGhost ? ghostScore : opponentScore}
        timeLeftMs={timeLeftMs}
      />
      <div
        className={`basket-court ${interactive ? "is-interactive" : ""}`}
        onPointerDown={interactive ? shoot : undefined}
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Tirer" : `${shooter.name} tire`}
      >
        <span className="basket-court__hoop" aria-hidden="true">
          <span className="basket-court__board" />
          <span className="basket-court__rim" />
          <span className="basket-court__net" />
        </span>
        <span className="basket-court__player basket-court__player--left">
          <DuellistAvatar duellist={shooter} size={56} />
        </span>
        <span
          className={`basket-court__player basket-court__player--right ${againstGhost ? "is-ghost" : "is-waiting"}`}
        >
          <DuellistAvatar duellist={opponent} size={56} />
        </span>
        {balls.map((ball) => (
          <span
            key={ball.key}
            className={`basket-ball basket-ball--${ball.side} ${ball.made ? "is-made" : "is-missed"}`}
            aria-hidden="true"
          />
        ))}
        {interactive && lastShot && !timeUp && (
          <span key={ballKey.current} className={`basket-court__feedback is-${lastShot}`} aria-hidden="true">
            {lastShot === "made" ? "Panier !" : "Raté"}
          </span>
        )}
        {timeUp && <span className="basket-court__buzzer">Temps écoulé !</span>}
      </div>
      {interactive ? (
        <>
          <div className="basket-gauge" aria-hidden="true">
            <span
              className="basket-gauge__zone"
              style={{ left: `${zone * 100}%`, width: `${SWEET_ZONE_WIDTH * 100}%` }}
            />
            <span ref={cursorRef} className="basket-gauge__cursor" />
          </div>
          <button type="button" className="btn btn--cup basket-shoot" onClick={shoot} disabled={timeUp} data-autofocus>
            Tirer ! <kbd>Espace</kbd>
          </button>
        </>
      ) : (
        <p className="duel-secret">
          {timeUp ? (
            "Décompte des paniers…"
          ) : (
            <>
              C’est <strong>{shooter.name}</strong> qui tire.
            </>
          )}
        </p>
      )}
    </div>
  );
}
