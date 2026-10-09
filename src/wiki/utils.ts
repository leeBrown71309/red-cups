/** Small shared helpers for the wiki: search normalisation and hash routing. */

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `item:rope` ↔ `#/item/rope` — the wiki routes live in the hash. */
export function refToHash(value: string): string {
  const [kind, id] = value.split(":");
  return `#/${kind}/${id}`;
}

export function hashToRef(hash: string): string[] {
  return hash.replace(/^#\//, "").split("/").filter(Boolean);
}
