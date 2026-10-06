import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const MAX_TILT_DEGREES = 16;

interface TiltCardProps {
  children: ReactNode;
  /** Wait before the card flips open, so a hand of cards turns one after the other. */
  delayMs?: number;
  /** The card sits in a page that scrolls: a finger sliding up or down scrolls it instead of tilting the card. */
  scrollable?: boolean;
}

/**
 * A card held in 3D: it appears face down, then flips open; afterwards it leans towards the pointer (the mouse
 * over it, a finger dragged across it) and shows a glare where the light hits it. It lies flat again when the
 * pointer leaves. Give it a \`key\` to replay the flip for another card.
 */
export function TiltCard({ children, delayMs = 0, scrollable = false }: TiltCardProps) {
  const surface = useRef<HTMLDivElement>(null);

  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const element = surface.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    element.style.setProperty("--tilt-x", `${((0.5 - y) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
    element.style.setProperty("--tilt-y", `${((x - 0.5) * 2 * MAX_TILT_DEGREES).toFixed(2)}deg`);
    element.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    element.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
    element.classList.add("is-leaning");
  };

  const rest = () => {
    const element = surface.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
    element.classList.remove("is-leaning");
  };

  return (
    <div
      className={`tilt-card ${scrollable ? "tilt-card--scrollable" : ""}`}
      style={{ "--flip-delay": `${delayMs}ms` } as CSSProperties}
      onPointerMove={lean}
      onPointerLeave={rest}
      onPointerCancel={rest}
      onPointerUp={rest}
    >
      <div
        className="tilt-card__surface"
        ref={surface}
        style={{ "--tilt-x": "0deg", "--tilt-y": "0deg" } as CSSProperties}
      >
        <div className="tilt-card__flip">
          <div className="tilt-card__face tilt-card__face--front">{children}</div>
          <div className="tilt-card__face tilt-card__face--back" aria-hidden="true">
            <span className="tilt-card__back-frame">
              <span className="tilt-card__back-medallion">
                <svg viewBox="0 0 48 48" width="46" height="46" focusable="false">
                  <path
                    d="M12 8h24l-3 32a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3L12 8z"
                    fill="#e8453c"
                    stroke="#3a2530"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <path d="M12.8 16h22.4" stroke="#fff8ee" strokeWidth="3" strokeLinecap="round" />
                  <ellipse cx="24" cy="8" rx="12" ry="3" fill="#ffd9d4" stroke="#3a2530" strokeWidth="3" />
                </svg>
              </span>
              <span className="tilt-card__back-star tilt-card__back-star--top">✦</span>
              <span className="tilt-card__back-star tilt-card__back-star--bottom">✦</span>
            </span>
          </div>
        </div>
        <span className="tilt-card__glare" aria-hidden="true" />
      </div>
    </div>
  );
}
