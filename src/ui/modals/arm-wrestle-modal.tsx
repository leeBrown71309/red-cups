import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getArmStrength } from "../../game/arm-wrestle";
import { useGameStore } from "../../game/store";
import type { PendingArmWrestle, Player, PlayerId } from "../../game/types";
import { ARM_WRESTLE_DURATION_MS, TANK_ARM_STRENGTH } from "../../game/types";
import { shareArmTaps, useArmLiveStore } from "../../net/arm-live";
import { useLocalPlayerId } from "../../net/room-store";
import { soundEffects } from "../../audio/sound-effects";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { WaitingNote } from "../components/waiting-note";
import { getAvatarExpression } from "../hud/player-status";

const COUNTDOWN_MS = 3_000;
const SHARE_EVERY_MS = 200;
/** Local table: the attacker taps A (left), Baraqué taps L (right). */
const LEFT_KEY = "a";
const RIGHT_KEY = "l";

type Phase = "ready" | "countdown" | "tapping" | "done";

const NO_LIVE_TAPS: Partial<Record<PlayerId, number>> = {};

/**
 * Baraqué against the Monopoly Man: ten seconds of tapping, the bar showing
 * who pulls harder. At a local table both sides tap on the same screen (left
 * and right halves, or the A and L keys); online each side taps on their own
 * device and the other's bar moves live.
 */
export function ArmWrestleModal() {
  const wrestle = useGameStore((state) => state.pendingArmWrestle);
  const players = useGameStore((state) => state.players);
  if (!wrestle) return null;
  const attacker = players.find((player) => player.id === wrestle.attackerId);
  const defender = players.find((player) => player.id === wrestle.defenderId);
  if (!attacker || !defender) return null;
  return <ArmWrestle key={wrestle.id} wrestle={wrestle} attacker={attacker} defender={defender} />;
}

function ArmWrestle({
  wrestle,
  attacker,
  defender,
}: {
  wrestle: PendingArmWrestle;
  attacker: Player;
  defender: Player;
}) {
  const submitArmTaps = useGameStore((state) => state.submitArmTaps);
  const players = useGameStore((state) => state.players);
  const localPlayerId = useLocalPlayerId();
  // Online, this device taps for its own side only; a local table taps for both.
  const mySides = useMemo<PlayerId[]>(
    () =>
      localPlayerId === null
        ? [attacker.id, defender.id]
        : [attacker.id, defender.id].filter((id) => id === localPlayerId),
    [localPlayerId, attacker.id, defender.id],
  );
  const [phase, setPhase] = useState<Phase>("ready");
  const [taps, setTaps] = useState<Record<PlayerId, number>>({});
  const tapsRef = useRef(taps);
  tapsRef.current = taps;
  const liveTaps = useArmLiveStore((state) => (state.wrestleId === wrestle.id ? state.taps : NO_LIVE_TAPS));

  const tap = useCallback(
    (playerId: PlayerId) => {
      if (phase !== "tapping" || !mySides.includes(playerId)) return;
      setTaps((current) => ({ ...current, [playerId]: (current[playerId] ?? 0) + 1 }));
    },
    [phase, mySides],
  );

  // 3, 2, 1, then ten seconds; the counts go to the engine at the buzzer.
  useEffect(() => {
    if (phase === "countdown") {
      const timer = window.setTimeout(() => setPhase("tapping"), COUNTDOWN_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase !== "tapping") return undefined;
    const share = window.setInterval(() => {
      for (const id of mySides) shareArmTaps(wrestle.id, id, tapsRef.current[id] ?? 0);
    }, SHARE_EVERY_MS);
    const buzzer = window.setTimeout(() => {
      setPhase("done");
      soundEffects.reveal();
      for (const id of mySides) submitArmTaps(id, tapsRef.current[id] ?? 0);
    }, ARM_WRESTLE_DURATION_MS);
    return () => {
      window.clearInterval(share);
      window.clearTimeout(buzzer);
    };
  }, [phase, mySides, wrestle.id, submitArmTaps]);

  useEffect(() => {
    if (phase !== "tapping") return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (localPlayerId === null && key === LEFT_KEY) tap(attacker.id);
      else if (localPlayerId === null && key === RIGHT_KEY) tap(defender.id);
      else if (localPlayerId !== null && key === " ") tap(localPlayerId);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, tap, localPlayerId, attacker.id, defender.id]);

  const countOf = (id: PlayerId) => taps[id] ?? wrestle.taps[id] ?? liveTaps[id] ?? 0;
  const attackerForce = getArmStrength({ players }, attacker.id, countOf(attacker.id));
  const defenderForce = getArmStrength({ players }, defender.id, countOf(defender.id));
  const total = attackerForce + defenderForce;
  // 0 %: the attacker pulls the whole bar; 100 %: Baraqué does.
  const balance = total === 0 ? 50 : (defenderForce / total) * 100;
  const waitingFor = [attacker, defender].find(
    (player) => wrestle.taps[player.id] === undefined && !mySides.includes(player.id),
  );

  return (
    <ModalShell title="Bras de fer !" eyebrow="Monopoly Man contre Baraqué" tone="grape" className="arm-modal">
      <div className="arm-versus">
        <ArmSide player={attacker} taps={countOf(attacker.id)} />
        <span className="duel-versus__vs">VS</span>
        <ArmSide player={defender} taps={countOf(defender.id)} bonus />
      </div>
      <div className="arm-bar" aria-hidden="true">
        <span className="arm-bar__fill" style={{ width: `${100 - balance}%`, background: attacker.color }} />
        <span className="arm-bar__fill" style={{ width: `${balance}%`, background: defender.color }} />
      </div>

      {phase === "ready" && mySides.length > 0 && (
        <>
          <p className="modal-lead">
            Dix secondes : tapez le plus vite possible.{" "}
            {localPlayerId === null
              ? `${attacker.name} à gauche (touche A), ${defender.name} à droite (touche L).`
              : "Touche le bouton, ou la barre d’espace."}{" "}
            Les coups de {defender.name} comptent {String(TANK_ARM_STRENGTH).replace(".", ",")} fois.
          </p>
          <button
            type="button"
            className="btn btn--gold btn--block"
            onClick={() => setPhase("countdown")}
            data-autofocus
          >
            C’est parti !
          </button>
        </>
      )}
      {phase === "ready" && mySides.length === 0 && (
        <WaitingNote player={attacker} text={`${attacker.name} et ${defender.name} se défient…`} />
      )}
      {phase === "countdown" && <CountdownNote />}
      {phase === "tapping" && (
        <div className="arm-pads">
          {mySides.map((id) => (
            <button
              key={id}
              type="button"
              className="arm-pad"
              onPointerDown={() => tap(id)}
              style={{ borderColor: id === attacker.id ? attacker.color : defender.color }}
            >
              {id === attacker.id ? attacker.name : defender.name}
            </button>
          ))}
        </div>
      )}
      {phase === "done" && waitingFor && <WaitingNote player={waitingFor} text={`En attente de ${waitingFor.name}…`} />}
    </ModalShell>
  );
}

function ArmSide({ player, taps, bonus = false }: { player: Player; taps: number; bonus?: boolean }) {
  return (
    <div className="contestant">
      <PlayerAvatar color={player.color} size={64} expression={getAvatarExpression(player)} />
      <strong>{player.name}</strong>
      <small>
        {taps} coups{bonus ? ` · ×${String(TANK_ARM_STRENGTH).replace(".", ",")}` : ""}
      </small>
    </div>
  );
}

function CountdownNote() {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return <p className="arm-countdown">{left > 0 ? left : "Tapez !"}</p>;
}
