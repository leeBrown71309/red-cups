import { Fragment, type ReactNode } from "react";
import { WIKI_ENTRIES } from "../registry";
import { refToHash } from "../utils";

/**
 * Renders text with `[[kind:id]]` or `[[kind:id|label]]` references as links
 * to the linked element's page. Unknown refs render as plain labels.
 */
export function RichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /\[\[(item|card|map|wheel|hub|system):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(<Fragment key={cursor}>{text.slice(cursor, match.index)}</Fragment>);
    const target = `${match[1]}:${match[2]}`;
    const label = match[3] ?? WIKI_ENTRIES.get(target)?.title ?? target;
    nodes.push(
      WIKI_ENTRIES.has(target) ? (
        <a key={`${target}-${match.index}`} className="wiki-link" href={refToHash(target)}>
          {label}
        </a>
      ) : (
        <span key={`${target}-${match.index}`} className="wiki-link wiki-link--missing">
          {label}
        </span>
      ),
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(<Fragment key={cursor}>{text.slice(cursor)}</Fragment>);
  return <>{nodes}</>;
}

/** The same, for plain strings without markup. A leading "• " is dropped: the list draws its own marker. */
export function RichList({ items }: { items: string[] }) {
  return (
    <ul className="wiki-bullets">
      {items.map((item) => (
        <li key={item}>
          <RichText text={item.replace(/^• /, "")} />
        </li>
      ))}
    </ul>
  );
}
