import type { ReactNode } from "react";
import { UiIcon } from "../ui/icons/ui-icon";
import type { Report } from "./api";
import { StatusPill } from "./report-fields";
import { KIND_LABEL, formatDate } from "./report-labels";

/**
 * What a report card shows, for the visitor and for the admin alike: kind, element and status up top, then the
 * title and the description, then the team's note in a block of its own (never left in an input).
 */
export function ReportCard({
  report,
  author,
  actions,
  children,
}: {
  report: Report;
  /** The admin's line « sent by … »; absent on the visitor's own list. */
  author?: ReactNode;
  /** Buttons at the top right of the card (copy, edit). */
  actions?: ReactNode;
  /** What goes under the card's text: status steps, controls, editor. */
  children?: ReactNode;
}) {
  const edited = new Date(report.updatedAt).getTime() - new Date(report.createdAt).getTime() > 60_000;
  return (
    <article className={`report-item report-item--${report.status}`}>
      <header className="report-item__head">
        <span className={`badge badge--${report.kind}`}>{KIND_LABEL[report.kind]}</span>
        {report.element && <span className="badge badge--element">{report.element}</span>}
        <StatusPill status={report.status} />
        {actions && <div className="report-item__actions">{actions}</div>}
      </header>
      <h3 className="report-item__title">{report.title}</h3>
      <p className="report-item__message">{report.message}</p>
      <p className="report-item__meta">
        {author}
        <time dateTime={report.createdAt}>Envoyé le {formatDate(report.createdAt)}</time>
        {edited && <span>· mis à jour le {formatDate(report.updatedAt)}</span>}
      </p>
      {report.adminNote && <TeamNote note={report.adminNote} />}
      {children}
    </article>
  );
}

/** The team's note, shown in the card as a quote. */
export function TeamNote({ note }: { note: string }) {
  return (
    <blockquote className="team-note">
      <span className="team-note__label">
        <UiIcon name="info" size={15} /> Note de l’équipe
      </span>
      <p>{note}</p>
    </blockquote>
  );
}
