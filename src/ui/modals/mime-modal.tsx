import { useMemo, useState } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { getCopyableCard, getCopyableKinds, type MimeCopyKind } from "../../game/mime";
import type { Player } from "../../game/types";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { CardSlideOver, type CardEntry } from "../hud/card-slide-over";
import { PassiveIcon } from "../icons/passive-icon";
import { UiIcon } from "../icons/ui-icon";

/**
 * Mime's copy, in a window of its own: first the player to copy, then what to take from them. Passifs are public, so
 * the passif can be read in the slide-over before it is chosen; the Cups Power is secret, so that choice is a gamble.
 */
export function MimeModal({
  targets,
  onCopy,
  onClose,
}: {
  targets: Player[];
  onCopy: (targetId: string, kind: MimeCopyKind) => void;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const target = useMemo(() => targets.find((candidate) => candidate.id === targetId) ?? null, [targets, targetId]);
  const passifId = target ? getCopyableCard(target, "passif") : null;
  const kinds = target ? getCopyableKinds(target) : [];
  const detailEntries: CardEntry[] = passifId ? [{ label: "Passif", cardId: passifId }] : [];

  // Escape and the backdrop close the details first, then the window.
  const close = () => (detailsOpen ? setDetailsOpen(false) : onClose());
  const back = () => {
    setDetailsOpen(false);
    setTargetId(null);
  };

  return (
    <>
      <ModalShell
        title={target ? `Copier ${target.name}` : "Qui veux-tu copier ?"}
        eyebrow="Mime"
        tone="grape"
        size="small"
        onClose={close}
        footer={
          target ? (
            <button type="button" className="btn btn--cream" onClick={back}>
              <UiIcon name="chevronLeft" size={18} /> Choisir un autre joueur
            </button>
          ) : (
            <button type="button" className="btn btn--cream" onClick={onClose}>
              Annuler
            </button>
          )
        }
      >
        {target ? (
          <div className="mime-choice">
            <div className="mime-choice__who">
              <PlayerAvatar color={target.color} size={56} />
              <p>
                La copie dure jusqu’à la fin de ton tour et ne coûte aucune énergie. Tu connais son passif, pas son Cups
                Power.
              </p>
            </div>
            {kinds.includes("actif") && (
              <button
                type="button"
                className="mime-option mime-option--secret"
                onClick={() => onCopy(target.id, "actif")}
              >
                <span className="mime-option__icon" aria-hidden="true">
                  <UiIcon name="help" size={34} strokeWidth={2.4} />
                </span>
                <span className="mime-option__text">
                  <span className="eyebrow">Cups Power</span>
                  <strong>Copier à l’aveugle</strong>
                  <small>Tu ne sais pas lequel tu obtiens : tu prends le risque.</small>
                </span>
              </button>
            )}
            {passifId && (
              <div className="mime-option mime-option--passif">
                <button type="button" className="mime-option__main" onClick={() => onCopy(target.id, "passif")}>
                  <span className="mime-option__icon" aria-hidden="true">
                    <PassiveIcon passiveId={passifId} size={44} />
                  </span>
                  <span className="mime-option__text">
                    <span className="eyebrow">Passif</span>
                    <strong>{PASSIVE_CATALOG[passifId].name}</strong>
                    <small>Tu sais ce que tu copies.</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`btn btn--small ${detailsOpen ? "btn--gold" : "btn--cream"}`}
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen(!detailsOpen)}
                >
                  <UiIcon name="info" size={16} /> Détails
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="mime-targets">
            {targets.map((candidate) => {
              const candidatePassif = getCopyableCard(candidate, "passif");
              return (
                <li key={candidate.id}>
                  <button type="button" className="mime-target" onClick={() => setTargetId(candidate.id)}>
                    <PlayerAvatar color={candidate.color} size={44} />
                    <span className="mime-target__text">
                      <strong>{candidate.name}</strong>
                      <small>
                        {candidatePassif ? `Passif · ${PASSIVE_CATALOG[candidatePassif].name}` : "Passif non copiable"}
                      </small>
                    </span>
                    <UiIcon name="chevronRight" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ModalShell>
      {detailsOpen && detailEntries.length > 0 && (
        <CardSlideOver entries={detailEntries} openLabel="Passif" onOpen={() => setDetailsOpen(false)} />
      )}
    </>
  );
}
