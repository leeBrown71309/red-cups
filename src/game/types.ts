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
/** Red light, Green light: coins a green tile pays and a red one costs (patch 0.1.5). */
export const RED_GREEN_GAIN = 100;
export const RED_GREEN_PENALTY = 50;
/** Coins the Goblin takes from each other player at every new Red Cup. */
export const GOBLIN_THEFT = 150;
/** Cupide wins as soon as their balance reaches this. */
export const GREEDY_GOAL = 6_000;
/** Cupide: what a Red Cup pays them instead of taking a bag slot. */
export const GREEDY_CUP_REWARD = 1_000;
/** Cupide: taken from every knocked-out player on the tile they walk onto. */
export const GREEDY_STUN_THEFT = 50;
/** Roller: faces of the die thrown for every move. */
export const ROLLER_DIE_FACES = 6;
/** Roller: the face a throw needs to show to pick the Red Cup up (patch 0.2.2). */
export const ROLLER_CUP_FACE = 6;
/** Roller: throws allowed in one go; failing them all, the Cup waits for their next turn. */
export const ROLLER_CUP_ATTEMPTS = 2;
/** Made In Heaven sets the Red Cup down on this tile, and is only sold while the Cup stands elsewhere. */
export const MADE_IN_HEAVEN_CUP_NODE_ID = 8;
/** Voleur: chance of being caught for every 10 coins of the stolen item's price. */
export const THEFT_RISK_PER_TEN_COINS = 0.01;
/** Voleur: caught, the thief loses items, or coins, worth this many times the price. */
export const THEFT_PENALTY_RATE = 1.5;
/** L'Ange-Gardien only joins tables of at least this many players. */
export const GUARDIAN_MIN_PLAYERS = 4;
/** Désert des Mirages: the Cups, the wells, the caravan and the sandstorms. */
export const WELL_PRICE = 300;
/** The player who reached a mirage starts their next turn with this many points less. */
export const THIRST_ENERGY = 1;
/** An oasis gives its single occupant this many points of energy at the start of their next turn. */
export const OASIS_ENERGY = 1;
/** The caravan walks this many tiles of the outer loop at every new round, and carries a rider this many. */
export const CARAVAN_STEP = 2;
export const CARAVAN_RIDE = 4;
/** A sandstorm changes which passes are open every this many rounds. */
export const STORM_ROUNDS = 4;
/** Archipel des Marées: the tide turns every this many rounds. */
export const TIDE_ROUNDS = 2;
/** Archipel des Marées: coins paid to whoever holds a quay when a second player is pushed back from it. */
export const QUAY_HOLDER_REWARD = 50;
/** L'Ange-Gardien: turns given up to free the protégé from Hell. */
export const RESCUE_SKIPPED_TURNS = 2;
/** Le diable's Portails stay open this many rounds, unless somebody stops on one of them first. */
export const PORTAL_ROUNDS = 3;
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
/** Mime: rounds to wait after a copy before copying again (patch 0.2.3). */
export const MIME_COOLDOWN_ROUNDS = 3;
/** Sœur Fantôme: rounds to wait after a Swap before swapping again. */
export const SISTER_SWAP_COOLDOWN_ROUNDS = 4;
/** Taupe: energy that digging a tunnel costs. */
export const MOLE_DIG_ENERGY = 3;
/** Taupe: energy the digger pays to cross a tunnel they dug; anybody else pays the dig's price. */
export const MOLE_OWN_CROSSING_ENERGY = 2;
/** Taupe: rounds to wait after digging before digging again. */
export const MOLE_COOLDOWN_ROUNDS = 3;
/** Taupe: a tunnel holds one crossing after the dig that opens it (the dig is its first use, the crossing its second). */
export const TUNNEL_CROSSINGS = 1;
/** Mage noir: chances at the start, and the most they may hold. */
export const MAGE_MAX_LUCK = 3;
/** Mage noir: rounds it takes to win a chance back. */
export const MAGE_LUCK_RETURN_ROUNDS = 15;
/** Mage noir: chance that a player standing on the mark when the mage lands there falls into Hell. */
export const MARK_HELL_CHANCE = 0.2;
/** Mage noir: chance that the mage falls into Hell when a Boue lies on their mark. */
export const MARK_MUD_HELL_CHANCE = 0.2;
/** Sœur Fantôme: energy that swapping with the sister costs. */
export const SISTER_SWAP_ENERGY = 3;
/** Mi-vu, Mi-vue: own turns in a cycle; the first is visible, the others are not. */
export const MIST_CYCLE_TURNS = 3;
/** Mi-vu, Mi-vue: standing this close to the Red Cup (in steps) makes them visible again. */
export const MIST_CUP_DISTANCE = 1;
/** L'Ermite: no other player within this many steps. */
export const HERMIT_DISTANCE = 2;
/** L'Ermite: extra coins every time they pass the start. */
export const HERMIT_START_BONUS = 100;
/** L'Ermite: extra energy while they are alone. */
export const HERMIT_ENERGY_BONUS = 1;
/** L'Assureur: share of any coins another player loses, paid by the bank. */
export const INSURER_RATE = 0.2;
/** L'Assureur: most the bank pays them for lost coins in one round. */
export const INSURER_ROUND_CAP = 150;
/** L'Assureur: coins every time another player falls into Hell. */
export const INSURER_HELL_REWARD = 50;

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
export type MapId = "classic" | "luna-park" | "banquise" | "archipel" | "desert";

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
  | "shield"
  // Items added in patch 0.1.6: three that act on their own, and the Barrière.
  | "wake-up"
  | "parachute"
  | "barrier"
  | "mirror";

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
  | "guardian-angel"
  // Passifs added in patch 0.1.6.
  | "last-in-class"
  | "hell-regular"
  | "green-hand"
  | "red-hand"
  | "angelic-touch"
  | "devils-hand"
  | "game-master"
  | "junk-dealer"
  | "trapper"
  // Cups Power (actifs) and passifs added in patch 0.2.3.
  | "mime"
  | "mole"
  | "black-mage"
  | "half-seen"
  | "ghost-sister"
  | "hermit"
  | "insurer";

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
  /** The player's actif: the card that carries them to victory all game long. */
  passiveId: PassiveId;
  /** The player's passif: a card that helps in one kind of situation; none until the draft is over. */
  passifId?: PassiveId | null;
  /** Items that acted on their own during the action in progress, announced in the journal and then cleared. */
  spentItems?: ItemId[];
  /** The Miroir was used: this player may not buy another one this game. */
  mirrorUsed?: boolean;
  skippedTurns: number;
  /** Knocked-out mark (patch 0.2.0): raised when a turn is lost, kept until the player can play again,
   * one turn after the skipped ones are used up; it is what Toucher d'Enfer and Cupide read. */
  knockedOut: boolean;
  /** First round in which Non merci may cancel an action again. */
  noThanksReadyRound: number;
  /** Own turns spent in Hell since the last trip there, skipped ones included. */
  hellTurns: number;
  /** Tile the player stood on before they were last moved, for « Retourne d’où tu viens ». */
  previousNodeId: NodeId | null;
  /**
   * The state of the Cups Power of patch 0.2.3 lives in the fields below, all optional: a player who holds none of
   * those cards never carries them, and a save from before has none of them.
   *
   * Mime: the actif copied from another player for the turn in progress, dropped as the turn changes.
   */
  mimicId?: PassiveId | null;
  /** Mime: first round in which they may copy again. */
  mimeReadyRound?: number;
  /** Sœur Fantôme: first round in which they may swap again. */
  swapReadyRound?: number;
  /** Taupe: every tile the player stood on or walked through, which is where they may dig a tunnel to. */
  visitedNodeIds?: NodeId[];
  /** Taupe: first round in which they may dig again. */
  moleReadyRound?: number;
  /** Mage noir: chances left; the game is over for them at zero. */
  luck?: number;
  /** Mage noir: round in which the next chance comes back, while they hold fewer than the most. */
  luckReturnRound?: number;
  /** Sœur Fantôme: the tile the little ghost floats on. */
  sisterNodeId?: NodeId;
  /** Mi-vu, Mi-vue: own turns begun so far, which tell where the player stands in the cycle of three. */
  mistTurns?: number;
  /** L'Ermite: the prime is lost up to and including this round (someone arrived on their tile). */
  hermitLostUntilRound?: number;
  /** L'Assureur: what the bank paid them for lost coins during `round`. */
  insurerEarned?: { round: number; amount: number };
}

export interface BoardNode {
  id: NodeId;
  x: number;
  z: number;
  kind:
    | "start"
    | "shop"
    | "red"
    | "green"
    | "neutral"
    | "hell"
    | "quay"
    | "causeway"
    | "whirlpool"
    | "well"
    | "oasis"
    | "pass";
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
  /** Meneur de jeu: before the duel, its host picks one of two mini-games. */
  | "duel-choice"
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
export type WheelOrigin = "tile" | "item" | "hell" | "chain" | "blessing" | "double";

export interface PendingWheel {
  /** Unique per spin so the UI can replay the animation for chained wheels. */
  id: string;
  wheelId: WheelId;
  playerId: PlayerId;
  result: WheelResult;
  resumeStage: TurnStage;
  sourceItemId?: ItemId;
  origin?: WheelOrigin;
  /** Main verte, Main rouge: two wheels spin side by side and the player keeps one of the two results. */
  choices?: [WheelResult, WheelResult];
  /** Which of the two results the player kept; unset until they choose. */
  chosen?: 0 | 1;
  /** « Va au Départ » of the wheel of fortune: the player may prefer that nothing happens; a choice left
   * undecided (the clock ran out) falls on one or the other at 50/50. */
  randomFallback?: boolean;
  /** A wheel already spun in parallel with the one before it (Touché angélique, Touché funeste): it only waits to be applied. */
  preSpun?: boolean;
  /** Touché angélique, Touché funeste: wheels spun at the same time as this one, applied in order once it is settled. */
  repeats?: QueuedWheel[];
}

/** A queued wheel waits for its player: it applies as soon as the board is at rest. */
export interface QueuedSpin extends QueuedWheel {
  playerId: PlayerId;
  sourceItemId?: ItemId;
}

/** A wheel spun in parallel with another one: its result is already drawn. */
export interface QueuedWheel {
  wheelId: WheelId;
  result: WheelResult;
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

/** How many of its owner's turns a Barrière holds its road. */
export const BARRIER_TURNS = 1;
/** The most Barrières on the board at once, each from a different player. */
export const MAX_BARRIERS = 2;

/** A road between two tiles closed by its owner's Barrière, for `turnsLeft` more turns of its owner. */
export interface Barrier {
  ownerId: PlayerId;
  a: NodeId;
  b: NodeId;
  turnsLeft: number;
}

/** Banquise: a slide drawn towards a barred road bounced back from it, standing on `path[index]`. */
export interface SlideBump {
  index: number;
  toward: NodeId;
}

/** Meneur de jeu: two mini-games were drawn, and `chooserId` picks the one the duel is played with. */
export interface PendingDuelChoice {
  playerOneId: PlayerId;
  playerTwoId: PlayerId;
  modes: [DuelMode, DuelMode];
  chooserId: PlayerId;
  resumeStage: TurnStage;
  /** Against the Luna Park ghost: what is at stake, drawn when it struck. */
  ghost: GhostStakes | null;
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
  /**
   * The loss would knock the holder out (−300): the knock-out waits for the gamble, since wiping the loss
   * out lets them play on.
   */
  knockout?: boolean;
  /** Coins the loss paid to somebody else (the owner of a Boue): doubled with the loss, wiped out with it. */
  linked?: { playerId: PlayerId; amount: number };
}

/** The last Double or nothing flip, so the whole table can see its result. */
export interface GambleResult {
  seq: number;
  playerId: PlayerId;
  doubled: boolean;
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

/**
 * One of le diable's two Portails: whoever stops on its tile drops into Hell,
 * and both close. Hidden the round they open, the first shows the next round,
 * the second the one after (`castRound` and `rank`; a save from before
 * patch 0.1.5 has neither and shows plainly).
 */
export interface HellPortal extends DevilSpell {
  id: string;
  nodeId: NodeId;
  /** Both portals of a pair share it; one stepped on closes the other. */
  pairId?: string;
  castRound?: number;
  /** 0 shows first, 1 shows last. */
  rank?: 0 | 1;
}

/** Le diable's Black Cup: the Red Cup waits in Hell, then goes back to its tile. */
export interface BlackCup extends DevilSpell {
  returnNodeId: NodeId;
  /** Désert: where the mirage stood, brought back with the real Cup. */
  returnMirageNodeId?: NodeId | null;
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

/** The cards dealt before the game, and the ones picked so far. */
export interface PassiveDraft {
  /** Every player first picks an actif, then a passif. */
  stage: "actif" | "passif";
  /** The cards dealt at this stage. */
  offers: Record<PlayerId, PassiveId[]>;
  /** What each player picked at this stage so far. */
  picks: Partial<Record<PlayerId, PassiveId>>;
  /** The actifs picked at the first stage, kept while the passifs are picked. */
  actifs: Partial<Record<PlayerId, PassiveId>>;
  /** Online: when the draft closes on its own; null at a local table, which has no clock. */
  deadline: number | null;
}

/** The countdown shown once the draft is over, before the first turn's clock starts. */
export const GAME_COUNTDOWN_MS = 5_000;

/** Rules this game runs on: an online room refuses a device on other rules. */
export const RULES_VERSION = "0.2.4";

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
  /** Banquise: the slide ran into a Barrière and came back, where the path says. */
  bumps?: SlideBump[];
  /** Banquise: the player broke free of the ice and finished last turn's slide. */
  thawed?: boolean;
  /** Luna Park: the ghost slapped the player and carried them to Hell. */
  flungByGhost?: boolean;
  /** Portail: the walk ends on this tile, whose portal then swallows the player whole. */
  portalNodeId?: NodeId;
  /** Chance aveugle: the walk ends on a tile of Boue, where they slip and are thrown back to the tile they came from. */
  slippedInMud?: boolean;
  /** Taupe: the walk is a dive into a tunnel, from `from` to the only tile of the path. */
  tunnel?: { id: string; dug: boolean };
  /**
   * Archipel des Marées and Désert des Mirages: what happened to the walk's last tile. A whirlpool drew the player
   * away from it (their final tile is another island's quay); a taken quay or oasis pushed them back to where the walk
   * began.
   */
  water?: "whirlpool" | "bumped";
  /** Désert des Mirages: the walk is a ride on the caravan, four tiles along the outer loop with no road to follow. */
  caravan?: boolean;
  /** Archipel des Marées: the walk is the ferry crossing from one quay to the next. */
  ferry?: boolean;
  /** Sœur Fantôme: where the little ghost went while the player walked, one step for each of theirs (or none). */
  sister?: { playerId: PlayerId; from: NodeId; path: NodeId[] };
}

/** Taupe: a tunnel between two tiles, open both ways until it was crossed once after the dig. */
export interface MoleTunnel {
  id: string;
  a: NodeId;
  b: NodeId;
  /** Who dug it: they cross it for less. */
  ownerId: PlayerId;
  /** Crossings left; it closes at zero. */
  crossingsLeft: number;
}

/** Mage noir: the pentagram their owner may teleport to, seen by the whole table. */
export interface BlackMark {
  ownerId: PlayerId;
  nodeId: NodeId;
}

/**
 * The last deed of a Cups Power of patch 0.2.3, kept so the scene, the toasts and the sounds can play it again.
 * One record at a time, as for the other `last…` events: `seq` tells a new one.
 */
export type PowerEvent = { seq: number } & (
  | { kind: "mime-copy"; playerId: PlayerId; targetId: PlayerId; cardId: PassiveId }
  | { kind: "tunnel-dig"; playerId: PlayerId; from: NodeId; to: NodeId; tunnelId: string }
  | { kind: "tunnel-cross"; playerId: PlayerId; from: NodeId; to: NodeId; tunnelId: string; closed: boolean }
  | { kind: "mark-place"; playerId: PlayerId; nodeId: NodeId }
  | {
      kind: "mark-teleport";
      playerId: PlayerId;
      from: NodeId;
      to: NodeId;
      /** Why the mage left: their own turn, an item aimed at them, a wheel that would move them. */
      reason: "turn" | "reaction" | "wheel";
      /** The mage fell into Hell on arrival, through the mud lying on the mark. */
      mudHell: boolean;
      /** Players standing on the mark who fell into Hell. */
      victimIds: PlayerId[];
      /** The mark stays on the board because it sent somebody to Hell. */
      kept: boolean;
      luckLeft: number;
    }
  | {
      kind: "sister-swap";
      playerId: PlayerId;
      /** The player's tile before the swap, and the sister's. */
      playerFrom: NodeId;
      sisterFrom: NodeId;
      /** What the sister carried along from her tile. */
      carried: { mud: number; portals: number; redCup: boolean; bulletBill: boolean };
    }
);

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

/**
 * Archipel des Marées: what the tide, the ferry, the whirlpools and the quays did during one action, kept so the
 * scene, the sounds and the toasts can replay it.
 */
export type ArchipelEvent =
  | { kind: "tide"; level: "low" | "high" }
  | { kind: "ferry-moved"; from: NodeId; to: NodeId }
  /** The causeway was drowned under a player: the water set them down on a quay. */
  | { kind: "flood-drop"; playerId: PlayerId; from: NodeId; to: NodeId }
  | { kind: "whirlpool"; playerId: PlayerId; from: NodeId; to: NodeId }
  /** A second player reached a quay: pushed back where they came from, the one who held it is paid. */
  | { kind: "quay-bump"; playerId: PlayerId; quayId: NodeId; to: NodeId; holderId: PlayerId | null };

/** An event with its place in the order of the game: the scene replays the ones newer than what it already saw. */
export type ArchipelEventRecord = ArchipelEvent & { seq: number };

/**
 * Désert des Mirages: what the caravan, the sandstorms, the wells and the mirages did during one action, kept so the
 * scene, the sounds and the toasts can replay it.
 */
export type DesertEvent =
  | { kind: "caravan-moved"; from: NodeId; to: NodeId }
  /** A sandstorm closes two passes and opens the two others (`closed` lists the ones now shut). */
  | { kind: "storm"; closed: NodeId[] }
  /** The storm shut a pass under a player: the sand set them down on the loop outside. */
  | { kind: "storm-drop"; playerId: PlayerId; from: NodeId; to: NodeId }
  /** Somebody drank at a well: the table sees only that, never what they learned. */
  | { kind: "well"; playerId: PlayerId; nodeId: NodeId }
  /** The mirage was reached: it dissipates; both Cups vanish and a new pair appears at `real` and `mirage`. */
  | { kind: "mirage"; playerId: PlayerId; nodeId: NodeId; oldReal: NodeId }
  /** A second player reached an oasis somebody holds: pushed back where they came from. */
  | { kind: "oasis-bump"; playerId: PlayerId; nodeId: NodeId; to: NodeId };

export type DesertEventRecord = DesertEvent & { seq: number };

/** Désert des Mirages: what a player learned at a well, valid for as long as the pair of Cups it was drunk for lasts. */
export interface WellKnowledge {
  pair: number;
  realNodeId: NodeId;
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

/** Roller: the throws made to pick the Red Cup up, kept so the whole table can watch them and read the banner. */
export interface CupRoll {
  seq: number;
  playerId: PlayerId;
  /** Every throw in order: a six ends the series, which is then a success. */
  rolls: number[];
  success: boolean;
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
  /**
   * Online, what a purchase, a theft or a discard says about a bag is for its
   * owner only: everybody else reads `publicText`. A local table shares one
   * screen and reads `text`.
   */
  secret?: { ownerId: PlayerId; publicText: string };
  /**
   * Whose turn it was when the line was written (patch 0.2.3). Mi-vu, Mi-vue: whoever is invisible does not read
   * what others do, and the others do not read what the invisible player does, unless the line is `open`.
   */
  by?: PlayerId;
  /** The line is told to everybody whatever the fog: whose turn begins, who turns invisible. */
  open?: true;
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
  pendingDuelChoice: PendingDuelChoice | null;
  /** The Barrières on the roads: nobody walks them while they stand. */
  barriers: Barrier[];
  /** Taupe: the tunnels dug and not yet crossed. */
  moleTunnels: MoleTunnel[];
  /** Mage noir: the pentagrams on the board, one for each mage at most. */
  blackMarks: BlackMark[];
  /** The last deed of a Cups Power of patch 0.2.3. */
  lastPowerEvent: PowerEvent | null;
  pendingDiscard: PendingDiscard | null;
  pendingChallenge: PendingChallenge | null;
  pendingCupRepositionPlayerId: PlayerId | null;
  pendingCupRevealNodeId: NodeId | null;
  /** Désert: the mirage waits with the real Cup while New Cup, New Me chooses, or its absence would give the real one away. */
  pendingMirageRevealNodeId: NodeId | null;
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
  /** Touché angélique, Touché funeste: the second result of a pair, applied right after the first once the table is at rest. */
  queuedWheels: QueuedSpin[];
  gambleResumeStage: TurnStage;
  lastGambleResult: GambleResult | null;
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
  /** Archipel des Marées: the quay the ferry is moored at; null on the other maps. */
  ferryQuayId: NodeId | null;
  /**
   * Désert des Mirages: the second Red Cup, the mirage (null on the other maps). `redCupNodeId` stays the real one,
   * so every rule that reads the Cup keeps working; the table never learns which of the two is which, except the
   * players who drank at a well (`wellKnowledge`).
   */
  mirageNodeId: NodeId | null;
  /** Désert: counts the pairs of Cups placed so far; a well only tells what it knew for the pair in play. */
  cupPairId: number;
  wellKnowledge: Partial<Record<PlayerId, WellKnowledge>>;
  /** Désert: players who reached a mirage and start their next turn with one point of energy less. */
  thirstyIds: PlayerId[];
  /** Désert: the tile of the outer loop the caravan stands on. */
  caravanNodeId: NodeId | null;
  lastDesertEvents: DesertEventRecord[];
  /** The last few events, oldest first, each with an increasing `seq`. */
  lastArchipelEvents: ArchipelEventRecord[];
  /** Luna Park: the ghost of the carousel; null on the other maps. */
  ghost: GhostState | null;
  lastGhostEvent: GhostEvent | null;
  /** Roller: the last series of throws for the Red Cup. */
  lastCupRoll: CupRoll | null;
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
  pendingDuelChoice: null,
  barriers: [],
  moleTunnels: [],
  blackMarks: [],
  lastPowerEvent: null,
  pendingDiscard: null,
  pendingChallenge: null,
  pendingCupRepositionPlayerId: null,
  pendingCupRevealNodeId: null,
  pendingMirageRevealNodeId: null,
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
  queuedWheels: [],
  gambleResumeStage: "turn-end",
  lastGambleResult: null,
  theftAttempted: false,
  bulletBill: null,
  lastBulletFlight: null,
  iceTileNodeId: null,
  frozenSlides: [],
  lastBlizzard: null,
  lastIceFall: null,
  ferryQuayId: null,
  mirageNodeId: null,
  cupPairId: 0,
  wellKnowledge: {},
  thirstyIds: [],
  caravanNodeId: null,
  lastDesertEvents: [],
  lastArchipelEvents: [],
  ghost: null,
  lastGhostEvent: null,
  lastCupRoll: null,
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
