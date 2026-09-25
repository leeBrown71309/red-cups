import { useEffect } from "react";
import { startAudioFeedback } from "./audio/audio-feedback";
import { startGameFeedback } from "./feedback/game-feedback";
import { useGameStore } from "./game/store";
import { BoardStage } from "./scene/board-stage";
import { OrientationHint } from "./ui/components/orientation-hint";
import { GameHud } from "./ui/hud/game-hud";
import { LobbyScreen } from "./ui/lobby/lobby-screen";

/**
 * The 3D board stays mounted for the whole session: it slowly orbits behind
 * the lobby, then the camera flies in when the game starts.
 */
export default function App() {
  const phase = useGameStore((state) => state.phase);
  const startGame = useGameStore((state) => state.startGame);

  useEffect(() => {
    const stopGameFeedback = startGameFeedback();
    const stopAudioFeedback = startAudioFeedback();
    return () => {
      stopGameFeedback();
      stopAudioFeedback();
    };
  }, []);

  return (
    <div className={`app app--${phase}`}>
      <BoardStage mode={phase === "setup" ? "attract" : "play"} />
      {phase === "setup" ? <LobbyScreen onStart={startGame} /> : <GameHud />}
      <OrientationHint />
    </div>
  );
}
