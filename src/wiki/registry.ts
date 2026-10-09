import {
  FREE_ITEM_POOL,
  ITEM_CATALOG,
  ITEM_ORDER,
  PASSIVE_CATALOG,
  PASSIVE_ORDER,
  WHEEL_RESULTS,
} from "../game/catalog";
import { CARD_KINDS, type CardKind } from "../game/cards";
import { MAP_ORDER, getBoardMap } from "../game/maps/map-registry";
import {
  HERMIT_DISTANCE,
  HERMIT_ENERGY_BONUS,
  HERMIT_START_BONUS,
  INSURER_HELL_REWARD,
  INSURER_RATE,
  INSURER_ROUND_CAP,
  MAGE_LUCK_RETURN_ROUNDS,
  MAGE_MAX_LUCK,
  MIME_COOLDOWN_ROUNDS,
  MIST_CYCLE_TURNS,
  MOLE_COOLDOWN_ROUNDS,
  MOLE_DIG_ENERGY,
  RULES_VERSION,
  SISTER_SWAP_COOLDOWN_ROUNDS,
  SISTER_SWAP_ENERGY,
  STARTING_CURRENCY,
} from "../game/types";
import type { ItemId, MapId, PassiveId, WheelId } from "../game/types";
import { percent } from "./format";
import { ITEM_SECTIONS } from "./content/items";
import { CARD_SECTIONS } from "./content/cards";
import { MAP_SECTIONS } from "./content/maps";
import { WHEEL_SECTIONS } from "./content/wheels";
import { HUB_SECTIONS } from "./content/hubs";
import { SYSTEM_ENTRIES } from "./content/systems";
import { INTERACTIONS } from "./content/interactions";
import type { Fact, Ref, WikiEntry } from "./types";
import { ref, refId, refKind } from "./types";

/**
 * Assemble le registre du wiki : les données VIVANTES du jeu (catalogues,
 * maps, constantes) fusionnées avec le contenu rédigé. Aucune valeur n'est
 * recopiée à la main : prix, poids des roues, graphes des plateaux et seuils
 * viennent du moteur lui-même.
 */

const TARGET_LABELS: Record<string, string> = {
  player: "Cible un joueur",
  self: "Sur soi",
  none: "Posé, sans cible",
  special: "Agit tout seul",
  road: "Cible une route",
};

const ITEM_SHOPS: Partial<Record<ItemId, string>> = {
  portal: "Boutique du diable",
  "hell-touch": "Boutique du diable",
  "black-cup": "Boutique du diable",
  sentence: "Boutique du diable",
  doomsday: "Boutique du diable",
  shield: "Boutique de l'Ange-Gardien",
  "made-in-heaven": "Boutique de Chance aveugle",
};

function itemFacts(itemId: ItemId): Fact[] {
  const item = ITEM_CATALOG[itemId];
  const facts: Fact[] = [];
  if (itemId === "boot") facts.push({ label: "100 → 400 pièces (prix montant)", tone: "gold" });
  else if (itemId === "mud") facts.push({ label: "200 pièces (100 Cupide/Piégeur)", tone: "gold" });
  else facts.push({ label: `${item.price.toLocaleString("fr-FR")} pièces`, tone: "gold" });
  facts.push({ label: item.energyCost === 0 ? "Sans énergie" : `${item.energyCost} points d'énergie`, tone: "sky" });
  facts.push({ label: TARGET_LABELS[item.target] ?? item.target, tone: "neutral" });
  if (item.stackLimit) facts.push({ label: `Pile de ${item.stackLimit}`, tone: "mint" });
  if (item.canTargetSelf) facts.push({ label: "Peut se cibler soi-même", tone: "mint" });
  facts.push({ label: ITEM_SHOPS[itemId] ?? "Boutique", tone: "grape" });
  if (FREE_ITEM_POOL.includes(itemId)) facts.push({ label: "Objet gratuit possible (roue du bonheur)", tone: "mint" });
  return facts;
}

/**
 * What the players read for each kind of card. The code keeps `actif` (saves and online rooms depend on the id), the
 * screens say « Cups Power » since patch 0.2.3. The list filter reads these labels too, in lower case.
 */
export const CARD_KIND_LABELS: Record<CardKind, string> = { actif: "Cups Power", passif: "Passif" };

/** The numbers that tell the Cups Power and passifs of patch 0.2.3 apart at a glance, read from the engine's constants. */
const PATCH_FACTS: Partial<Record<PassiveId, Fact[]>> = {
  mime: [
    { label: `Une copie tous les ${MIME_COOLDOWN_ROUNDS} tours`, tone: "grape" },
    { label: "Sans énergie", tone: "sky" },
  ],
  mole: [
    { label: `Creuser : ${MOLE_DIG_ENERGY} points d'énergie`, tone: "sky" },
    { label: `Tous les ${MOLE_COOLDOWN_ROUNDS} tours`, tone: "grape" },
  ],
  "black-mage": [
    { label: `${MAGE_MAX_LUCK} chances`, tone: "mint" },
    { label: `Une chance rendue tous les ${MAGE_LUCK_RETURN_ROUNDS} tours`, tone: "grape" },
  ],
  "half-seen": [{ label: `Invisible ${MIST_CYCLE_TURNS - 1} tours sur ${MIST_CYCLE_TURNS}`, tone: "grape" }],
  "ghost-sister": [
    {
      label: `Swap : ${SISTER_SWAP_ENERGY} points d'énergie, tous les ${SISTER_SWAP_COOLDOWN_ROUNDS} tours`,
      tone: "sky",
    },
  ],
  hermit: [
    { label: `Seul à plus de ${HERMIT_DISTANCE} cases`, tone: "grape" },
    { label: `+${HERMIT_ENERGY_BONUS} énergie`, tone: "sky" },
    { label: `+${HERMIT_START_BONUS} pièces au Départ`, tone: "gold" },
  ],
  insurer: [
    { label: `${percent(INSURER_RATE)} des pertes des autres`, tone: "gold" },
    { label: `Au plus ${INSURER_ROUND_CAP} pièces par tour de table`, tone: "grape" },
    { label: `+${INSURER_HELL_REWARD} pièces par descente en Enfer`, tone: "gold" },
  ],
};

function cardFacts(passiveId: PassiveId): Fact[] {
  const kind = CARD_KINDS[passiveId];
  const facts: Fact[] = [{ label: CARD_KIND_LABELS[kind], tone: kind === "actif" ? "cup" : "sky" }];
  if (passiveId === "devil" || passiveId === "guardian-angel")
    facts.push({ label: "Un seul par table", tone: "grape" });
  if (passiveId === "guardian-angel") facts.push({ label: "Tables de 4 joueurs et plus", tone: "mint" });
  if (passiveId === "lambda") facts.push({ label: "Cups Power de remplissage", tone: "neutral" });
  facts.push(...(PATCH_FACTS[passiveId] ?? []));
  return facts;
}

function mapFacts(mapId: MapId): Fact[] {
  const map = getBoardMap(mapId);
  const facts: Fact[] = [
    { label: `${map.nodes.length} cases`, tone: "neutral" },
    { label: `${map.edges.length} routes`, tone: "neutral" },
  ];
  const shops = map.nodes.filter((node) => node.kind === "shop").length;
  facts.push({ label: `${shops} boutiques`, tone: "grape" });
  facts.push({ label: `Première Red Cup en case ${map.initialCupNodeId}`, tone: "gold" });
  if (map.haunted) facts.push({ label: "Hanté par le fantôme", tone: "cup" });
  if (map.blizzardEveryRounds) facts.push({ label: `Blizzard tous les ${map.blizzardEveryRounds} tours`, tone: "sky" });
  if (map.snowballs) facts.push({ label: "Pingouins à boules de neige", tone: "sky" });
  return facts;
}

function wheelFacts(wheelId: WheelId): Fact[] {
  const results = WHEEL_RESULTS[wheelId];
  const total = results.reduce((sum, result) => sum + result.weight, 0);
  const facts: Fact[] = [{ label: `${results.length} secteurs (${total} parts égales)`, tone: "neutral" }];
  if (wheelId === "misfortune") facts.push({ label: "Variante à 2 secteurs pour l'Ange-Gardien", tone: "grape" });
  return facts;
}

function hubFacts(hubId: string): Fact[] {
  if (hubId === "shop")
    return [
      { label: `${Object.keys(ITEM_CATALOG).length} objets au catalogue`, tone: "gold" },
      { label: `S'ouvre en fin de marche (ou partout pour eShop)`, tone: "grape" },
    ];
  if (hubId === "duels")
    return [
      { label: "5 mini-jeux", tone: "grape" },
      { label: "Enjeu : la sortie de l'Enfer", tone: "gold" },
      { label: "Le fantôme a ses propres enjeux", tone: "cup" },
    ];
  return [];
}

const HUB_TITLES: Record<string, [string, string]> = {
  shop: ["La boutique", "Ce qui se vend, à quel prix, à qui, et les exceptions de chaque Cups Power et passif."],
  duels: ["Les duels", "Quand on se bat, contre qui, avec quel mini-jeu, et ce que ça change."],
};

function buildEntries(): Map<Ref, WikiEntry> {
  const entries = new Map<Ref, WikiEntry>();
  const add = (entry: WikiEntry) => entries.set(entry.ref, entry);

  for (const itemId of ITEM_ORDER) {
    const item = ITEM_CATALOG[itemId];
    add({
      ref: ref("item", itemId),
      kind: "item",
      title: item.name,
      summary: item.description,
      facts: itemFacts(itemId),
      sections: ITEM_SECTIONS[itemId] ?? [],
      keywords: `${item.description} ${itemId}`,
    });
  }

  for (const passiveId of PASSIVE_ORDER) {
    const card = PASSIVE_CATALOG[passiveId];
    const cardKind = CARD_KINDS[passiveId];
    // « actif » stays searchable next to « Cups Power » and « CP », whatever the screens call it.
    const aliases = cardKind === "actif" ? "actif cups power cp" : "passif";
    add({
      ref: ref("card", passiveId),
      kind: "card",
      title: card.name,
      subtitle: CARD_KIND_LABELS[cardKind],
      summary: card.description,
      facts: cardFacts(passiveId),
      sections: CARD_SECTIONS[passiveId] ?? [],
      keywords: `${card.description} ${passiveId} ${aliases}`,
    });
  }

  for (const mapId of MAP_ORDER) {
    const map = getBoardMap(mapId);
    add({
      ref: ref("map", mapId),
      kind: "map",
      title: map.name,
      subtitle: map.tagline,
      summary: map.highlights.join(" — "),
      facts: mapFacts(mapId),
      sections: MAP_SECTIONS[mapId] ?? [],
      keywords: `${map.tagline} ${map.highlights.join(" ")} ${mapId}`,
    });
  }

  for (const wheelId of Object.keys(WHEEL_RESULTS) as WheelId[]) {
    add({
      ref: ref("wheel", wheelId),
      kind: "wheel",
      title: WHEEL_TITLES[wheelId],
      summary: WHEEL_SUMMARIES[wheelId],
      facts: wheelFacts(wheelId),
      sections: WHEEL_SECTIONS[wheelId] ?? [],
      keywords: `${WHEEL_RESULTS[wheelId].map((result) => result.label).join(" ")} ${wheelId}`,
    });
  }

  for (const hubId of Object.keys(HUB_TITLES)) {
    const [title, summary] = HUB_TITLES[hubId];
    add({
      ref: ref("hub", hubId),
      kind: "hub",
      title,
      summary,
      facts: hubFacts(hubId),
      sections: HUB_SECTIONS[hubId] ?? [],
      keywords: `${title} ${summary}`,
    });
  }

  for (const entry of SYSTEM_ENTRIES) add(entry);

  return entries;
}

const WHEEL_TITLES: Record<WheelId, string> = {
  misfortune: "Roue du malheur",
  fortune: "Roue du bonheur",
  hell: "Roue de l'Enfer",
};

const WHEEL_SUMMARIES: Record<WheelId, string> = {
  misfortune: "Case rouge, Ndoye et Doomsday : huit secteurs, dont une vers l'Enfer.",
  fortune: "Case verte, Tour de Bénédiction : huit secteurs généreux, dont l'objet gratuit.",
  hell: "La roue qui remplace la marche en Enfer : sept secteurs, la Libération double part.",
};

export const WIKI_ENTRIES: Map<Ref, WikiEntry> = buildEntries();

/** Garde-fou de rédaction : chaque ref citée dans une interaction doit exister. */
export function assertContentIntegrity(): string[] {
  const missing: string[] = [];
  for (const interaction of INTERACTIONS) {
    if (interaction.text.length === 0) missing.push(`vide: ${interaction.a} ↔ ${interaction.b}`);
    for (const side of [interaction.a, interaction.b]) {
      if (!WIKI_ENTRIES.has(side)) missing.push(`ref inconnue: ${side}`);
    }
  }
  return missing;
}

export interface InteractionRow {
  otherRef: Ref;
  text: string;
}

/** Toutes les interactions d'un élément, groupées par côté opposé. */
export function interactionsOf(target: Ref): InteractionRow[] {
  const rows = new Map<Ref, string[]>();
  for (const interaction of INTERACTIONS) {
    const other = interaction.a === target ? interaction.b : interaction.b === target ? interaction.a : null;
    if (other === null || other === target) continue;
    rows.set(other, [...(rows.get(other) ?? []), interaction.text]);
  }
  return [...rows.entries()]
    .map(([otherRef, texts]) => ({ otherRef, text: texts.join(" ") }))
    .sort((left, right) => {
      const kindOrder = refKind(left.otherRef).localeCompare(refKind(right.otherRef));
      return kindOrder !== 0
        ? kindOrder
        : (WIKI_ENTRIES.get(left.otherRef)?.title ?? "").localeCompare(
            WIKI_ENTRIES.get(right.otherRef)?.title ?? "",
            "fr",
          );
    });
}

/** Une section par famille de partenaires (Cups Power et passifs, objets, systèmes…) pour la page fiche. */
export function groupInteractions(
  rows: InteractionRow[],
): { kind: ReturnType<typeof refKind>; rows: InteractionRow[] }[] {
  const groups = new Map<ReturnType<typeof refKind>, InteractionRow[]>();
  for (const row of rows) {
    const kind = refKind(row.otherRef);
    groups.set(kind, [...(groups.get(kind) ?? []), row]);
  }
  const order: ReturnType<typeof refKind>[] = ["item", "card", "map", "wheel", "hub", "system"];
  return order.filter((kind) => groups.has(kind)).map((kind) => ({ kind, rows: groups.get(kind)! }));
}

/** Le tableau « Croisements » : paires réparties par couples de types. */
export function interactionsMatrix(): { left: Ref; right: Ref; text: string }[] {
  return INTERACTIONS.map((interaction) => ({ left: interaction.a, right: interaction.b, text: interaction.text }));
}

export const WIKI_STATS = {
  items: ITEM_ORDER.length,
  cards: PASSIVE_ORDER.length,
  actifs: PASSIVE_ORDER.filter((id) => CARD_KINDS[id] === "actif").length,
  passifs: PASSIVE_ORDER.filter((id) => CARD_KINDS[id] === "passif").length,
  maps: MAP_ORDER.length,
  wheels: Object.keys(WHEEL_RESULTS).length,
  systems: SYSTEM_ENTRIES.length,
  interactions: INTERACTIONS.length,
  rulesVersion: RULES_VERSION,
  startingCurrency: STARTING_CURRENCY,
};

export { refId, refKind };
