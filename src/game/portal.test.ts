import { afterEach, describe, expect, it, vi } from "vitest";
import { withPassives } from "./forced-passives";
import { useGameStore } from "./store";
import type { InventoryEntry, ItemId, PassiveId, Player } from "./types";
import { HELL_NODE_ID } from "./types";

/**
 * Le diable's Portails (patch 0.1.4) on the classic board: stopping on one
 * drops the player into Hell — without activating the tile (no wheel, no
 * shop), and after the Red Cup lying on the same tile has been collected.
 */

function startTable(passives: PassiveId[]): void {
  useGameStore.getState().startGame(passives.map((_, index) => `Joueur ${index + 1}`));
  useGameStore.setState((state) => withPassives(state, passives));
}

function editPlayer(index: number, changes: Partial<Player>): void {
  useGameStore.setState((state) => ({
    players: state.players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...changes } : player)),
  }));
}

const store = () => useGameStore.getState();
const playerId = (index: number) => store().players[index].id;
const item = (id: string, itemId: ItemId): InventoryEntry => ({ id, kind: "item", itemId });

const devil = () => playerId(0);
const hellPortal = (nodeId: number) => [{ id: "p1", nodeId, casterId: devil(), untilRound: 99 }];

afterEach(() => {
  store().resetGame();
  vi.restoreAllMocks();
});

describe("Portails : la case avalée ne s'active pas", () => {
  it("rouge à roue sous un Portail : pas de roue du malheur, direction l'Enfer", () => {
    startTable(["devil", "lambda"]);
    useGameStore.setState({ hellPortals: hellPortal(6) });
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "move", energyLeft: 3 });
    editPlayer(1, { position: 3 });
    store().movePlayer(6);
    expect(store().players[1].position).toBe(HELL_NODE_ID);
    expect(store().pendingTileWheels).toEqual([]);
    expect(store().turnStage).not.toBe("tile-wheel");
  });

  it("boutique sous un Portail : la boutique ne s'ouvre pas", () => {
    startTable(["devil", "lambda"]);
    useGameStore.setState({ hellPortals: hellPortal(3) });
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "move", energyLeft: 3 });
    editPlayer(1, { position: 4 });
    store().movePlayer(3);
    expect(store().players[1].position).toBe(HELL_NODE_ID);
    expect(store().turnStage).not.toBe("shop");
  });
});

describe("Portails : la Red Cup avant la chute", () => {
  it("Portail et Red Cup sur la même case : la Cup est ramassée, puis le joueur tombe", () => {
    startTable(["devil", "lambda"]);
    useGameStore.setState({ redCupNodeId: 8, hellPortals: hellPortal(8) });
    useGameStore.setState({ activePlayerIndex: 1, turnStage: "move", energyLeft: 3 });
    editPlayer(1, { position: 10 });
    store().movePlayer(8);
    expect(store().players[1].inventory.filter((entry) => entry.kind === "red-cup")).toHaveLength(1);
    expect(store().players[1].position).toBe(HELL_NODE_ID);
  });
});

describe("Hollow Purple : personne ne tombe deux fois", () => {
  it("un joueur déjà en Enfer ne peut pas être ciblé", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { inventory: [item("purple", "hollow-purple")] });
    editPlayer(1, { position: HELL_NODE_ID });
    const before = store();
    store().useItem("purple", playerId(1));
    expect(store()).toBe(before);
    expect(store().players[0].inventory).toHaveLength(1);
  });

  it("soi-même en Enfer, on ne peut pas se re-cibler", () => {
    startTable(["lambda", "lambda"]);
    editPlayer(0, { position: HELL_NODE_ID, hellTurns: 1, inventory: [item("purple", "hollow-purple")] });
    useGameStore.setState({ turnStage: "hell" });
    const before = store();
    store().useItem("purple", playerId(0));
    expect(store()).toBe(before);
  });
});
