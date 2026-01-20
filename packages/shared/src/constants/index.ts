import type { Suit, Rank, GameVariant, Stakes } from '../types';

// Card Constants
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#1f2937',
  spades: '#1f2937',
};

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

// Hand Ranking Values (higher = better)
export const HAND_RANK_VALUES = {
  'high-card': 1,
  'pair': 2,
  'two-pair': 3,
  'three-of-a-kind': 4,
  'straight': 5,
  'flush': 6,
  'full-house': 7,
  'four-of-a-kind': 8,
  'straight-flush': 9,
  'royal-flush': 10,
} as const;

export const HAND_RANK_NAMES = {
  'high-card': 'High Card',
  'pair': 'Pair',
  'two-pair': 'Two Pair',
  'three-of-a-kind': 'Three of a Kind',
  'straight': 'Straight',
  'flush': 'Flush',
  'full-house': 'Full House',
  'four-of-a-kind': 'Four of a Kind',
  'straight-flush': 'Straight Flush',
  'royal-flush': 'Royal Flush',
} as const;

// Game Constants
export const MAX_PLAYERS_PER_TABLE = 10;
export const MIN_PLAYERS_TO_START = 2;
export const DEFAULT_TURN_TIME_SECONDS = 30;
export const DEFAULT_STARTING_CHIPS = 10000;

// Variant Configurations
export const VARIANT_CONFIG: Record<GameVariant, {
  name: string;
  description: string;
  holeCards: number;
  communityCards: number;
  mustUseHoleCards?: number; // For Omaha
  isPoker: boolean; // vs blackjack
}> = {
  'texas-holdem': {
    name: 'Texas Hold\'em',
    description: 'The most popular poker variant. Use any combination of your 2 hole cards and 5 community cards.',
    holeCards: 2,
    communityCards: 5,
    isPoker: true,
  },
  'omaha': {
    name: 'Omaha',
    description: 'Similar to Hold\'em but with 4 hole cards. Must use exactly 2 hole cards and 3 community cards.',
    holeCards: 4,
    communityCards: 5,
    mustUseHoleCards: 2,
    isPoker: true,
  },
  'omaha-hi-lo': {
    name: 'Omaha Hi-Lo',
    description: 'Omaha with split pot. Best high hand and best qualifying low hand split the pot.',
    holeCards: 4,
    communityCards: 5,
    mustUseHoleCards: 2,
    isPoker: true,
  },
  'seven-card-stud': {
    name: 'Seven Card Stud',
    description: 'Classic stud poker. Each player receives 7 cards, makes best 5-card hand.',
    holeCards: 7,
    communityCards: 0,
    isPoker: true,
  },
  'five-card-draw': {
    name: 'Five Card Draw',
    description: 'Draw poker. Receive 5 cards, draw up to 5 new cards once.',
    holeCards: 5,
    communityCards: 0,
    isPoker: true,
  },
  'blackjack': {
    name: 'Blackjack',
    description: 'Classic 21. Beat the dealer without going over 21. Player can be banker!',
    holeCards: 2,
    communityCards: 0,
    isPoker: false,
  },
};

// Default Custom Rules
export const DEFAULT_CUSTOM_RULES: import('../types').CustomRules = {
  runItTwice: false,
  runItThrice: false,
  runOutOnFold: false,
  bombPotEnabled: false,
  bombPotAmount: undefined,
  bombPotEveryNHands: undefined,
  bombPotDoubleBoard: false,
  straddleEnabled: true,
  multipleStraddlesAllowed: false,
  maxStraddles: 1,
  dealerChoosesGame: false,
  allowMidHandJoin: true,
  autoPostBlinds: true,
  turnTimeEnabled: true,
  turnTimeSeconds: 30,
  warningTimeSeconds: 15,
  timeBank: true,
  timeBankSeconds: 30,
  potLimit: false,
  noLimit: true,
  fixedLimit: false,
  spreadLimit: undefined,
  sevenDeuce: false,
  sevenDeuceBonus: undefined,
  insuranceEnabled: false,
};

// Default Blackjack Rules
export const DEFAULT_BLACKJACK_RULES: import('../types').BlackjackRules = {
  decks: 6,
  dealerHitsSoft17: true,
  doubleAfterSplit: true,
  surrenderAllowed: true,
  insuranceAllowed: true,
  blackjackPays: '3:2',
  maxSplits: 3,
  playerIsBanker: false,
  bankerPlayerId: undefined,
};

// Bomb Pot Presets
export const BOMB_POT_PRESETS = [
  { name: 'Mini', multiplier: 5 },      // 5x big blind
  { name: 'Standard', multiplier: 10 }, // 10x big blind
  { name: 'Big', multiplier: 25 },      // 25x big blind
  { name: 'Mega', multiplier: 50 },     // 50x big blind
] as const;

// Default Stakes Presets
export const STAKES_PRESETS: { name: string; stakes: Stakes }[] = [
  {
    name: 'Micro',
    stakes: { smallBlind: 1, bigBlind: 2, minBuyIn: 40, maxBuyIn: 200 },
  },
  {
    name: 'Low',
    stakes: { smallBlind: 5, bigBlind: 10, minBuyIn: 200, maxBuyIn: 1000 },
  },
  {
    name: 'Medium',
    stakes: { smallBlind: 25, bigBlind: 50, minBuyIn: 1000, maxBuyIn: 5000 },
  },
  {
    name: 'High',
    stakes: { smallBlind: 100, bigBlind: 200, minBuyIn: 4000, maxBuyIn: 20000 },
  },
  {
    name: 'Nosebleed',
    stakes: { smallBlind: 500, bigBlind: 1000, minBuyIn: 20000, maxBuyIn: 100000 },
  },
];

// Socket Event Names
export const SOCKET_EVENTS = {
  // Game events
  GAME_STATE: 'game:state',
  GAME_ACTION: 'game:action',
  GAME_WINNER: 'game:winner',

  // Room events
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_SIT: 'room:sit',
  ROOM_STAND: 'room:stand',
  ROOM_PLAYER_JOINED: 'room:player-joined',
  ROOM_PLAYER_LEFT: 'room:player-left',
  ROOM_CHAT: 'room:chat',

  // System events
  ERROR: 'error',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
} as const;

// Error Codes
export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  SEAT_TAKEN: 'SEAT_TAKEN',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INSUFFICIENT_CHIPS: 'INSUFFICIENT_CHIPS',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;
