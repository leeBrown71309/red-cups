import type { CSSProperties } from "react";
import type { PlayerColor } from "../../game/types";
import { PlayerAvatar } from "../components/player-avatar";
import { RedCupIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

/** Radius of the seating circle, as a fraction of the table's width. */
const SEAT_RADIUS = 0.37;

export interface TableSeat {
  /** Stable identity: a seat keeps its pawn from one render to the next, so the pawn glides when seats change. */
  key: string | number;
  name: string;
  color: PlayerColor;
}

interface PlayersTableProps {
  seats: TableSeat[];
  /** Counts the tosses of the order: each one spins the ring once. */
  shuffles?: number;
  /** After a toss, the pawns set off one after the other for a moment. */
  flourish?: boolean;
}

/** Seat `index` of `count`, clockwise from the top of the table, as fractions of the table's size. */
function seatPosition(index: number, count: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(count, 1);
  return { x: Math.cos(angle) * SEAT_RADIUS, y: Math.sin(angle) * SEAT_RADIUS };
}

/**
 * The table seen from above, the pawns sitting around it in the playing order (clockwise from the top, the
 * first player carries the flag). It fills the box it is put in, whatever the screen, and is purely decorative.
 */
export function PlayersTable({ seats, shuffles = 0, flourish = false }: PlayersTableProps) {
  return (
    <div className={`table${flourish ? " is-shuffling" : ""}`} aria-hidden="true">
      <span className="table__plate">
        <span key={shuffles} className={`table__ring${shuffles > 0 ? " is-spinning" : ""}`} />
        <span className="table__cups">
          <RedCupIcon size={44} />
          <RedCupIcon size={44} />
          <RedCupIcon size={44} />
        </span>
      </span>
      {seats.map((seat, index) => {
        const { x, y } = seatPosition(index, seats.length);
        return (
          <span key={seat.key} className="table__seat" style={{ "--x": x, "--y": y, "--i": index } as CSSProperties}>
            <span className="table__pawn" style={{ "--bob": `${index * 0.37}s` } as CSSProperties}>
              <PlayerAvatar color={seat.color} size={64} />
              {index === 0 && (
                <span className="table__start">
                  <UiIcon name="flag" size={12} />
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
