import { useEffect, useState, type ReactNode } from "react";
import { useGameStore } from "../../game/store";
import { useBoardSettled, useUiStore } from "../../feedback/ui-store";
import { useCanActFor } from "../../net/room-store";
import { ITEM_CATALOG } from "../../game/catalog";
import { ChallengeModal, DiscardModal, ItemTargetModal, ReactionModal } from "../modals/decision-modals";
import { ArmWrestleModal } from "../modals/arm-wrestle-modal";
import { DuelChoiceModal, DuelModal } from "../modals/duel-modal";
import { GhostLootModal } from "../modals/ghost-loot-modal";
import { HelpModal } from "../modals/help-modal";
import { AbandonModal, JournalModal, PauseMenu } from "../modals/menu-modals";
import { ShopModal } from "../modals/shop-modal";
import { VictoryModal } from "../modals/victory-modal";
import { WheelModal } from "../modals/wheel-modal";
import { AlertBannerView } from "./alert-banner";
import { CameraControls } from "./camera-controls";
import { EventToasts, useHudFeedback } from "./event-toasts";
import { GameCountdown } from "./game-countdown";
import { DiceRollAnimation } from "./dice-roll";
import { GambleSplash } from "./gamble-splash";
import { PauseOverlay } from "./pause-controls";
import { PlayerDock } from "./player-dock";
import { LeftTableBanner } from "./left-table-banner";
import { RoadPickBanner } from "./road-pick-banner";
import { PlayersPanel } from "./players-panel";
import { TopBar } from "./top-bar";
import { TurnSplash } from "./turn-splash";
import { useClockBeeps } from "./use-clock-beeps";

/** The longest the victory screen waits for the last moves to land. */
const FINISH_WAIT_MS = 3500;

type Overlay = "menu" | "help" | "journal" | "abandon" | null;

/**
 * In-game heads-up display laid over the 3D board. Only one blocking decision
 * is shown at a time, and only once the pawns have finished moving.
 */
export function GameHud() {
  useHudFeedback();
  useClockBeeps();
  const game = useGameStore();
  const settled = useBoardSettled();
  const setPreviewNodeId = useUiStore((state) => state.setPreviewNodeId);
  const setIgnoreArrows = useUiStore((state) => state.setIgnoreArrows);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
  const [shopClosed, setShopClosed] = useState(false);
  const ghostLootOpen = useUiStore((state) => state.ghostLootOpen);
  const setGhostLootOpen = useUiStore((state) => state.setGhostLootOpen);
  const setRoadPickEntryId = useUiStore((state) => state.setRoadPickEntryId);

  // Keyed on the player rather than the seat: seats shift when an earlier player abandons.
  const activePlayerId = game.players[game.activePlayerIndex]?.id;
  const isOwnTurn = useCanActFor([activePlayerId]);

  useEffect(() => {
    setShopClosed(false);
    setTargetEntryId(null);
    setRoadPickEntryId(null);
    setPreviewNodeId(null);
  }, [game.turnStage, activePlayerId, setPreviewNodeId, setRoadPickEntryId]);

  useEffect(() => setIgnoreArrows(false), [activePlayerId, setIgnoreArrows]);

  // The final table must always come: a board that never reports settling cannot hold it back for long.
  const finished = game.phase === "finished";
  const [finishWaited, setFinishWaited] = useState(false);
  useEffect(() => {
    if (!finished) return undefined;
    const timer = window.setTimeout(() => setFinishWaited(true), FINISH_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [finished]);

  // A Barrière is set down by tapping its road on the board: no window in the way.
  const requestTarget = (entryId: string) => {
    const entry = game.players[game.activePlayerIndex]?.inventory.find((candidate) => candidate.id === entryId);
    if (entry?.kind === "item" && ITEM_CATALOG[entry.itemId].target === "road") setRoadPickEntryId(entryId);
    else setTargetEntryId(entryId);
  };

  let decision: ReactNode = null;
  if (settled || (finished && finishWaited)) {
    if (game.phase === "finished") decision = <VictoryModal />;
    else if (game.pendingReaction) decision = <ReactionModal />;
    else if (game.pendingArmWrestle) decision = <ArmWrestleModal />;
    else if (game.pendingDiscard) decision = <DiscardModal />;
    else if (game.pendingWheel) decision = <WheelModal />;
    else if (game.pendingDuelChoice) decision = <DuelChoiceModal />;
    else if (game.pendingDuel) decision = <DuelModal />;
    else if (game.pendingChallenge) decision = <ChallengeModal />;
    else if (targetEntryId)
      decision = <ItemTargetModal entryId={targetEntryId} onClose={() => setTargetEntryId(null)} />;
    else if (game.turnStage === "shop" && !shopClosed && isOwnTurn)
      decision = <ShopModal onClose={() => setShopClosed(true)} />;
  }

  return (
    <div className={`hud ${decision ? "has-decision" : ""}`}>
      <TopBar
        onOpenMenu={() => setOverlay("menu")}
        onOpenJournal={() => setOverlay("journal")}
        onOpenHelp={() => setOverlay("help")}
      />
      <EventToasts />
      <CameraControls />
      <PlayersPanel />
      <PlayerDock onRequestTarget={requestTarget} onOpenShop={() => setShopClosed(false)} />
      <RoadPickBanner />
      <LeftTableBanner />
      <TurnSplash />
      <GameCountdown />
      <DiceRollAnimation />
      <GambleSplash />
      <AlertBannerView />
      {decision}
      {/* Above every decision; the menu opened from it takes its place until closed. */}
      {overlay === null && <PauseOverlay onOpenMenu={() => setOverlay("menu")} />}
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
      {ghostLootOpen && game.ghost && <GhostLootModal onClose={() => setGhostLootOpen(false)} />}
    </div>
  );
}
