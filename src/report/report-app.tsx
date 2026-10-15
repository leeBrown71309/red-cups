import { useEffect, useState } from "react";
import { useAccountStore } from "../net/account-store";
import { GameLogo } from "../ui/components/game-logo";
import { UiIcon, type UiIconName } from "../ui/icons/ui-icon";
import { AccountBar, takeReturnTab } from "./account-bar";
import { AdminSection } from "./admin-section";
import { reportsAvailable } from "./client";
import { MyReports } from "./my-reports";
import { ReportForm } from "./report-form";

/**
 * The reporting page, served next to the game (`feedback.html`): players send
 * a bug or an idea, a player signed in with Google follows and corrects what
 * they sent, and the admin — connected by email and password — sorts what
 * comes back. Three tabs; everything goes through the functions of the schema.
 */
type Tab = "report" | "mine" | "admin";

const TABS: { id: Tab; label: string; icon: UiIconName }[] = [
  { id: "report", label: "Signaler", icon: "flag" },
  { id: "mine", label: "Mes signalements", icon: "journal" },
  { id: "admin", label: "Administrateur", icon: "shield" },
];

function readFirstTab(): Tab {
  const remembered = takeReturnTab();
  return remembered === "mine" || remembered === "admin" ? remembered : "report";
}

export function ReportApp() {
  const [tab, setTab] = useState<Tab>(readFirstTab);
  const startAccount = useAccountStore((state) => state.start);

  // Reads the session of the game (the Google account, if any), and finishes a sign-in coming back from Google.
  useEffect(() => startAccount(), [startAccount]);

  return (
    <main className="report">
      <div className="report__shell">
        <header className="report__hero">
          <div className="report__top">
            <a className="report__back btn btn--cream btn--small" href="./">
              <UiIcon name="arrowLeft" size={18} /> Retour au jeu
            </a>
            {reportsAvailable && <AccountBar returnTab={tab} />}
          </div>
          <GameLogo compact />
          <h1>Bugs &amp; idées</h1>
          <p className="report__intro">
            Un objet qui fait n’importe quoi, un Cups Power mal équilibré, une idée qui rendrait la partie meilleure ?
            Chaque signalement est lu, trié, puis corrigé.
          </p>
        </header>

        {reportsAvailable ? (
          <>
            <nav className="report-tabs" role="tablist" aria-label="Contenu de la page">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.id}
                  className={`report-tab ${tab === entry.id ? "is-current" : ""}`}
                  onClick={() => setTab(entry.id)}
                >
                  <UiIcon name={entry.icon} size={18} /> {entry.label}
                </button>
              ))}
            </nav>

            {tab === "report" && <ReportForm onSeeMine={() => setTab("mine")} />}
            {tab === "mine" && <MyReports onReport={() => setTab("report")} />}
            {tab === "admin" && <AdminSection />}
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
