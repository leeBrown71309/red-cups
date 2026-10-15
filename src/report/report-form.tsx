import { useState } from "react";
import { useAccountStore } from "../net/account-store";
import { UiIcon } from "../ui/icons/ui-icon";
import { submitReport, type ReportDraft } from "./api";
import { rememberReturnTab } from "./account-bar";
import { DraftFields, isDraftValid, trimDraft } from "./report-fields";

const EMPTY_DRAFT: ReportDraft = { kind: "bug", element: "", title: "", message: "" };

/** The « Signaler » tab: the form, then a thank-you that points an account to its list. */
export function ReportForm({ onSeeMine }: { onSeeMine: () => void }) {
  const accountKind = useAccountStore((state) => state.kind);
  const busyAccount = useAccountStore((state) => state.busy);
  const signInWithGoogle = useAccountStore((state) => state.signInWithGoogle);
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ReportDraft | null>(null);
  const [error, setError] = useState("");

  const canSend = isDraftValid(draft) && !sending;
  const signedIn = accountKind === "google";

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const clean = trimDraft(draft);
      await submitReport(clean);
      setSent(clean);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible, réessayez.");
    } finally {
      setSending(false);
    }
  };

  const again = () => {
    setDraft(EMPTY_DRAFT);
    setError("");
    setSent(null);
  };

  if (sent) {
    return (
      <section className="report-card report-card--thanks" aria-live="polite">
        <span className="report-thanks__badge">
          <UiIcon name="check" size={30} />
        </span>
        <h2>Merci, c’est envoyé !</h2>
        <p>
          {sent.kind === "bug"
            ? "Le bug sera vérifié, puis corrigé dans une prochaine version."
            : "L’idée sera discutée pour les prochaines versions."}
        </p>
        {signedIn ? (
          <p>
            Retrouve-le dans « Mes signalements » : tu y suis son statut et tu peux le corriger tant qu’il est nouveau.
          </p>
        ) : (
          <p>Connecte-toi avec Google la prochaine fois pour suivre tes signalements et les corriger.</p>
        )}
        <div className="report-actions">
          {signedIn && (
            <button type="button" className="btn btn--gold" onClick={onSeeMine}>
              <UiIcon name="journal" size={20} /> Mes signalements
            </button>
          )}
          <button type="button" className="btn btn--cup" onClick={again}>
            <UiIcon name="plus" size={20} /> Signaler autre chose
          </button>
        </div>
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
      {!signedIn && (
        <p className="report-note">
          <UiIcon name="info" size={18} />
          <span>
            Tu envoies ce signalement sans compte : il sera lu, mais tu ne pourras ni le suivre ni le corriger.{" "}
            <button
              type="button"
              className="report-link"
              disabled={busyAccount}
              onClick={() => {
                rememberReturnTab("report");
                void signInWithGoogle();
              }}
            >
              Se connecter avec Google
            </button>
          </span>
        </p>
      )}

      <DraftFields draft={draft} onChange={setDraft} />

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
