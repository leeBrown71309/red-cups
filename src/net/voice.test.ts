import { describe, expect, it } from "vitest";
import { describeMicError, readVoicePresence, selectVoicePeers, shouldOffer } from "./voice";

describe("voice chat rules", () => {
  it("lets exactly one side of each pair dial", () => {
    expect(shouldOffer("a", "b")).toBe(true);
    expect(shouldOffer("b", "a")).toBe(false);
  });

  it("links only to the other devices that are in the call", () => {
    const presence = {
      me: { voice: true, muted: false },
      ada: { voice: true, muted: true },
      bob: { voice: false, muted: false },
      cyd: { voice: true, muted: false },
    };
    expect(selectVoicePeers(presence, "me")).toEqual(["ada", "cyd"]);
  });

  it("reads the voice flags of a presence state, whatever else it holds", () => {
    expect(
      readVoicePresence({
        ada: [{ voice: true, muted: true }],
        bob: [{}],
        cyd: [{ voice: false }, { voice: true, muted: false }],
      }),
    ).toEqual({
      ada: { voice: true, muted: true },
      bob: { voice: false, muted: false },
      cyd: { voice: true, muted: false },
    });
  });

  it("explains why the mic could not be opened", () => {
    expect(describeMicError(new DOMException("denied", "NotAllowedError"))).toMatch(/refusé/);
    expect(describeMicError(new DOMException("none", "NotFoundError"))).toMatch(/Aucun micro/);
    expect(describeMicError(new Error("boom"))).toBe("Impossible d’ouvrir le micro.");
  });
});
