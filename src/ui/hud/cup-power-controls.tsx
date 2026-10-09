import { useMemo, useState, type ReactNode } from "react";
import { PASSIVE_CATALOG } from "../../game/catalog";
import { getCopyableCard, getCopyableKinds, getMimeTargets } from "../../game/mime";
import { PentagramIcon } from "../icons/pentagram-icon";
import { hasCard, ownsCard } from "../../game/cards";
import { canPlaceMark, canTeleportInTurn, findMark } from "../../game/mage-queries";
import { canDig, getCrossingEnergy, getCrossings, getDigTargets } from "../../game/mole";
import { canSwap, getSisterNode } from "../../game/sister";
import { useGameStore } from "../../game/store";
import type { GameState, Player } from "../../game/types";
import { MAGE_MAX_LUCK, MOLE_DIG_ENERGY, SISTER_SWAP_ENERGY } from "../../game/types";
import { useUiStore } from "../../feedback/ui-store";
import { UiIcon } from "../icons/ui-icon";

/**
 * The buttons of the Cups Power of patch 0.2.3 that play in the dock: Mime's copy, Taupe's dig and everybody's
 * tunnels, Mage noir's pentagram and teleport, Sœur Fantôme's swap. Each one asks the engine whether it may act, so
 * the dock and the rules never disagree.
 */

/** The cooldown, in words, for a power that returns at `readyRound`. */
function formatReturn(readyRound: number, round: number): string | null {
  return readyRound > round ? `de retour au tour ${readyRound}` : null;
}

/** Mime: pick the player whose Cups Power is borrowed for the turn. */
function MimeControl({ game, player }: { game: GameState; player: Player }) {
  const [open, setOpen] = useState(false);
  const copy = useGameStore((state) => state.mimeCopy);
  const targets = useMemo(() => getMimeTargets(game, player), [game, player]);
  const waiting = formatReturn(player.mimeReadyRound ?? 0, game.round);
  if (player.mimicId) return null;

  if (open && targets.length > 0) {
    return (
      <div className="power-picker" role="group" aria-label="Copier un joueur">
        <span className="power-picker__title">Copier pour ce tour…</span>
        {targets.map((target) => (
          <div key={target.id} className="power-picker__row">
            <span className="power-picker__who">
              <span className="power-picker__dot" style={{ background: target.color }} /> {target.name}
            </span>
            {getCopyableKinds(target).map((kind) => {
              const passifId = getCopyableCard(target, "passif");
              return (
                <button
                  key={kind}
                  type="button"
                  className="destination-chip"
                  onClick={() => {
                    setOpen(false);
                    copy(target.id, kind);
                  }}
                >
                  {kind === "actif" ? "Cups Power" : `Passif · ${passifId ? PASSIVE_CATALOG[passifId].name : ""}`}
                </button>
              );
            })}
          </div>
        ))}
        <button type="button" className="btn btn--small btn--cream" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    );
  }
  const disabled = targets.length === 0;
  return (
    <button
      type="button"
      className="btn btn--small btn--grape"
      onClick={() => setOpen(true)}
      disabled={disabled}
      title={
        waiting
          ? `Mime : ${waiting}`
          : disabled
            ? "Personne dont le Cups Power ou le passif puisse être copié pour l’instant"
            : "Copie le Cups Power ou le passif d’un autre joueur jusqu’à la fin de ton tour, sans énergie"
      }
    >
      <UiIcon name="sparkle" size={16} /> Copier un joueur{waiting ? ` · ${waiting}` : ""}
    </button>
  );
}

/** Taupe: dig a tunnel to a tile already visited, chosen on the board. */
function DigControl({ game, player }: { game: GameState; player: Player }) {
  const digMode = useUiStore((state) => state.digMode);
  const setDigMode = useUiStore((state) => state.setDigMode);
  const targets = useMemo(() => getDigTargets(game, player), [game, player]);
  const possible = canDig(game, player) && targets.length > 0;
  const waiting = formatReturn(player.moleReadyRound ?? 0, game.round);
  const reason = waiting
    ? `Creuser : ${waiting}`
    : game.energyLeft < MOLE_DIG_ENERGY
      ? `Creuser demande ${MOLE_DIG_ENERGY} points d’énergie`
      : !possible
        ? "Pas de case visitée où creuser depuis ici (la Red Cup, un piège ou un tunnel bloquent)"
        : null;
  return (
    <button
      type="button"
      className={`btn btn--small ${digMode ? "btn--gold" : "btn--cream"}`}
      onClick={() => setDigMode(!digMode)}
      disabled={!possible && !digMode}
      aria-pressed={digMode}
      title={
        reason ??
        `Creuse un tunnel vers une case déjà visitée et t’y déplace : ${MOLE_DIG_ENERGY} points d’énergie, une fois tous les 3 tours`
      }
    >
      <UiIcon name="target" size={16} /> {digMode ? "Choisis la case d’arrivée" : `Creuser · ${MOLE_DIG_ENERGY}`}
      {!digMode && waiting ? ` · ${waiting}` : ""}
    </button>
  );
}

/** Everybody: the tunnels that open on the tile the player stands on, for what each costs them. */
export function TunnelControls({ player }: { player: Player }) {
  const game = useGameStore();
  const crossTunnel = useGameStore((state) => state.crossTunnel);
  const crossings = useMemo(() => getCrossings(game, player), [game, player]);
  const tunnelHere = game.moleTunnels.filter((tunnel) => tunnel.a === player.position || tunnel.b === player.position);
  if (tunnelHere.length === 0) return null;
  return (
    <>
      {tunnelHere.map((tunnel) => {
        const to = tunnel.a === player.position ? tunnel.b : tunnel.a;
        const cost = getCrossingEnergy(tunnel, player);
        const open = crossings.some((crossing) => crossing.tunnel.id === tunnel.id);
        return (
          <button
            key={tunnel.id}
            type="button"
            className="btn btn--small btn--sky"
            onClick={() => crossTunnel(tunnel.id)}
            disabled={!open}
            title={
              open
                ? `Traverse le tunnel jusqu’en case ${to} : ${cost} points d’énergie ; il se referme derrière toi`
                : `Il faut ${cost} points d’énergie pour traverser ce tunnel`
            }
          >
            <UiIcon name="arrowRight" size={16} /> Tunnel → case {to} · {cost}
          </button>
        );
      })}
    </>
  );
}

/** Mage noir: lay the pentagram and teleport to it (the reserve shows under the energy). */
function MageControl({ game, player }: { game: GameState; player: Player }) {
  const placeMark = useGameStore((state) => state.placeMark);
  const teleport = useGameStore((state) => state.teleportToMark);
  const mark = findMark(game, player.id);
  const canTeleport = canTeleportInTurn(game, player);
  return (
    <>
      {canPlaceMark(game, player) && (
        <button
          type="button"
          className="btn btn--small btn--grape"
          onClick={placeMark}
          title="Trace un pentagramme sur ta case : tu pourras t’y téléporter. Un seul à la fois, jamais sur de la Boue"
        >
          <UiIcon name="sparkle" size={16} /> Poser le pentagramme
        </button>
      )}
      {mark && (
        <button
          type="button"
          className="btn btn--small btn--grape"
          disabled={!canTeleport}
          onClick={() => {
            teleport();
          }}
          title={
            canTeleport
              ? `Téléporte-toi sur ton pentagramme (case ${mark.nodeId}) : il te coûte un pentagramme`
              : `Ton pentagramme est sur ta case (${mark.nodeId}), ou la téléportation n’est pas possible maintenant`
          }
        >
          <UiIcon name="flag" size={16} /> Se téléporter · case ${mark.nodeId}
        </button>
      )}
    </>
  );
}

/** The mage's reserve as mini pentagrams, one lit for each left; at zero, the game is over for them. */
export function MageLuck({ luck }: { luck: number }) {
  return (
    <span
      className="mage-luck"
      role="img"
      aria-label={`Pentagrammes du Mage noir : ${luck} sur ${MAGE_MAX_LUCK}`}
      title={`Pentagrammes en réserve : ${luck}/${MAGE_MAX_LUCK}. Chaque téléportation en dépense un ; à zéro, il ne peut plus se téléporter avant d’en retrouver un.`}
    >
      {Array.from({ length: MAGE_MAX_LUCK }, (_, index) => (
        <PentagramIcon key={index} size={20} lit={index < luck} />
      ))}
    </span>
  );
}

/** Sœur Fantôme: swap places with the little ghost. */
function SisterControl({ game, player }: { game: GameState; player: Player }) {
  const swap = useGameStore((state) => state.swapWithSister);
  const possible: boolean = canSwap(game, player);
  const sister = getSisterNode(player);
  const waiting = formatReturn(player.swapReadyRound ?? 0, game.round);
  return (
    <button
      type="button"
      className="btn btn--small btn--sky"
      onClick={swap}
      disabled={!possible}
      title={
        possible
          ? `Échange ta place avec ta sœur (case ${sister}) : ${SISTER_SWAP_ENERGY} points d’énergie. Elle emporte ce qui était sur sa case`
          : waiting
            ? `Swap ${waiting}`
            : sister === player.position
              ? "Ta sœur est sur ta case"
              : `Swap demande ${SISTER_SWAP_ENERGY} points d’énergie, avant le déplacement, hors de l’Enfer`
      }
    >
      <UiIcon name="sparkle" size={16} /> Swap · {SISTER_SWAP_ENERGY}
    </button>
  );
}

/** Every Cups Power button the active player's cards give them, for the stage they are in. */
export function CupPowerControls({
  player,
  stage,
  children,
}: {
  player: Player;
  stage: "move" | "hell" | "after";
  /** Other buttons of the turn that belong with the powers (rescue, ignore arrows). */
  children?: ReactNode;
}) {
  const game = useGameStore();
  const beforeMove = stage !== "after";
  // One tidy zone of its own under the main actions; empty, it takes no room.
  return (
    <div className="dock-powers">
      {beforeMove && ownsCard(player, "mime") && <MimeControl game={game} player={player} />}
      {stage === "move" && hasCard(player, "mole") && <DigControl game={game} player={player} />}
      {stage === "move" && <TunnelControls player={player} />}
      {ownsCard(player, "black-mage") && <MageControl game={game} player={player} />}
      {stage === "move" && ownsCard(player, "ghost-sister") && <SisterControl game={game} player={player} />}
      {children}
    </div>
  );
}
