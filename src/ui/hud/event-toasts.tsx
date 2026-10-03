import { useEffect } from "react";
import { onFeedback, type FeedbackEvent } from "../../feedback/event-bus";
import { useUiStore, type AlertBanner, type Toast } from "../../feedback/ui-store";
import { useGameStore } from "../../game/store";
import { BULLET_BILL_DAMAGE } from "../../game/types";

const TOAST_LIFETIME_MS = 4_200;

/** Turn announcements get the splash, big table events the banner; plain moves are visible on the board. */
const TOASTLESS_LOG =
  /^(Tour de |Bullet Bill |Toute la table est fauchée|Le carrousel change de sens|Blizzard|La glace tombe|Un fantôme surgit|Le fantôme attaque)|se déplace en case/;

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
    case "devil-announced":
      return {
        tone: "devil",
        eyebrow: "Le diable est à table",
        title: `${playerName(event.playerId)} est le diable !`,
        detail: `Il gagne quand les autres auront passé ${event.goal} tours en Enfer. Méfiez-vous de sa boutique.`,
      };
    case "last-chance":
      return {
        tone: "chances",
        eyebrow: "Dernière chance",
        title: `${playerName(event.playerId)}, à toi de jouer !`,
        detail: "Encore un tour qui passe sans jouer, et c’est le forfait.",
      };
    case "doomsday-started":
      return {
        tone: "devil",
        eyebrow: "Doomsday",
        title: "Toutes les cases sont maudites !",
        detail: "Jusqu’au prochain tour du diable, chaque case fait tourner la roue du malheur.",
      };
    case "black-cup-cast":
      return {
        tone: "devil",
        eyebrow: "Black Cup",
        title: "La Red Cup plonge en Enfer !",
        detail: "Elle y reste deux tours de table. Qui arrive en Enfer d’ici là la ramasse.",
      };
    case "blessing-started":
      return {
        tone: "blessing",
        eyebrow: "Toute la table est fauchée",
        title: "Tour de Bénédiction !",
        detail: "Chacun tourne la roue du bonheur, à tour de rôle.",
      };
    case "blizzard":
      return {
        tone: "blizzard",
        eyebrow: "Blizzard",
        title: event.to === null ? "Le blizzard souffle…" : `La case ${event.to} devient glissante !`,
        detail:
          event.from === null
            ? "Le vent glacé la couvre de glace : on y glisse au hasard."
            : `La glace de la case ${event.from} fond. Prochain blizzard dans deux tours.`,
      };
    case "ice-fall":
      return event.hit
        ? {
            tone: "blizzard",
            eyebrow: "Tombée de glace",
            title: `${playerName(event.playerId)} est pris dans la glace !`,
            detail: `Bloqué sur la route de la case ${event.to}, il la rejoint à son prochain tour.`,
          }
        : {
            tone: "blizzard",
            eyebrow: "Tombée de glace",
            title: "Raté de peu !",
            detail: `La glace s’écrase à côté de ${playerName(event.playerId)}, qui file vers la case ${event.to}.`,
          };
    case "ghost-appeared":
      return {
        tone: "ghost",
        eyebrow: "Luna Park",
        title: "Un fantôme hante la fête foraine !",
        detail: `Il surgit sur la case ${event.nodeId} et rôde partout, routes ou pas. Clique-le pour voir son butin.`,
      };
    case "ghost-attack":
      return {
        tone: "ghost",
        eyebrow: "Le fantôme attaque",
        title: `${playerName(event.playerId)} doit l’affronter !`,
        detail: `Duel sur la case ${event.nodeId}, mini-jeu tiré au sort. Perdu, il vole ; gagné, il rend un butin.`,
      };
    case "carousel-flipped":
      return {
        tone: "carousel",
        eyebrow: "Nouvelle Red Cup",
        title: "Le carrousel change de sens !",
        detail: event.reversed
          ? "Il tourne maintenant dans le sens 1 → 4 → 3 → 2."
          : "Il tourne maintenant dans le sens 1 → 2 → 3 → 4.",
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
