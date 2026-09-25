import { useGameStore } from "../../game/store";
import { AudioToggles } from "../components/audio-controls";
import { UiIcon } from "../icons/ui-icon";
import { PlayersBar } from "./players-bar";

interface TopBarProps {
  onOpenMenu: () => void;
  onOpenHelp: () => void;
}

export function TopBar({ onOpenMenu, onOpenHelp }: TopBarProps) {
  const round = useGameStore((state) => state.round);

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="icon-button icon-button--solid" onClick={onOpenMenu} aria-label="Menu pause">
          <UiIcon name="menu" />
        </button>
        <span className="round-chip" title="Tour de table">
          <small>Tour</small>
          <strong>{round}</strong>
        </span>
      </div>
      <PlayersBar />
      <div className="top-bar__right">
        <AudioToggles />
        <button type="button" className="icon-button" onClick={onOpenHelp} aria-label="Comment jouer">
          <UiIcon name="help" />
        </button>
      </div>
    </header>
  );
}
