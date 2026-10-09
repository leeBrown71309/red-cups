import { describe, expect, it } from "vitest";
import { CARD_KINDS } from "../game/cards";
import { PASSIVE_ORDER } from "../game/catalog";
import type { PassiveId } from "../game/types";
import { INTERACTIONS } from "./content/interactions";
import { CARD_KIND_LABELS, WIKI_ENTRIES, assertContentIntegrity } from "./registry";

/** The seven elements of patch 0.2.3: each one owns a detail page and a set of interactions. */
const CUPS_POWER_PATCH_IDS: PassiveId[] = [
  "mime",
  "mole",
  "black-mage",
  "half-seen",
  "ghost-sister",
  "hermit",
  "insurer",
];

const REFERENCE_PATTERN = /\[\[(item|card|map|wheel|hub|system):([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g;

/** Every `[[kind:id]]` a written text points at. */
function findReferences(text: string): string[] {
  return [...text.matchAll(REFERENCE_PATTERN)].map((match) => `${match[1]}:${match[2]}`);
}

describe("wiki content", () => {
  it("every interaction names two known elements and says something", () => {
    expect(assertContentIntegrity()).toEqual([]);
  });

  it("every [[ref]] written in a section or an interaction points at a known entry", () => {
    const unknown: string[] = [];
    for (const entry of WIKI_ENTRIES.values()) {
      for (const section of entry.sections) {
        for (const line of section.body) {
          for (const target of findReferences(line)) {
            if (!WIKI_ENTRIES.has(target)) unknown.push(`${entry.ref}: ${target}`);
          }
        }
      }
    }
    for (const interaction of INTERACTIONS) {
      for (const target of findReferences(interaction.text)) {
        if (!WIKI_ENTRIES.has(target)) unknown.push(`${interaction.a} ↔ ${interaction.b}: ${target}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("no section repeats a line (the page keys its bullets by their text)", () => {
    const repeated: string[] = [];
    for (const entry of WIKI_ENTRIES.values()) {
      for (const section of entry.sections) {
        const seen = new Set<string>();
        for (const line of section.body) {
          if (seen.has(line)) repeated.push(`${entry.ref}: ${line.slice(0, 60)}`);
          seen.add(line);
        }
      }
    }
    expect(repeated).toEqual([]);
  });

  it("every Cups Power and passif has a detail page of its own", () => {
    const missing = PASSIVE_ORDER.filter(
      (passiveId) => (WIKI_ENTRIES.get(`card:${passiveId}`)?.sections.length ?? 0) === 0,
    );
    expect(missing).toEqual([]);
  });

  it.each(CUPS_POWER_PATCH_IDS)("%s is described and crossed with the rest of the game", (passiveId) => {
    const entry = WIKI_ENTRIES.get(`card:${passiveId}`);
    expect(entry).toBeDefined();
    expect(entry?.sections.length).toBeGreaterThan(0);
    const crossings = INTERACTIONS.filter(
      (interaction) => interaction.a === `card:${passiveId}` || interaction.b === `card:${passiveId}`,
    );
    expect(crossings.length).toBeGreaterThanOrEqual(8);
  });

  it("the list filter reads the same labels as the facts of every card", () => {
    for (const passiveId of PASSIVE_ORDER) {
      const entry = WIKI_ENTRIES.get(`card:${passiveId}`);
      const label = CARD_KIND_LABELS[CARD_KINDS[passiveId]];
      expect(entry?.facts.some((fact) => fact.label.toLowerCase() === label.toLowerCase())).toBe(true);
    }
  });

  it("calls the actifs « Cups Power » and never « carte » for a card", () => {
    expect(CARD_KIND_LABELS.actif).toBe("Cups Power");
    expect(CARD_KIND_LABELS.passif).toBe("Passif");
    const wording: string[] = [];
    for (const entry of WIKI_ENTRIES.values()) {
      const texts = [entry.summary, ...entry.sections.flatMap((section) => section.body)];
      for (const text of texts) {
        if (/\bactifs?\b/i.test(text)) wording.push(`${entry.ref}: ${text.slice(0, 80)}`);
      }
    }
    for (const interaction of INTERACTIONS) {
      if (/\bactifs?\b/i.test(interaction.text)) wording.push(`${interaction.a} ↔ ${interaction.b}`);
    }
    expect(wording).toEqual([]);
  });
});
