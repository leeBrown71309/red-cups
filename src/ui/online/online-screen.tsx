import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useUiStore } from "../../feedback/ui-store";
import { PLAYER_COLORS } from "../../game/types";
import { useAccountStore } from "../../net/account-store";
import { buildInviteLink, normalizeRoomCode, type RoomPlayer } from "../../net/room-api";
import { useRoomStore } from "../../net/room-store";
import { FlowFooter, FlowShell } from "../components/flow-shell";
import { KickButton } from "../components/kick-button";
import { ModalShell } from "../components/modal-shell";
import { PlayerAvatar } from "../components/player-avatar";
import { VoiceBadge, VoiceMicButton } from "../components/voice-controls";
import { EventToasts } from "../hud/event-toasts";
import { UiIcon } from "../icons/ui-icon";
import { MapStep } from "../setup/map-step";
import { PlayersTable } from "../setup/players-table";
import { AccountPanel } from "./account-panel";
import { AvatarPicker, firstFreeAvatar } from "./avatar-picker";
import { loadOnlineIdentity, ONLINE_NAME_MAX_LENGTH, saveOnlineIdentity } from "./online-name";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

/**
 * Online play, before the board, on the same full-screen pages as the local setup: who you are, then a room
 * to create or join, then the lobby (the table, chapter one) where the host picks the board (chapter two)
 * and starts the game. Only seated players exist: there is no way to watch a game without playing it.
 */
export function OnlineScreen() {
  const view = useRoomStore((state) => state.view);
  const preview = useRoomStore((state) => state.preview);
  const accountError = useAccountStore((state) => state.error);

  // Errors show as toasts, over any panel.
  useEffect(() => {
    if (accountError) useUiStore.getState().pushToast({ id: "account-error", text: accountError, tone: "bad" });
  }, [accountError]);

  if (view === "lobby") return <RoomLobby />;
  if (preview?.kicked) return <RejoinRoom code={preview.code} />;
  if (preview) return <JoinRoom players={preview.players} code={preview.code} />;
  return <OnlineHome />;
}

/** A page of the online flow that is not a chapter yet (home, join): the title and its context beside a form. */
function OnlinePage({
  leading,
  title,
  lead,
  aside,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FlowShell step={null} leading={leading} corner={<VoiceMicButton />}>
      <section className="onpage">
        <div className="onpage__intro">
          <h1>{title}</h1>
          {lead && <p className="onpage__lead">{lead}</p>}
          {aside}
        </div>
        <div className="onpage__card">{children}</div>
      </section>
      <EventToasts />
    </FlowShell>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="icon-button" onClick={onClick} aria-label={label}>
      <UiIcon name="arrowLeft" />
    </button>
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
    <OnlinePage
      leading={<BackButton onClick={closeMenu} label="Retour au menu" />}
      title={
        <>
          Une table, <br />
          chacun chez soi
        </>
      }
      lead="Crée un salon et partage son code, ou rejoins celui d’un ami."
      aside={<AccountPanel />}
    >
      <NameField identity={identity} />
      <div className="onpage__group">
        <span className="onpage__label">Ton avatar</span>
        <AvatarPicker selected={avatar} taken={[]} onSelect={setAvatar} />
      </div>
      <button
        type="button"
        className="btn btn--cup btn--large onpage__cta"
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
    </OnlinePage>
  );
}

/** A room the host sent this player away from: they may ask to come back, and wait for the answer. */
function RejoinRoom({ code }: { code: string }) {
  const busy = useRoomStore((state) => state.busy);
  const waiting = useRoomStore((state) => state.rejoinWaitingFor === code);
  const requestRejoin = useRoomStore((state) => state.requestRejoin);
  const cancelWait = useRoomStore((state) => state.cancelRejoinWait);
  const clearPreview = useRoomStore((state) => state.clearPreview);
  const identity = useSeatIdentity();
  const avatar = identity.rememberedAvatar ?? 0;

  return (
    <OnlinePage
      leading={<BackButton onClick={clearPreview} label="Retour" />}
      title={
        <>
          Retour à <br />
          la table
        </>
      }
      lead={`Salon ${formatCode(code)}`}
    >
      {waiting ? (
        <>
          <p className="modal-lead">Demande envoyée : l’hôte doit l’accepter. Reste sur cette page.</p>
          <button
            type="button"
            className="btn btn--cream btn--small"
            onClick={() => {
              cancelWait();
              clearPreview();
            }}
          >
            Annuler la demande
          </button>
        </>
      ) : (
        <>
          <p className="modal-lead">L’hôte t’a exclu de ce salon. Tu peux lui demander de te laisser revenir.</p>
          <NameField identity={identity} />
          <button
            type="button"
            className="btn btn--cup btn--large onpage__cta"
            disabled={busy || !identity.isValid}
            onClick={() => {
              saveOnlineIdentity(identity.name, avatar);
              void requestRejoin(identity.name, avatar);
            }}
          >
            <UiIcon name="play" size={22} /> Demander à revenir
          </button>
        </>
      )}
    </OnlinePage>
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
    <OnlinePage
      leading={<BackButton onClick={clearPreview} label="Retour" />}
      title={
        <>
          Rejoindre <br />
          la table
        </>
      }
      lead={`Salon ${formatCode(code)} : ${players.length} places prises sur ${MAX_PLAYERS}.`}
      aside={<RosterList players={players} />}
    >
      <NameField identity={identity} />
      <div className="onpage__group">
        <span className="onpage__label">Ton avatar</span>
        <AvatarPicker selected={avatar} taken={taken} onSelect={setAvatar} />
      </div>
      <button
        type="button"
        className="btn btn--cup btn--large onpage__cta"
        disabled={busy || !identity.isValid || !avatarFree}
        onClick={() => {
          saveOnlineIdentity(identity.name, avatar);
          void join(code, identity.name, avatar);
        }}
      >
        <UiIcon name="play" size={22} /> Prendre place
      </button>
    </OnlinePage>
  );
}

/** Chapter one for a room: the table and its seats. The host then picks the board (chapter two) and launches. */
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
  const connected = useRoomStore((state) => state.connectedUserIds);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [pickingMap, setPickingMap] = useState(false);
  const [changingAvatar, setChangingAvatar] = useState(false);
  const [shuffles, setShuffles] = useState(0);
  const [flourish, setFlourish] = useState(false);
  const me = players.find((player) => player.userId === myUserId);
  const isHost = myUserId !== null && myUserId === hostId;
  const takenByOthers = players.filter((player) => player.userId !== myUserId).map((player) => player.avatar);

  // The staggered glide after a toss only lasts a moment.
  useEffect(() => {
    if (!flourish) return undefined;
    const timer = window.setTimeout(() => setFlourish(false), 900);
    return () => window.clearTimeout(timer);
  }, [flourish]);

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

  const toss = () => {
    setShuffles((count) => count + 1);
    setFlourish(true);
    void shuffleOrder();
  };

  const leaveButton = (
    <button
      type="button"
      className="icon-button"
      onClick={() => void leave()}
      disabled={busy}
      aria-label="Quitter le salon"
    >
      <UiIcon name="arrowLeft" />
    </button>
  );
  const enoughPlayers = players.length >= MIN_PLAYERS;

  if (isHost && pickingMap) {
    return (
      <FlowShell step="map" onStepBack={() => setPickingMap(false)} leading={leaveButton} corner={<VoiceMicButton />}>
        <MapStep
          playerCount={players.length}
          onBack={() => setPickingMap(false)}
          onLaunch={(mapId) => {
            if (enoughPlayers && !busy) void startGame(mapId);
          }}
        />
        <EventToasts />
      </FlowShell>
    );
  }

  return (
    <FlowShell step="players" leading={leaveButton} corner={<VoiceMicButton />}>
      <section className="players players--online" aria-labelledby="room-title">
        <div className="players__intro">
          <h1 id="room-title" className="players__code">
            {formatCode(code)}
          </h1>
          <p className="players__lead">
            {enoughPlayers
              ? "L’ordre du tour est celui de la table. Chacun choisira son Cups Power, les passifs sont tirés au sort."
              : "Il faut au moins deux joueurs : partage le code ou le lien."}
          </p>
          <div className="online-share">
            <button type="button" className="btn btn--cream btn--small" onClick={() => void copy("code")}>
              <UiIcon name={copied === "code" ? "check" : "copy"} size={18} />
              {copied === "code" ? (
                "Copié !"
              ) : (
                <>
                  <span className="flow-foot__wide">Copier le code</span>
                  <span className="flow-foot__narrow">Code</span>
                </>
              )}
            </button>
            <button type="button" className="btn btn--cream btn--small" onClick={() => void copy("link")}>
              <UiIcon name={copied === "link" ? "check" : "link"} size={18} />
              {copied === "link" ? (
                "Copié !"
              ) : (
                <>
                  <span className="flow-foot__wide">Copier le lien</span>
                  <span className="flow-foot__narrow">Lien</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="players__stage">
          <PlayersTable
            seats={players.map((player) => ({
              key: player.userId,
              name: player.name,
              color: PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0],
            }))}
            shuffles={shuffles}
            flourish={flourish}
          />
        </div>

        <ol className="players__roster">
          {players.map((player, index) => {
            const online = connected.includes(player.userId) || player.userId === myUserId;
            const color = PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0];
            return (
              <li
                key={player.userId}
                className="seat seat--online"
                style={{ "--seat-color": color, "--order": index } as CSSProperties}
              >
                <span className="seat__rank">{index + 1}</span>
                <span className="seat__avatar">
                  <PlayerAvatar color={color} size={52} />
                </span>
                <span className="seat__who">
                  <span className="seat__label">
                    {player.userId === hostId ? "Hôte" : index === 0 ? "Premier à jouer" : `Joueur ${index + 1}`}
                  </span>
                  <strong className="seat__name">
                    {player.name}
                    {player.userId === myUserId && <em> (toi)</em>}
                  </strong>
                </span>
                <span className="seat__badges">
                  <VoiceBadge userId={player.userId} />
                  {player.userId === hostId && <UiIcon name="crown" size={18} />}
                  {isHost && player.userId !== myUserId && (
                    <KickButton name={player.name} disabled={busy} onKick={() => void kick(player.userId)} />
                  )}
                  <span
                    className={`online-dot ${online ? "is-online" : ""}`}
                    title={online ? "Connecté" : "Déconnecté"}
                  />
                </span>
              </li>
            );
          })}
        </ol>

        <FlowFooter>
          {isHost && (
            <button type="button" className="btn btn--gold" onClick={toss} disabled={busy || !enoughPlayers}>
              <UiIcon name="dice" size={20} />
              <span>
                Mélanger<span className="flow-foot__wide"> l’ordre</span>
              </span>
            </button>
          )}
          {me && (
            <button type="button" className="btn btn--cream" onClick={() => setChangingAvatar(true)}>
              <UiIcon name="user" size={20} />
              <span>
                Avatar<span className="flow-foot__wide"> à changer</span>
              </span>
            </button>
          )}
          <p className="flow-foot__count" aria-live="polite">
            <strong>{players.length}</strong> / {MAX_PLAYERS}
            <span className="flow-foot__wide"> joueurs</span>
          </p>
          {isHost ? (
            <button
              type="button"
              className="btn btn--cup btn--large flow-foot__next"
              onClick={() => setPickingMap(true)}
              disabled={busy || !enoughPlayers}
              data-autofocus
            >
              Choisir la carte
              <UiIcon name="arrowRight" size={22} />
            </button>
          ) : (
            <p className="online__waiting flow-foot__next">L’hôte choisit la carte et lance la partie…</p>
          )}
        </FlowFooter>
      </section>
      {changingAvatar && me && (
        <ModalShell title="Changer d’avatar" size="small" onClose={() => setChangingAvatar(false)}>
          <AvatarPicker
            selected={me.avatar}
            taken={takenByOthers}
            onSelect={(avatar) => {
              saveOnlineIdentity(me.name, avatar);
              void updateSeat(me.name, avatar);
              setChangingAvatar(false);
            }}
          />
        </ModalShell>
      )}
      <EventToasts />
    </FlowShell>
  );
}

/** The seats already taken in a room, read-only: shown to somebody about to join it. */
function RosterList({ players }: { players: RoomPlayer[] }) {
  return (
    <ol className="roster-peek">
      {players.map((player, index) => (
        <li key={player.userId} className="roster-peek__player">
          <span className="roster-peek__rank">{index + 1}</span>
          <PlayerAvatar color={PLAYER_COLORS[player.avatar] ?? PLAYER_COLORS[0]} size={34} />
          <span className="roster-peek__name">{player.name}</span>
        </li>
      ))}
    </ol>
  );
}

/** Split in two halves so the code reads aloud easily. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
