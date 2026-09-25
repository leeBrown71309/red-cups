import { onFeedback, type FeedbackEvent } from "../feedback/event-bus";
import { useGameStore } from "../game/store";
import { HELL_NODE_ID } from "../game/types";
import { audioEngine } from "./audio-engine";
import { musicPlayer } from "./music-player";
import { soundEffects } from "./sound-effects";

const COIN_SOUND_COOLDOWN_MS = 140;

/**
 * Wires presentation events to sounds, keeps the music mood in sync with the
 * table, and unlocks audio on the first user gesture.
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
      case "bullet-spawned":
        soundEffects.bulletWhistle();
        break;
      case "bullet-hit":
        soundEffects.bulletHit();
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

  const unsubscribeMood = useGameStore.subscribe((state) => {
    const activePlayer = state.players[state.activePlayerIndex];
    const tense = state.phase === "playing" && (activePlayer?.position === HELL_NODE_ID || state.pendingDuel !== null);
    musicPlayer.setMood(tense ? "tense" : "calm");
  });

  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    window.removeEventListener("pointerdown", clickSound);
    unsubscribeFeedback();
    unsubscribeMood();
  };
}
