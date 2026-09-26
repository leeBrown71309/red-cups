import { useEffect } from "react";
import { onFeedback, type FeedbackEvent } from "../../feedback/event-bus";
import { useUiStore, type AlertBanner, type Toast } from "../../feedback/ui-store";
import { useGameStore } from "../../game/store";
import { BULLET_BILL_DAMAGE } from "../../game/types";

const TOAST_LIFETIME_MS = 4_200;

/** Turn announcements get the splash, big table events the banner; plain moves are visible on the board. */
const TOASTLESS_LOG = /^(Tour de |Bullet Bill |Toute la table est fauchée)|se déplace en case/;

function playerName(playerId: string | null): string {
  return useGameStore.getState().players.find((player) => player.id === playerId)?.name ?? "quelqu’un";
}

/** Big table events nobody should miss, phrased for the banner. */
function describeAlert(event: FeedbackEvent): Omit<AlertBanner, "key"> | null {
  switch (event.type) {
    case "bullet-launched":
      return {
        tone: "danger",
        eyebrow: "Alerte Bullet Bill",
        title: "Bullet Bill attend au départ !",
        detail: "Au prochain tour de table, il fonce sur le joueur le plus proche.",
      };
    case "bullet-flight": {
      const { flight } = event;
      const target = playerName(flight.targetId);
      return flight.victimId
        ? {
            tone: "danger",
            eyebrow: "Bullet Bill charge",
            title: `Il fonce sur ${target} !`,
            detail: "Impact imminent…",
          }
        : {
            tone: "danger",
            eyebrow: "Bullet Bill charge",
            title: `Il traque ${target} !`,
            detail: `${flight.path.length} case${flight.path.length > 1 ? "s" : ""} de plus vers sa cible.`,
          };
    }
    case "bullet-hit":
      return {
        tone: "danger",
        eyebrow: "Bullet Bill a frappé",
        title: "BOUM !",
        detail: `Bullet Bill percute ${playerName(event.playerId)} : −${BULLET_BILL_DAMAGE} pièces et un tour sauté.`,
      };
    case "blessing-started":
      return {
        tone: "blessing",
        eyebrow: "Toute la table est fauchée",
        title: "Tour de Bénédiction !",
        detail: "Chacun tourne la roue du bonheur, à tour de rôle.",
      };
    default:
      return null;
  }
}

/** Pipes game log lines into short-lived toasts, turn changes into the splash and big events into the banner. */
export function useHudFeedback(): void {
  const pushToast = useUiStore((state) => state.pushToast);
  const showSplash = useUiStore((state) => state.showSplash);
  const showAlert = useUiStore((state) => state.showAlert);

  useEffect(
    () =>
      onFeedback((event) => {
        if (event.type === "turn-start") showSplash(event.playerId);
        const alert = describeAlert(event);
        if (alert) showAlert(alert);
        if (event.type === "log" && !TOASTLESS_LOG.test(event.entry.text)) {
          pushToast({ id: event.entry.id, text: event.entry.text, tone: event.entry.tone });
        }
      }),
    [pushToast, showSplash, showAlert],
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
