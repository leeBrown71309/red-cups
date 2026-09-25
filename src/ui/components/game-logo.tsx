import { RedCupIcon } from "../icons/item-icon";

export function GameLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`game-logo ${compact ? "game-logo--compact" : ""}`}>
      <RedCupIcon className="game-logo__cup" size={compact ? 34 : 86} />
      <span className="game-logo__word">
        <span className="game-logo__red">Red</span>
        <span className="game-logo__cups">Cups</span>
      </span>
    </div>
  );
}
