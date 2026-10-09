import { useEffect } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import type { PassiveId } from "../../game/types";
import { useVisibleCards } from "../card-visibility";
import { getBoardMap } from "../../game/maps/map-registry";
import { useGameStore } from "../../game/store";
import { HELL_NODE_ID } from "../../game/types";
import { useUiStore } from "../../feedback/ui-store";
import { PlayerAvatar } from "../components/player-avatar";
import { canSeePlayer, useFog } from "../fog";
import { getAvatarExpression } from "./player-status";

const SPLASH_DURATION_MS = 1_600;

/** Big "your turn" banner, so a shared screen always says who holds the controls. */
export function TurnSplash() {
  const splash = useUiStore((state) => state.splash);
  const hideSplash = useUiStore((state) => state.hideSplash);
  const player = useGameStore((state) => state.players.find((candidate) => candidate.id === splash?.playerId));
  // The very first turn announces the board too: online guests learn the host's pick here.
  const openingTurn = useGameStore(
    (state) => state.round === 1 && state.activePlayerIndex === 0 && !state.turnActionTaken,
  );
  const mapName = useGameStore((state) => getBoardMap(state.mapId).name);

  useEffect(() => {
    if (!splash) return undefined;
    const timer = window.setTimeout(hideSplash, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [splash, hideSplash]);

  const cards = useVisibleCards(player);
  const fog = useFog();
  if (!splash || !player) return null;
  const seen = canSeePlayer(fog, player.id);
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
          <span className="turn-splash__eyebrow">
            {inHell ? "Depuis l’Enfer…" : openingTurn ? `C’est parti · ${mapName}` : "C’est parti !"}
          </span>
          <strong className="turn-splash__title">Au tour de {player.name}</strong>
          <span className="turn-splash__passive">
            {seen
              ? [cards.actif ?? "Cups Power caché", cards.passif]
                  .filter((cardId): cardId is string => cardId !== null)
                  .map((cardId) => (cardId in PASSIVE_CATALOG ? PASSIVE_CATALOG[cardId as PassiveId].name : cardId))
                  .join(" · ")
              : "Hors de vue"}
          </span>
        </div>
      </div>
    </div>
  );
}
