import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getWheelResults } from "../../game/catalog";
import type { MapId, WheelId } from "../../game/types";
import { getBoardMap } from "../../game/maps/map-registry";
import { BoardMap } from "../../ui/components/board-map";
import { UiIcon } from "../../ui/icons/ui-icon";
import { CoinIcon } from "../../ui/icons/item-icon";
import { GameLogo } from "../../ui/components/game-logo";
import { isPositiveOutcome } from "../../ui/display/game-display";
import type { Fact, Ref, WikiEntry } from "../types";
import { KIND_LABELS } from "../types";
import { WIKI_ENTRIES, WIKI_STATS, groupInteractions, interactionsMatrix, interactionsOf, refKind } from "../registry";
import { normalizeSearch, refToHash } from "../utils";
import { EntryIcon } from "./entry-icon";
import { RichList, RichText } from "./rich-text";

/** Tone-colored chips of an entry's facts. */
export function FactChips({ facts }: { facts: Fact[] }) {
  return (
    <div className="wiki-facts">
      {facts.map((fact) => (
        <span key={fact.label} className={`wiki-fact wiki-fact--${fact.tone ?? "neutral"}`}>
          {fact.tone === "gold" && <CoinIcon size={13} />}
          {fact.label}
        </span>
      ))}
    </div>
  );
}

/** A linked pill to another wiki element. */
export function EntityPill({ target }: { target: Ref }) {
  const entry = WIKI_ENTRIES.get(target);
  if (!entry) return null;
  return (
    <a className="wiki-pill" href={refToHash(target)}>
      <EntryIcon entry={entry} size={22} />
      {entry.title}
    </a>
  );
}

/** Compact card used in every listing grid. */
export function SectionCard({ entry }: { entry: WikiEntry }) {
  return (
    <a className="wiki-card panel" href={refToHash(entry.ref)}>
      <span className="wiki-card__icon">
        <EntryIcon entry={entry} size={40} />
      </span>
      <span className="wiki-card__title">
        {entry.title}
        {entry.subtitle && <small>{entry.subtitle}</small>}
      </span>
      <span className="wiki-card__excerpt">{entry.summary}</span>
      <FactChips facts={entry.facts.slice(0, 3)} />
    </a>
  );
}

/** Home: what the wiki holds, how to read it, where to dive. */
export function HomePage() {
  const tiles: { href: string; title: string; blurb: string; count: number }[] = [
    {
      href: "#/items",
      title: "Objets",
      blurb: "Les 24 objets du catalogue : prix, énergie, comportement complet.",
      count: WIKI_STATS.items,
    },
    {
      href: "#/cards",
      title: "Cups Power & passifs",
      blurb: "Rôles, pouvoirs, victoires propres, exceptions de règle : ce que chacun porte toute la partie.",
      count: WIKI_STATS.cards,
    },
    {
      href: "#/maps",
      title: "Plateaux",
      blurb: "Plans, cases, routes et règles propres à chaque carte.",
      count: WIKI_STATS.maps,
    },
    {
      href: "#/wheels",
      title: "Roues",
      blurb: "Secteurs, probabilités réelles, Cups Power et passifs qui les trichent.",
      count: WIKI_STATS.wheels,
    },
    {
      href: refToHash("hub:shop"),
      title: "Boutique",
      blurb: "Rayons, prix mouvants, vols, reventes, panier gratuit.",
      count: 0,
    },
    {
      href: refToHash("hub:duels"),
      title: "Duels",
      blurb: "Enfer, défis, fantôme : cinq mini-jeux et leurs enjeux.",
      count: 0,
    },
    {
      href: "#/systems",
      title: "Systèmes",
      blurb: "Tour, marche, Enfer, Red Cup, draft, en ligne…",
      count: WIKI_STATS.systems,
    },
    {
      href: "#/matrix",
      title: "Croisements",
      blurb: "Qui change quoi chez qui : la matrice d'interactions.",
      count: WIKI_STATS.interactions,
    },
  ];
  return (
    <div className="wiki-home">
      <header className="wiki-hero panel">
        <GameLogo />
        <h1>Le wiki Red Cups</h1>
        <p className="wiki-hero__lead">
          Tout ce que le code du jeu sait sur ses éléments : chaque objet, chaque Cups Power et chaque passif, chaque
          plateau, chaque roue — et exactement comment ils interagissent les uns avec les autres. Les prix, poids et
          graphes viennent <strong>directement du moteur</strong> : cette page est toujours à jour avec le jeu.
        </p>
        <div className="wiki-facts">
          <span className="wiki-fact wiki-fact--gold">Règles {WIKI_STATS.rulesVersion}</span>
          <span className="wiki-fact wiki-fact--sky">{WIKI_STATS.items} objets</span>
          <span className="wiki-fact wiki-fact--cup">{WIKI_STATS.actifs} Cups Power</span>
          <span className="wiki-fact wiki-fact--mint">{WIKI_STATS.passifs} passifs</span>
          <span className="wiki-fact wiki-fact--grape">{WIKI_STATS.maps} plateaux</span>
          <span className="wiki-fact wiki-fact--neutral">{WIKI_STATS.interactions} interactions recensées</span>
        </div>
      </header>
      <div className="wiki-tiles">
        {tiles.map((tile) => (
          <a key={tile.href} className="wiki-tile panel" href={tile.href}>
            <strong>{tile.title}</strong>
            <span>{tile.blurb}</span>
            {tile.count > 0 && <small>{tile.count}</small>}
          </a>
        ))}
      </div>
      <p className="wiki-note">
        Astuce : sur chaque fiche, les noms soulignés d'un paragraphe mènent à la fiche de ce dont il parle. Pour
        revenir au jeu :{" "}
        <a className="wiki-link" href="./">
          index.html
        </a>
        .
      </p>
    </div>
  );
}

function entriesOfKind(kind: WikiEntry["kind"]): WikiEntry[] {
  return [...WIKI_ENTRIES.values()].filter((entry) => entry.kind === kind);
}

/** Generic grid listing for a whole family (items, cards, maps, wheels, systems). */
export function ListPage({
  kind,
  title,
  blurb,
  filter,
  placeholder,
}: {
  kind: WikiEntry["kind"];
  title: string;
  blurb: string;
  filter?: { options: [string, string][] };
  /** The search box's hint; the lower-cased title when omitted. */
  placeholder?: string;
}) {
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    const normalized = normalizeSearch(query);
    return entriesOfKind(kind).filter((entry) => {
      if (filter && active !== "all" && !entry.facts.some((fact) => fact.label.toLowerCase() === active)) return false;
      if (!normalized) return true;
      return normalizeSearch(
        `${entry.title} ${entry.subtitle ?? ""} ${entry.summary} ${entry.keywords ?? ""}`,
      ).includes(normalized);
    });
  }, [kind, active, query, filter]);
  return (
    <div className="wiki-list">
      <h1>{title}</h1>
      <p className="wiki-blurb">{blurb}</p>
      {filter && (
        <div className="segmented segmented--compact" role="group" aria-label="Filtrer">
          <button
            type="button"
            className={`segmented__option ${active === "all" ? "is-active" : ""}`}
            onClick={() => setActive("all")}
          >
            Toutes
          </button>
          {filter.options.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`segmented__option ${active === id ? "is-active" : ""}`}
              onClick={() => setActive(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="wiki-search wiki-search--inline">
        <UiIcon name="target" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder ?? `Filtrer ${title.toLowerCase()}…`}
          type="search"
        />
      </label>
      {entries.length === 0 ? (
        <p className="wiki-empty">Rien ne correspond à « {query} ».</p>
      ) : (
        <div className="wiki-grid">
          {entries.map((entry) => (
            <SectionCard key={entry.ref} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The full detail page for one element, whatever its family. */
export function EntryPage({ entry }: { entry: WikiEntry }) {
  const rows = interactionsOf(entry.ref);
  const groups = groupInteractions(rows);
  return (
    <article className="wiki-entry">
      <header className="wiki-entry__head panel">
        <span className="wiki-entry__icon">
          <EntryIcon entry={entry} size={64} />
        </span>
        <div className="wiki-entry__titles">
          <small className="eyebrow">{KIND_LABELS[entry.kind]}</small>
          <h1>{entry.title}</h1>
          {entry.subtitle && <p className="wiki-entry__subtitle">{entry.subtitle}</p>}
          <FactChips facts={entry.facts} />
        </div>
      </header>

      <p className="wiki-entry__summary">{entry.summary}</p>

      {entry.kind === "map" && <MapExtras refValue={entry.ref} />}
      {entry.kind === "wheel" && <WheelExtras refValue={entry.ref} />}

      {entry.sections.map((section) => (
        <section key={section.title ?? "lead"} className="wiki-section panel">
          {section.title && <h2>{section.title}</h2>}
          <RichList items={section.body} />
        </section>
      ))}

      {groups.length > 0 && (
        <section className="wiki-section wiki-section--interactions panel">
          <h2>
            <UiIcon name="swords" size={20} /> Interactions ({rows.length})
          </h2>
          <p className="wiki-blurb">Ce qui touche cet élément, et ce qu'il touche en retour.</p>
          {groups.map((group) => (
            <div key={group.kind} className="wiki-intergroup">
              <h3>avec {PLURAL_LABELS[group.kind]}</h3>
              <ul className="wiki-interlist">
                {group.rows.map((row) => (
                  <li key={row.otherRef}>
                    <EntityPill target={row.otherRef} />
                    <RichText text={row.text} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

const PLURAL_LABELS: Record<string, string> = {
  item: "objets",
  card: "Cups Power & passifs",
  map: "plateaux",
  wheel: "roues",
  hub: "mécaniques",
  system: "systèmes",
};

/** Board plan + tiles + roads of a map, built from the live map data. */
function MapExtras({ refValue }: { refValue: Ref }) {
  const mapId = refValue.slice(refValue.indexOf(":") + 1) as MapId;
  const map = getBoardMap(mapId);
  const arrows = map.edges.filter((edge) => edge.arrow);
  const tunnels = map.edges.filter((edge) => edge.kind === "tunnel");
  const carousels = map.edges.filter((edge) => edge.kind === "carousel");
  const plain = map.edges.filter((edge) => !edge.arrow && !edge.kind);
  const kindTitles: Record<string, string> = {
    start: "Départ",
    shop: "Boutique",
    red: "Rouge",
    green: "Verte",
    neutral: "Neutre",
    hell: "Enfer",
  };
  return (
    <>
      <section className="wiki-section panel">
        <h2>Le plateau</h2>
        <div className="wiki-board-wrap">
          <BoardMap mapId={mapId} carouselReversed={false} />
        </div>
        <p className="wiki-blurb">{map.tagline} Le plan est dessiné avec les coordonnées réelles du plateau de jeu.</p>
      </section>
      <section className="wiki-section panel">
        <h2>Les cases</h2>
        <div className="wiki-table-wrap">
          <table className="wiki-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Type</th>
                <th>Rôle</th>
              </tr>
            </thead>
            <tbody>
              {map.nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <strong>{node.id}</strong>
                  </td>
                  <td>{kindTitles[node.kind] ?? node.kind}</td>
                  <td>
                    {node.kind === "start"
                      ? "Le Départ : +200 en y entrant par la flèche qui le vise"
                      : node.kind === "shop"
                        ? "Boutique en fin de marche"
                        : node.kind === "green"
                          ? "Roue du bonheur à l'arrêt"
                          : node.kind === "red"
                            ? "Roue du malheur à l'arrêt"
                            : node.kind === "hell"
                              ? "Enfer — jamais atteinte à pied"
                              : node.ice
                                ? "Glace : on y glisse au hasard"
                                : "Aucun effet"}
                    {node.ice && node.kind !== "neutral" ? " (glace)" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="wiki-section panel">
        <h2>Les routes</h2>
        <RichList
          items={
            [
              plain.length > 0 && `• Chemins libres : ${plain.map((edge) => `${edge.from} ⇄ ${edge.to}`).join(", ")}.`,
              arrows.length > 0 &&
                `• Flèches (sortie imposée) : ${arrows.map((edge) => `${edge.from} → ${edge.to}`).join(", ")}.`,
              tunnels.length > 0 &&
                `• ${map.tunnelName} (un seul pas, sens unique) : ${tunnels.map((edge) => `${edge.from} → ${edge.to}`).join(", ")}.`,
              carousels.length > 0 &&
                `• Carrousel (sens unique, inversé à chaque Cup) : ${carousels.map((edge) => `${edge.from} → ${edge.to}`).join(", ")}.`,
            ].filter(Boolean) as string[]
          }
        />
        <RichList items={map.roadLegend.map((entry) => `• ${entry.title} — ${entry.description}`)} />
      </section>
    </>
  );
}

/** Wedge table with the REAL probabilities, straight from WHEEL_RESULTS. */
function WheelExtras({ refValue }: { refValue: Ref }) {
  const wheelId = refValue.slice(refValue.indexOf(":") + 1) as WheelId;
  const results = getWheelResults(wheelId);
  const total = results.reduce((sum, result) => sum + result.weight, 0);
  return (
    <section className="wiki-section panel">
      <h2>Les secteurs et leurs vraies chances</h2>
      <div className="wiki-table-wrap">
        <table className="wiki-table">
          <thead>
            <tr>
              <th>Secteur</th>
              <th>Parts</th>
              <th>Chance</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className={isPositiveOutcome(result.id) ? "is-good" : "is-bad"}>
                <td>
                  <RichText text={result.label} />
                </td>
                <td>{result.weight}</td>
                <td>{((result.weight / total) * 100).toFixed(1)} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {wheelId === "misfortune" && (
        <p className="wiki-note">
          La roue du malheur n'a pas la même tête pour un Ange-Gardien : elle ne tire alors que « Passe ton prochain
          tour » ou « Rien du tout », un secteur chacun.
        </p>
      )}
      {wheelId === "hell" && (
        <p className="wiki-note">
          Deux secteurs pèsent double : « −100 pièces » et « Libération » (2 parts sur 9 chacun).
        </p>
      )}
    </section>
  );
}

/**
 * The matrix: every interaction, grouped by family pair, as an accordion —
 * sections stay folded until opened, a text filter auto-opens the matches.
 */
export function MatrixPage() {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const rows = interactionsMatrix();
  const matched = useMemo(() => {
    const normalized = normalizeSearch(query);
    return rows
      .map((row) => {
        const from = WIKI_ENTRIES.get(row.left);
        const to = WIKI_ENTRIES.get(row.right);
        if (!from || !to) return null;
        if (normalized && !normalizeSearch(`${from.title} ${to.title} ${row.text}`).includes(normalized)) return null;
        const family = [refKind(row.left), refKind(row.right)].sort().join(":");
        return { ...row, family, from, to };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [rows, query]);

  const grouped = new Map<string, typeof matched>();
  for (const row of matched) {
    grouped.set(row.family, [...(grouped.get(row.family) ?? []), row]);
  }
  const families = [...grouped.entries()].sort((left, right) => right[1].length - left[1].length);

  // A new filter resets the manual toggles: matching sections open by default again.
  useEffect(() => setManual({}), [query]);
  const isOpen = (family: string) => manual[family] ?? query.trim().length > 0;

  return (
    <div className="wiki-matrix">
      <h1>Croisements</h1>
      <p className="wiki-blurb">
        Les {WIKI_STATS.interactions} interactions recensées, groupées par famille. Ouvre une section pour la lire, ou
        cherche un nom (« Boue », « Corde », « Banquise »…) : les sections touchées se déploient d'elles-mêmes.
      </p>
      <label className="wiki-search wiki-search--inline">
        <UiIcon name="recenter" size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrer…" type="search" />
      </label>
      {families.map(([family, rowsOfFamily]) => {
        const open = isOpen(family);
        const [a, b] = family.split(":");
        return (
          <section key={family} className={`wiki-acc panel ${open ? "is-open" : ""}`}>
            <button
              type="button"
              className="wiki-acc__head"
              aria-expanded={open}
              onClick={() => setManual((current) => ({ ...current, [family]: !open }))}
            >
              <span>
                {PLURAL_LABELS[a]} ↔ {PLURAL_LABELS[b]}
              </span>
              <small>{rowsOfFamily.length}</small>
              <UiIcon name="chevronDown" size={18} className="wiki-acc__chevron" />
            </button>
            {open && (
              <ul className="wiki-matrixlist">
                {rowsOfFamily.map((row, index) => (
                  <li key={`${row.left}-${row.right}-${index}`}>
                    <span className="wiki-matrixpair">
                      <EntityPill target={row.left} />
                      <span className="wiki-matrixarrow" aria-hidden="true">
                        ↔
                      </span>
                      <EntityPill target={row.right} />
                    </span>
                    <RichText text={row.text} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {grouped.size === 0 && <p className="wiki-empty">Aucune interaction ne correspond à « {query} ».</p>}
    </div>
  );
}

/** Small helper so pages can render a plain title with an icon for unknown routes. */
export function NotFound(): ReactNode {
  return (
    <div className="wiki-list">
      <h1>Cette page n'existe pas (encore)</h1>
      <p className="wiki-blurb">
        Un élément du jeu a peut-être changé de nom.{" "}
        <a className="wiki-link" href="#/">
          Retour à l'accueil
        </a>
        .
      </p>
    </div>
  );
}
