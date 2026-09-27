import type { Player } from "../../game/types";
import { PlayerAvatar } from "./player-avatar";

/** Shown in an online game where another player has the decision. */
export function WaitingNote({ player, text }: { player: Player | undefined; text?: string }) {
  return (
    <p className="waiting-note" aria-live="polite">
      {player && <PlayerAvatar color={player.color} size={28} />}
      <span>{text ?? `En attente de ${player?.name ?? "l’autre joueur"}…`}</span>
    </p>
  );
}
