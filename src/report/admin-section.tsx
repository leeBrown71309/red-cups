import { useEffect, useMemo, useState } from "react";
import { UiIcon } from "../ui/icons/ui-icon";
import { adminSignIn, adminSignOut, listReports, setReportStatus, type AdminReport, type ReportStatus } from "./api";
import { getReportClient } from "./client";
import { ReportCard } from "./report-card";
import { StatusPicker } from "./report-fields";
import {
  EMAIL_PATTERN,
  FILTER_LABEL,
  KIND_TAG,
  STATUS_LABEL,
  countByStatus,
  formatDate,
  type StatusFilter,
} from "./report-labels";
import { normalizeElementText } from "./elements";

type AdminView = "loading" | "signed-out" | "signed-in";

/** The admin tab: sign-in with the team's account, then the triage of every report. */
export function AdminSection() {
  const [view, setView] = useState<AdminView>("loading");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setReports(await listReports());
      setView("signed-in");
      setError("");
    } catch {
      await adminSignOut();
      setView("signed-out");
      setError("Ce compte n’est pas administrateur des signalements.");
    }
  };

  useEffect(() => {
    void (async () => {
      const { data } = await getReportClient().auth.getSession();
      if (data.session) await load();
      else setView("signed-out");
    })();
  }, []);

  return (
    <section className="admin">
      {view === "signed-in" && (
        <AdminReports
          reports={reports}
          onReload={load}
          onSignOut={() => void adminSignOut().then(() => setView("signed-out"))}
        />
      )}
      {view === "loading" && <p className="report-empty">Vérification de la session…</p>}
      {view === "signed-out" && (
        <AdminSignIn
          error={error}
          onSignedIn={() => {
            setError("");
            void load();
          }}
        />
      )}
    </section>
  );
}

function AdminSignIn({ error, onSignedIn }: { error: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      await adminSignIn(email.trim(), password);
      onSignedIn();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="report-card admin__signin"
      onSubmit={(event) => {
        event.preventDefault();
        if (EMAIL_PATTERN.test(email.trim()) && password.length >= 6) void submit();
      }}
    >
      <h2 className="admin__title">Connexion administrateur</h2>
      <p className="report-hint">Réservé à l’équipe du jeu.</p>
      <label className="report-field">
        <span className="report-label">Email</span>
        <input
          className="report-input"
          type="email"
          value={email}
          autoComplete="username"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="report-field">
        <span className="report-label">Mot de passe</span>
        <input
          className="report-input"
          type="password"
          value={password}
          minLength={6}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {(message || error) && (
        <p className="report-error" role="alert">
          {error || message}
        </p>
      )}
      <button type="submit" className="btn btn--cup" disabled={busy}>
        {busy ? "Un instant…" : "Se connecter"}
      </button>
    </form>
  );
}

/** Reports shown per admin page, newest first. */
const REPORT_PAGE_SIZE = 10;

/** The author line of a report: the account's name, or « Anonyme » when the sender was not signed in. */
function authorOf(report: AdminReport): string {
  return report.reporterName || report.reporterEmail || "Anonyme";
}

/** One report as a paste-ready block: type, elements touched, author, title, description. */
function formatReportForCopy(report: AdminReport): string {
  const target = report.element || "Général";
  const note = report.adminNote ? `\n   Note de l’équipe : ${report.adminNote}` : "";
  return (
    `[${KIND_TAG[report.kind]}] ${target} — ${report.title}\n` +
    `   Signalé par ${authorOf(report)} le ${formatDate(report.createdAt)} · statut : ${STATUS_LABEL[report.status]}\n` +
    `   ${report.message}${note}`
  );
}

/**
 * The admin's « Copier » text: the whole filtered list as one paste-ready
 * brief, one block per report, meant to be pasted straight into a chat to drive the corrections.
 */
function formatReportsForCopy(reports: AdminReport[], filter: StatusFilter): string {
  const blocks = reports.map((report, index) => `${index + 1}. ${formatReportForCopy(report)}`);
  return [
    `Red Cups — signalements (${FILTER_LABEL[filter]}), ${reports.length} au total, du plus récent au plus ancien.`,
    ...blocks,
  ].join("\n\n");
}

/** Whether the report matches what the admin typed in the search box (title, text, element, author). */
function matchesSearch(report: AdminReport, search: string): boolean {
  const needle = normalizeElementText(search.trim());
  if (needle === "") return true;
  const haystack = normalizeElementText(
    [report.title, report.message, report.element, report.adminNote, authorOf(report)].join(" "),
  );
  return haystack.includes(needle);
}

function AdminReports({
  reports,
  onReload,
  onSignOut,
}: {
  reports: AdminReport[];
  onReload: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const counts = useMemo(() => countByStatus(reports), [reports]);
  const shown = useMemo(
    () => reports.filter((report) => (filter === "all" || report.status === filter) && matchesSearch(report, search)),
    [reports, filter, search],
  );
  const pages = Math.max(1, Math.ceil(shown.length / REPORT_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = shown.slice((current - 1) * REPORT_PAGE_SIZE, current * REPORT_PAGE_SIZE);

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(formatReportsForCopy(shown, filter));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // A browser refusing clipboard access leaves the button silent; the text is on screen anyway.
    }
  };

  return (
    <div className="admin__panel">
      <div className="report-summary" role="tablist" aria-label="Filtrer les signalements">
        {(Object.keys(FILTER_LABEL) as StatusFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            className={`report-summary__chip report-summary__chip--${option} ${filter === option ? "is-current" : ""}`}
            onClick={() => {
              setFilter(option);
              setPage(1);
            }}
          >
            <strong>{counts[option]}</strong>
            {FILTER_LABEL[option]}
          </button>
        ))}
      </div>

      <div className="admin__bar">
        <label className="admin__search">
          <UiIcon name="search" size={18} />
          <input
            className="admin__search-input"
            type="search"
            value={search}
            placeholder="Chercher un titre, un élément, un joueur…"
            aria-label="Chercher dans les signalements"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="admin__tools">
          <button
            type="button"
            className="btn btn--mint btn--small"
            onClick={() => void copyList()}
            disabled={shown.length === 0}
            title="Copier tout le filtre affiché, formaté pour un chat"
          >
            <UiIcon name={copied ? "check" : "copy"} size={18} /> {copied ? "Copié !" : "Copier"}
          </button>
          <button
            type="button"
            className="icon-button icon-button--small"
            onClick={() => void onReload()}
            aria-label="Actualiser"
          >
            <UiIcon name="refresh" size={18} />
          </button>
          <button type="button" className="btn btn--cream btn--small" onClick={onSignOut}>
            <UiIcon name="logout" size={18} /> Quitter
          </button>
        </div>
      </div>

      {shown.length === 0 && <p className="report-empty">Rien dans cette case, pour l’instant.</p>}
      {visible.map((report) => (
        <AdminReportCard key={report.id} report={report} onSaved={onReload} />
      ))}

      {pages > 1 && (
        <nav className="admin__pager" aria-label="Pages de signalements">
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
          >
            <UiIcon name="chevronLeft" size={18} /> Plus récents
          </button>
          <span className="admin__pager-page">
            Page {current} / {pages}
          </span>
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={() => setPage(current + 1)}
            disabled={current === pages}
          >
            Plus anciens <UiIcon name="chevronRight" size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}

function AdminReportCard({ report, onSaved }: { report: AdminReport; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState(report.adminNote);
  const [editingNote, setEditingNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const dirty = status !== report.status || note.trim() !== report.adminNote;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await setReportStatus(report.id, status, note.trim());
      await onSaved();
      setEditingNote(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const copyOne = async () => {
    try {
      await navigator.clipboard.writeText(formatReportForCopy(report));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // A browser refusing clipboard access leaves the button silent; the text is on screen anyway.
    }
  };

  return (
    <ReportCard
      report={report}
      author={
        <span className={`report-item__author ${report.reporterName || report.reporterEmail ? "" : "is-anonymous"}`}>
          <UiIcon name="user" size={15} /> {authorOf(report)}
          {report.reporterName && report.reporterEmail && <small>{report.reporterEmail}</small>}
        </span>
      }
      actions={
        <button
          type="button"
          className="btn btn--cream btn--small"
          onClick={() => void copyOne()}
          title="Copier ce signalement, formaté pour un chat"
        >
          <UiIcon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copié !" : "Copier"}
        </button>
      }
    >
      <div className="report-item__controls">
        <StatusPicker value={status} onChange={setStatus} />
        {editingNote ? (
          <label className="report-field">
            <span className="report-label">Note affichée dans la carte (facultative)</span>
            <textarea
              className="report-input report-textarea report-textarea--small"
              value={note}
              maxLength={500}
              rows={3}
              placeholder="Ex : corrigé dans la 0.2.5"
              onChange={(event) => setNote(event.target.value)}
              autoFocus
            />
            <span className="report-hint">{note.length} / 500</span>
          </label>
        ) : (
          <button type="button" className="report-link" onClick={() => setEditingNote(true)}>
            {report.adminNote ? "Modifier la note" : "Ajouter une note"}
          </button>
        )}
        {(dirty || editingNote) && (
          <div className="report-actions">
            <button
              type="button"
              className="btn btn--cream btn--small"
              onClick={() => {
                setStatus(report.status);
                setNote(report.adminNote);
                setEditingNote(false);
                setError("");
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--gold btn--small"
              onClick={() => void save()}
              disabled={!dirty || busy}
            >
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        )}
        {error && <p className="report-error">{error}</p>}
      </div>
    </ReportCard>
  );
}
