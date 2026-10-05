import { useEffect } from "react";
import { startAudioFeedback } from "./audio/audio-feedback";
import { startGameFeedback } from "./feedback/game-feedback";
import { useUiStore } from "./feedback/ui-store";
import { useGameStore } from "./game/store";
import { useAccountStore } from "./net/account-store";
import { useRoomStore } from "./net/room-store";
import { onlineAvailable } from "./net/supabase-client";
import { BoardStage } from "./scene/board-stage";
import { ErrorBoundary } from "./ui/components/error-boundary";
import { FullscreenGate } from "./ui/components/fullscreen-gate";
import { OrientationHint } from "./ui/components/orientation-hint";
import { DraftScreen } from "./ui/draft/draft-screen";
import { GameHud } from "./ui/hud/game-hud";
import { ChangelogScreen } from "./ui/home/changelog-screen";
import { useHomeStore } from "./ui/home/home-store";
import { MenuScreen } from "./ui/home/menu-screen";
import { LobbyScreen } from "./ui/lobby/lobby-screen";
import { OnlineScreen } from "./ui/online/online-screen";

/** Read once at startup: a game in progress at this point came back from the browser save. */
const RESTORED_ON_LOAD = useGameStore.getState().phase === "playing";

/** Shown if the game screen fails to draw: a way out instead of a blank page. */
function GameFailed() {
  const leave = useRoomStore((state) => state.leave);
  const resetGame = useGameStore((state) => state.resetGame);
  return (
    <div className="modal-layer" role="alert">
      <div className="modal-backdrop" />
      <section className="modal-card modal-card--medium">
        <h2>Oups, l’écran n’a pas pu s’afficher</h2>
        <div className="modal-actions">
          <button type="button" className="btn btn--cup" onClick={() => void leave().then(resetGame)}>
            Retour au menu
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * The 3D board stays mounted for the whole session: it slowly orbits behind
 * the lobby, then the camera flies in when the game starts.
 */
export default function App() {
  const phase = useGameStore((state) => state.phase);
  const startGame = useGameStore((state) => state.startGame);
  const roomView = useRoomStore((state) => state.view);
  const openOnlineMenu = useRoomStore((state) => state.openMenu);
  const homeView = useHomeStore((state) => state.view);
  const setHomeView = useHomeStore((state) => state.setView);

  useEffect(() => {
    if (!onlineAvailable) return;
    useAccountStore.getState().start();
    // Back after a reload, a Google sign-in or an invitation link.
    void useRoomStore.getState().restore();
  }, []);

  useEffect(() => {
    const stopGameFeedback = startGameFeedback();
    const stopAudioFeedback = startAudioFeedback();
    if (RESTORED_ON_LOAD) {
      useUiStore
        .getState()
        .pushToast({ id: "restored-game", text: "Partie restaurée : on reprend où vous en étiez.", tone: "good" });
    }
    return () => {
      stopGameFeedback();
      stopAudioFeedback();
    };
  }, []);

  return (
    <div className={`app app--${phase}`}>
      <BoardStage mode={phase === "setup" || phase === "draft" ? "attract" : "play"} />
      {phase === "draft" ? (
        <DraftScreen />
      ) : phase !== "setup" ? (
        <ErrorBoundary fallback={<GameFailed />}>
          <GameHud />
        </ErrorBoundary>
      ) : roomView === "closed" ? (
        homeView === "menu" ? (
          <MenuScreen onPlayOnline={onlineAvailable ? () => openOnlineMenu() : undefined} />
        ) : homeView === "changelog" ? (
          <ChangelogScreen />
        ) : (
          <LobbyScreen
            // Every game opens on the passive draft (patch 0.1.4).
            onStart={(names, mapId) => startGame(names, undefined, mapId, true)}
            onPlayOnline={onlineAvailable ? () => openOnlineMenu() : undefined}
            onBack={() => setHomeView("menu")}
          />
        )
      ) : (
        <OnlineScreen />
      )}
      <OrientationHint />
      <FullscreenGate />
    </div>
  );
}
