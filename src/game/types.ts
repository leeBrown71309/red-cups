export const START_NODE_ID = 0;
export const HELL_NODE_ID = 11;
export const INITIAL_RED_CUP_NODE_ID = 8;
export const RED_CUP_GOAL = 3;
export const STARTING_CURRENCY = 2_000;
export const BASE_INVENTORY_CAPACITY = 4;
export const CURRENCY_RESET_THRESHOLD = -300;

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

export type InventoryEntry =
  | { id: string; kind: "red-cup" }
  | { id: string; kind: "item"; itemId: ItemId };

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
  oneWay?: boolean;
}

export type TurnStage =
  | "move"
  | "shop"
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

export interface PendingWheel {
  wheelId: WheelId;
  playerId: PlayerId;
  result: WheelResult;
  resumeStage: TurnStage;
  sourceItemId?: ItemId;
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
  duelResumeStage: TurnStage;
  mudTraps: MudTrap[];
  bulletBill: BulletBillState | null;
  bootPrice: number;
  bootFirstPurchased: boolean;
  bootLastPriceRound: number;
  moveDistance: number;
  turnActionTaken: boolean;
  winnerId: PlayerId | null;
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
  mudTraps: [],
  bulletBill: null,
  bootPrice: 100,
  bootFirstPurchased: false,
  bootLastPriceRound: 0,
  moveDistance: 1,
  turnActionTaken: false,
  duelResumeStage: "turn-end",
  winnerId: null,
  log: [],
};
