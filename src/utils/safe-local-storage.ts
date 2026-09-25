/**
 * localStorage can be missing (tests, server rendering) or throw (private
 * browsing, quota). Saving is always a convenience, so failures are swallowed
 * after a warning instead of breaking the game.
 */

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch (error) {
    console.warn(`Could not read "${key}" from local storage.`, error);
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save "${key}" to local storage.`, error);
  }
}

export function removeStorage(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove "${key}" from local storage.`, error);
  }
}
