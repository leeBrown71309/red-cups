import { readStorage, writeStorage } from "../../utils/safe-local-storage";

const ONLINE_NAME_KEY = "red-cups-online-name";
const ONLINE_AVATAR_KEY = "red-cups-online-avatar";
export const ONLINE_NAME_MAX_LENGTH = 16;

/** The name and avatar a guest used last time, offered again on the next visit. */
export function loadOnlineIdentity(): { name: string; avatar: number | null } {
  const storedAvatar = readStorage(ONLINE_AVATAR_KEY);
  const avatar = storedAvatar === null ? Number.NaN : Number(storedAvatar);
  return {
    name: readStorage(ONLINE_NAME_KEY) ?? "",
    avatar: Number.isInteger(avatar) && avatar >= 0 && avatar < 8 ? avatar : null,
  };
}

export function saveOnlineIdentity(name: string, avatar: number): void {
  writeStorage(ONLINE_NAME_KEY, name);
  writeStorage(ONLINE_AVATAR_KEY, String(avatar));
}
