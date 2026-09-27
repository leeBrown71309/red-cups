import { useState } from "react";
import { useAccountStore } from "../../net/account-store";
import { ModalShell } from "../components/modal-shell";
import { UiIcon } from "../icons/ui-icon";
import { GameHistoryModal } from "./game-history";
import { ONLINE_NAME_MAX_LENGTH } from "./online-name";

/**
 * Guest or Google account. An account keeps its profile name from one visit
 * to the next, and the history of its online games.
 */
export function AccountPanel() {
  const kind = useAccountStore((state) => state.kind);
  const email = useAccountStore((state) => state.email);
  const displayName = useAccountStore((state) => state.displayName);
  const busy = useAccountStore((state) => state.busy);
  const signInWithGoogle = useAccountStore((state) => state.signInWithGoogle);
  const signOut = useAccountStore((state) => state.signOut);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (kind !== "google") {
    return (
      <section className="account-panel panel">
        <div className="account-panel__who">
          <UiIcon name="user" size={22} />
          <div>
            <strong>Tu joues en invité</strong>
            <span>Connecte-toi pour garder ton nom et l’historique de tes parties.</span>
          </div>
        </div>
        <button type="button" className="btn btn--cream btn--small" onClick={signInWithGoogle} disabled={busy}>
          Se connecter avec Google
        </button>
      </section>
    );
  }

  return (
    <section className="account-panel panel">
      <div className="account-panel__who">
        <UiIcon name="user" size={22} />
        <div>
          <strong>{displayName ?? "Compte Google"}</strong>
          <span>{email}</span>
        </div>
        <button
          type="button"
          className="icon-button icon-button--small"
          onClick={() => setConfirmSignOut(true)}
          disabled={busy}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <UiIcon name="logout" size={18} />
        </button>
      </div>
      <ProfileNameForm key={displayName ?? ""} initialName={displayName ?? ""} />
      <button type="button" className="btn btn--cream btn--small" onClick={() => setHistoryOpen(true)}>
        <UiIcon name="journal" size={18} /> Mes parties
      </button>
      {historyOpen && <GameHistoryModal onClose={() => setHistoryOpen(false)} />}
      {confirmSignOut && (
        <ModalShell
          title="Se déconnecter ?"
          eyebrow="Compte Google"
          size="small"
          onClose={() => setConfirmSignOut(false)}
        >
          <p className="modal-lead">
            Tu joueras en invité sur cet appareil. Ton nom de profil et l’historique de tes parties restent sur ton
            compte : reconnecte-toi pour les retrouver.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn--cream" onClick={() => setConfirmSignOut(false)} data-autofocus>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--grape"
              disabled={busy}
              onClick={() => {
                setConfirmSignOut(false);
                void signOut();
              }}
            >
              <UiIcon name="logout" size={18} /> Se déconnecter
            </button>
          </div>
        </ModalShell>
      )}
    </section>
  );
}

function ProfileNameForm({ initialName }: { initialName: string }) {
  const busy = useAccountStore((state) => state.busy);
  const saveDisplayName = useAccountStore((state) => state.saveDisplayName);
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();
  const unchanged = trimmed === initialName;
  const valid = trimmed.length >= 2 && trimmed.length <= ONLINE_NAME_MAX_LENGTH;

  return (
    <form
      className="account-panel__form"
      onSubmit={async (event) => {
        event.preventDefault();
        // Once saved, the new name shows in the header and this form starts over from it.
        if (valid && !unchanged) await saveDisplayName(trimmed);
      }}
    >
      <label className="field">
        <span>Nom de profil</span>
        <input
          className="lobby-player__input"
          value={name}
          maxLength={ONLINE_NAME_MAX_LENGTH}
          placeholder="Ton nom à la table"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn--gold btn--small" disabled={busy || !valid || unchanged}>
        <UiIcon name="check" size={18} /> Enregistrer
      </button>
    </form>
  );
}
