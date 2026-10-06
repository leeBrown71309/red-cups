import { useMemo, useState, type ReactNode } from "react";
import { UiIcon } from "../icons/ui-icon";

export interface CatalogEntry {
  id: string;
  name: string;
  /** Everything a search may match besides the name. */
  keywords?: string;
}

/** Lower case, accents off: « Épées » is found by « epee ». */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

interface CatalogBrowserProps<T extends CatalogEntry> {
  entries: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** The small version of an entry, in the scrolling list. */
  renderMini: (entry: T, selected: boolean) => ReactNode;
  /** The fixed side: what the selected entry is. */
  detail: ReactNode;
  searchLabel: string;
  /** Chips above the list that narrow it down (actifs, passifs). */
  filters?: ReactNode;
  className?: string;
}

/**
 * A list to browse and a detail to read, the way the shop lays out its shelf: the miniatures scroll on the
 * left under a search bar, the selected entry stays put on the right.
 */
export function CatalogBrowser<T extends CatalogEntry>({
  entries,
  selectedId,
  onSelect,
  renderMini,
  detail,
  searchLabel,
  filters,
  className = "",
}: CatalogBrowserProps<T>) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const wanted = normalizeSearch(query);
    if (wanted === "") return entries;
    return entries.filter((entry) => normalizeSearch(`${entry.name} ${entry.keywords ?? ""}`).includes(wanted));
  }, [entries, query]);

  return (
    <div className={`catalog ${className}`}>
      <div className="catalog__list-side">
        <div className="catalog__toolbar">
          <label className="catalog__search">
            <UiIcon name="search" size={16} />
            <input
              type="search"
              value={query}
              placeholder={searchLabel}
              aria-label={searchLabel}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {filters}
        </div>
        {shown.length === 0 ? (
          <p className="catalog__empty">Rien ne correspond à « {query} ».</p>
        ) : (
          <ul className="catalog__list">
            {shown.map((entry) => {
              const selected = entry.id === selectedId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`catalog__mini ${selected ? "is-selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(entry.id)}
                  >
                    {renderMini(entry, selected)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <aside className="catalog__detail" aria-live="polite">
        {detail}
      </aside>
    </div>
  );
}
