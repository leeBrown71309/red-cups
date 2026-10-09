import { useEffect } from "react";
import { useUiStore } from "../../feedback/ui-store";
import { ALERT_BANNER_MS } from "../../theme/timing";
import { GhostAvatar } from "../components/ghost-avatar";
import { CloverIcon, DevilIcon, ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

/**
 * Wide ribbon at the top for events the whole table must notice: Bullet
 * Bill, le diable and their spells, the Tour de Bénédiction, the map's events.
 */
export function AlertBannerView() {
  const alert = useUiStore((state) => state.alert);
  const hideAlert = useUiStore((state) => state.hideAlert);

  useEffect(() => {
    if (!alert) return undefined;
    const timer = window.setTimeout(() => hideAlert(alert.key), ALERT_BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [alert, hideAlert]);

  if (!alert) return null;

  return (
    <div className="alert-banner-layer" aria-live="assertive">
      <div key={alert.key} className={`alert-banner alert-banner--${alert.tone}`}>
        <span className="alert-banner__icon" aria-hidden="true">
          {alert.tone === "danger" ? (
            <ItemIcon itemId="bullet-bill" size={46} />
          ) : alert.tone === "devil" ? (
            <DevilIcon size={50} />
          ) : alert.tone === "chances" ? (
            <CloverIcon size={44} />
          ) : alert.tone === "ghost" ? (
            <GhostAvatar size={50} />
          ) : alert.tone === "roller" ? (
            <UiIcon name="dice" size={38} />
          ) : (
            <UiIcon name={alert.tone === "blizzard" ? "flag" : alert.tone === "tide" ? "waves" : "sparkle"} size={34} />
          )}
        </span>
        <span className="alert-banner__text">
          <span className="alert-banner__eyebrow">{alert.eyebrow}</span>
          <strong className="alert-banner__title">{alert.title}</strong>
          <span className="alert-banner__detail">{alert.detail}</span>
        </span>
      </div>
    </div>
  );
}
