import { useEffect, useState } from "react";

/**
 * Fullscreen helpers. Browsers only grant fullscreen from a user gesture, so
 * "forcing" it on phones means asking for one tap, then locking landscape.
 */

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };

function currentFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FullscreenDocument).webkitFullscreenElement ?? null;
}

export function isFullscreenSupported(): boolean {
  const root = document.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen);
}

/** Launched from the home screen as an installed app: the browser UI is already gone. */
export function isStandaloneApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
}

export async function enterGameFullscreen(): Promise<boolean> {
  const root = document.documentElement as FullscreenElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
    else root.webkitRequestFullscreen?.();
  } catch (error) {
    console.warn("Fullscreen was refused by the browser.", error);
    return false;
  }

  // Orientation lock only exists in fullscreen on some browsers (mainly Android); elsewhere it just fails.
  const orientation = screen.orientation as LockableOrientation | undefined;
  await orientation?.lock?.("landscape").catch(() => undefined);
  return currentFullscreenElement() !== null;
}

export function exitGameFullscreen(): void {
  const doc = document as FullscreenDocument;
  try {
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
    else doc.webkitExitFullscreen?.();
  } catch (error) {
    console.warn("Could not leave fullscreen.", error);
  }
}

export function useFullscreenState(): boolean {
  const [active, setActive] = useState(() => currentFullscreenElement() !== null);

  useEffect(() => {
    const update = () => setActive(currentFullscreenElement() !== null);
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  return active;
}
