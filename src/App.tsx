import { useEffect } from "react";
import { startAudioFeedback } from "./audio/audio-feedback";
import { startGameFeedback } from "./feedback/game-feedback";
import { useUiStore } from "./feedback/ui-store";
import { useGameStore } from "./game/store";
import { useAccountStore } from "./net/account-store";
import { useRoomStore } from "./net/room-store";
import { onlineAvailable } from "./net/supabase-client";
import { BoardStage } from "./scene/board-stage";
import { FullscreenGate } from "./ui/components/fullscreen-gate";
import { OrientationHint } from "./ui/components/orientation-hint";
import { GameHud } from "./ui/hud/game-hud";
import { LobbyScreen } from "./ui/lobby/lobby-screen";
import { OnlineScreen } from "./ui/online/online-screen";

/** Read once at startup: a game in progress at this point came back from the browser save. */
const RESTORED_ON_LOAD = useGameStore.getState().phase === "playing";

/**
 * The 3D board stays mounted for the whole session: it slowly orbits behind
 * the lobby, then the camera flies in when the game starts.
 */
export default function App() {
  const phase = useGameStore((state) => state.phase);
  const startGame = useGameStore((state) => state.startGame);
  const roomView = useRoomStore((state) => state.view);
  const openOnlineMenu = useRoomStore((state) => state.openMenu);

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
      <BoardStage mode={phase === "setup" ? "attract" : "play"} />
      {phase !== "setup" ? (
        <GameHud />
      ) : roomView === "closed" ? (
        <LobbyScreen onStart={startGame} onPlayOnline={onlineAvailable ? () => openOnlineMenu() : undefined} />
      ) : (
        <OnlineScreen />
      )}
      <OrientationHint />
      <FullscreenGate />
    </div>
  );
}
