import { getReportClient } from "./client";

/**
 * Everything the reporting page asks of the database, through the definer
 * functions of `supabase/schema.sql`: the visitor never touches a table.
 */

export type ReportKind = "bug" | "idea" | "other";
export type ReportStatus = "new" | "in_progress" | "fixed" | "rejected";

export interface ReportDraft {
  kind: ReportKind;
  element: string;
  title: string;
  message: string;
  contactEmail: string;
}

export interface Report extends ReportDraft {
  id: string;
  status: ReportStatus;
  adminNote: string;
  createdAt: string;
}

export async function submitReport(draft: ReportDraft): Promise<void> {
  const { error } = await getReportClient().rpc("submit_report", {
    p_kind: draft.kind,
    p_element: draft.element,
    p_title: draft.title,
    p_message: draft.message,
    p_contact_email: draft.contactEmail || null,
  });
  if (error) throw new Error(error.message);
}

/** The admin's own account, kept apart from the game's sessions. It is provisioned by `scripts/create-admin.ts`. */
export async function adminSignIn(email: string, password: string): Promise<void> {
  const { error } = await getReportClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      throw new Error("Le compte existe, mais son email n’est pas confirmé : relance le script de création du compte.");
    }
    throw new Error("Email ou mot de passe incorrect.");
  }
}

export async function adminSignOut(): Promise<void> {
  await getReportClient().auth.signOut({ scope: "local" });
}

export async function listReports(): Promise<Report[]> {
  const { data, error } = await getReportClient().rpc("list_reports");
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as RawReport[]) : [];
  return rows.map(toReport);
}

interface RawReport {
  id: string;
  kind: ReportKind;
  element: string | null;
  title: string;
  message: string;
  contact_email: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
}

function toReport(row: RawReport): Report {
  return {
    id: row.id,
    kind: row.kind,
    element: row.element ?? "",
    title: row.title,
    message: row.message,
    contactEmail: row.contact_email ?? "",
    status: row.status,
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
  };
}

export async function setReportStatus(id: string, status: ReportStatus, note: string): Promise<void> {
  const { error } = await getReportClient().rpc("set_report_status", { p_id: id, p_status: status, p_note: note });
  if (error) throw new Error(error.message);
}
