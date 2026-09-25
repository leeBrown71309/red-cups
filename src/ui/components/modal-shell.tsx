import { useEffect, useId, useRef, type ReactNode } from "react";
import { UiIcon } from "../icons/ui-icon";

interface ModalShellProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  tone?: "cream" | "grape" | "sky" | "gold" | "cup";
  size?: "small" | "medium" | "large";
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Shared dialog frame: sticker-like card, soft backdrop and pop-in motion.
 * Dialogs without `onClose` are mandatory decisions and cannot be dismissed.
 */
export function ModalShell({
  title,
  eyebrow,
  tone = "cream",
  size = "medium",
  onClose,
  footer,
  className,
  children,
}: ModalShellProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const focusable = card?.querySelector<HTMLElement>("[data-autofocus], button:not(:disabled), input");
    focusable?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!onClose) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-layer" role="presentation">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        ref={cardRef}
        className={`modal-card modal-card--${tone} modal-card--${size} ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-card__header">
          <div>
            {eyebrow && <span className="modal-card__eyebrow">{eyebrow}</span>}
            <h2 id={titleId} className="modal-card__title">
              {title}
            </h2>
          </div>
          {onClose && (
            <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">
              <UiIcon name="close" />
            </button>
          )}
        </header>
        <div className="modal-card__body">{children}</div>
        {footer && <footer className="modal-card__footer">{footer}</footer>}
      </section>
    </div>
  );
}
