import { WIKI_ENTRIES } from "../wiki/registry";

/**
 * The game elements offered to the report form, read from the wiki registry:
 * every item, card, board, wheel and mechanic the reference knows about is
 * reportable, and a new entry of the game appears here by itself.
 */
export interface ElementOption {
  name: string;
  group: string;
}

export interface ElementGroup {
  label: string;
  options: string[];
}

const GROUP_ORDER: [kind: string, label: string][] = [
  ["item", "Objets"],
  ["card", "Cups Power & passifs"],
  ["map", "Plateaux"],
  ["wheel", "Roues"],
  ["system", "Systèmes"],
  ["hub", "Boutique & Duels"],
];

export const ELEMENT_GROUPS: ElementGroup[] = GROUP_ORDER.map(([kind, label]) => ({
  label,
  options: [...WIKI_ENTRIES.values()]
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.title)
    .sort((left, right) => left.localeCompare(right, "fr")),
}));

/** Flat view of the same catalogue, for the form's autocomplete search. */
export const ELEMENT_OPTIONS: ElementOption[] = ELEMENT_GROUPS.flatMap((group) =>
  group.options.map((name) => ({ name, group: group.label })),
);

/** Lowercase and without accents, so « barrier » finds « Barrière ». */
export function normalizeElementText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
