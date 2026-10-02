/** Every map keeps its start on tile 0 and Hell on tile 11 (checked by the map tests). */
export const START_NODE_ID = 0;
export const HELL_NODE_ID = 11;
export const RED_CUP_GOAL = 3;
export const STARTING_CURRENCY = 2_000;
export const BASE_INVENTORY_CAPACITY = 4;
export const CURRENCY_RESET_THRESHOLD = -300;
export const START_BONUS = 200;
export const MUD_PENALTY = 200;
/** Paid to whoever laid the mud when somebody else steps in it. */
export const MUD_OWNER_REWARD = 100;
/** Corrupteur pays this for every move that goes against an arrow. */
export const CORRUPTER_COST = 400;
/** The round the game opens with; Corrupteur may not break out of the start during it. */
export const FIRST_ROUND = 1;
/** Rounds Non merci needs to recharge after cancelling something (5 since patch 0.1.4). */
export const NO_THANKS_COOLDOWN_ROUNDS = 5;
/** Je note: chance of keeping a copy of a single-target item used against its holder. */
export const JE_NOTE_COPY_CHANCE = 1 / 3;
/** Red light, Green light: green tiles that pay, and red tiles that cost, per Red Cup. */
export const RED_GREEN_TRIGGERS_PER_CUP = 2;
/** Calme-toi: how far from the new Red Cup the holder sets a player down. */
export const CALM_DOWN_DISTANCE = 3;
export const BULLET_BILL_DAMAGE = 200;
/** Tiles Bullet Bill covers per charge: only a target on the next tile is hit (patch 0.1.4). */
export const BULLET_BILL_CHARGE_STEPS = 1;
/** The Botte starts at this price, and gets dearer each round after its first purchase, up to the maximum. */
export const BOOT_STARTING_PRICE = 100;
export const BOOT_PRICE_STEP = 50;
export const MAXIMUM_BOOT_PRICE = 400;
/** Wheel of fortune: a free Tomate comes as a whole stack of this many. */
export const FREE_TOMATOES = 5;
/** Energy every turn opens with (patch 0.1.4): items cost some, the move uses up the rest. */
export const BASE_ENERGY = 3;
/** The move, or the Hell wheel that stands for it, needs at least this much energy. */
export const MOVE_MINIMUM_ENERGY = 1;
/** Tomate: chance that a hit knocks the target out, who then skips their next turn. */
export const TOMATO_STUN_CHANCE = 0.02;
/** Banquise: chance that ice falls on a player sliding towards the Red Cup. */
export const ICE_FALL_CHANCE = 0.8;
/** Banquise: chance that a penguin's snowball hits the player it aims at. */
export const SNOWBALL_HIT_CHANCE = 2 / 3;
/** Banquise: snowballs a player takes before freezing solid and losing a turn. */
export const SNOWBALL_HITS_TO_FREEZE = 3;
/** After this many of their own turns in Hell, a player is released at the start, for a toll. */
export const HELL_TURN_LIMIT = 5;
export const HELL_EXIT_TOLL = 500;
/** When Non merci cancels an item, the item is still spent (confirmed by the game's author). */
export const CANCELLED_ITEM_IS_CONSUMED = true;
/** Luna Park: the ghost duels in place of a second player, under this id. */
export const GHOST_ID = "ghost";
/** Luna Park: most the ghost steals from a player's purse when it wins. */
export const GHOST_STEAL_COINS = 300;
/** Luna Park: most a winner takes back from the coins in the ghost's loot. */
export const GHOST_LOOT_COINS = 200;
/** Luna Park: what beating a ghost with an empty loot pays. */
export const GHOST_EMPTY_LOOT_REWARD = 300;
/** Luna Park: rounds the ghost stays away after being beaten. */
export const GHOST_COOLDOWN_ROUNDS = 3;
/** Luna Park: chance that the ghost vanishes and reappears far away instead of drifting along the roads. */
export const GHOST_TELEPORT_CHANCE = 0.25;
/** Luna Park: most tiles the ghost drifts in one go; at least one. */
export const GHOST_MAX_DRIFT_STEPS = 3;
/** Luna Park: a teleport takes the ghost at least this many roads away, when the board allows. */
export const GHOST_TELEPORT_MIN_DISTANCE = 3;
/** Basket: length of each duellist's shooting time. */
export const BASKET_DURATION_MS = 15_000;
/** Basket: no score above this is believed (a shot takes well over half a second). */
export const BASKET_MAX_SCORE = 30;

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
export type MapId = "classic" | "luna-park" | "banquise";

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
  | "draven"
  | "tomato";

export type PassiveId =
  | "built-like-a-tank"
  | "new-cup-new-me"
  | "red-light-green-light"
  | "no-thanks"
  | "corrupter"
  | "goblin"
  | "i-take-notes"
  | "calm-down"
  | "lambda";

export type WheelId = "misfortune" | "fortune" | "hell";
export type DuelMode = "coin-flip" | "rock-paper-scissors" | "player-vote" | "basket";
export type RpsChoice = "rock" | "paper" | "scissors";

export type InventoryEntry =
  | { id: string; kind: "red-cup" }
  /** `count`: how many a stackable item (the Tomate) piles up in this one slot; absent means one. */
  | { id: string; kind: "item"; itemId: ItemId; count?: number };

export interface Player {
  id: PlayerId;
  name: string;
  color: PlayerColor;
  position: NodeId;
  currency: number;
  inventory: InventoryEntry[];
  passiveId: PassiveId;
  skippedTurns: number;
  /** First round in which Non merci may cancel an action again. */
  noThanksReadyRound: number;
  /** Own turns spent in Hell since the last trip there, skipped ones included. */
  hellTurns: number;
  /** Tile the player stood on before they were last moved, for « Retourne d’où tu viens ». */
  previousNodeId: NodeId | null;
}

export interface BoardNode {
  id: NodeId;
  x: number;
  z: number;
  kind: "start" | "shop" | "red" | "green" | "neutral" | "hell";
  label: string;
  /** Banquise: a walk that ends on ice slides on, at random, along one of the tile's other roads. */
  ice?: boolean;
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
  /**
   * A tunnel is a one-way passage from `from` to `to`, counted as one step.
   * A carousel road is one-way too, but its direction flips with the game
   * (`GameState.carouselReversed`); maps list it in its starting direction.
   */
  kind?: "road" | "tunnel" | "carousel";
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
  /** New Cup, New Me: before the new Red Cup appears, off to the start or stay. */
  | "reposition"
  /** Wheel of fortune: the player picks the tile they step forward onto. */
  | "advance"
  /** Calme-toi: the holder sets a player down three tiles from the new Red Cup, or lets them be. */
  | "passive-choice"
  | "blessing"
  | "finished";

export type WheelOutcomeId =
  | "lose-100"
  | "lose-200"
  | "lose-300"
  | "lose-400"
  | "lose-item"
  | "skip-turn"
  | "go-to-hell"
  | "go-back"
  | "spin-fortune"
  | "spin-misfortune"
  | "gain-100"
  | "gain-200"
  | "gain-300"
  | "gain-400"
  | "advance-one"
  | "free-item"
  | "go-to-start"
  | "challenge"
  | "escape"
  | "hell-skip";

export interface WheelResult {
  id: WheelOutcomeId;
  label: string;
  amount?: number;
}

/** Why a wheel spins; only used to phrase the wheel screen. */
export type WheelOrigin = "tile" | "item" | "hell" | "chain" | "blessing";

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

/** Something about to affect a Non merci holder, waiting for their answer. */
export type DeclaredAction =
  | { type: "item"; entryId: string; itemId: ItemId; targetPlayerId?: PlayerId }
  /** Bullet Bill is about to hit its victim, as a new round starts. */
  | { type: "bullet-bill"; victimId: PlayerId };

export interface PendingReaction {
  /** Whoever declared the action; null for Bullet Bill, which belongs to nobody. */
  actorId: PlayerId | null;
  action: DeclaredAction;
  /** Holders of a ready Non merci the action would affect. */
  reactorIds: PlayerId[];
  resumeStage: TurnStage;
}

/** Basket: one shot of the ghost, drawn when the duel starts so every device sees the same game. */
export interface BasketShot {
  /** Time from the start of the round. */
  atMs: number;
  made: boolean;
}

/** Basket: 15 seconds each, one duellist after the other; the ghost shoots alongside its opponent. */
export interface BasketDuel {
  /** Tells this duel's live shots apart from an earlier one's on the online channel. */
  id: string;
  /** The duellist whose 15 seconds are running, once they pressed start. */
  shooterId: PlayerId | null;
  scores: Partial<Record<PlayerId, number>>;
  /** Against the ghost: its whole round, its misses and streaks included. */
  ghostShots: BasketShot[];
  /** Equal scores are settled by a coin the engine flips. */
  tieBroken: boolean;
}

/** Luna Park: what the ghost takes if it wins, drawn when the duel starts. */
export type GhostPenalty =
  { kind: "hell" } | { kind: "coins"; amount: number } | { kind: "item"; entryId: string; itemId: ItemId };

/** Luna Park: what beating the ghost gives, drawn when the duel starts. */
export type GhostReward =
  { kind: "coins"; amount: number; fromLoot: boolean } | { kind: "item"; entryId: string; itemId: ItemId };

export interface GhostStakes {
  penalty: GhostPenalty;
  reward: GhostReward;
}

export interface PendingDuel {
  playerOneId: PlayerId;
  /** `GHOST_ID` when a player meets the Luna Park ghost. */
  playerTwoId: PlayerId;
  mode: DuelMode;
  coinWinnerId?: PlayerId;
  resumeStage: TurnStage;
  /** Secret picks of the current rock-paper-scissors round, by duellist. */
  rpsChoices: Partial<Record<PlayerId, RpsChoice>>;
  /** Picks of the last round that ended in a tie, shown before the replay. */
  rpsTiedRound: Partial<Record<PlayerId, RpsChoice>> | null;
  rpsTies: number;
  /** Secret votes of the other players: voter id → chosen duellist id. */
  votes: Partial<Record<PlayerId, PlayerId>>;
  /** A tied vote is settled by a coin the engine flips. */
  voteTieBroken: boolean;
  /** Set once the duel is decided; resolving it then has to name this player. */
  winnerId: PlayerId | null;
  basket: BasketDuel | null;
  /** Luna Park: set when the duel is against the ghost. */
  ghost: GhostStakes | null;
}

export interface PendingDiscard {
  playerId: PlayerId;
  /** "loot": an item won back from the ghost does not fit in the bag. */
  reason: "red-cup" | "forced-item" | "loot";
  resumeStage: TurnStage;
  cupNodeId?: NodeId;
  itemId?: ItemId;
}

export interface PendingChallenge {
  playerId: PlayerId;
  resumeStage: TurnStage;
}

/** Wheel of fortune: a player owes a step onto a tile of their choice. */
export interface PendingAdvance {
  playerId: PlayerId;
  resumeStage: TurnStage;
}

/** Calme-toi: the players the holder may set down three tiles from the new Red Cup, one after the other. */
export interface PendingCalmDown {
  passivePlayerId: PlayerId;
  /** The first one is decided now. */
  targetIds: PlayerId[];
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

/** Bullet Bill waits on the start from its purchase, then charges from round `spawnRound` on. */
export interface BulletBillState {
  status: "waiting" | "active";
  position: NodeId;
  spawnRound: number;
}

/** Last charge of Bullet Bill, kept so the scene can replay the flight and the explosion. */
export interface BulletFlight {
  seq: number;
  from: NodeId;
  path: NodeId[];
  /** Nearest player Bullet Bill was chasing. */
  targetId: PlayerId;
  /** Set when the charge reached its target. */
  victimId: PlayerId | null;
  /** Non merci: the player it was about to hit cancelled it, and it fizzled out on their tile. */
  dodgedBy?: PlayerId;
}

export type WinReason = "red-cups" | "forfeit";

/** Last walk on the board, kept so the scene can animate the hops. */
export interface PlayerMovement {
  seq: number;
  playerId: PlayerId;
  from: NodeId;
  path: NodeId[];
  /** Banquise: steps from this index on were slid on ice, not walked. */
  slideStart?: number;
  /** Banquise: falling ice stopped the slide on its way to this tile. */
  interruptedTo?: NodeId;
  /** Banquise: the player broke free of the ice and finished last turn's slide. */
  thawed?: boolean;
  /** Luna Park: the ghost slapped the player and carried them to Hell. */
  flungByGhost?: boolean;
}

/** Banquise: the last snowball thrown by the penguins, kept so the scene can replay it. */
export interface SnowballThrow {
  seq: number;
  targetId: PlayerId;
  hit: boolean;
  /** The third hit: the target froze solid. */
  frozen: boolean;
}

/** Last volley of Tomates, kept so the scene can replay every throw and splat. */
export interface TomatoThrow {
  seq: number;
  throwerId: PlayerId;
  targetId: PlayerId;
  /** Tomates thrown in one go, from one stack. */
  count: number;
  /** Knocked out by at least one of them: one skipped turn, however many hit. */
  stunned: boolean;
}

/** Banquise: a player stuck in fallen ice, halfway between two tiles. */
export interface FrozenSlide {
  playerId: PlayerId;
  from: NodeId;
  to: NodeId;
}

/** Banquise: the last blizzard, kept so the scene can replay it. */
export interface BlizzardEvent {
  seq: number;
  /** Temporary ice tile the blizzard melted, if any. */
  from: NodeId | null;
  to: NodeId | null;
}

/** Banquise: the last fall of ice on a sliding player, hit or missed. */
export interface IceFallEvent {
  seq: number;
  playerId: PlayerId;
  from: NodeId;
  to: NodeId;
  hit: boolean;
}

/** Luna Park: whatever the ghost stole, waiting for whoever beats it. */
export interface GhostLoot {
  coins: number;
  items: { id: string; itemId: ItemId }[];
}

/** Luna Park: the ghost haunting the whole board, road rules or not. */
export interface GhostState {
  /** Null while it is away, beaten or not appeared yet. */
  nodeId: NodeId | null;
  /** While away: the round it comes back in. */
  returnsAtRound: number;
  loot: GhostLoot;
  /** Players it already duelled on this tile; it meets them again once it moved on. */
  metPlayerIds: PlayerId[];
}

/** Luna Park: the ghost's last deed, kept so the scene can replay it. */
export interface GhostEvent {
  seq: number;
  /** "move": drifted along the roads; "teleport": vanished and reappeared elsewhere. */
  kind: "appear" | "move" | "teleport" | "vanish" | "fling";
  from: NodeId | null;
  to: NodeId | null;
  /** "move": every tile drifted through, `to` last. */
  path?: NodeId[];
  /** "fling": the player the ghost carried to Hell. */
  playerId?: PlayerId;
}

export interface GameLogEntry {
  id: string;
  text: string;
  tone: "neutral" | "good" | "bad" | "event";
}

/** Seeded luck of an online game, stored in the state so every device draws the same. */
export interface SeededRandomState {
  rngState: number;
  /** Next engine id, so ids match across devices too. */
  nextId: number;
}

export interface GameState {
  phase: "setup" | "playing" | "finished";
  /** Board the game is played on. */
  mapId: MapId;
  /** Luna Park: the carousel turns the other way, flipped at every new Red Cup. */
  carouselReversed: boolean;
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
  pendingCalmDown: PendingCalmDown | null;
  pendingAdvance: PendingAdvance | null;
  pendingReaction: PendingReaction | null;
  /** Tile wheels still to spin, in arrival order; filled by walks and teleports alike. */
  pendingTileWheels: PendingTileWheel[];
  /** Stage to return to once every queued tile wheel has spun. */
  tileWheelResumeStage: TurnStage;
  duelResumeStage: TurnStage;
  mudTraps: MudTrap[];
  /** Only one mud can be laid per turn. */
  mudPlacedThisTurn: boolean;
  /** Red light, Green light: green and red tiles that already counted since the last Red Cup. */
  redGreenTriggers: { green: number; red: number };
  /** Tomates: the stack the active player throws from this turn; another stack waits for the next turn. */
  thrownStackId: string | null;
  bulletBill: BulletBillState | null;
  lastBulletFlight: BulletFlight | null;
  /** Banquise: the temporary ice tile brought by the last blizzard. */
  iceTileNodeId: NodeId | null;
  /** Banquise: players stuck in fallen ice; they finish their slide when their turn comes. */
  frozenSlides: FrozenSlide[];
  lastBlizzard: BlizzardEvent | null;
  lastIceFall: IceFallEvent | null;
  /** Luna Park: the ghost of the carousel; null on the other maps. */
  ghost: GhostState | null;
  lastGhostEvent: GhostEvent | null;
  lastTomatoThrow: TomatoThrow | null;
  /** Banquise: snowballs each player took since they last froze. */
  snowballHits: Partial<Record<PlayerId, number>>;
  /** Banquise: players frozen solid by snowballs, until the turn they lose is over. */
  snowFrozenPlayerIds: PlayerId[];
  lastSnowball: SnowballThrow | null;
  /** Tour de Bénédiction: players who still have to spin the wheel of fortune, in turn order. */
  blessingQueue: PlayerId[];
  /** Players who left before the end, kept for the final standings. */
  abandonedPlayers: Player[];
  bootPrice: number;
  bootFirstPurchased: boolean;
  bootLastPriceRound: number;
  moveDistance: number;
  /** Energy the active player has left this turn: items cost some, the move or the Hell wheel the rest. */
  energyLeft: number;
  /**
   * The active player did something this turn: an item, the Botte, a move or
   * the Hell wheel. Only then may they end the turn without moving.
   */
  turnActionTaken: boolean;
  winnerId: PlayerId | null;
  winReason: WinReason | null;
  lastMovement: PlayerMovement | null;
  log: GameLogEntry[];
  /** Null in a local game, which keeps Math.random; set in an online game. */
  seededRandom: SeededRandomState | null;
}

export const EMPTY_GAME_STATE: GameState = {
  phase: "setup",
  mapId: "classic",
  carouselReversed: false,
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
  pendingCalmDown: null,
  pendingAdvance: null,
  pendingReaction: null,
  pendingTileWheels: [],
  tileWheelResumeStage: "turn-end",
  mudTraps: [],
  mudPlacedThisTurn: false,
  redGreenTriggers: { green: 0, red: 0 },
  thrownStackId: null,
  bulletBill: null,
  lastBulletFlight: null,
  iceTileNodeId: null,
  frozenSlides: [],
  lastBlizzard: null,
  lastIceFall: null,
  ghost: null,
  lastGhostEvent: null,
  lastTomatoThrow: null,
  snowballHits: {},
  snowFrozenPlayerIds: [],
  lastSnowball: null,
  blessingQueue: [],
  abandonedPlayers: [],
  bootPrice: BOOT_STARTING_PRICE,
  bootFirstPurchased: false,
  bootLastPriceRound: 0,
  moveDistance: 1,
  energyLeft: BASE_ENERGY,
  turnActionTaken: false,
  duelResumeStage: "turn-end",
  winnerId: null,
  winReason: null,
  lastMovement: null,
  log: [],
  seededRandom: null,
};
