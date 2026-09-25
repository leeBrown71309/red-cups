import GameScreen from "./components/game-screen";
import SetupScreen from "./components/setup-screen";
import { useGameStore } from "./game/store";

export default function App() {
  const phase = useGameStore((state) => state.phase);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);

  if (phase === "setup") {
    return <SetupScreen onStart={startGame} />;
  }

  return <GameScreen onExit={resetGame} />;
}
