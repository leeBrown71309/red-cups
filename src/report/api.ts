import { getSupabase } from "../net/supabase-client";
import { getReportClient } from "./client";

/**
 * Everything the reporting page asks of the database, through the definer
 * functions of `supabase/schema.sql`: the visitor never touches a table.
 *
 * The visitor's side goes through the game's own Supabase client, so the Google
 * account of the game is the one the page knows. The admin's side keeps its own
 * session (see `client.ts`).
 */

export type ReportKind = "bug" | "idea" | "other";
export type ReportStatus = "new" | "in_progress" | "fixed" | "rejected";

export interface ReportDraft {
  kind: ReportKind;
  element: string;
  title: string;
  message: string;
}

export interface Report extends ReportDraft {
  id: string;
  status: ReportStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

/** What the admin sees on top: who sent it, when they were signed in with an account. */
export interface AdminReport extends Report {
  reporterName: string;
  reporterEmail: string;
}

interface RawReport {
  id: string;
  kind: ReportKind;
  element: string | null;
  title: string;
  message: string;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface RawAdminReport extends RawReport {
  reporter_name: string | null;
  reporter_email: string | null;
}

function toReport(row: RawReport): Report {
  return {
    id: row.id,
    kind: row.kind,
    element: row.element ?? "",
    title: row.title,
    message: row.message,
    status: row.status,
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function toAdminReport(row: RawAdminReport): AdminReport {
  return { ...toReport(row), reporterName: row.reporter_name ?? "", reporterEmail: row.reporter_email ?? "" };
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

// ---------------------------------------------------------------- the visitor

export async function submitReport(draft: ReportDraft): Promise<void> {
  const { error } = await getSupabase().rpc("submit_report", {
    p_kind: draft.kind,
    p_element: draft.element,
    p_title: draft.title,
    p_message: draft.message,
    // No SMTP on the project: the page cannot promise an email answer, so it asks for no contact.
    p_contact_email: null,
  });
  if (error) throw new Error(error.message);
}

/** The reports of the signed-in account, the newest first. */
export async function listMyReports(): Promise<Report[]> {
  const { data, error } = await getSupabase().rpc("list_my_reports");
  if (error) throw new Error(error.message);
  return asRows<RawReport>(data).map(toReport);
}

/** Corrects one of the account's own reports; the database refuses once the team has taken it up. */
export async function updateMyReport(id: string, draft: ReportDraft): Promise<void> {
  const { error } = await getSupabase().rpc("update_my_report", {
    p_id: id,
    p_kind: draft.kind,
    p_element: draft.element,
    p_title: draft.title,
    p_message: draft.message,
  });
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ the admin

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

export async function listReports(): Promise<AdminReport[]> {
  const { data, error } = await getReportClient().rpc("list_reports");
  if (error) throw new Error(error.message);
  return asRows<RawAdminReport>(data).map(toAdminReport);
}

export async function setReportStatus(id: string, status: ReportStatus, note: string): Promise<void> {
  const { error } = await getReportClient().rpc("set_report_status", { p_id: id, p_status: status, p_note: note });
  if (error) throw new Error(error.message);
}
