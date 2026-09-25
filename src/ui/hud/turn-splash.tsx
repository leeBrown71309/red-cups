import { useEffect } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { useGameStore } from "../../game/store";
import { HELL_NODE_ID } from "../../game/types";
import { useUiStore } from "../../feedback/ui-store";
import { PlayerAvatar } from "../components/player-avatar";
import { getAvatarExpression } from "./players-bar";

const SPLASH_DURATION_MS = 1_600;

/** Big "your turn" banner, so a shared screen always says who holds the controls. */
export function TurnSplash() {
  const splash = useUiStore((state) => state.splash);
  const hideSplash = useUiStore((state) => state.hideSplash);
  const player = useGameStore((state) => state.players.find((candidate) => candidate.id === splash?.playerId));

  useEffect(() => {
    if (!splash) return undefined;
    const timer = window.setTimeout(hideSplash, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [splash, hideSplash]);

  if (!splash || !player) return null;
  const inHell = player.position === HELL_NODE_ID;

  return (
    <div className="turn-splash" key={splash.key} aria-live="assertive">
      <div className="turn-splash__ribbon" style={{ background: player.color }}>
        <PlayerAvatar
          color={player.color}
          size={84}
          expression={getAvatarExpression(player)}
          className="turn-splash__avatar"
        />
        <div>
          <span className="turn-splash__eyebrow">{inHell ? "Depuis l’Enfer…" : "C’est parti !"}</span>
          <strong className="turn-splash__title">Au tour de {player.name}</strong>
          <span className="turn-splash__passive">{PASSIVE_CATALOG[player.passiveId].name}</span>
        </div>
      </div>
    </div>
  );
}
