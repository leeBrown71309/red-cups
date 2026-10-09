import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import type { PassiveId } from "../../game/types";
import { PassiveIcon } from "../icons/passive-icon";
import { CardTexture, getCardStyle } from "../cards/card-art";
import { CARD_DESIGNS } from "../cards/card-design";

/** Slices stacked behind the face: they give the coin its thickness when it leans. */
const THICKNESS_SLICES = [1, 2, 3, 4, 5, 6];
/** Studs set around the rim of the coin. */
const RIM_STUDS = Array.from({ length: 10 }, (_, index) => index * 36);
const MAX_LEAN_DEGREES = 26;

interface PassiveTalismanProps {
  passiveId: PassiveId;
  /** Wait before the coin drops in, so a hand of talismans lands one after the other. */
  delayMs?: number;
  children?: ReactNode;
}

/**
 * A passif drawn as a talisman, so it never looks like an actif's tarot card: a thick coin of the suit's colour
 * floating over a dark plaque, with the emblem standing out of its face. It really is 3D: the coin has depth, drifts
 * on its own and leans towards the pointer (the mouse over it, a finger dragged across it).
 */
export function PassiveTalisman({ passiveId, delayMs = 0, children }: PassiveTalismanProps) {
  const coin = useRef<HTMLDivElement>(null);
  const passive = PASSIVE_CATALOG[passiveId];
  const design = CARD_DESIGNS[passiveId];
  const style = { ...getCardStyle(passiveId), "--drop-delay": `${delayMs}ms` } as CSSProperties;

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const element = coin.current;
    if (!element) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    element.style.setProperty("--lean-x", `${((0.5 - y) * 2 * MAX_LEAN_DEGREES).toFixed(2)}deg`);
    element.style.setProperty("--lean-y", `${((x - 0.5) * 2 * MAX_LEAN_DEGREES).toFixed(2)}deg`);
  };

  const rest = () => {
    coin.current?.style.setProperty("--lean-x", "0deg");
    coin.current?.style.setProperty("--lean-y", "0deg");
  };

  return (
    <article className="talisman" style={style}>
      <span className="talisman__texture" aria-hidden="true">
        <CardTexture design={design} />
      </span>
      <div
        className="talisman__stage"
        onPointerMove={lean}
        onPointerLeave={rest}
        onPointerCancel={rest}
        onPointerUp={rest}
      >
        <div className="talisman__drop">
          <div className="talisman__float">
            <div className="talisman__coin" ref={coin} aria-hidden="true">
              {THICKNESS_SLICES.map((slice) => (
                <span
                  key={slice}
                  className="talisman__slice"
                  style={{ "--depth": `${-slice * 2}px` } as CSSProperties}
                />
              ))}
              <span className="talisman__face">
                <span className="talisman__ring" />
                {RIM_STUDS.map((angle) => (
                  <span key={angle} className="talisman__stud" style={{ "--angle": `${angle}deg` } as CSSProperties} />
                ))}
                <span className="talisman__emblem">
                  <PassiveIcon passiveId={passiveId} size={62} />
                </span>
                <span className="talisman__shine" />
              </span>
            </div>
          </div>
        </div>
        <span className="talisman__shadow" aria-hidden="true" />
      </div>
      <strong className="talisman__name">{passive.name}</strong>
      {/* Long rules scroll inside the plaque, so every talisman keeps the same height. */}
      <span className="talisman__text scroll-block" tabIndex={0}>
        {passive.description}
      </span>
      <span className="talisman__kind">Passif</span>
      {children}
    </article>
  );
}
