export const START_NODE_ID = 0;
export const HELL_NODE_ID = 11;
export const INITIAL_RED_CUP_NODE_ID = 8;
export const RED_CUP_GOAL = 3;
export const STARTING_CURRENCY = 2_000;
export const BASE_INVENTORY_CAPACITY = 4;
export const CURRENCY_RESET_THRESHOLD = -300;
export const START_BONUS = 200;
export const MUD_PENALTY = 200;
/** Délinquant pays this for every move that goes against an arrow. */
export const DELINQUENT_COST = 200;
/** After this many of their own turns in Hell, a player is released at the start, for a toll. */
export const HELL_TURN_LIMIT = 5;
export const HELL_EXIT_TOLL = 500;
/** When Non merci cancels an item, the item is still spent (confirmed by the game's author). */
export const CANCELLED_ITEM_IS_CONSUMED = true;

export const PLAYER_COLORS = [
  "#f16a53",
  "#f5c451",
  "#56a8ee",
  "#7cc785",
  "#c27de4",
  "#f08aba",
  "#79d4cb",
  "#ed8d48",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];
export type NodeId = number;
export type PlayerId = string;

export type ItemId =
  | "ndoye"
  | "hollow-purple"
  | "rope"
  | "boot"
  | "mud"
  | "eraser"
  | "bullet-bill"
  | "middle-finger"
  | "monopoly-man"
  | "water-bottle"
  | "helmet"
  | "draven";

export type PassiveId =
  | "built-like-a-tank"
  | "new-cup-new-me"
  | "red-light-green-light"
  | "no-thanks"
  | "delinquent"
  | "penta"
  | "troll"
  | "im-cups"
  | "i-take-notes"
  | "calm-down";

export type WheelId = "misfortune" | "fortune" | "hell";
export type DuelMode = "coin-flip" | "rock-paper-scissors" | "player-vote";
export type RpsChoice = "rock" | "paper" | "scissors";

export type InventoryEntry = { id: string; kind: "red-cup" } | { id: string; kind: "item"; itemId: ItemId };

export interface Player {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  position: NodeId;
  currency: number;
  inventory: InventoryEntry[];
  passiveId: PassiveId;
  skippedTurns: number;
  noThanksUsedCycle: number;
  /** Own turns spent in Hell since the last trip there, skipped ones included. */
  hellTurns: number;
}

export interface BoardNode {
  id: NodeId;
  x: number;
  z: number;
  kind: "start" | "shop" | "red" | "green" | "neutral" | "hell";
  label: string;
}

export interface BoardEdge {
  from: NodeId;
  to: NodeId;
  /**
   * An arrow drawn on the `from` tile, pointing along this road. A tile that
   * carries arrows can only be left through them; it can still be entered by
   * any road, including this one walked backwards.
   */
  arrow?: boolean;
  /** A tunnel leaves the board on one side and comes back on the other. */
  kind?: "road" | "tunnel";
}

export type TurnStage =
  | "move"
  | "reaction"
  | "shop"
  | "tile-wheel"
  | "turn-end"
  | "hell"
  | "wheel-result"
  | "duel"
  | "discard"
  | "target"
  | "reposition"
  | "passive-choice"
  | "finished";

export type WheelOutcomeId =
  | "lose-100"
  | "lose-200"
  | "lose-400"
  | "lose-item"
  | "skip-turn"
  | "go-to-hell"
  | "spin-fortune"
  | "nothing"
  | "gain-100"
  | "gain-200"
  | "gain-300"
  | "gain-400"
  | "gain-500"
  | "free-item"
  | "challenge"
  | "escape"
  | "hell-skip";

export interface WheelResult {
  id: WheelOutcomeId;
  label: string;
  amount?: number;
}

/** Why a wheel spins; only used to phrase the wheel screen. */
export type WheelOrigin = "tile" | "item" | "hell" | "chain";

export interface PendingWheel {
  /** Unique per spin so the UI can replay the animation for chained wheels. */
  id: string;
  wheelId: WheelId;
  playerId: PlayerId;
  result: WheelResult;
  resumeStage: TurnStage;
  sourceItemId?: ItemId;
  origin?: WheelOrigin;
}

/** An action announced by the active player, waiting for a possible Non merci. */
export type DeclaredAction =
  | { type: "move"; destination: NodeId; ignoreArrows: boolean }
  | { type: "item"; entryId: string; itemId: ItemId; targetPlayerId?: PlayerId };

export interface PendingReaction {
  actorId: PlayerId;
  action: DeclaredAction;
  /** Players who may still cancel the action with Non merci this Red Cup cycle. */
  reactorIds: PlayerId[];
  resumeStage: TurnStage;
}

export interface PendingDuel {
  playerOneId: PlayerId;
  playerTwoId: PlayerId;
  mode: DuelMode;
  coinWinnerId?: PlayerId;
  resumeStage: TurnStage;
}

export interface PendingDiscard {
  playerId: PlayerId;
  reason: "red-cup" | "forced-item";
  resumeStage: TurnStage;
  cupNodeId?: NodeId;
  itemId?: ItemId;
}

export interface PendingChallenge {
  playerId: PlayerId;
  resumeStage: TurnStage;
}

export interface PendingCalmDown {
  passivePlayerId: PlayerId;
  collectorId: PlayerId;
  retreatNodeId: NodeId;
  resumeStage: TurnStage;
}

/** A player who arrived on a green or red tile and still has to spin its wheel. */
export interface PendingTileWheel {
  playerId: PlayerId;
  nodeId: NodeId;
}

export interface MudTrap {
  id: string;
  nodeId: NodeId;
  ownerId: PlayerId;
}

export interface BulletBillState {
  status: "waiting" | "active";
  position: NodeId;
  spawnRound: number;
}

/** Last walk on the board, kept so the scene can animate the hops. */
export interface PlayerMovement {
  seq: number;
  playerId: PlayerId;
  from: NodeId;
  path: NodeId[];
}

export interface GameLogEntry {
  id: string;
  text: string;
  tone: "neutral" | "good" | "bad" | "event";
}

export interface GameState {
  phase: "setup" | "playing" | "finished";
  turnStage: TurnStage;
  players: Player[];
  activePlayerIndex: number;
  round: number;
  redCupNodeId: NodeId | null;
  previousRedCupNodeId: NodeId | null;
  redCupCycle: number;
  pendingWheel: PendingWheel | null;
  pendingDuel: PendingDuel | null;
  pendingDiscard: PendingDiscard | null;
  pendingChallenge: PendingChallenge | null;
  pendingCupRepositionPlayerId: PlayerId | null;
  pendingCupRevealNodeId: NodeId | null;
  pendingCupRepositionResumeStage: TurnStage | null;
  pendingCupCollectorId: PlayerId | null;
  pendingCalmDown: PendingCalmDown | null;
  pendingReaction: PendingReaction | null;
  /** Tile wheels still to spin, in arrival order; filled by walks and teleports alike. */
  pendingTileWheels: PendingTileWheel[];
  /** Stage to return to once every queued tile wheel has spun. */
  tileWheelResumeStage: TurnStage;
  duelResumeStage: TurnStage;
  mudTraps: MudTrap[];
  bulletBill: BulletBillState | null;
  bootPrice: number;
  bootFirstPurchased: boolean;
  bootLastPriceRound: number;
  moveDistance: number;
  turnActionTaken: boolean;
  winnerId: PlayerId | null;
  lastMovement: PlayerMovement | null;
  log: GameLogEntry[];
}

export const EMPTY_GAME_STATE: GameState = {
  phase: "setup",
  turnStage: "move",
  players: [],
  activePlayerIndex: 0,
  round: 1,
  redCupNodeId: null,
  previousRedCupNodeId: null,
  redCupCycle: 0,
  pendingWheel: null,
  pendingDuel: null,
  pendingDiscard: null,
  pendingChallenge: null,
  pendingCupRepositionPlayerId: null,
  pendingCupRevealNodeId: null,
  pendingCupRepositionResumeStage: null,
  pendingCupCollectorId: null,
  pendingCalmDown: null,
  pendingReaction: null,
  pendingTileWheels: [],
  tileWheelResumeStage: "turn-end",
  mudTraps: [],
  bulletBill: null,
  bootPrice: 100,
  bootFirstPurchased: false,
  bootLastPriceRound: 0,
  moveDistance: 1,
  turnActionTaken: false,
  duelResumeStage: "turn-end",
  winnerId: null,
  lastMovement: null,
  log: [],
};
