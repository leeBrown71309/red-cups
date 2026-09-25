import { useEffect } from "react";
import { onFeedback } from "../../feedback/event-bus";
import { useUiStore, type Toast } from "../../feedback/ui-store";

const TOAST_LIFETIME_MS = 4_200;

/** Pipes game log lines into short-lived toasts and turn changes into the splash. */
export function useHudFeedback(): void {
  const pushToast = useUiStore((state) => state.pushToast);
  const showSplash = useUiStore((state) => state.showSplash);

  useEffect(
    () =>
      onFeedback((event) => {
        if (event.type === "turn-start") showSplash(event.playerId);
        // Turn announcements get the splash; plain moves are already visible on the board.
        if (event.type === "log" && !/^Tour de |se déplace en case/.test(event.entry.text)) {
          pushToast({ id: event.entry.id, text: event.entry.text, tone: event.entry.tone });
        }
      }),
    [pushToast, showSplash],
  );
}

export function EventToasts() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <ol className="event-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </ol>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), TOAST_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast.id]);

  return (
    <li className={`event-toast event-toast--${toast.tone}`}>
      <span className="event-toast__dot" aria-hidden="true" />
      {toast.text}
    </li>
  );
}
