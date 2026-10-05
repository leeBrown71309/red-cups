import { getHellTurnLimit } from "../../game/passive-rules";
import { hasCard } from "../../game/cards";
import type { ReactNode } from "react";
import { getDevilGoalFor } from "../../game/devil";
import { getIdleStrikes, IDLE_STRIKES_TO_FORFEIT } from "../../game/turn-clock";
import type { GameState, Player } from "../../game/types";
import { HELL_NODE_ID, RED_CUP_GOAL, SNOWBALL_HITS_TO_FREEZE } from "../../game/types";
import type { AvatarExpression } from "../components/player-avatar";
import { CloverIcon, RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

export function getAvatarExpression(player: Player): AvatarExpression {
  if (player.skippedTurns > 0) return "sleepy";
  if (player.position === HELL_NODE_ID) return "worried";
  return "happy";
}

export function CupPips({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <span className="cup-pips" aria-label={`${count} Red Cup sur ${RED_CUP_GOAL}`}>
      {Array.from({ length: RED_CUP_GOAL }, (_, index) => (
        <span key={index} className={`cup-pips__pip ${index < count ? "is-filled" : ""}`}>
          <RedCupIcon size={size} />
        </span>
      ))}
    </span>
  );
}

export type PlayerStatusTone = "hell" | "frozen" | "sleep" | "chances" | "snow" | "devil" | "angel";

/** Something about a player the whole table should see: shown as a small token, spelled out in the details. */
export interface PlayerStatus {
  id: string;
  tone: PlayerStatusTone;
  icon: ReactNode;
  /** A count next to the icon, e.g. "2/4". */
  short?: string;
  /** The status in words, for the details card and the token's tooltip. */
  label: string;
}

/** Online: a player's chances left, three turns run out without doing anything being a forfeit. */
export function getChancesLeft(state: Pick<GameState, "idleStrikes">, player: Player): number {
  return Math.max(0, IDLE_STRIKES_TO_FORFEIT - getIdleStrikes(state, player.id));
}

function getRoleStatus(state: GameState, player: Player): PlayerStatus | null {
  if (hasCard(player, "devil")) {
    const count = `${state.devilHellTurns}/${getDevilGoalFor(state)}`;
    return {
      id: "devil",
      tone: "devil",
      icon: <UiIcon name="flame" size={11} strokeWidth={3} />,
      short: count,
      label: `Le diable : tours passés en Enfer par les autres ${count}`,
    };
  }
  const guardian = state.guardian;
  const name = (id: string | undefined) => state.players.find((candidate) => candidate.id === id)?.name ?? "";
  if (guardian?.angelId === player.id) {
    return {
      id: "angel",
      tone: "angel",
      icon: <UiIcon name="sparkle" size={11} strokeWidth={3} />,
      label: `Ange-Gardien de ${name(guardian.protegeId)}`,
    };
  }
  if (guardian?.protegeId === player.id) {
    return {
      id: "protege",
      tone: "angel",
      icon: <UiIcon name="shield" size={11} strokeWidth={3} />,
      label: `Protégé par ${name(guardian.angelId)}`,
    };
  }
  return null;
}

/**
 * Every status of a player, the most pressing first: the row shows the first
 * ones only, the details card all of them.
 */
export function getPlayerStatuses(state: GameState, player: Player): PlayerStatus[] {
  const statuses: PlayerStatus[] = [];
  const frozen = state.snowFrozenPlayerIds.includes(player.id);
  if (frozen) {
    statuses.push({ id: "frozen", tone: "frozen", icon: "❄", label: "Gelé : passe son prochain tour" });
  } else if (player.skippedTurns > 0) {
    statuses.push({
      id: "sleep",
      tone: "sleep",
      icon: <UiIcon name="sleep" size={11} strokeWidth={3} />,
      label: "Passe son prochain tour",
    });
  }
  if (player.position === HELL_NODE_ID) {
    statuses.push({
      id: "hell",
      tone: "hell",
      icon: <UiIcon name="flame" size={11} strokeWidth={3} />,
      short: `${player.hellTurns}/${getHellTurnLimit(player)}`,
      label: `En Enfer depuis ${player.hellTurns} tour${player.hellTurns > 1 ? "s" : ""} sur ${getHellTurnLimit(player)}`,
    });
  }
  const strikes = getIdleStrikes(state, player.id);
  if (strikes > 0) {
    const left = getChancesLeft(state, player);
    statuses.push({
      id: "chances",
      tone: "chances",
      icon: <CloverIcon size={13} />,
      short: `${left}/${IDLE_STRIKES_TO_FORFEIT}`,
      label: `Chances : ${left}/${IDLE_STRIKES_TO_FORFEIT}, forfait quand il n’en reste plus`,
    });
  }
  const hits = state.snowballHits[player.id] ?? 0;
  if (hits > 0) {
    statuses.push({
      id: "snow",
      tone: "snow",
      icon: "❄",
      short: `${hits}/${SNOWBALL_HITS_TO_FREEZE}`,
      label: `Boules de neige reçues : ${hits}/${SNOWBALL_HITS_TO_FREEZE}, gelé à la ${SNOWBALL_HITS_TO_FREEZE}ᵉ`,
    });
  }
  const role = getRoleStatus(state, player);
  if (role) statuses.push(role);
  return statuses;
}

export function StatusToken({ status }: { status: PlayerStatus }) {
  return (
    <span
      className={`status-token status-token--${status.tone}`}
      title={status.label}
      role="img"
      aria-label={status.label}
    >
      <span className="status-token__icon">{status.icon}</span>
      {status.short && <span className="status-token__count">{status.short}</span>}
    </span>
  );
}
