import { useEffect, useMemo, useRef, useState } from "react";
import { isPortalVisible } from "../game/devil";
import { getBoardMap } from "../game/maps/map-registry";
import { useGameStore } from "../game/store";
import type { MapId, NodeId } from "../game/types";
import { useBoardSettled, useUiStore } from "../feedback/ui-store";
import { getDecidingPlayer, selectDestinationFromBoard, useLegalMoves, useRedCupHidden } from "../ui/game-hooks";
import { useMapChoiceStore } from "../ui/lobby/map-choice-store";
import { BoardWorld, type BoardView } from "./board-world";
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

export function BoardStage({ mode }: { mode: CameraMode }) {
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
          { onTileSelect: selectDestinationFromBoard, onGhostSelect: openGhostLoot },
          mapId,
        );
        boardCamera.world = created;
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

  const view = useBoardView(mode, mapId);
  useEffect(() => {
    world?.update(view);
  }, [world, view]);

  return (
    <div className="board-stage" data-status={status} data-map-theme={getBoardMap(mapId).themeId}>
      <div className="board-stage__canvas" ref={containerRef} aria-label="Plateau de jeu Red Cups en 3D" role="img" />
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
  mudNodeIds: NodeId[];
}

/**
 * The rules move the Red Cup and remove mud the instant a move is played. The
 * board keeps showing the previous props until the pawn has landed on them.
 */
function useLaggedProps(): LaggedProps {
  const redCupNodeId = useGameStore((state) => state.redCupNodeId);
  const mudTraps = useGameStore((state) => state.mudTraps);
  const settled = useBoardSettled();
  const [displayed, setDisplayed] = useState<LaggedProps>(() => ({
    redCupNodeId,
    mudNodeIds: mudTraps.map((trap) => trap.nodeId),
  }));

  useEffect(() => {
    if (!settled) return;
    setDisplayed({ redCupNodeId, mudNodeIds: mudTraps.map((trap) => trap.nodeId) });
  }, [settled, redCupNodeId, mudTraps]);

  return displayed;
}

function useBoardView(mode: CameraMode, mapId: MapId): BoardView {
  const game = useGameStore();
  const legalMoves = useLegalMoves();
  const lagged = useLaggedProps();
  const cupHidden = useRedCupHidden();
  const previewNodeId = useUiStore((state) => state.previewNodeId ?? state.hoveredChipNodeId);
  const followActivePlayer = useUiStore((state) => state.followActivePlayer);

  return useMemo(() => {
    const activePlayer = game.players[game.activePlayerIndex];
    const decider = getDecidingPlayer(game);
    const playing = mode === "play" && game.phase !== "setup";
    return {
      mode,
      carouselReversed: playing && game.carouselReversed,
      iceTileNodeId: playing ? game.iceTileNodeId : null,
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
              isSleeping: player.skippedTurns > 0,
              ...(frozen ? { frozenTo: frozen.to } : {}),
              ...(game.snowFrozenPlayerIds.includes(player.id) ? { snowFrozen: true } : {}),
              ...(game.guardian?.protegeId === player.id ? { halo: true } : {}),
            };
          })
        : [],
      redCupNodeId: playing ? (cupHidden ? null : lagged.redCupNodeId) : getBoardMap(mapId).initialCupNodeId,
      mudNodeIds: playing ? lagged.mudNodeIds : [],
      portalNodeIds: playing
        ? game.hellPortals.filter((portal) => isPortalVisible(game, portal)).map((portal) => portal.nodeId)
        : [],
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
  }, [game, lagged, cupHidden, legalMoves, previewNodeId, followActivePlayer, mode, mapId]);
}
