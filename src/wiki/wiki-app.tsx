import { useEffect, useMemo, useRef, useState } from "react";
import { UiIcon } from "../ui/icons/ui-icon";
import { RedCupIcon } from "../ui/icons/item-icon";
import { WIKI_ENTRIES } from "./registry";
import { INTERACTIONS } from "./content/interactions";
import { EntryIcon } from "./components/entry-icon";
import { EntryPage, HomePage, ListPage, MatrixPage, NotFound } from "./components/pages";
import type { WikiEntry } from "./types";
import { hashToRef, normalizeSearch, refToHash } from "./utils";

/**
 * The wiki shell: a sidebar of families and entries, a hash router, and a
 * global search over every title, description and interaction sentence.
 */
export function WikiApp() {
  const [route, setRoute] = useState<string[]>(hashToRef(window.location.hash));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(hashToRef(window.location.hash));
      setDrawerOpen(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => searchWiki(query), [query]);
  const page = renderPage(route);

  const sidebar = (
    <nav className="wiki-nav" aria-label="Rubriques du wiki">
      <a className="wiki-nav__logo" href="#/" onClick={() => setDrawerOpen(false)}>
        <span className="wiki-nav__logo-cup">
          <RedCupIcon size={34} />
        </span>
        <span className="wiki-nav__logo-text">
          <strong>
            Red<span>Cups</span>
          </strong>
          <small>Wiki des règles</small>
        </span>
      </a>
      <label className="wiki-search">
        <UiIcon name="recenter" size={17} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher  (touche /)"
          type="search"
          aria-label="Recherche globale"
        />
        {query.length > 0 && (
          <button type="button" className="wiki-search__clear" onClick={() => setQuery("")} aria-label="Effacer">
            <UiIcon name="close" size={14} />
          </button>
        )}
      </label>
      {query.length > 0 && (
        <div className="wiki-results" role="listbox">
          {results.length === 0 && <p className="wiki-empty">Rien pour « {query} ».</p>}
          {results.map((entry) => (
            <a key={entry.ref} className="wiki-result" href={refToHash(entry.ref)} onClick={() => setQuery("")}>
              <EntryIcon entry={entry} size={24} />
              <span>
                <strong>{entry.title}</strong>
                <small>{KIND_LABEL[entry.kind]}</small>
              </span>
            </a>
          ))}
        </div>
      )}
      <div className="wiki-nav__sections">
        <NavLink href="#/" label="Accueil" active={route.length === 0} icon="play" />
        <NavGroup
          route={route}
          href="#/items"
          kind="item"
          label="Objets"
          entries={entriesOf("item")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavGroup
          route={route}
          href="#/cards"
          kind="card"
          label="Cartes"
          entries={entriesOf("card")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavGroup
          route={route}
          href="#/maps"
          kind="map"
          label="Plateaux"
          entries={entriesOf("map")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavGroup
          route={route}
          href="#/wheels"
          kind="wheel"
          label="Roues"
          entries={entriesOf("wheel")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavGroup
          route={route}
          href="#/systems"
          kind="system"
          label="Systèmes"
          entries={entriesOf("system")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavGroup
          route={route}
          href={refToHash("hub:shop")}
          kind="hub"
          label="Boutique & Duels"
          entries={entriesOf("hub")}
          onNavigate={() => setDrawerOpen(false)}
        />
        <NavLink href="#/matrix" label="Croisements" active={route[0] === "matrix"} icon="swords" />
      </div>
      <div className="wiki-nav__foot">
        <a className="btn btn--cup btn--small" href="./">
          <UiIcon name="arrowLeft" size={16} /> Retour au jeu
        </a>
      </div>
    </nav>
  );

  return (
    <div className="wiki">
      <header className="wiki-topbar">
        <button type="button" className="icon-button" onClick={() => setDrawerOpen(true)} aria-label="Menu">
          <UiIcon name="menu" />
        </button>
        <strong>Red Cups · Wiki</strong>
        <a className="icon-button" href="#/" aria-label="Accueil">
          <UiIcon name="info" />
        </a>
      </header>
      {drawerOpen && <div className="wiki-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside className={`wiki-side ${drawerOpen ? "is-open" : ""}`}>{sidebar}</aside>
      <main className="wiki-content">{page}</main>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  item: "Objet",
  card: "Carte",
  map: "Plateau",
  wheel: "Roue",
  system: "Système",
  hub: "Mécanique",
};

function entriesOf(kind: WikiEntry["kind"]): WikiEntry[] {
  return [...WIKI_ENTRIES.values()].filter((entry) => entry.kind === kind);
}

function renderPage(route: string[]) {
  if (route.length === 0) return <HomePage />;
  if (route.length === 1) {
    const [name] = route;
    if (name === "items")
      return (
        <ListPage
          kind="item"
          title="Objets"
          blurb="Vingt-quatre objets de la boutique au sac : prix, énergie, comportement complet et interactions."
        />
      );
    if (name === "cards")
      return (
        <ListPage
          kind="card"
          title="Cartes Actif & Passif"
          blurb="Chaque joueur tient un actif (le rôle qui le porte toute la partie) et un passif (le réflexe d'une situation)."
          filter={{
            options: [
              ["actif", "Actifs"],
              ["passif", "Passifs"],
            ],
          }}
        />
      );
    if (name === "maps")
      return (
        <ListPage
          kind="map"
          title="Plateaux"
          blurb="Trois tabliers, trois lois physiques : coffro à jouets, fête foraine et lac gelé."
        />
      );
    if (name === "wheels")
      return (
        <ListPage
          kind="wheel"
          title="Roues"
          blurb="Bonheur, malheur, Enfer : chaque secteur, sa vraie probabilité calculée depuis les poids du moteur."
        />
      );
    if (name === "systems")
      return (
        <ListPage
          kind="system"
          title="Systèmes"
          blurb="Les lois transverses que les fiches invoquent sans les répéter."
        />
      );
    if (name === "matrix") return <MatrixPage />;
    return <NotFound />;
  }
  const target = `${route[0]}:${route[1]}`;
  const entry = WIKI_ENTRIES.get(target);
  return entry ? <EntryPage entry={entry} /> : <NotFound />;
}

function NavLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: "play" | "swords" | "info";
}) {
  return (
    <a className={`wiki-nav__link ${active ? "is-active" : ""}`} href={href}>
      <UiIcon name={icon} size={18} /> {label}
    </a>
  );
}

/** A family header that expands to every entry when it owns the current route. */
function NavGroup({
  route,
  href,
  kind,
  label,
  entries,
  onNavigate,
}: {
  route: string[];
  href: string;
  kind: string;
  label: string;
  entries: WikiEntry[];
  onNavigate: () => void;
}) {
  const active = route[0] === kind || LIST_ALIASES[route[0] ?? ""] === kind;
  const [open, setOpen] = useState(active);
  useEffect(() => setOpen(active), [active]);
  return (
    <div className={`wiki-nav__group ${active ? "is-active" : ""}`}>
      <button
        type="button"
        className="wiki-nav__link"
        onClick={() => {
          setOpen((value) => !value);
          window.location.hash = href.slice(1);
          onNavigate();
        }}
      >
        {label}
        <small>{entries.length}</small>
        <UiIcon name={open ? "chevronUp" : "chevronDown"} size={15} />
      </button>
      {open && (
        <ul className="wiki-nav__entries">
          {entries.map((entry) => (
            <li key={entry.ref}>
              <a
                href={refToHash(entry.ref)}
                className={route.length > 1 && `${route[0]}:${route[1]}` === entry.ref ? "is-current" : ""}
                onClick={onNavigate}
              >
                <EntryIcon entry={entry} size={20} />
                <span>{entry.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** List routes are plural; entry routes name the kind: map both to the family. */
const LIST_ALIASES: Record<string, string> = {
  items: "item",
  cards: "card",
  maps: "map",
  wheels: "wheel",
  systems: "system",
};

/** Everything the search reads: titles, descriptions, section text, interaction sentences. */
function searchWiki(query: string): WikiEntry[] {
  const normalized = normalizeSearch(query);
  if (normalized.length === 0) return [];
  const scored: [number, WikiEntry][] = [];
  for (const entry of WIKI_ENTRIES.values()) {
    if (!cachedHaystacks.has(entry.ref)) cachedHaystacks.set(entry.ref, buildHaystack(entry));
    const haystack = cachedHaystacks.get(entry.ref)!;
    const title = normalizeSearch(entry.title);
    let score = 0;
    if (title === normalized) score = 100;
    else if (title.startsWith(normalized)) score = 60;
    else if (title.includes(normalized)) score = 40;
    else if (haystack.includes(normalized)) score = 20;
    if (score > 0) scored.push([score, entry]);
  }
  return scored
    .sort((left, right) => right[0] - left[0] || left[1].title.localeCompare(right[1].title, "fr"))
    .slice(0, 14)
    .map(([, entry]) => entry);
}

function buildHaystack(entry: WikiEntry): string {
  const texts = [
    entry.summary,
    entry.keywords ?? "",
    ...entry.sections.flatMap((section) => [section.title ?? "", ...section.body]),
    ...interactionsTextOf(entry.ref),
  ];
  return normalizeSearch(texts.join(" "));
}

function interactionsTextOf(target: string): string[] {
  return INTERACTIONS.filter((interaction) => interaction.a === target || interaction.b === target).map(
    (interaction) => interaction.text,
  );
}

/** One built haystack per entry, kept across renders. */
const cachedHaystacks = new Map<string, string>();
