import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachBasketLive,
  getBasketRoundKey,
  handleBasketWire,
  shareBasketShot,
  useBasketLiveStore,
  type BasketWire,
} from "./basket-live";

afterEach(() => attachBasketLive(null));

describe("live Basket shots", () => {
  it("sends the shooter's shots on the room's channel, and nothing at a local table", () => {
    const send = vi.fn<(wire: BasketWire) => void>();
    shareBasketShot("b1:p1", "p1", { atMs: 800, made: true });
    expect(send).not.toHaveBeenCalled();

    attachBasketLive(send);
    shareBasketShot("b1:p1", "p1", { atMs: 800, made: true });
    expect(send).toHaveBeenCalledWith({ roundKey: "b1:p1", shooterId: "p1", shot: { atMs: 800, made: true } });
  });

  it("collects a round's shots for the watchers and starts afresh with the next round", () => {
    const round = getBasketRoundKey("b1", "p1");
    handleBasketWire({ roundKey: round, shooterId: "p1", shot: { atMs: 500, made: false } });
    handleBasketWire({ roundKey: round, shooterId: "p1", shot: { atMs: 1_400, made: true } });
    expect(useBasketLiveStore.getState()).toEqual({
      roundKey: round,
      shots: [
        { atMs: 500, made: false },
        { atMs: 1_400, made: true },
      ],
    });

    const next = getBasketRoundKey("b1", "p2");
    handleBasketWire({ roundKey: next, shooterId: "p2", shot: { atMs: 700, made: true } });
    expect(useBasketLiveStore.getState()).toEqual({ roundKey: next, shots: [{ atMs: 700, made: true }] });
  });

  it("ignores a malformed message", () => {
    const before = useBasketLiveStore.getState();
    handleBasketWire({ roundKey: 3 } as unknown as BasketWire);
    expect(useBasketLiveStore.getState()).toBe(before);
  });
});
