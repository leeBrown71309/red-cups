import { getLocalPlayerId } from "../net/room-store";
import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import { useGameStore } from "../game/store";
import type { GameState, PlayerId, PowerEvent } from "../game/types";
import {
  GHOST_SLAP_IMPACT_MS,
  GHOST_SLAP_MS,
  GHOST_TELEPORT_MS,
  MARK_SUCK_MS,
  MARK_TRANSIT_MS,
  SNOWBALL_FLIGHT_MS,
  TOMATO_FLIGHT_MS,
  TOMATO_VOLLEY_GAP_MS,
  TUNNEL_DIVE_MS,
} from "../theme/timing";
import { getFog } from "../ui/fog";
import { audioEngine } from "./audio-engine";
import { getMusicMood } from "./music-mood";
import { musicPlayer } from "./music-player";
import { pickSoundtrackTheme, useMapAuditionStore } from "./soundtrack-theme";
import { soundEffects } from "./sound-effects";

const COIN_SOUND_COOLDOWN_MS = 140;

/**
 * Mi-vu, Mi-vue: what the fog hides from this device stays silent too. The same viewer as the screens (see
 * `ui/fog.ts`): the seat of this device online, whoever decides on a shared screen.
 */
function getViewerFog() {
  return getFog(useGameStore.getState(), getLocalPlayerId());
}

/** Whether the fog lets the viewer of this device see (and so hear) what `playerId` does. */
function isSeen(playerId: PlayerId | null | undefined): boolean {
  return playerId === null || playerId === undefined || !getViewerFog().hiddenIds.has(playerId);
}

/** Whether whoever's turn it is stays out of the viewer's sight, or the viewer sees nothing at all. */
function isTurnUnseen(): boolean {
  const state = useGameStore.getState();
  const fog = getViewerFog();
  return fog.viewerHidden || !isSeen(state.players[state.activePlayerIndex]?.id);
}

/** Whether a deed of the viewer's sight changed: the viewer sees every change but those of others, when hidden. */
function seesChangeOf(playerId: PlayerId): boolean {
  const fog = getViewerFog();
  return !fog.viewerHidden || fog.viewerId === playerId;
}

/** Whether a Cups Power deed (not yet heard) moves `playerId`, so that the sound of the deed replaces a move's own. */
function isMovedByPower(playerId: PlayerId, heardSeq: number): boolean {
  const power = useGameStore.getState().lastPowerEvent;
  if (!power || power.seq <= heardSeq) return false;
  if (power.kind === "mark-teleport") return power.playerId === playerId || power.victimIds.includes(playerId);
  if (power.kind === "sister-swap") return power.playerId === playerId;
  return power.kind === "mage-fallen" && power.playerId === playerId;
}

/**
 * Wires presentation events to sounds, keeps the music's mood and soundtrack
 * in sync with the table and the map picker, and unlocks audio on the first
 * user gesture.
 */
export function startAudioFeedback(): () => void {
  let lastCoinSound = 0;
  // The Cups Power deeds heard so far: a deed's own sound stands for the moves, poofs and falls it causes.
  let heardPowerSeq = useGameStore.getState().lastPowerEvent?.seq ?? 0;

  const playPower = (event: PowerEvent) => {
    heardPowerSeq = event.seq;
    switch (event.kind) {
      case "tunnel-cross":
        if (event.closed) soundEffects.tunnelCollapse();
        break;
      case "mark-place":
        soundEffects.pentagramDraw();
        break;
      case "mark-teleport": {
        if (isSeen(event.playerId)) soundEffects.mageTeleport();
        const fire = event.victimIds.some((id) => isSeen(id)) || (event.mudHell && isSeen(event.playerId));
        if (fire) soundEffects.hellfire((MARK_SUCK_MS + MARK_TRANSIT_MS) / 1_000);
        break;
      }
      case "mage-fallen":
        if (isSeen(event.playerId)) soundEffects.mageFallen();
        break;
      case "sister-swap":
        if (isSeen(event.playerId)) soundEffects.sisterSwap();
        break;
      case "mime-copy":
        if (isSeen(event.playerId) && isSeen(event.targetId)) soundEffects.mimeCopy();
        break;
      default:
        break;
    }
  };

  const unlock = () => audioEngine.unlock();
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });

  // Buttons click on press rather than release so the UI feels immediate.
  const clickSound = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target || target.disabled || target.dataset.silent !== undefined) return;
    soundEffects.click();
  };
  window.addEventListener("pointerdown", clickSound);

  const unsubscribeFeedback = onFeedback((event: FeedbackEvent) => {
    switch (event.type) {
      case "pawn-hop":
        soundEffects.hop();
        break;
      case "pawn-slide":
        soundEffects.iceSlide();
        break;
      case "barrier-bump":
        soundEffects.error();
        break;
      case "blizzard":
        soundEffects.blizzardWind();
        break;
      case "ice-fall":
        if (isSeen(event.playerId)) soundEffects.iceFall();
        break;
      case "ice-shatter":
        if (isSeen(event.playerId)) soundEffects.iceShatter();
        break;
      case "snowball-thrown":
        if (!isSeen(event.targetId)) break;
        soundEffects.snowballThrow(SNOWBALL_FLIGHT_MS / 1000);
        if (event.frozen) window.setTimeout(() => soundEffects.iceFall(), SNOWBALL_FLIGHT_MS - 400);
        break;
      case "tomato-thrown": {
        if (!isSeen(event.throwerId) || !isSeen(event.targetId)) break;
        for (let index = 0; index < event.count; index += 1) {
          soundEffects.tomatoThrow(TOMATO_FLIGHT_MS / 1000, (index * TOMATO_VOLLEY_GAP_MS) / 1000);
        }
        const lastLanding = (TOMATO_FLIGHT_MS + (event.count - 1) * TOMATO_VOLLEY_GAP_MS) / 1000;
        if (event.stunned) soundEffects.tomatoKnockOut(lastLanding);
        break;
      }
      case "teleport":
        if (isSeen(event.playerId) && !isMovedByPower(event.playerId, heardPowerSeq)) soundEffects.tunnel();
        break;
      case "pawn-tunnel":
        soundEffects.tunnel();
        break;
      case "portal-swallowed":
        soundEffects.tunnel();
        break;
      case "hell-portal-open":
        soundEffects.hellRumble();
        break;
      case "currency": {
        // The shop's price is heard as the cash register of the purchase event.
        if (event.purchase || !isSeen(event.playerId)) break;
        const now = performance.now();
        if (now - lastCoinSound < COIN_SOUND_COOLDOWN_MS) break;
        lastCoinSound = now;
        if (event.delta > 0) soundEffects.coinGain();
        else soundEffects.coinLoss();
        break;
      }
      case "cup-collected":
        if (isSeen(event.playerId)) soundEffects.cupCollected();
        break;
      case "shop-opened":
        if (isSeen(event.playerId)) soundEffects.shopBell();
        break;
      case "purchase":
        // Online, what somebody else buys is theirs to know: only their own device rings the register.
        if (getLocalPlayerId() !== null && getLocalPlayerId() !== event.playerId) break;
        soundEffects.purchase();
        break;
      case "hell-entered":
        // The mage's fire (or the mud on their mark) rumbles for the players it sends to Hell.
        if (isSeen(event.playerId) && !isMovedByPower(event.playerId, heardPowerSeq)) soundEffects.hellRumble();
        break;
      case "hell-escaped":
        if (isSeen(event.playerId)) soundEffects.duelWin();
        break;
      case "duel-started":
        soundEffects.duelDrums();
        break;
      case "mud-placed":
      case "mud-triggered":
        if (!isTurnUnseen()) soundEffects.mudSplat();
        break;
      case "bullet-launched":
        if (!getViewerFog().viewerHidden) soundEffects.bulletAlarm();
        break;
      case "bullet-flight":
        if (!getViewerFog().viewerHidden) soundEffects.bulletCharge();
        break;
      case "bullet-hit":
        if (!getViewerFog().viewerHidden) soundEffects.explosion();
        break;
      case "blessing-started":
        soundEffects.blessing();
        break;
      case "carousel-flipped":
        soundEffects.carouselFlip();
        break;
      case "ghost-appeared":
        soundEffects.ghostAppear();
        break;
      case "ghost-moved":
        soundEffects.ghostWhoosh();
        break;
      case "ghost-teleported":
        soundEffects.ghostVanish();
        soundEffects.ghostWhoosh(GHOST_TELEPORT_MS / 2_000);
        break;
      case "ghost-attack":
      case "ghost-stole":
        if (isSeen(event.playerId)) soundEffects.ghostLaugh();
        break;
      case "ghost-vanished":
        soundEffects.ghostVanish();
        break;
      case "player-left":
        // A mage who crumbles to ash has the sting of their fall instead.
        if (isSeen(event.playerId) && !isMovedByPower(event.playerId, heardPowerSeq)) soundEffects.tunnel();
        break;
      case "turn-skipped":
        soundEffects.snore();
        break;
      case "item-used":
        if (!isTurnUnseen()) soundEffects.itemUsed();
        break;
      case "power":
        playPower(event.event);
        break;
      case "invisibility":
        if (seesChangeOf(event.playerId)) {
          if (event.hidden) soundEffects.invisibilityOn();
          else soundEffects.invisibilityOff();
        }
        break;
      case "reaction-opened":
        soundEffects.reveal();
        break;
      case "action-cancelled":
        soundEffects.error();
        break;
      case "turn-start":
        soundEffects.turnStart();
        break;
      case "victory":
        soundEffects.victory();
        break;
      default:
        break;
    }
  });

  const syncMusic = () => {
    const game = useGameStore.getState();
    musicPlayer.setMood(getMusicMood(game));
    musicPlayer.setTheme(
      pickSoundtrackTheme(useMapAuditionStore.getState().choice, game.phase === "setup" ? null : game.mapId),
    );
  };
  syncMusic();
  const unsubscribeGameMusic = useGameStore.subscribe(syncMusic);
  const unsubscribeAudition = useMapAuditionStore.subscribe(syncMusic);
  const unsubscribeFling = useGameStore.subscribe(playGhostFling);
  const unsubscribeTunnel = useGameStore.subscribe(playTunnelMove);

  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    window.removeEventListener("pointerdown", clickSound);
    unsubscribeFeedback();
    unsubscribeGameMusic();
    unsubscribeAudition();
    unsubscribeFling();
    unsubscribeTunnel();
  };
}

/**
 * Luna Park: the "ghost-flung" event only comes once the victim has landed in
 * Hell, while the board plays the slap and the flight from the state change
 * itself. The sounds follow the board, scheduled on its timeline.
 */
function playGhostFling(state: GameState, previous: GameState): void {
  const movement = state.lastMovement;
  const isNew = movement !== null && movement.seq !== previous.lastMovement?.seq;
  if (!isNew || !movement.flungByGhost || previous.phase !== "playing") return;
  soundEffects.ghostWhoosh();
  soundEffects.ghostSlap(GHOST_SLAP_IMPACT_MS / 1_000);
  soundEffects.ghostLaugh(GHOST_SLAP_MS / 1_000);
  soundEffects.ghostWhoosh(GHOST_SLAP_MS / 1_000);
}

/**
 * Taupe: a pawn digs into the ground at the state change and bursts out of it at the other end, as the board plays
 * the walk. The sounds follow the board, scheduled on its timeline; a pawn the fog hides digs in silence.
 */
function playTunnelMove(state: GameState, previous: GameState): void {
  const movement = state.lastMovement;
  const isNew = movement !== null && movement.seq !== previous.lastMovement?.seq;
  if (!isNew || !movement.tunnel || previous.phase !== "playing") return;
  if (!isSeen(movement.playerId)) return;
  soundEffects.dig();
  soundEffects.popOut(TUNNEL_DIVE_MS / 1_000);
}
