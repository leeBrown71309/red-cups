import type { ReportKind, ReportStatus } from "./api";

/** The words of the reporting page, shared by the visitor's side and the admin's. */

export const KIND_LABEL: Record<ReportKind, string> = { bug: "Bug", idea: "Amélioration", other: "Autre" };
export const KIND_TAG: Record<ReportKind, string> = { bug: "BUG", idea: "IDÉE", other: "AUTRE" };

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  fixed: "Corrigé",
  rejected: "Rejeté",
};

/** What a status means for the person who sent the report. */
export const STATUS_MEANING: Record<ReportStatus, string> = {
  new: "Reçu : personne ne l’a encore regardé. Tu peux encore le corriger.",
  in_progress: "L’équipe s’en occupe.",
  fixed: "C’est réglé : la correction arrive dans une version du jeu.",
  rejected: "L’équipe ne donnera pas suite. Sa note explique pourquoi.",
};

export const STATUS_ORDER: ReportStatus[] = ["new", "in_progress", "fixed", "rejected"];

export type StatusFilter = "all" | ReportStatus;

export const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "Tous",
  new: "Nouveaux",
  in_progress: "En cours",
  fixed: "Corrigés",
  rejected: "Rejetés",
};

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const TITLE_MIN = 3;
export const MESSAGE_MIN = 10;

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Counts of reports per status, plus the total under `all`. */
export function countByStatus(reports: { status: ReportStatus }[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: reports.length, new: 0, in_progress: 0, fixed: 0, rejected: 0 };
  for (const report of reports) counts[report.status] += 1;
  return counts;
}
