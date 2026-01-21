// Card and Deck Types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  code: string; // e.g., "As" for Ace of Spades
}

// Hand Rankings
export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface HandResult {
  rank: HandRank;
  value: number; // Numeric value for comparison
  cards: Card[]; // Best 5 cards
  description: string; // e.g., "Pair of Aces"
}

// Player Types
export interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export interface RoomPlayer {
  id: string;
  oderId: string;
  odername: string;
  avatarUrl?: string;
  seat: number; // 0-9 for 10-max table
  chips: number;
  status: PlayerStatus;
  isDealer: boolean;
  isTurn: boolean;
  holeCards?: Card[]; // Only visible to the player
  bet: number;
  totalBetThisRound: number;
  hasActed: boolean;
  isAllIn: boolean;
  isFolded: boolean;
  lastAction?: PlayerAction;
  bombPotWhenDealer?: boolean; // If true, trigger bomb pot when this player becomes dealer
  straddleNextHand?: boolean; // If true, auto-straddle when in straddle position next hand
}

export type PlayerStatus = 'active' | 'sitting-out' | 'away' | 'disconnected';

// Game Actions
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
  timestamp: number;
}

// Game Phases
export type GamePhase =
  | 'waiting'      // Waiting for players
  | 'starting'     // About to deal
  | 'preflop'      // Hole cards dealt
  | 'flop'         // 3 community cards
  | 'turn'         // 4th community card
  | 'river'        // 5th community card
  | 'showdown'     // Reveal hands
  | 'complete';    // Hand finished

// Game Variants
export type GameVariant =
  | 'texas-holdem'
  | 'omaha'
  | 'omaha-hi-lo'
  | 'seven-card-stud'
  | 'five-card-draw'
  | 'blackjack';

// Customizable Rules
export interface CustomRules {
  // Run it out options
  runItTwice: boolean;           // Run the board twice when all-in
  runItThrice: boolean;          // Run the board three times when all-in
  runOutOnFold: boolean;         // Show remaining cards when everyone folds

  // Bomb pot options
  bombPotEnabled: boolean;
  bombPotAmount?: number;        // Fixed amount everyone antes
  bombPotEveryNHands?: number;   // Auto bomb pot every N hands
  bombPotDoubleBoard: boolean;   // Two boards for bomb pots

  // Straddle options
  straddleEnabled: boolean;
  multipleStraddlesAllowed: boolean;
  maxStraddles?: number;

  // Game flow
  dealerChoosesGame: boolean;    // Dealer picks variant each hand
  allowMidHandJoin: boolean;     // Join during active hand (sit out until next)
  autoPostBlinds: boolean;

  // Turn timer
  turnTimeEnabled: boolean;      // Enable turn timer
  turnTimeSeconds: number;       // Base time per turn (e.g., 30)
  warningTimeSeconds: number;    // Time added after warning (e.g., 15)
  timeBank: boolean;
  timeBankSeconds?: number;

  // Betting limits
  potLimit: boolean;
  noLimit: boolean;
  fixedLimit: boolean;
  spreadLimit?: { min: number; max: number };

  // Special rules
  sevenDeuce: boolean;           // Bonus for winning with 7-2
  sevenDeuceBonus?: number;

  // Insurance/side bets (for advanced play)
  insuranceEnabled: boolean;
}

// Blackjack specific
export interface BlackjackRules {
  decks: number;                 // Number of decks (1-8)
  dealerHitsSoft17: boolean;
  doubleAfterSplit: boolean;
  surrenderAllowed: boolean;
  insuranceAllowed: boolean;
  blackjackPays: '3:2' | '6:5';
  maxSplits: number;
  playerIsBanker: boolean;       // A player can be the house
  bankerPlayerId?: string;
}

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  isDoubled: boolean;
  isSplit: boolean;
  isInsured: boolean;
  isSurrendered: boolean;
  isStood: boolean;
  isBusted: boolean;
}

export interface BlackjackPlayerState {
  oderId: string;
  hands: BlackjackHand[];        // Multiple hands if split
  currentHandIndex: number;
  totalBet: number;
  insuranceBet?: number;
}

export interface BlackjackGameState {
  dealerHand: Card[];
  dealerHiddenCard?: Card;       // Face-down card
  players: BlackjackPlayerState[];
  phase: 'betting' | 'dealing' | 'player-turns' | 'dealer-turn' | 'payout';
  currentPlayerSeat: number;
  bankerId?: string;             // If a player is the banker
  bankerChips?: number;
}

// Room Types
export interface Room {
  id: string;
  name: string;
  code: string; // Short invite code
  variant: GameVariant;
  stakes: Stakes;
  maxPlayers: number;
  isPrivate: boolean;
  hasPassword: boolean;
  hostId: string;
  status: RoomStatus;
  createdAt: Date;
  customRules: CustomRules;
  blackjackRules?: BlackjackRules;
  allowedVariants: GameVariant[];  // Variants table can switch between
  currentVariant: GameVariant;      // Active variant for current hand
}

export interface Stakes {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  minBuyIn: number;
  maxBuyIn: number;
}

export type RoomStatus = 'waiting' | 'playing' | 'paused' | 'closed';

// Game State
export interface GameState {
  roomId: string;
  handNumber: number;
  phase: GamePhase;
  players: RoomPlayer[];
  communityCards: Card[];
  communityCards2?: Card[];     // Second board for dual-board bomb pots
  ghostCards?: Card[];          // Cards that "would have come" on run out on fold
  pot: number;
  sidePots: SidePot[];
  currentBet: number;
  minRaise: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentPlayerSeat: number;
  turnTimeRemaining?: number;
  lastAction?: PlayerAction & { playerId: string };
  validActions?: ActionType[];  // Valid actions for current player
  isRunout?: boolean;           // True when dealing remaining cards after all-in
  runoutStartPhase?: GamePhase; // Phase when runout started (e.g., 'flop')
  isBombPot?: boolean;          // True when this is a bomb pot hand
  isDualBoard?: boolean;        // True when using dual boards (bomb pot)
  sevenDeuceBonus?: SevenDeuceBonusInfo; // Bonus info when someone wins with 7-2
  straddles?: Straddle[];       // Active straddles for this hand
  straddlePrompt?: StraddlePrompt; // Current straddle prompt (null if not in straddle phase)
  runItPrompt?: RunItPrompt;    // Run it decision prompt (when all-in with cards to come)
  runItBoards?: Board[];        // Multiple boards when running it multiple times
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

// 7-2 Game bonus info
export interface SevenDeuceBonusInfo {
  winnerId: string;
  totalBonus: number;
  contributions: { playerId: string; amount: number }[];
}

// Straddle types
export interface Straddle {
  playerId: string;
  amount: number;
  seat: number;
}

export interface StraddlePrompt {
  seat: number;
  playerId: string;
  amount: number;
  timeoutSeconds: number;
  previousStraddlerName?: string; // Name of player who straddled before (for "X straddled, would you like to double?")
  isDoubleStraddle?: boolean; // True if this is a response to someone else's straddle
}

// Run It Twice/Thrice types
export type RunItChoice = 1 | 2 | 3;

export interface Board {
  index: number;
  communityCards: Card[];
  winners: string[];
  potShare: number;
}

export interface RunItPrompt {
  eligiblePlayerIds: string[];
  timeoutSeconds: number;
  choices: { playerId: string; choice: RunItChoice | null; confirmed: boolean }[];
}

// Socket Events
export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:action': (action: PlayerAction & { playerId: string }) => void;
  'game:winner': (winners: WinnerInfo[]) => void;
  'game:run-out': (boards: Card[][]) => void;  // Run it twice/thrice boards
  'game:seven-deuce-bonus': (bonus: SevenDeuceBonusInfo) => void;  // 7-2 game bonus
  'game:straddle-prompt': (prompt: StraddlePrompt) => void;  // Straddle offer to player
  'game:straddle-placed': (straddle: Straddle) => void;  // Player placed a straddle
  'game:straddle-declined': (data: { seat: number }) => void;  // Player declined straddle
  'game:run-it-prompt': (prompt: RunItPrompt) => void;  // Run it decision prompt
  'game:run-it-decision': (data: { playerId: string; choice: RunItChoice; confirmed: boolean }) => void;  // Player made choice
  'game:run-it-result': (data: { boards: Board[]; finalChoice: RunItChoice }) => void;  // Final result
  'game:variant-changed': (variant: GameVariant) => void;
  'game:timer': (data: { timeRemaining: number; playerId: string }) => void;
  'game:timer-warning': (data: { playerId: string; extraTime: number }) => void;
  'game:auto-fold': (data: { playerId: string }) => void;
  'game:hand-shown': (data: { playerId: string; cards: Card[] }) => void;
  'blackjack:state': (state: BlackjackGameState) => void;
  'room:joined': (data: { room: Room; userId: string; username: string }) => void;
  'room:player-joined': (player: RoomPlayer) => void;
  'room:player-left': (playerId: string) => void;
  'room:player-rebuy': (data: { playerId: string; amount: number }) => void;
  'room:chat': (message: ChatMessage) => void;
  'room:rules-updated': (rules: CustomRules) => void;
  'room:dealer-choosing': (dealerSeat: number, options: GameVariant[]) => void;
  'player:bomb-pot-preference-changed': (data: { playerId: string; enabled: boolean }) => void;
  'player:straddle-preference-changed': (data: { playerId: string; enabled: boolean }) => void;
  'room:settings-updated': (data: { room: Room }) => void;  // Host changed room settings
  'error': (error: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'game:action': (action: PlayerAction) => void;
  'game:start': () => void;                               // Host starts the game
  'game:choose-variant': (variant: GameVariant) => void;  // Dealer's choice
  'game:run-it-select': (choice: 1 | 2 | 3) => void;      // Select run-it option (before confirming)
  'game:run-it-confirm': () => void;                       // Confirm run-it selection
  'game:start-bomb-pot': (amount?: number) => void;
  'game:show-hand': () => void;                           // Show winning hand voluntarily
  'game:straddle': (straddle: boolean) => void;           // Accept or decline straddle
  'blackjack:bet': (amount: number) => void;
  'blackjack:action': (action: BlackjackAction) => void;
  'blackjack:become-banker': () => void;
  'blackjack:leave-banker': () => void;
  'room:join': (roomCode: string, password?: string) => void;
  'room:leave': () => void;
  'room:sit': (seat: number, buyIn: number) => void;
  'room:stand': () => void;
  'room:sit-out': (sittingOut: boolean) => void;          // Toggle sitting out
  'room:rebuy': (amount: number) => void;                 // Rebuy chips when at 0
  'room:chat': (message: string) => void;
  'room:update-rules': (rules: Partial<CustomRules>) => void;
  'room:update-settings': (settings: { stakes?: Partial<Stakes>; maxPlayers?: number; customRules?: Partial<CustomRules> }) => void;
  'room:switch-variant': (variant: GameVariant) => void;
  'player:set-bomb-pot-preference': (enabled: boolean) => void; // Toggle bomb pot when dealer
  'player:set-straddle-preference': (enabled: boolean) => void; // Toggle straddle next hand
}

export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insurance';

export interface WinnerInfo {
  playerId: string;
  amount: number;
  hand?: HandResult;
  potType: 'main' | 'side';
  wonByFold?: boolean;  // True if won because everyone else folded
  boardIndex?: number;  // 0 = board 1, 1 = board 2 (for dual-board bomb pots)
}

export interface ChatMessage {
  id: string;
  oderId: string;
  odername: string;
  message: string;
  timestamp: number;
}

// API Types
export interface CreateRoomRequest {
  name: string;
  variant: GameVariant;
  stakes: Stakes;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
}

export interface JoinRoomRequest {
  roomCode: string;
  password?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
