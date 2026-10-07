/**
 * Which build the player is looking at.
 *
 * Local play stays a test tool: on one shared screen the cards and the bag
 * cannot be hidden from the other players, so the public build is played
 * online only. Dev servers and the pre-prod preview — served under
 * `/red-cups/` on GitHub Pages, see the deploy workflows — keep the local game.
 */
export const localPlayAvailable = !import.meta.env.PROD || import.meta.env.BASE_URL === "/red-cups/";
