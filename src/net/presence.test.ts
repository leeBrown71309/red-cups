import { describe, expect, it } from "vitest";
import { hasLeftRoom } from "./room-protocol";

describe("presence departures", () => {
  it("only announces a device that has no presence left in the room", () => {
    expect(hasLeftRoom([])).toBe(true);
    expect(hasLeftRoom(undefined)).toBe(true);
  });

  it("ignores a device that turned its mic on or off, whose new presence replaced the old one", () => {
    expect(hasLeftRoom([{ voice: true, muted: false, at: 1 }])).toBe(false);
  });
});
