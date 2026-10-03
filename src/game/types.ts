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
/** Cupide wins as soon as their balance reaches this. */
export const GREEDY_GOAL = 5_000;
/** Cupide: what a Red Cup pays them instead of taking a bag slot. */
export const GREEDY_CUP_REWARD = 1_000;
/** Cupide: taken from every knocked-out player on the tile they walk onto. */
export const GREEDY_STUN_THEFT = 50;
/** Roller: faces of the die thrown for every move. */
export const ROLLER_DIE_FACES = 6;
/** Made In Heaven sets the Red Cup down on this tile, and is only sold while the Cup stands elsewhere. */
export const MADE_IN_HEAVEN_CUP_NODE_ID = 8;
/** Voleur: chance of being caught for every 10 coins of the stolen item's price. */
export const THEFT_RISK_PER_TEN_COINS = 0.01;
/** Voleur: caught, the thief loses items, or coins, worth this many times the price. */
export const THEFT_PENALTY_RATE = 1.5;
/** L'Ange-Gardien only joins tables of at least this many players. */
export const GUARDIAN_MIN_PLAYERS = 4;
/** L'Ange-Gardien: turns given up to free the protégé from Hell. */
export const RESCUE_SKIPPED_TURNS = 2;
/** Le diable's Portail stays open this many rounds, unless somebody stops on it first. */
export const PORTAL_ROUNDS = 2;
/** Le diable's Black Cup keeps the Red Cup in Hell this many rounds. */
export const BLACK_CUP_ROUNDS = 2;
/** Le diable's Doomsday lasts this many rounds. */
export const DOOMSDAY_ROUNDS = 1;
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
/** Luna Park: what a player other than L'Ange-Gardien wins instead of the Bouclier the ghost stole. */
export const GHOST_SHIELD_COINS = 400;
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
/** Arm wrestle: each side taps for this long. */
export const ARM_WRESTLE_DURATION_MS = 10_000;
/** Arm wrestle: no count above this is believed (fifteen taps a second). */
export const ARM_WRESTLE_MAX_TAPS = 150;
/** Arm wrestle: Baraqué's strength. */
export const TANK_ARM_STRENGTH = 1.2;

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
  | "tomato"
  /** Chance aveugle's own item. */
  | "made-in-heaven"
  /** Le diable's shop. */
  | "portal"
  | "hell-touch"
  | "black-cup"
  | "sentence"
  | "doomsday"
  /** L'Ange-Gardien's own item. */
  | "shield";

export type PassiveId =
  | "built-like-a-tank"
  | "new-cup-new-me"
  | "red-light-green-light"
  | "no-thanks"
  | "corrupter"
  | "goblin"
  | "i-take-notes"
  | "calm-down"
  | "lambda"
  | "nepo-baby"
  | "red-bull"
  | "eshop"
  | "tomato-enjoyer"
  | "roller"
  | "greedy"
  | "double-or-nothing"
  | "blind-luck"
  | "thief"
  | "devil"
  | "guardian-angel";

export type WheelId = "misfortune" | "fortune" | "hell";
export type DuelMode = "coin-flip" | "rock-paper-scissors" | "player-vote" | "basket" | "blackjack";
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
  /** Double or nothing: the holder may stake a gain or a loss of coins on a coin flip. */
  | "gamble"
  /** Baraqué against the Monopoly Man: ten seconds of arm wrestling. */
  | "arm-wrestle"
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
  | "hell-skip"
  /** L'Ange-Gardien's wheel of misfortune only: nothing happens. */
  | "nothing";

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

/** A playing card: rank 1 (ace) to 13 (king), suit 0 to 3 (♠ ♥ ♦ ♣). */
export interface PlayingCard {
  rank: number;
  suit: number;
}

/**
 * Blackjack (patch 0.1.4): each duellist draws in turn, the first one first,
 * from a deck shuffled when the duel starts. The ghost plays as a dealer.
 */
export interface BlackjackDuel {
  deck: PlayingCard[];
  hands: Partial<Record<PlayerId, PlayingCard[]>>;
  /** Whose hand it is; null once both are done. */
  turnId: PlayerId | null;
  /** Equal hands are settled by a coin the engine flips. */
  tieBroken: boolean;
}

/** Luna Park: what the ghost takes if it wins, drawn when the duel starts. */
export type GhostPenalty =
  { kind: "hell" } | { kind: "coins"; amount: number } | { kind: "item"; entryId: string; itemId: ItemId };

/** Luna Park: what beating the ghost gives, drawn when the duel starts. */
export type GhostReward =
  | {
      kind: "coins";
      amount: number;
      fromLoot: boolean;
      /** The loot's item paid out in coins instead (the Bouclier, kept for L'Ange-Gardien), which leaves the loot. */
      replacesEntryId?: string;
    }
  | { kind: "item"; entryId: string; itemId: ItemId };

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
  blackjack: BlackjackDuel | null;
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

/**
 * Double or nothing: a gain (positive) or a loss (negative) of coins the
 * holder may still double or wipe out, on a coin flip.
 */
export interface PendingGamble {
  playerId: PlayerId;
  amount: number;
}

/**
 * Baraqué (patch 0.1.4): a Monopoly Man used on them opens an arm wrestle.
 * Each side taps for ten seconds; Baraqué's taps count 1.2 times.
 */
export interface PendingArmWrestle {
  id: string;
  attackerId: PlayerId;
  defenderId: PlayerId;
  taps: Partial<Record<PlayerId, number>>;
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

/** "greedy": Cupide reached its balance goal; "devil": le diable sent enough players to Hell. */
export type WinReason = "red-cups" | "forfeit" | "greedy" | "devil";

/**
 * An effect of le diable that lasts whole rounds: it ends as the caster's
 * turn comes in round `untilRound` (as that round starts, should they be gone).
 */
export interface DevilSpell {
  casterId: PlayerId;
  untilRound: number;
}

/** Le diable's Portail: whoever stops on its tile drops into Hell. */
export interface HellPortal extends DevilSpell {
  id: string;
  nodeId: NodeId;
}

/** Le diable's Black Cup: the Red Cup waits in Hell, then goes back to its tile. */
export interface BlackCup extends DevilSpell {
  returnNodeId: NodeId;
  /** Already in Hell when it was cast: only a player who arrives there afterwards picks it up. */
  bystanderIds: PlayerId[];
}

/** Le diable's Doomsday: every tile spins the wheel of misfortune for one round. */
export type Doomsday = DevilSpell;

/**
 * Online only: the active player's time for this turn. It runs while the
 * decision is theirs, from `runningSince` (after the animations' grace), and
 * pauses while somebody else decides.
 */
export interface TurnClock {
  playerId: PlayerId;
  round: number;
  remainingMs: number;
  runningSince: number | null;
}

/** Online only: when somebody other than the active player must have decided. */
export interface DecisionClock {
  deadline: number;
}

/** Online: the host stopped the game; every clock stands still from `since` until it resumes. */
export interface GamePause {
  byPlayerId: PlayerId;
  since: number;
}

/** The passive cards dealt before the game, and the ones picked so far. */
export interface PassiveDraft {
  offers: Record<PlayerId, PassiveId[]>;
  picks: Partial<Record<PlayerId, PassiveId>>;
  /** Online: when the draft closes on its own; null at a local table, which has no clock. */
  deadline: number | null;
}

/** The countdown shown once the draft is over, before the first turn's clock starts. */
export const GAME_COUNTDOWN_MS = 5_000;

/** Rules this game runs on: an online room refuses a device on other rules. */
export const RULES_VERSION = "0.1.4";

/** L'Ange-Gardien and the player they protect, known to the whole table. */
export interface Guardian {
  angelId: PlayerId;
  protegeId: PlayerId;
}

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
  /** "draft": the players pick their passive before the first turn (patch 0.1.4). */
  phase: "setup" | "draft" | "playing" | "finished";
  /** The passive draft, while it lasts. */
  draft: PassiveDraft | null;
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
  pendingArmWrestle: PendingArmWrestle | null;
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
  /** Roller: the die thrown for this turn's move, until the move is played. */
  diceRoll: number | null;
  /**
   * Double or nothing: gains and losses still to offer, in order. Each one is
   * offered once the table is at rest, then play resumes at `gambleResumeStage`.
   */
  pendingGambles: PendingGamble[];
  gambleResumeStage: TurnStage;
  /** Voleur: one theft per visit to the shop, so one per turn. */
  theftAttempted: boolean;
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
  /** L'Ange-Gardien wins along with their protégé. */
  coWinnerId: PlayerId | null;
  /** Players at the table when the game started: le diable's goal depends on it. */
  startingPlayerCount: number;
  /** Times a player other than le diable entered Hell; only counted while le diable plays. */
  devilHellTurns: number;
  hellPortals: HellPortal[];
  blackCup: BlackCup | null;
  doomsday: Doomsday | null;
  guardian: Guardian | null;
  /** Online clocks; null in a local game. */
  turnClock: TurnClock | null;
  decisionClock: DecisionClock | null;
  /** Online: turns each player let run out without doing anything; three is a forfeit. */
  idleStrikes: Partial<Record<PlayerId, number>>;
  /** Online: the player whose device opened the room, who may pause the game; null in a local game. */
  hostPlayerId: PlayerId | null;
  pause: GamePause | null;
  rulesVersion: string;
  lastMovement: PlayerMovement | null;
  log: GameLogEntry[];
  /** Null in a local game, which keeps Math.random; set in an online game. */
  seededRandom: SeededRandomState | null;
}

export const EMPTY_GAME_STATE: GameState = {
  phase: "setup",
  draft: null,
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
  pendingArmWrestle: null,
  pendingTileWheels: [],
  tileWheelResumeStage: "turn-end",
  mudTraps: [],
  mudPlacedThisTurn: false,
  redGreenTriggers: { green: 0, red: 0 },
  thrownStackId: null,
  diceRoll: null,
  pendingGambles: [],
  gambleResumeStage: "turn-end",
  theftAttempted: false,
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
  coWinnerId: null,
  startingPlayerCount: 0,
  devilHellTurns: 0,
  hellPortals: [],
  blackCup: null,
  doomsday: null,
  guardian: null,
  turnClock: null,
  decisionClock: null,
  idleStrikes: {},
  hostPlayerId: null,
  pause: null,
  rulesVersion: RULES_VERSION,
  lastMovement: null,
  log: [],
  seededRandom: null,
};
