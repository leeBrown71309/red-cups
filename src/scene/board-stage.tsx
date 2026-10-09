import { useEffect, useMemo, useRef, useState } from "react";
import { ownsCard } from "../game/cards";
import { isPortalVisible } from "../game/devil";
import { isKnockedOut } from "../game/rules";
import { getSisterNode } from "../game/sister";
import { getBarrierRoads } from "../game/turn-actions";
import { getBoardMap } from "../game/maps/map-registry";
import { getKnownRealCup } from "../game/desert";
import { getFloodedNodeIds } from "../game/tide";
import { useGameStore } from "../game/store";
import type { BlackMark, MapId, MoleTunnel, NodeId } from "../game/types";
import { useBoardSettled, useUiStore } from "../feedback/ui-store";
import { getDecidingPlayer, selectDestinationFromBoard, useLegalMoves, useRedCupHidden } from "../ui/game-hooks";
import { getLocalPlayerId, useLocalPlayerId } from "../net/room-store";
import { getFog, useFog, type Fog } from "../ui/fog";
import { useMapChoiceStore } from "../ui/lobby/map-choice-store";
import { BoardWorld, type BoardView, type MarkView, type TunnelView } from "./board-world";
import type { CameraMode } from "./camera-rig";
import { waitForDisplayFont } from "./text-sprites";

/** Camera commands for HUD buttons, bound to the mounted world. */
export const boardCamera = {
  world: null as BoardWorld | null,
  recenter(): void {
    this.world?.recenter();
  },
  zoomIn(): void {
    this.world?.zoomBy(0.75);
  },
  zoomOut(): void {
    this.world?.zoomBy(1.33);
  },
  focusOnNode(nodeId: NodeId): void {
    this.world?.focusOnNode(nodeId);
  },
};

type StageStatus = "loading" | "ready" | "error";

/** A road was tapped while a Barrière is being set down: the item is used on it. */
function placeBarrierOnRoad(road: [NodeId, NodeId]): void {
  const { roadPickEntryId, setRoadPickEntryId } = useUiStore.getState();
  if (roadPickEntryId === null) return;
  setRoadPickEntryId(null);
  useGameStore.getState().useItem(roadPickEntryId, undefined, undefined, road);
}

/** What the fog hides from this device right now: read by the scene when a feedback event reaches it. */
function readFog(): Fog {
  return getFog(useGameStore.getState(), getLocalPlayerId());
}

function openGhostLoot(): void {
  useUiStore.getState().setGhostLootOpen(true);
}

/** Map on screen: the game's board once it starts, the lobby's pick before. */
function useDisplayedMapId(mode: CameraMode): MapId {
  const gameMapId = useGameStore((state) => state.mapId);
  const phase = useGameStore((state) => state.phase);
  const previewMapId = useMapChoiceStore((state) => state.previewMapId);
  return mode === "play" && phase !== "setup" ? gameMapId : previewMapId;
}

/** `paused`: a full-screen page covers the board, so it is kept alive but not drawn. */
export function BoardStage({ mode, paused = false }: { mode: CameraMode; paused?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<BoardWorld | null>(null);
  const [status, setStatus] = useState<StageStatus>("loading");
  const mapId = useDisplayedMapId(mode);

  // Each map has its own scene: switching maps rebuilds the world from scratch.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let cancelled = false;
    let created: BoardWorld | null = null;

    void waitForDisplayFont().then(() => {
      if (cancelled) return;
      try {
        created = new BoardWorld(
          container,
          {
            onTileSelect: selectDestinationFromBoard,
            onGhostSelect: openGhostLoot,
            onRoadSelect: placeBarrierOnRoad,
            readFog,
          },
          mapId,
        );
        boardCamera.world = created;
        // Dev only: lets a scenario in the console inspect the scene (`window.__redCupsWorld`).
        if (import.meta.env.DEV) (window as unknown as { __redCupsWorld?: BoardWorld }).__redCupsWorld = created;
        setWorld(created);
        setStatus("ready");
      } catch (error) {
        console.error("The 3D board could not be created.", error);
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      if (boardCamera.world === created) boardCamera.world = null;
      created?.dispose();
      setWorld(null);
    };
  }, [mapId]);

  useEffect(() => {
    world?.setPaused(paused);
  }, [world, paused]);

  const view = useBoardView(mode, mapId);
  useEffect(() => {
    world?.update(view);
  }, [world, view]);

  return (
    <div
      className="board-stage"
      data-status={status}
      data-map-theme={getBoardMap(mapId).themeId}
      data-doomed={view.doomed}
    >
      {/* Doomsday's sky: it fades in behind the transparent canvas. */}
      <div className="board-stage__doom" aria-hidden="true" />
      <div className="board-stage__canvas" ref={containerRef} aria-label="Plateau de jeu Red Cups en 3D" role="img" />
      {/* Desktop only: the edges of the view blur, as the far decor would under a lens. */}
      <div className="board-stage__focus" aria-hidden="true" />
      {status === "loading" && (
        <div className="board-stage__message">
          <span className="board-stage__spinner" aria-hidden="true" />
          Installation du plateau…
        </div>
      )}
      {status === "error" && (
        <div className="board-stage__message board-stage__message--error">
          Ton navigateur ne peut pas afficher le plateau 3D (WebGL indisponible).
        </div>
      )}
    </div>
  );
}

interface LaggedProps {
  redCupNodeId: NodeId | null;
  /** Désert: the mirage lags with the real Cup, or whichever moved first would be the real one. */
  mirageNodeId: NodeId | null;
  mudNodeIds: NodeId[];
  portalNodeIds: NodeId[];
  /** Taupe and Mage noir: what was on the board once it last settled, to show what has just gone a while longer. */
  moleTunnels: MoleTunnel[];
  blackMarks: BlackMark[];
  /** Mi-vu, Mi-vue: who the viewer sees, once the board has settled: a pawn is not hidden or shown mid-walk. */
  fog: Fog;
}

/**
 * The rules move the Red Cup, remove mud and close the Portails the instant a
 * move is played. The board keeps showing the previous props until the pawn
 * has landed, walked into the Portail and fallen through.
 *
 * The tunnels and the pentagrams are held the other way round: a new one shows at once (it is drawn as it
 * appears), and one that has gone stays until the pawn has crossed it or the mage has landed on it. The fog
 * changes what the viewer sees only once the walk is over.
 */
function useLaggedProps(): LaggedProps {
  const redCupNodeId = useGameStore((state) => state.redCupNodeId);
  const mirageNodeId = useGameStore((state) => state.mirageNodeId);
  const mudTraps = useGameStore((state) => state.mudTraps);
  const hellPortals = useGameStore((state) => state.hellPortals);
  const moleTunnels = useGameStore((state) => state.moleTunnels);
  const blackMarks = useGameStore((state) => state.blackMarks);
  const fog = useStableFog();
  const round = useGameStore((state) => state.round);
  const settled = useBoardSettled();
  const visiblePortalNodeIds = useMemo(
    () => hellPortals.filter((portal) => isPortalVisible({ round }, portal)).map((portal) => portal.nodeId),
    [hellPortals, round],
  );
  const [displayed, setDisplayed] = useState<LaggedProps>(() => ({
    redCupNodeId,
    mirageNodeId,
    mudNodeIds: mudTraps.map((trap) => trap.nodeId),
    portalNodeIds: visiblePortalNodeIds,
    moleTunnels,
    blackMarks,
    fog,
  }));

  useEffect(() => {
    if (!settled) return;
    setDisplayed({
      redCupNodeId,
      mirageNodeId,
      mudNodeIds: mudTraps.map((trap) => trap.nodeId),
      portalNodeIds: visiblePortalNodeIds,
      moleTunnels,
      blackMarks,
      fog,
    });
  }, [settled, redCupNodeId, mirageNodeId, mudTraps, visiblePortalNodeIds, moleTunnels, blackMarks, fog]);

  return displayed;
}

/** The fog is a new object at every state change: this one changes only when what it hides does. */
function useStableFog(): Fog {
  const fog = useFog();
  const stable = useRef(fog);
  if (!isSameFog(stable.current, fog)) stable.current = fog;
  return stable.current;
}

function isSameFog(first: Fog, second: Fog): boolean {
  return (
    first.viewerId === second.viewerId &&
    first.viewerHidden === second.viewerHidden &&
    first.ghostlyId === second.ghostlyId &&
    first.hiddenIds.size === second.hiddenIds.size &&
    [...first.hiddenIds].every((id) => second.hiddenIds.has(id))
  );
}

function useBoardView(mode: CameraMode, mapId: MapId): BoardView {
  const game = useGameStore();
  const legalMoves = useLegalMoves();
  const lagged = useLaggedProps();
  // The live fog, not the lagged one: the Red Cup comes back the moment the viewer's own hidden turn is over.
  const liveFog = useFog();
  const redCupBlind = useRedCupHidden();
  // Online each screen is one player's; on a single screen the player to act is the one looking.
  const localPlayerId = useLocalPlayerId();
  const viewerPlayerId = localPlayerId ?? game.players[game.activePlayerIndex]?.id ?? null;
  const cupHidden = redCupBlind || liveFog.viewerHidden;
  const previewNodeId = useUiStore((state) => state.previewNodeId ?? state.hoveredChipNodeId);
  const followActivePlayer = useUiStore((state) => state.followActivePlayer);
  const roadPickEntryId = useUiStore((state) => state.roadPickEntryId);

  return useMemo(() => {
    const activePlayer = game.players[game.activePlayerIndex];
    const decider = getDecidingPlayer(game);
    const playing = mode === "play" && game.phase !== "setup";
    const { fog } = lagged;
    const hidesProps = playing && fog.viewerHidden;
    const power = playing ? game.lastPowerEvent : null;
    const colorOf = (playerId: string) => game.players.find((player) => player.id === playerId)?.color ?? "#ffffff";
    // A new tunnel or pentagram shows at once; the one that has just gone stays a moment, for the animation.
    const tunnels: TunnelView[] = playing
      ? [...game.moleTunnels, ...lagged.moleTunnels.filter((old) => !game.moleTunnels.some((now) => now.id === old.id))]
      : [];
    const marks: MarkView[] = playing
      ? [
          ...game.blackMarks,
          ...lagged.blackMarks.filter((old) => !game.blackMarks.some((now) => isSameMark(now, old))),
        ].map((mark) => ({ ownerId: mark.ownerId, nodeId: mark.nodeId, color: colorOf(mark.ownerId) }))
      : [];
    return {
      mode,
      carouselReversed: playing && game.carouselReversed,
      iceTileNodeId: playing ? game.iceTileNodeId : null,
      floodedNodeIds: playing ? getFloodedNodeIds(getBoardMap(mapId), game.round) : [],
      // On show before the game, the ferry waits at its first quay.
      ferryQuayId: playing ? game.ferryQuayId : (getBoardMap(mapId).tidal?.ferryQuays[0] ?? null),
      // Désert: both Cups look alike to everybody; only a player who drank sees the marker on the real one.
      mirageNodeId: playing ? (cupHidden ? null : lagged.mirageNodeId) : null,
      caravanNodeId: playing ? game.caravanNodeId : (getBoardMap(mapId).desert?.caravanStart ?? null),
      knownRealNodeId: playing && !cupHidden ? getKnownRealCup(game, viewerPlayerId) : null,
      doomed: playing && game.doomsday !== null,
      pawns: playing
        ? game.players.map((player) => {
            // Stuck in fallen ice only while still on the tile the slide left from.
            const frozen = game.frozenSlides.find(
              (entry) => entry.playerId === player.id && entry.from === player.position,
            );
            return {
              id: player.id,
              color: player.color,
              position: player.position,
              isActive: game.phase === "playing" && player.id === activePlayer?.id,
              isSleeping: isKnockedOut(player),
              ...(frozen ? { frozenTo: frozen.to } : {}),
              ...(game.snowFrozenPlayerIds.includes(player.id) ? { snowFrozen: true } : {}),
              ...(game.guardian?.protegeId === player.id ? { halo: true } : {}),
              ...(fog.hiddenIds.has(player.id) ? { hidden: true } : {}),
              ...(fog.ghostlyId === player.id ? { ghostly: true } : {}),
            };
          })
        : [],
      hidesProps,
      moleTunnels: tunnels,
      blackMarks: marks,
      sisters: playing
        ? game.players
            .filter((player) => ownsCard(player, "ghost-sister"))
            .map((player) => ({
              ownerId: player.id,
              color: player.color,
              nodeId: getSisterNode(player),
              hidden: fog.hiddenIds.has(player.id),
            }))
        : [],
      powerEvent: power,
      bulletCarry:
        power?.kind === "sister-swap" && power.carried.bulletBill
          ? { seq: power.seq, from: power.sisterFrom, to: power.playerFrom }
          : null,
      redCupNodeId: playing ? (cupHidden ? null : lagged.redCupNodeId) : getBoardMap(mapId).initialCupNodeId,
      mudNodeIds: playing && !hidesProps ? lagged.mudNodeIds : [],
      barrierEdges: playing ? game.barriers.map((barrier): [NodeId, NodeId] => [barrier.a, barrier.b]) : [],
      pickableRoads: playing && roadPickEntryId !== null ? getBarrierRoads(game) : [],
      // Lagged: the Portail stays under the pawn until it has fallen through.
      portalNodeIds: playing && !hidesProps ? lagged.portalNodeIds : [],
      // Not lagged: the scene holds Bullet Bill in place itself until its charge has been replayed.
      bulletBill:
        playing && game.bulletBill ? { nodeId: game.bulletBill.position, status: game.bulletBill.status } : null,
      bulletFlightSeq: playing ? (game.lastBulletFlight?.seq ?? null) : null,
      // Not lagged either: the ghost actor holds its place until its deed has been replayed.
      ghost:
        playing && game.ghost
          ? { nodeId: game.ghost.nodeId, lootCount: (game.ghost.loot.coins > 0 ? 1 : 0) + game.ghost.loot.items.length }
          : null,
      ghostEventSeq: playing ? (game.lastGhostEvent?.seq ?? null) : null,
      legalPaths: playing ? legalMoves.paths : new Map(),
      pathOrigin: legalMoves.origin,
      markerColor: decider?.color ?? "#ffffff",
      previewNodeId,
      lastMovement: game.lastMovement,
      followActivePlayer,
      activePlayerId: activePlayer?.id ?? null,
    };
  }, [
    game,
    lagged,
    cupHidden,
    legalMoves,
    previewNodeId,
    followActivePlayer,
    roadPickEntryId,
    mode,
    mapId,
    viewerPlayerId,
  ]);
}

/** The same pentagram, whoever holds it: a mage has at most one, so the owner and the tile say which. */
function isSameMark(first: BlackMark, second: BlackMark): boolean {
  return first.ownerId === second.ownerId && first.nodeId === second.nodeId;
}
