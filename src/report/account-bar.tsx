import { useAccountStore } from "../net/account-store";
import { UiIcon } from "../ui/icons/ui-icon";

/** Where the page remembers which tab the visitor was on while Google takes them away and brings them back. */
const RETURN_TAB_KEY = "red-cups-report-return-tab";

export function rememberReturnTab(tab: string): void {
  try {
    window.sessionStorage.setItem(RETURN_TAB_KEY, tab);
  } catch {
    // Storage may be blocked: the visitor then lands on the first tab, which costs one click.
  }
}

export function takeReturnTab(): string | null {
  try {
    const tab = window.sessionStorage.getItem(RETURN_TAB_KEY);
    window.sessionStorage.removeItem(RETURN_TAB_KEY);
    return tab;
  } catch {
    return null;
  }
}

/** Who the page thinks the visitor is, and the way to sign in or out. A guest is nobody for the reports. */
export function AccountBar({ returnTab }: { returnTab: string }) {
  const kind = useAccountStore((state) => state.kind);
  const email = useAccountStore((state) => state.email);
  const displayName = useAccountStore((state) => state.displayName);
  const busy = useAccountStore((state) => state.busy);
  const signInWithGoogle = useAccountStore((state) => state.signInWithGoogle);
  const signOut = useAccountStore((state) => state.signOut);

  if (kind === "google") {
    return (
      <div className="account-bar account-bar--in">
        <UiIcon name="user" size={18} />
        <span className="account-bar__who">
          <strong>{displayName ?? "Compte Google"}</strong>
          {email && <small>{email}</small>}
        </span>
        <button type="button" className="account-bar__out" onClick={() => void signOut()} disabled={busy}>
          Se déconnecter
        </button>
      </div>
    );
  }
  return (
    <div className="account-bar">
      <UiIcon name="user" size={18} />
      <span className="account-bar__who">Non connecté</span>
      <button
        type="button"
        className="btn btn--cream btn--small"
        disabled={busy}
        onClick={() => {
          rememberReturnTab(returnTab);
          void signInWithGoogle();
        }}
      >
        Se connecter avec Google
      </button>
    </div>
  );
}

/** The invitation to sign in, for what only an account can do (follow and correct its reports). */
export function SignInInvite({ title, text, returnTab }: { title: string; text: string; returnTab: string }) {
  const busy = useAccountStore((state) => state.busy);
  const error = useAccountStore((state) => state.error);
  const signInWithGoogle = useAccountStore((state) => state.signInWithGoogle);
  return (
    <section className="report-card report-invite">
      <span className="report-invite__badge">
        <UiIcon name="user" size={26} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {error && (
        <p className="report-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn--cup"
        disabled={busy}
        onClick={() => {
          rememberReturnTab(returnTab);
          void signInWithGoogle();
        }}
      >
        Se connecter avec Google
      </button>
    </section>
  );
}
