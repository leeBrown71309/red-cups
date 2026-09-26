/**
 * Where the auth client keeps a session, which depends on whose it is.
 *
 * A guest's session belongs to the tab, in `sessionStorage`: two windows side
 * by side must be two players, or the second silently takes the first one's
 * seat. An account's session belongs to the person, in `localStorage`: being
 * signed out of Google by closing a tab would make the account worthless.
 *
 * Reading asks the tab first, so a tab already seated as a guest keeps its
 * identity when somebody signs in elsewhere in the same browser.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The account a stored value belongs to, or null for a guest session or a PKCE verifier. */
function accountOf(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { user?: { id?: unknown; is_anonymous?: unknown } } | null;
    const id = parsed?.user?.id;
    return parsed?.user?.is_anonymous === false && typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export function createAuthStorage(tab: KeyValueStore, browser: KeyValueStore): KeyValueStore {
  return {
    getItem: (key) => tab.getItem(key) ?? browser.getItem(key),
    setItem: (key, value) => {
      const account = accountOf(value);
      // A second person signing in on a browser that holds someone else's
      // account keeps theirs in this tab, so other tabs are not swapped.
      const other = accountOf(browser.getItem(key));
      if (account && other && other !== account) {
        tab.setItem(key, value);
      } else if (account) {
        browser.setItem(key, value);
        // The guest session this tab held would otherwise shadow the account on every read.
        tab.removeItem(key);
      } else {
        tab.setItem(key, value);
      }
    },
    // Removed only from where it was read: a guest tab lapsing must not sign the account out everywhere.
    removeItem: (key) => {
      if (tab.getItem(key) !== null) tab.removeItem(key);
      else browser.removeItem(key);
    },
  };
}
