import { useGameStore } from "../../game/store";
import { useRoomStore } from "../../net/room-store";
import { boardCamera } from "../../scene/board-stage";
import { AudioToggles } from "../components/audio-controls";
import { ItemIcon } from "../icons/item-icon";
import { UiIcon } from "../icons/ui-icon";
import { PlayersBar } from "./players-bar";

interface TopBarProps {
  onOpenMenu: () => void;
  onOpenHelp: () => void;
}

export function TopBar({ onOpenMenu, onOpenHelp }: TopBarProps) {
  const round = useGameStore((state) => state.round);

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="icon-button icon-button--solid" onClick={onOpenMenu} aria-label="Menu pause">
          <UiIcon name="menu" />
        </button>
        <span className="round-chip" title="Tour de table">
          <small>Tour</small>
          <strong>{round}</strong>
        </span>
        <BulletChip />
        <OnlineChip />
      </div>
      <PlayersBar />
      <div className="top-bar__right">
        <AudioToggles />
        <button type="button" className="icon-button" onClick={onOpenHelp} aria-label="Comment jouer">
          <UiIcon name="help" />
        </button>
      </div>
    </header>
  );
}

/** Online only: the room code, and a warning while the connection is down. */
function OnlineChip() {
  const code = useRoomStore((state) => (state.view === "playing" ? state.code : null));
  const connection = useRoomStore((state) => state.connection);
  if (!code) return null;
  const online = connection === "online";
  return (
    <span
      className={`online-chip ${online ? "is-online" : "is-offline"}`}
      title={online ? `Salon ${code} : connecté` : "Connexion perdue, reconnexion…"}
    >
      <span className={`online-dot ${online ? "is-online" : ""}`} />
      <strong>{online ? code : "Reconnexion…"}</strong>
    </span>
  );
}

/** Keeps Bullet Bill on everybody's mind for as long as it is on the board. */
function BulletChip() {
  const bullet = useGameStore((state) => state.bulletBill);
  if (!bullet) return null;

  const waiting = bullet.status === "waiting";
  const label = waiting
    ? `Bullet Bill attend au départ et fonce au tour ${bullet.spawnRound}. Toucher pour le voir.`
    : `Bullet Bill traque le joueur le plus proche depuis la case ${bullet.position}. Toucher pour le voir.`;

  return (
    <button
      type="button"
      className={`bullet-chip ${waiting ? "is-waiting" : "is-hunting"}`}
      onClick={() => boardCamera.focusOnNode(bullet.position)}
      title={label}
      aria-label={label}
    >
      <ItemIcon itemId="bullet-bill" size={26} />
      <span className="bullet-chip__text">
        <small>{waiting ? `Tour ${bullet.spawnRound}` : "Traque"}</small>
        <strong>Case {bullet.position}</strong>
      </span>
    </button>
  );
}
