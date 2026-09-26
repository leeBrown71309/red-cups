import { useEffect } from "react";
import { useUiStore } from "../../feedback/ui-store";
import { ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";

const ALERT_DURATION_MS = 3_400;

/**
 * Wide ribbon under the players bar for events the whole table must notice:
 * Bullet Bill's arrival, charges and hits, and the Tour de Bénédiction.
 */
export function AlertBannerView() {
  const alert = useUiStore((state) => state.alert);
  const hideAlert = useUiStore((state) => state.hideAlert);

  useEffect(() => {
    if (!alert) return undefined;
    const timer = window.setTimeout(() => hideAlert(alert.key), ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [alert, hideAlert]);

  if (!alert) return null;

  return (
    <div className="alert-banner-layer" aria-live="assertive">
      <div key={alert.key} className={`alert-banner alert-banner--${alert.tone}`}>
        <span className="alert-banner__icon" aria-hidden="true">
          {alert.tone === "danger" ? <ItemIcon itemId="bullet-bill" size={46} /> : <UiIcon name="sparkle" size={34} />}
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
