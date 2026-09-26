import { PLAYER_COLORS } from "../../game/types";
import { PlayerAvatar } from "../components/player-avatar";

interface AvatarPickerProps {
  selected: number | null;
  /** Avatars already worn by somebody else in the room. */
  taken: number[];
  onSelect: (avatar: number) => void;
}

/** The game's eight avatars; each one can only be worn by one player per room. */
export function AvatarPicker({ selected, taken, onSelect }: AvatarPickerProps) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Choisis ton avatar">
      {PLAYER_COLORS.map((color, index) => {
        const isTaken = taken.includes(index);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected === index}
            aria-label={isTaken ? `Avatar ${index + 1}, déjà pris` : `Avatar ${index + 1}`}
            className={`avatar-picker__option ${selected === index ? "is-selected" : ""}`}
            disabled={isTaken}
            onClick={() => onSelect(index)}
          >
            <PlayerAvatar color={color} size={46} expression={isTaken ? "sleepy" : "happy"} />
          </button>
        );
      })}
    </div>
  );
}

/** First avatar nobody wears yet, so a newcomer never starts on a taken one. */
export function firstFreeAvatar(taken: number[], preferred: number | null): number {
  if (preferred !== null && !taken.includes(preferred)) return preferred;
  const free = PLAYER_COLORS.findIndex((_, index) => !taken.includes(index));
  return free < 0 ? 0 : free;
}
