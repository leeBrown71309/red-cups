import { useEffect, type CSSProperties } from "react";
import { getInventoryCapacity } from "../../game/rules";
import { useGameStore } from "../../game/store";
import { useCountdownRunning } from "../../feedback/ui-store";
import { useCanActFor, useLocalPlayerId } from "../../net/room-store";
import { PlayerAvatar } from "../components/player-avatar";
import { useActivePlayer, useDecidingPlayer } from "../game-hooks";
import { UiIcon } from "../icons/ui-icon";
import { usePersistentToggle } from "../use-persistent-toggle";
import { ActionDock } from "./action-dock";
import { InventoryTray } from "./inventory-tray";
import { getAvatarExpression } from "./player-status";
import { TurnTimer } from "./turn-timer";

const COLLAPSED_KEY = "red-cups-dock-collapsed";

interface PlayerDockProps {
  onRequestTarget: (entryId: string) => void;
  onOpenShop: () => void;
}

/**
 * The bag and the action dock, together at the bottom of the screen. Both
 * fold away into a small tab to free the board; the clock stays on the tab.
 * Online, the dock opens again by itself when this device's turn comes.
 */
export function PlayerDock({ onRequestTarget, onOpenShop }: PlayerDockProps) {
  const [collapsed, setCollapsed] = usePersistentToggle(COLLAPSED_KEY, () => false);
  const countdownRunning = useCountdownRunning();
  const activePlayerId = useActivePlayer()?.id;
  const localPlayerId = useLocalPlayerId();
  const ownOnlineTurn = localPlayerId !== null && localPlayerId === activePlayerId;

  useEffect(() => {
    if (ownOnlineTurn) setCollapsed(false);
  }, [ownOnlineTurn, setCollapsed]);

  // Nobody plays during the countdown that follows the draft.
  if (countdownRunning) return null;
  if (collapsed) return <DockTab onExpand={() => setCollapsed(false)} />;
  return (
    <div className="hud__bottom">
      <InventoryTray onRequestTarget={onRequestTarget} />
      <ActionDock onOpenShop={onOpenShop} onCollapse={() => setCollapsed(true)} />
    </div>
  );
}

/** The folded dock: who decides, the clock, and a nudge when it is this device's call. */
function DockTab({ onExpand }: { onExpand: () => void }) {
  const decider = useDecidingPlayer();
  const phase = useGameStore((state) => state.phase);
  const localPlayerId = useLocalPlayerId();
  const canAct = useCanActFor([decider?.id]);
  const bagOwner = useGameStore((state) =>
    state.players.find((player) => player.id === (localPlayerId ?? state.players[state.activePlayerIndex]?.id)),
  );
  if (!decider || phase !== "playing") return null;

  const label = canAct
    ? localPlayerId
      ? "À toi de jouer"
      : `À ${decider.name} de jouer`
    : `Au tour de ${decider.name}`;
  return (
    <div className="dock-tab-layer">
      <button
        type="button"
        className={`dock-tab ${canAct ? "is-calling" : ""}`}
        style={{ "--player-color": decider.color } as CSSProperties}
        onClick={onExpand}
        aria-label={`${label} : afficher le sac et les actions`}
        title="Afficher le sac et les actions"
      >
        <PlayerAvatar color={decider.color} size={32} expression={getAvatarExpression(decider)} />
        <span className="dock-tab__text">
          <strong>{label}</strong>
          {bagOwner && (
            <small>
              <UiIcon name="bag" size={12} /> Sac {bagOwner.inventory.length}/{getInventoryCapacity(bagOwner)}
            </small>
          )}
        </span>
        <TurnTimer />
        <span className="dock-toggle" aria-hidden="true">
          <UiIcon name="chevronUp" size={16} strokeWidth={3} />
        </span>
      </button>
    </div>
  );
}
