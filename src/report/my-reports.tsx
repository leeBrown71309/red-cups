import { useCallback, useEffect, useState } from "react";
import { useAccountStore } from "../net/account-store";
import { UiIcon } from "../ui/icons/ui-icon";
import { listMyReports, updateMyReport, type Report, type ReportDraft } from "./api";
import { SignInInvite } from "./account-bar";
import { ReportCard } from "./report-card";
import { DraftFields, isDraftValid, StatusSteps, trimDraft } from "./report-fields";
import { FILTER_LABEL, STATUS_MEANING, countByStatus, type StatusFilter } from "./report-labels";

/** The « Mes signalements » tab: the reports of the signed-in account, their status, and the way to correct them. */
export function MyReports({ onReport }: { onReport: () => void }) {
  const kind = useAccountStore((state) => state.kind);
  const ready = useAccountStore((state) => state.ready);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      setReports(await listMyReports());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger tes signalements.");
    }
  }, []);

  useEffect(() => {
    if (kind === "google") void load();
    else setReports(null);
  }, [kind, load]);

  if (!ready) return <p className="report-empty">Vérification de ta session…</p>;
  if (kind !== "google") {
    return (
      <SignInInvite
        returnTab="mine"
        title="Retrouve tes signalements"
        text="Connecte-toi avec Google : tu verras la liste de ce que tu as envoyé, tu suivras son statut et tu pourras corriger une erreur tant que personne ne l’a lu."
      />
    );
  }
  if (error) {
    return (
      <section className="report-card">
        <p className="report-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn btn--cream btn--small" onClick={() => void load()}>
          <UiIcon name="refresh" size={18} /> Réessayer
        </button>
      </section>
    );
  }
  if (reports === null) return <p className="report-empty">Chargement de tes signalements…</p>;
  if (reports.length === 0) {
    return (
      <section className="report-card report-invite">
        <span className="report-invite__badge">
          <UiIcon name="flag" size={26} />
        </span>
        <h2>Rien d’envoyé pour l’instant</h2>
        <p>Les bugs et idées que tu signales connecté apparaîtront ici, avec leur statut.</p>
        <button type="button" className="btn btn--cup" onClick={onReport}>
          <UiIcon name="plus" size={20} /> Faire un signalement
        </button>
      </section>
    );
  }

  const counts = countByStatus(reports);
  const shown = filter === "all" ? reports : reports.filter((report) => report.status === filter);
  return (
    <div className="report-list">
      <div className="report-summary" role="tablist" aria-label="Filtrer mes signalements">
        {(Object.keys(FILTER_LABEL) as StatusFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            className={`report-summary__chip report-summary__chip--${option} ${filter === option ? "is-current" : ""}`}
            onClick={() => setFilter(option)}
          >
            <strong>{counts[option]}</strong>
            {FILTER_LABEL[option]}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="report-empty">Aucun signalement dans cette case.</p>}
      {shown.map((report) => (
        <MyReportCard key={report.id} report={report} onSaved={load} />
      ))}
    </div>
  );
}

function MyReportCard({ report, onSaved }: { report: Report; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReportDraft>(toDraft(report));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editable = report.status === "new";

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await updateMyReport(report.id, trimDraft(draft));
      await onSaved();
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form
        className="report-card report-item-edit"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDraftValid(draft) && !busy) void save();
        }}
      >
        <h3 className="report-item-edit__title">Corriger mon signalement</h3>
        <DraftFields draft={draft} onChange={setDraft} />
        {error && (
          <p className="report-error" role="alert">
            {error}
          </p>
        )}
        <div className="report-actions">
          <button
            type="button"
            className="btn btn--cream"
            onClick={() => {
              setEditing(false);
              setDraft(toDraft(report));
              setError("");
            }}
          >
            Annuler
          </button>
          <button type="submit" className="btn btn--gold" disabled={!isDraftValid(draft) || busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <ReportCard
      report={report}
      actions={
        editable && (
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={() => {
              setDraft(toDraft(report));
              setEditing(true);
            }}
          >
            Modifier
          </button>
        )
      }
    >
      <StatusSteps status={report.status} />
      <p className="report-item__meaning">{STATUS_MEANING[report.status]}</p>
    </ReportCard>
  );
}

function toDraft(report: Report): ReportDraft {
  return { kind: report.kind, element: report.element, title: report.title, message: report.message };
}
