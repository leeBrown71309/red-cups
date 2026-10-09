import { APP_VERSION } from "../../version";
import { UiIcon } from "../icons/ui-icon";
import { CHANGELOG } from "./changelog-data";
import { useHomeStore } from "./home-store";

/** A full page listing the important changes of every version, the running one first. */
export function ChangelogScreen() {
  const setView = useHomeStore((state) => state.setView);

  return (
    <main className="changelog">
      <header className="changelog__header">
        <button type="button" className="btn btn--cream btn--small" onClick={() => setView("menu")} data-autofocus>
          <UiIcon name="arrowLeft" size={18} /> Menu
        </button>
        <div>
          <span className="eyebrow">Red Cups · version {APP_VERSION}</span>
          <h1>Journal des modifications</h1>
        </div>
      </header>
      <div className="changelog__body">
        <ol className="changelog__list">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="changelog__entry panel">
              <header className="changelog__entry-head">
                <strong className="changelog__version">{entry.version}</strong>
                {entry.version === APP_VERSION && <span className="changelog__current">Version actuelle</span>}
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              </header>
              <h2>{entry.title}</h2>
              <ul>
                {entry.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
