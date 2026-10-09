import { useEffect, useMemo, useRef, useState } from "react";
import { GameLogo } from "../ui/components/game-logo";
import { UiIcon } from "../ui/icons/ui-icon";
import {
  adminSignIn,
  adminSignOut,
  listReports,
  setReportStatus,
  submitReport,
  type Report,
  type ReportKind,
  type ReportStatus,
} from "./api";
import { getReportClient, reportsAvailable } from "./client";
import { ELEMENT_OPTIONS, normalizeElementText, type ElementOption } from "./elements";

/**
 * The reporting page, served next to the game (`feedback.html`): players send
 * a bug or an idea, and the admin — connected by email and password — sorts
 * what comes back. The two sides live in two tabs. Everything goes through
 * the functions of the schema.
 */
export function ReportApp() {
  const [tab, setTab] = useState<"report" | "admin">("report");
  return (
    <main className="report">
      <div className="report__shell">
        <header className="report__hero">
          <GameLogo compact />
          <h1>Signaler un bug ou une idée</h1>
          <p className="report__intro">
            Un objet qui fait n’importe quoi, un Cups Power mal équilibré, une idée qui rendrait la partie meilleure ?
            Écrivez-le ici : chaque signalement est lu, trié, puis corrigé.
          </p>
          <a className="report__back btn btn--cream btn--small" href="./">
            <UiIcon name="arrowLeft" size={18} /> Retour au jeu
          </a>
        </header>

        {reportsAvailable ? (
          <>
            <nav className="report-tabs" role="tablist" aria-label="Contenu de la page">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "report"}
                className={`report-tab ${tab === "report" ? "is-current" : ""}`}
                onClick={() => setTab("report")}
              >
                <UiIcon name="flag" size={18} /> Signaler
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "admin"}
                className={`report-tab ${tab === "admin" ? "is-current" : ""}`}
                onClick={() => setTab("admin")}
              >
                <UiIcon name="user" size={18} /> Espace administrateur
              </button>
            </nav>

            {tab === "report" ? <ReportForm /> : <AdminSection />}
          </>
        ) : (
          <section className="report-card report__notice">
            <p>
              Cette version du jeu n’est reliée à aucune base de données : le signalement est disponible sur le site
              public du jeu.
            </p>
          </section>
        )}

        <footer className="report__foot">Red Cups — merci pour vos retours !</footer>
      </div>
    </main>
  );
}

const KIND_LABEL: Record<ReportKind, string> = { bug: "Bug", idea: "Amélioration", other: "Autre" };
const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  fixed: "Corrigé",
  rejected: "Rejeté",
};
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ReportForm() {
  const [kind, setKind] = useState<ReportKind>("bug");
  const [element, setElement] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const canSend = title.trim().length >= 3 && message.trim().length >= 10 && !sending;

  const reset = () => {
    setKind("bug");
    setElement("");
    setTitle("");
    setMessage("");
    setError("");
    setSent(false);
  };

  const send = async () => {
    setSending(true);
    setError("");
    try {
      // No SMTP on the project yet: the page cannot promise an email answer, so no contact field.
      await submitReport({ kind, element, title: title.trim(), message: message.trim(), contactEmail: "" });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible, réessayez.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <section className="report-card report-card--thanks" aria-live="polite">
        <span className="report-thanks__badge">
          <UiIcon name="check" size={30} />
        </span>
        <h2>Merci, c’est envoyé !</h2>
        <p>
          {kind === "bug"
            ? "Le bug sera vérifié, puis corrigé dans une prochaine version."
            : "L’idée sera discutée pour les prochaines versions."}
        </p>
        <button type="button" className="btn btn--cup" onClick={reset}>
          <UiIcon name="plus" size={20} /> Signaler autre chose
        </button>
      </section>
    );
  }

  return (
    <form
      className="report-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) void send();
      }}
    >
      <div className="report-fieldset">
        <legend className="report-label">Que voulez-vous envoyer ?</legend>
        <div className="report-kinds" role="radiogroup" aria-label="Type de signalement">
          {(Object.keys(KIND_LABEL) as ReportKind[]).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              className={`report-kind ${kind === option ? "is-chosen" : ""}`}
              onClick={() => setKind(option)}
            >
              <UiIcon name={option === "bug" ? "flag" : option === "idea" ? "sparkle" : "info"} size={18} />
              {KIND_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="report-field">
        <span className="report-label" id="report-element-label">
          Élément concerné (facultatif)
        </span>
        <ElementPicker value={element} onChange={setElement} />
      </div>

      <label className="report-field">
        <span className="report-label">Titre</span>
        <input
          className="report-input"
          value={title}
          maxLength={80}
          placeholder="Ex : La Barrière laisse passer la Botte deux fois"
          onChange={(event) => setTitle(event.target.value)}
        />
        <span className="report-hint">{title.trim().length < 3 ? "Au moins 3 caractères." : ""}</span>
      </label>

      <label className="report-field">
        <span className="report-label">Description</span>
        <textarea
          className="report-input report-textarea"
          value={message}
          maxLength={2000}
          rows={6}
          placeholder="Que s’est-il passé ? À quel moment ? Que vouliez-vous obtenir ?"
          onChange={(event) => setMessage(event.target.value)}
        />
        <span className="report-hint">
          {message.trim().length < 10
            ? "Encore quelques mots : décrivez la scène (au moins 10 caractères)."
            : `${message.length} / 2000`}
        </span>
      </label>

      {error && (
        <p className="report-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn--cup btn--large report-send" disabled={!canSend}>
        <UiIcon name="flag" size={22} /> {sending ? "Envoi en cours…" : "Envoyer le signalement"}
      </button>
    </form>
  );
}

/**
 * The searchable element picker: the full catalogue drops down on focus,
 * typing narrows it (accents ignored), and a text that is not in the list
 * stays allowed — the field is optional and free.
 */
function ElementPicker({ value, onChange }: { value: string; onChange: (element: string) => void }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setText(value), [value]);

  const matches = useMemo(() => {
    const needle = normalizeElementText(text.trim());
    return needle === ""
      ? ELEMENT_OPTIONS
      : ELEMENT_OPTIONS.filter((option) => normalizeElementText(option.name).includes(needle));
  }, [text]);

  const type = (next: string) => {
    setText(next);
    onChange(next.trim());
    setActive(0);
    setOpen(true);
  };

  const choose = (option: ElementOption) => {
    setText(option.name);
    onChange(option.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="picker" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}>
      <input
        ref={inputRef}
        id="report-element"
        className="report-input"
        role="combobox"
        aria-labelledby="report-element-label"
        aria-expanded={open}
        aria-controls="report-element-list"
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={60}
        placeholder="Tape pour rechercher : Barrière, Cupide, Banquise…"
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open) {
            // Never submit the form from the combobox: Enter takes the highlighted element, if any.
            event.preventDefault();
            if (matches[active]) choose(matches[active]);
          }
        }}
      />
      {text !== "" && (
        <button
          type="button"
          className="picker__clear"
          aria-label="Effacer l'élément"
          onClick={() => {
            type("");
            inputRef.current?.focus();
          }}
        >
          <UiIcon name="close" size={14} />
        </button>
      )}
      {open && (
        <div id="report-element-list" className="picker__list" role="listbox">
          {matches.length === 0 && (
            <p className="picker__empty">Aucun élément trouvé — ton texte sera gardé tel quel.</p>
          )}
          {matches.map((option, index) => (
            <div key={option.name}>
              {(index === 0 || matches[index - 1].group !== option.group) && (
                <p className="picker__group">{option.group}</p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={`picker__option ${index === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.name}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminView = "loading" | "signed-out" | "signed-in";

function AdminSection() {
  const [view, setView] = useState<AdminView>("loading");
  const [reports, setReports] = useState<Report[]>([]);
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
      {view === "loading" && <p className="admin__empty">Vérification de la session…</p>}
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
      <div className="admin__signin-actions">
        <button type="submit" className="btn btn--cup" disabled={busy}>
          {busy ? "Un instant…" : "Se connecter"}
        </button>
      </div>
    </form>
  );
}

type StatusFilter = "all" | ReportStatus;

/** Reports shown per admin page, newest first. */
const REPORT_PAGE_SIZE = 10;

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "Tous",
  new: "Nouveaux",
  in_progress: "En cours",
  fixed: "Corrigés",
  rejected: "Rejetés",
};
const KIND_TAG: Record<ReportKind, string> = { bug: "BUG", idea: "IDÉE", other: "AUTRE" };

/** One report as a paste-ready block: type, elements touched, title, description. */
function formatReportForCopy(report: Report): string {
  const target = report.element || "Général";
  const note = report.adminNote ? `\n   Note de l’équipe : ${report.adminNote}` : "";
  return (
    `[${KIND_TAG[report.kind]}] ${target} — ${report.title}\n` +
    `   Signalé le ${formatDate(report.createdAt)} · statut : ${STATUS_LABEL[report.status]}\n` +
    `   ${report.message}${note}`
  );
}

/**
 * The admin's « Copier » text: the whole filtered list as one paste-ready
 * brief, one block per report (type, elements touched, title, description),
 * meant to be pasted straight into a chat to drive the corrections.
 */
function formatReportsForCopy(reports: Report[], filter: StatusFilter): string {
  const blocks = reports.map((report, index) => `${index + 1}. ${formatReportForCopy(report)}`);
  return [
    `Red Cups — signalements (${FILTER_LABEL[filter]}), ${reports.length} au total, du plus récent au plus ancien.`,
    ...blocks,
  ].join("\n\n");
}

function AdminReports({
  reports,
  onReload,
  onSignOut,
}: {
  reports: Report[];
  onReload: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const counts: Record<StatusFilter, number> = { all: reports.length, new: 0, in_progress: 0, fixed: 0, rejected: 0 };
  for (const report of reports) counts[report.status] += 1;
  const shown = filter === "all" ? reports : reports.filter((report) => report.status === filter);
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
      <div className="admin__bar">
        <div className="admin__filters" role="tablist" aria-label="Filtrer les signalements">
          {(["all", "new", "in_progress", "fixed", "rejected"] as StatusFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`admin__filter ${filter === option ? "is-current" : ""}`}
              onClick={() => {
                setFilter(option);
                setPage(1);
              }}
            >
              {FILTER_LABEL[option]} <small>{counts[option] ?? 0}</small>
            </button>
          ))}
        </div>
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

      {shown.length === 0 && <p className="admin__empty">Rien dans cette case, pour l’instant.</p>}
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

function AdminReportCard({ report, onSaved }: { report: Report; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [note, setNote] = useState(report.adminNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const dirty = status !== report.status || note !== report.adminNote;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await setReportStatus(report.id, status, note.trim());
      await onSaved();
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
    <article className={`admin-report admin-report--${report.status}`}>
      <header className="admin-report__head">
        <span className={`badge badge--${report.kind}`}>{KIND_LABEL[report.kind]}</span>
        {report.element && <span className="badge badge--element">{report.element}</span>}
        <time className="admin-report__date">{formatDate(report.createdAt)}</time>
        <button
          type="button"
          className="btn btn--cream btn--small admin-report__copy"
          onClick={() => void copyOne()}
          title="Copier ce signalement, formaté pour un chat"
        >
          <UiIcon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copié !" : "Copier"}
        </button>
      </header>
      <h3 className="admin-report__title">{report.title}</h3>
      <p className="admin-report__message">{report.message}</p>
      {report.contactEmail && (
        <p className="admin-report__contact">
          <UiIcon name="user" size={15} /> {report.contactEmail}
        </p>
      )}

      <div className="admin-report__controls">
        <label className="admin-report__status">
          <span className="report-label">Statut</span>
          <select
            className="report-input report-input--small"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReportStatus)}
          >
            {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((option) => (
              <option key={option} value={option}>
                {STATUS_LABEL[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-report__note">
          <span className="report-label">Note interne (facultative)</span>
          <input
            className="report-input report-input--small"
            value={note}
            maxLength={500}
            placeholder="Ex : corrigé dans la 0.2.0"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--gold btn--small admin-report__save"
          onClick={() => void save()}
          disabled={!dirty || busy}
        >
          {busy ? "…" : "Enregistrer"}
        </button>
      </div>
      {error && <p className="report-error">{error}</p>}
    </article>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
