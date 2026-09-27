import { useEffect, useState, type ReactNode } from "react";
import { useGameStore } from "../../game/store";
import { useBoardSettled, useUiStore } from "../../feedback/ui-store";
import { useCanActFor } from "../../net/room-store";
import { CalmDownModal, ChallengeModal, DiscardModal, ItemTargetModal, ReactionModal } from "../modals/decision-modals";
import { DuelModal } from "../modals/duel-modal";
import { HelpModal } from "../modals/help-modal";
import { AbandonModal, JournalModal, PauseMenu } from "../modals/menu-modals";
import { ShopModal } from "../modals/shop-modal";
import { VictoryModal } from "../modals/victory-modal";
import { WheelModal } from "../modals/wheel-modal";
import { ActionDock } from "./action-dock";
import { AlertBannerView } from "./alert-banner";
import { CameraControls } from "./camera-controls";
import { EventToasts, useHudFeedback } from "./event-toasts";
import { InventoryTray } from "./inventory-tray";
import { TopBar } from "./top-bar";
import { TurnSplash } from "./turn-splash";

type Overlay = "menu" | "help" | "journal" | "abandon" | null;

/**
 * In-game heads-up display laid over the 3D board. Only one blocking decision
 * is shown at a time, and only once the pawns have finished moving.
 */
export function GameHud() {
  useHudFeedback();
  const game = useGameStore();
  const settled = useBoardSettled();
  const setPreviewNodeId = useUiStore((state) => state.setPreviewNodeId);
  const setIgnoreArrows = useUiStore((state) => state.setIgnoreArrows);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
  const [shopClosed, setShopClosed] = useState(false);

  // Keyed on the player rather than the seat: seats shift when an earlier player abandons.
  const activePlayerId = game.players[game.activePlayerIndex]?.id;
  const isOwnTurn = useCanActFor([activePlayerId]);

  useEffect(() => {
    setShopClosed(false);
    setTargetEntryId(null);
    setPreviewNodeId(null);
  }, [game.turnStage, activePlayerId, setPreviewNodeId]);

  useEffect(() => setIgnoreArrows(false), [activePlayerId, setIgnoreArrows]);

  let decision: ReactNode = null;
  if (settled) {
    if (game.phase === "finished") decision = <VictoryModal />;
    else if (game.pendingReaction) decision = <ReactionModal />;
    else if (game.pendingDiscard) decision = <DiscardModal />;
    else if (game.pendingWheel) decision = <WheelModal />;
    else if (game.pendingDuel) decision = <DuelModal />;
    else if (game.pendingChallenge) decision = <ChallengeModal />;
    else if (game.pendingCalmDown) decision = <CalmDownModal />;
    else if (targetEntryId)
      decision = <ItemTargetModal entryId={targetEntryId} onClose={() => setTargetEntryId(null)} />;
    else if (game.turnStage === "shop" && !shopClosed && isOwnTurn)
      decision = <ShopModal onClose={() => setShopClosed(true)} />;
  }

  return (
    <div className={`hud ${decision ? "has-decision" : ""}`}>
      <TopBar onOpenMenu={() => setOverlay("menu")} onOpenHelp={() => setOverlay("help")} />
      <EventToasts />
      <CameraControls />
      <div className="hud__bottom">
        <InventoryTray onRequestTarget={setTargetEntryId} />
        <ActionDock onOpenShop={() => setShopClosed(false)} />
      </div>
      <TurnSplash />
      <AlertBannerView />
      {decision}
      {overlay === "menu" && (
        <PauseMenu
          onClose={() => setOverlay(null)}
          onOpenHelp={() => setOverlay("help")}
          onOpenJournal={() => setOverlay("journal")}
          onOpenAbandon={() => setOverlay("abandon")}
        />
      )}
      {overlay === "help" && <HelpModal onClose={() => setOverlay(null)} />}
      {overlay === "journal" && <JournalModal onClose={() => setOverlay(null)} />}
      {overlay === "abandon" && <AbandonModal onClose={() => setOverlay(null)} />}
    </div>
  );
}
