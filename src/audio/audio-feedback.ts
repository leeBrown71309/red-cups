import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import { useGameStore } from "../game/store";
import type { GameState } from "../game/types";
import {
  GHOST_SLAP_IMPACT_MS,
  GHOST_SLAP_MS,
  GHOST_TELEPORT_MS,
  SNOWBALL_FLIGHT_MS,
  TOMATO_FLIGHT_MS,
  TOMATO_VOLLEY_GAP_MS,
} from "../theme/timing";
import { audioEngine } from "./audio-engine";
import { getMusicMood } from "./music-mood";
import { musicPlayer } from "./music-player";
import { pickSoundtrackTheme, useMapAuditionStore } from "./soundtrack-theme";
import { soundEffects } from "./sound-effects";

const COIN_SOUND_COOLDOWN_MS = 140;

/**
 * Wires presentation events to sounds, keeps the music's mood and soundtrack
 * in sync with the table and the map picker, and unlocks audio on the first
 * user gesture.
 */
export function startAudioFeedback(): () => void {
  let lastCoinSound = 0;

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
      case "blizzard":
        soundEffects.blizzardWind();
        break;
      case "ice-fall":
        soundEffects.iceFall();
        break;
      case "ice-shatter":
        soundEffects.iceShatter();
        break;
      case "snowball-thrown":
        soundEffects.snowballThrow(SNOWBALL_FLIGHT_MS / 1000);
        if (event.frozen) window.setTimeout(() => soundEffects.iceFall(), SNOWBALL_FLIGHT_MS - 400);
        break;
      case "tomato-thrown": {
        for (let index = 0; index < event.count; index += 1) {
          soundEffects.tomatoThrow(TOMATO_FLIGHT_MS / 1000, (index * TOMATO_VOLLEY_GAP_MS) / 1000);
        }
        const lastLanding = (TOMATO_FLIGHT_MS + (event.count - 1) * TOMATO_VOLLEY_GAP_MS) / 1000;
        if (event.stunned) soundEffects.tomatoKnockOut(lastLanding);
        break;
      }
      case "pawn-tunnel":
      case "teleport":
        soundEffects.tunnel();
        break;
      case "currency": {
        const now = performance.now();
        if (now - lastCoinSound < COIN_SOUND_COOLDOWN_MS) break;
        lastCoinSound = now;
        if (event.delta > 0) soundEffects.coinGain();
        else soundEffects.coinLoss();
        break;
      }
      case "cup-collected":
        soundEffects.cupCollected();
        break;
      case "shop-opened":
        soundEffects.shopBell();
        break;
      case "purchase":
        soundEffects.purchase();
        break;
      case "hell-entered":
        soundEffects.hellRumble();
        break;
      case "hell-escaped":
        soundEffects.duelWin();
        break;
      case "duel-started":
        soundEffects.duelDrums();
        break;
      case "mud-placed":
      case "mud-triggered":
        soundEffects.mudSplat();
        break;
      case "bullet-launched":
        soundEffects.bulletAlarm();
        break;
      case "bullet-flight":
        soundEffects.bulletCharge();
        break;
      case "bullet-hit":
        soundEffects.explosion();
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
        soundEffects.ghostLaugh();
        break;
      case "ghost-vanished":
        soundEffects.ghostVanish();
        break;
      case "player-left":
        soundEffects.tunnel();
        break;
      case "turn-skipped":
        soundEffects.snore();
        break;
      case "item-used":
        soundEffects.itemUsed();
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

  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    window.removeEventListener("pointerdown", clickSound);
    unsubscribeFeedback();
    unsubscribeGameMusic();
    unsubscribeAudition();
    unsubscribeFling();
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
