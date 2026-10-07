import { WIKI_ENTRIES } from "../wiki/registry";

/**
 * The game elements offered to the report form, read from the wiki registry:
 * every item, card, board, wheel and mechanic the reference knows about is
 * reportable, and a new entry of the game appears here by itself.
 */
export interface ElementGroup {
  label: string;
  options: string[];
}

const GROUP_ORDER: [kind: string, label: string][] = [
  ["item", "Objets"],
  ["card", "Cartes"],
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
