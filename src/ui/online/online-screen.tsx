import { useState } from "react";
import { PLAYER_COLORS } from "../../game/types";
import { useAccountStore } from "../../net/account-store";
import { buildInviteLink, normalizeRoomCode, type RoomPlayer } from "../../net/room-api";
import { useRoomStore } from "../../net/room-store";
import { AudioToggles } from "../components/audio-controls";
import { VoiceBadge, VoiceMicButton } from "../components/voice-controls";
import { FullscreenButton } from "../components/fullscreen-button";
import { GameLogo } from "../components/game-logo";
import { KickButton } from "../components/kick-button";
import { PlayerAvatar } from "../components/player-avatar";
import { UiIcon } from "../icons/ui-icon";
import { AccountPanel } from "./account-panel";
import { drawChosenMap } from "../lobby/map-choice-store";
import { MapPicker } from "../lobby/map-picker";
import { AvatarPicker, firstFreeAvatar } from "./avatar-picker";
import { loadOnlineIdentity, ONLINE_NAME_MAX_LENGTH, saveOnlineIdentity } from "./online-name";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

/**
 * Online play, before the board: who you are, then a room to create or join,
 * then the lobby where the host starts the game. Only seated players exist:
 * there is no way to watch a game without playing it.
 */
export function OnlineScreen() {
  const view = useRoomStore((state) => state.view);
  const preview = useRoomStore((state) => state.preview);
  const error = useRoomStore((state) => state.error);
  const accountError = useAccountStore((state) => state.error);

  let panel = <OnlineHome />;
  if (view === "lobby") panel = <RoomLobby />;
  else if (preview) panel = <JoinRoom players={preview.players} code={preview.code} />;

  return (
    <main className="lobby online">
      <div className="lobby__corner">
        <AudioToggles />
        <VoiceMicButton />
        <FullscreenButton />
      </div>

      <section className="lobby__hero">
        <GameLogo />
        <p className="lobby__tagline">Chacun sur son écran, la même table.</p>
        <AccountPanel />
      </section>

      <section className="lobby__panel panel" aria-live="polite">
        {panel}
        {(error ?? accountError) && (
          <p className="online__error" role="alert">
            <UiIcon name="info" size={18} /> {error ?? accountError}
          </p>
        )}
      </section>
    </main>
  );
}

/** The name a seat is taken under: a Google profile's, or the one a guest types. */
function useSeatIdentity() {
  const profileName = useAccountStore((state) => state.displayName);
  const [remembered] = useState(loadOnlineIdentity);
  const [typedName, setTypedName] = useState(remembered.name);
  const name = (profileName ?? typedName).trim();
  return {
    name,
    fromProfile: profileName !== null,
    typedName: profileName ?? typedName,
    setTypedName,
    rememberedAvatar: remembered.avatar,
    isValid: name.length >= 1 && name.length <= ONLINE_NAME_MAX_LENGTH,
  };
}

function NameField({ identity }: { identity: ReturnType<typeof useSeatIdentity> }) {
  return (
    <label className="field">
      <span>{identity.fromProfile ? "Ton nom de profil" : "Ton nom"}</span>
      <input
        className="lobby-player__input"
        value={identity.typedName}
        maxLength={ONLINE_NAME_MAX_LENGTH}
        placeholder="Comment la table t’appelle"
        disabled={identity.fromProfile}
        onChange={(event) => identity.setTypedName(event.target.value)}
      />
    </label>
  );
}

function OnlineHome() {
  const busy = useRoomStore((state) => state.busy);
  const createAndJoin = useRoomStore((state) => state.createAndJoin);
  const lookUpRoom = useRoomStore((state) => state.lookUpRoom);
  const closeMenu = useRoomStore((state) => state.closeMenu);
  const identity = useSeatIdentity();
  const [avatar, setAvatar] = useState(firstFreeAvatar([], identity.rememberedAvatar));
  const [codeInput, setCodeInput] = useState("");
  const code = normalizeRoomCode(codeInput);

  const create = () => {
    saveOnlineIdentity(identity.name, avatar);
    void createAndJoin(identity.name, avatar);
  };

  return (
    <>
      <header className="lobby__panel-header">
        <div>
          <span className="eyebrow">Jouer en ligne</span>
          <h1>Crée ou rejoins une table</h1>
        </div>
        <button type="button" className="icon-button" onClick={closeMenu} aria-label="Retour au jeu local">
          <UiIcon name="close" />
        </button>
      </header>

      <NameField identity={identity} />
      <AvatarPicker selected={avatar} taken={[]} onSelect={setAvatar} />
      <button
        type="button"
        className="btn btn--cup btn--large lobby__start"
        onClick={create}
        disabled={busy || !identity.isValid}
      >
        <UiIcon name="plus" size={22} /> Créer un salon
      </button>

      <div className="online__divider">
        <span>ou</span>
      </div>

      <form
        className="online__join"
        onSubmit={(event) => {
          event.preventDefault();
          if (code) void lookUpRoom(code);
        }}
      >
        <input
          className="lobby-player__input online__code-input"
          value={codeInput}
          placeholder="Code du salon"
          aria-label="Code du salon"
          autoCapitalize="characters"
          onChange={(event) => setCodeInput(event.target.value)}
        />
        <button type="submit" className="btn btn--sky" disabled={busy || !code}>
          Rejoindre <UiIcon name="arrowRight" size={20} />
        </button>
      </form>
    </>
  );
}

/** A lobby found by its code: pick a free avatar, then sit down. */
function JoinRoom({ code, players }: { code: string; players: RoomPlayer[] }) {
  const busy = useRoomStore((state) => state.busy);
  const join = useRoomStore((state) => state.join);
  const clearPreview = useRoomStore((state) => state.clearPreview);
  const identity = useSeatIdentity();
  const taken = players.map((player) => player.avatar);
  const [avatar, setAvatar] = useState(() => firstFreeAvatar(taken, identity.rememberedAvatar));
  const avatarFree = !taken.includes(avatar);

  return (
    <>
      <header className="lobby__panel-header">
        <div>
          <span className="eyebrow">Salon {formatCode(code)}</span>
          <h1>Rejoindre la table</h1>
        </div>
        <span className="count-badge">
          {players.length}/{MAX_PLAYERS}
        </span>
      </header>

      <RosterList players={players} />
      <NameField identity={identity} />
      <AvatarPicker selected={avatar} taken={taken} onSelect={setAvatar} />
      <button
        type="button"
        className="btn btn--cup btn--large lobby__start"
        disabled={busy || !identity.isValid || !avatarFree}
        onClick={() => {
          saveOnlineIdentity(identity.name, avatar);
          void join(code, identity.name, avatar);
        }}
      >
        <UiIcon name="play" size={22} /> Prendre place
      </button>
      <button type="button" className="btn btn--cream btn--small" onClick={clearPreview}>
        Annuler
      </button>
    </>
  );
}

function RoomLobby() {
  const code = useRoomStore((state) => state.code);
  const players = useRoomStore((state) => state.players);
  const hostId = useRoomStore((state) => state.hostId);
  const myUserId = useRoomStore((state) => state.myUserId);
  const busy = useRoomStore((state) => state.busy);
  const startGame = useRoomStore((state) => state.startGame);
  const leave = useRoomStore((state) => state.leave);
  const updateSeat = useRoomStore((state) => state.updateSeat);
  const shuffleOrder = useRoomStore((state) => state.shuffleOrder);
  const kick = useRoomStore((state) => state.kick);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // Like the local lobby, the host picks the board in a step of its own, once the table is set.
  const [pickingMap, setPickingMap] = useState(false);
  const me = players.find((player) => player.userId === myUserId);
  const isHost = myUserId !== null && myUserId === hostId;
  const takenByOthers = players.filter((player) => player.userId !== myUserId).map((player) => player.avatar);

  if (!code) return null;

  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : buildInviteLink(code));
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      // Clipboard access can be refused; the code stays visible to read aloud.
    }
  };

  if (isHost && pickingMap) {
    return (
      <>
        <header className="lobby__panel-header">
          <div>
            <span className="eyebrow">Salon {formatCode(code)} · étape 2/2</span>
            <h1>Sur quelle carte ?</h1>
          </div>
          <span className="count-badge">{players.length} joueurs</span>
        </header>

        <MapPicker />

        <div className="lobby__step-actions">
          <button type="button" className="btn btn--cream" onClick={() => setPickingMap(false)}>
            ← Retour
          </button>
          <button
            type="button"
            className="btn btn--cup btn--large lobby__start"
            onClick={() => void startGame(drawChosenMap())}
            disabled={busy || players.length < MIN_PLAYERS}
          >
            <UiIcon name="play" size={22} /> Lancer la partie
          </button>
        </div>
        <p className="lobby__note">
          {players.length < MIN_PLAYERS
            ? "Il faut au moins deux joueurs : reviens partager le code ou le lien."
            : "Les autres joueurs découvriront la carte au lancement."}
        </p>
      </>
    );
  }

  return (
    <>
      <header className="lobby__panel-header">
        <div>
          <span className="eyebrow">Salon{isHost ? " · étape 1/2" : ""}</span>
          <h1 className="online__code">{formatCode(code)}</h1>
        </div>
        <span className="count-badge">
          {players.length}/{MAX_PLAYERS}
        </span>
      </header>

      {/* One compact row: the roster below gets the height back on landscape phones. */}
      <div className="lobby__tools online__tools">
        <button
          type="button"
          className="btn btn--cream btn--small"
          onClick={() => void copy("code")}
          aria-label="Copier le code"
          title="Copier le code"
        >
          <UiIcon name={copied === "code" ? "check" : "copy"} size={18} /> {copied === "code" ? "Copié !" : "Code"}
        </button>
        <button
          type="button"
          className="btn btn--cream btn--small"
          onClick={() => void copy("link")}
          aria-label="Copier le lien"
          title="Copier le lien"
        >
          <UiIcon name={copied === "link" ? "check" : "link"} size={18} /> {copied === "link" ? "Copié !" : "Lien"}
        </button>
        {isHost && (
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={() => void shuffleOrder()}
            disabled={busy || players.length < MIN_PLAYERS}
            aria-label="Mélanger l’ordre"
            title="Mélanger l’ordre"
          >
            <UiIcon name="dice" size={18} /> Mélanger
          </button>
        )}
      </div>

      <RosterList
        players={players}
        hostId={hostId}
        myUserId={myUserId}
        onKick={isHost ? kick : undefined}
        busy={busy}
      />

      {me && (
        <details className="online__change-avatar">
          <summary>Changer d’avatar</summary>
          <AvatarPicker
            selected={me.avatar}
            taken={takenByOthers}
            onSelect={(avatar) => {
              saveOnlineIdentity(me.name, avatar);
              void updateSeat(me.name, avatar);
            }}
          />
        </details>
      )}

      {!isHost && <p className="online__waiting">En attente de l’hôte : il choisit la carte puis lance la partie…</p>}
      <p className="lobby__note">
        {players.length < MIN_PLAYERS
          ? "Il faut au moins deux joueurs. Partage le code ou le lien."
          : "L’ordre du tour est celui de la liste. Chacun choisira son passif parmi ses cartes."}
      </p>
      <div className="lobby__actions">
        <button
          type="button"
          className="btn btn--cream lobby__leave"
          onClick={() => void leave()}
          disabled={busy}
          aria-label="Quitter le salon"
        >
          <UiIcon name="logout" size={18} /> Quitter
        </button>
        {isHost && (
          <button
            type="button"
            className="btn btn--cup lobby__start"
            onClick={() => setPickingMap(true)}
            disabled={busy || players.length < MIN_PLAYERS}
            aria-label="Suivant : choisir la carte"
          >
            Suivant →
          </button>
        )}
      </div>
    </>
  );
}

function RosterList({
  players,
  hostId = null,
  myUserId = null,
  onKick,
  busy = false,
}: {
  players: RoomPlayer[];
  hostId?: string | null;
  myUserId?: string | null;
  /** Given to the host only: a button next to every other player. */
  onKick?: (userId: string) => Promise<void>;
  busy?: boolean;
}) {
  const connected = useRoomStore((state) => state.connectedUserIds);
  return (
    <ol className="lobby__players">
      {players.map((player, index) => {
        const online = connected.includes(player.userId) || player.userId === myUserId;
        return (
          <li className="lobby-player online-player" key={player.userId}>
            <span className="lobby-player__seat">{index + 1}</span>
            <PlayerAvatar color={PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0]} size={40} />
            <span className="online-player__name">
              {player.name}
              {player.userId === myUserId && <em> (toi)</em>}
            </span>
            <span className="online-player__badges">
              <VoiceBadge userId={player.userId} />
              {player.userId === hostId && <UiIcon name="crown" size={18} />}
              {onKick && player.userId !== myUserId && (
                <KickButton name={player.name} disabled={busy} onKick={() => void onKick(player.userId)} />
              )}
              {myUserId && (
                <span
                  className={`online-dot ${online ? "is-online" : ""}`}
                  title={online ? "Connecté" : "Déconnecté"}
                />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Split in two halves so the code reads aloud easily. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
