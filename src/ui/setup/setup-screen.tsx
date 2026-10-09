import { useEffect, useState } from "react";
import type { MapId } from "../../game/types";
import { FlowShell } from "../components/flow-shell";
import { UiIcon } from "../icons/ui-icon";
import { HelpModal } from "../modals/help-modal";
import { MapStep } from "./map-step";
import { PlayersStep, type TableEntry } from "./players-step";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const NAME_MAX_LENGTH = 16;
const STORAGE_KEY = "red-cups-table";
const DEFAULT_NAMES = ["Léa", "Malik", "Inès", "Tom"];

type SetupStepId = "players" | "map";

function loadTable(): TableEntry[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    if (Array.isArray(parsed) && parsed.length >= MIN_PLAYERS && parsed.every((name) => typeof name === "string")) {
      return parsed.slice(0, MAX_PLAYERS).map((name, index) => ({ id: index + 1, name }));
    }
  } catch {
    // A missing or corrupted memory simply falls back to the default table.
  }
  return DEFAULT_NAMES.map((name, index) => ({ id: index + 1, name }));
}

function rememberTable(entries: TableEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.map((entry) => entry.name)));
  } catch {
    // Storage can be unavailable (private mode); remembering names is optional.
  }
}

interface SetupScreenProps {
  /** Every local game opens on the passive draft (patch 0.1.4). */
  onStart: (names: string[], mapId: MapId) => void;
  /** Offered only when the build has an online backend. */
  onPlayOnline?: () => void;
  /** Back to the game's menu. */
  onBack?: () => void;
}

/**
 * The whole pre-game configuration, on pages that fill the screen: the table, then the board, then
 * launch. They replaced the little lobby card that used to float over the 3D board, and a chapter
 * stepper binds them to the draft page that follows.
 */
export function SetupScreen({ onStart, onPlayOnline, onBack }: SetupScreenProps) {
  const [entries, setEntries] = useState<TableEntry[]>(loadTable);
  const [step, setStep] = useState<SetupStepId>("players");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => rememberTable(entries), [entries]);

  const launch = (mapId: MapId) =>
    onStart(
      entries.map((entry, index) => entry.name.trim() || `Joueur ${index + 1}`),
      mapId,
    );

  return (
    <FlowShell
      step={step}
      onStepBack={(target) => setStep(target === "map" ? "map" : "players")}
      leading={
        onBack && (
          <button type="button" className="icon-button" onClick={onBack} aria-label="Retour au menu">
            <UiIcon name="arrowLeft" />
          </button>
        )
      }
      corner={
        <>
          {onPlayOnline && (
            <button type="button" className="btn btn--sky btn--small flow__online" onClick={onPlayOnline}>
              <UiIcon name="globe" size={18} /> <span>En ligne</span>
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Comment jouer">
            <UiIcon name="help" />
          </button>
        </>
      }
    >
      {step === "players" ? (
        <PlayersStep
          key="players"
          entries={entries}
          onChange={setEntries}
          minPlayers={MIN_PLAYERS}
          maxPlayers={MAX_PLAYERS}
          nameMaxLength={NAME_MAX_LENGTH}
          onNext={() => setStep("map")}
        />
      ) : (
        <MapStep key="map" playerCount={entries.length} onBack={() => setStep("players")} onLaunch={launch} />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </FlowShell>
  );
}
