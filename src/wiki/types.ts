/**
 * The wiki's data model. Entries are assembled in `registry.ts` from the game's
 * own catalog data (so names, prices and boards stay in sync) plus the curated
 * sections and interactions written from a read of the engine's code.
 */

export type EntryKind = "item" | "card" | "map" | "wheel" | "system" | "hub";

/** Every element of the game has a ref: `item:rope`, `card:devil`, `map:classic`, `wheel:hell`, `system:hell`, `hub:shop`. */
export type Ref = string;

export const ref = (kind: EntryKind, id: string): Ref => `${kind}:${id}`;

export const refKind = (value: Ref): EntryKind => value.split(":")[0] as EntryKind;

export const refId = (value: Ref): string => value.slice(value.indexOf(":") + 1);

/** Badges under an entry's title: price, energy, role, shop, board… */
export interface Fact {
  label: string;
  tone?: "gold" | "sky" | "grape" | "mint" | "cup" | "neutral";
}

export interface ContentSection {
  /** Omitted for the opening section. */
  title?: string;
  /** Paragraphs. A line starting with "• " is rendered as a bullet. */
  body: string[];
}

export interface WikiEntry {
  ref: Ref;
  kind: EntryKind;
  title: string;
  /** One line under the title: role of a card, tagline of a map… */
  subtitle?: string;
  /** The general description, shown first on the page. */
  summary: string;
  facts: Fact[];
  sections: ContentSection[];
  /** Extra words the search should match (never shown). */
  keywords?: string;
}

/** How two elements of the game interact; shown on both pages and on the matrix. */
export interface Interaction {
  a: Ref;
  b: Ref;
  text: string;
}

export const KIND_LABELS: Record<EntryKind, string> = {
  item: "Objet",
  card: "Cups Power / passif",
  map: "Plateau",
  wheel: "Roue",
  system: "Système",
  hub: "Mécanique",
};
