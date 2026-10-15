import { UiIcon } from "../ui/icons/ui-icon";
import type { ReportDraft, ReportKind, ReportStatus } from "./api";
import { ElementPicker } from "./element-picker";
import { KIND_LABEL, MESSAGE_MIN, STATUS_LABEL, STATUS_ORDER, TITLE_MIN } from "./report-labels";

/** The pieces of the report form, shared by the « Signaler » tab and the editor of « Mes signalements ». */

export function isDraftValid(draft: ReportDraft): boolean {
  return draft.title.trim().length >= TITLE_MIN && draft.message.trim().length >= MESSAGE_MIN;
}

export function trimDraft(draft: ReportDraft): ReportDraft {
  return { ...draft, title: draft.title.trim(), message: draft.message.trim(), element: draft.element.trim() };
}

const KIND_ICON: Record<ReportKind, "flag" | "sparkle" | "info"> = { bug: "flag", idea: "sparkle", other: "info" };

export function KindChoice({ value, onChange }: { value: ReportKind; onChange: (kind: ReportKind) => void }) {
  return (
    <div className="report-kinds" role="radiogroup" aria-label="Type de signalement">
      {(Object.keys(KIND_LABEL) as ReportKind[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`report-kind report-kind--${option} ${value === option ? "is-chosen" : ""}`}
          onClick={() => onChange(option)}
        >
          <UiIcon name={KIND_ICON[option]} size={18} />
          {KIND_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

/** Kind, element, title and description: the four fields of a report, with their hints. */
export function DraftFields({ draft, onChange }: { draft: ReportDraft; onChange: (draft: ReportDraft) => void }) {
  const set = (changes: Partial<ReportDraft>) => onChange({ ...draft, ...changes });
  return (
    <>
      <div className="report-field">
        <span className="report-label">Que voulez-vous envoyer ?</span>
        <KindChoice value={draft.kind} onChange={(kind) => set({ kind })} />
      </div>

      <div className="report-field">
        <span className="report-label">
          Élément concerné <small>facultatif</small>
        </span>
        <ElementPicker value={draft.element} onChange={(element) => set({ element })} />
      </div>

      <label className="report-field">
        <span className="report-label">Titre</span>
        <input
          className="report-input"
          value={draft.title}
          maxLength={80}
          placeholder="Ex : La Barrière laisse passer la Botte deux fois"
          onChange={(event) => set({ title: event.target.value })}
        />
        <span className="report-hint">{draft.title.trim().length < TITLE_MIN ? "Au moins 3 caractères." : ""}</span>
      </label>

      <label className="report-field">
        <span className="report-label">Description</span>
        <textarea
          className="report-input report-textarea"
          value={draft.message}
          maxLength={2000}
          rows={6}
          placeholder="Que s’est-il passé ? À quel moment ? Que vouliez-vous obtenir ?"
          onChange={(event) => set({ message: event.target.value })}
        />
        <span className="report-hint">
          {draft.message.trim().length < MESSAGE_MIN
            ? "Encore quelques mots : décrivez la scène (au moins 10 caractères)."
            : `${draft.message.length} / 2000`}
        </span>
      </label>
    </>
  );
}

/** The status of a report as a coloured pill. */
export function StatusPill({ status }: { status: ReportStatus }) {
  return <span className={`status-pill status-pill--${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Where a report stands on its way: received, taken up, then settled one way or the other. */
export function StatusSteps({ status }: { status: ReportStatus }) {
  const last: ReportStatus = status === "rejected" ? "rejected" : "fixed";
  const steps: ReportStatus[] = ["new", "in_progress", last];
  const reached = steps.indexOf(status);
  return (
    <ol className="status-steps" aria-label={`Avancement : ${STATUS_LABEL[status]}`}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={`status-steps__step status-steps__step--${step} ${index <= reached ? "is-reached" : ""} ${
            index === reached ? "is-current" : ""
          }`}
          aria-current={index === reached ? "step" : undefined}
        >
          <span className="status-steps__dot" aria-hidden="true" />
          {step === "new" ? "Reçu" : STATUS_LABEL[step]}
        </li>
      ))}
    </ol>
  );
}

/** The admin's way to pick a status: four buttons side by side instead of a hidden drop-down. */
export function StatusPicker({ value, onChange }: { value: ReportStatus; onChange: (status: ReportStatus) => void }) {
  return (
    <div className="status-picker" role="radiogroup" aria-label="Statut">
      {STATUS_ORDER.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`status-picker__option status-picker__option--${option} ${value === option ? "is-chosen" : ""}`}
          onClick={() => onChange(option)}
        >
          {STATUS_LABEL[option]}
        </button>
      ))}
    </div>
  );
}
