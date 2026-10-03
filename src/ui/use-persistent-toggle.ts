import { useCallback, useState } from "react";
import { readStorage, writeStorage } from "../utils/safe-local-storage";

/**
 * A yes/no layout choice of this viewer (a folded panel, a hidden dock) that
 * survives a reload. Without storage it simply starts from the default again.
 */
export function usePersistentToggle(key: string, getDefault: () => boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    const stored = readStorage(key);
    return stored === null ? getDefault() : stored === "true";
  });

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      writeStorage(key, String(next));
    },
    [key],
  );

  return [value, update];
}

/** Phones and small windows start with the side panels folded, to leave the board in view. */
export function prefersCompactHud(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 900px), (max-height: 520px)").matches;
}
