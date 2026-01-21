import { create } from 'zustand';
import type {
  GameState,
  Room,
  RoomPlayer,
  ChatMessage,
  PlayerAction,
  WinnerInfo,
  CustomRules,
  GameVariant,
  Card,
  SevenDeuceBonusInfo,
  StraddlePrompt,
  RunItPrompt,
} from '@poker/shared';

// =============================================================================
// TYPES
// =============================================================================

interface GameStore {
  // Connection
  isConnected: boolean;
  connectionError: string | null;

  // User
  userId: string | null;
  username: string | null;
  token: string | null;

  // Room
  room: Room | null;
  players: RoomPlayer[];
  gameState: GameState | null;
  chat: ChatMessage[];
  winners: WinnerInfo[];

  // Turn Timer
  turnTimeRemaining: number | null;
  turnTimerPlayerId: string | null;
  turnTimerWarning: boolean;

  // Shown Hands (voluntarily shown after winning by fold)
  shownHands: Map<string, Card[]>; // playerId -> cards

  // 7-2 Game Bonus
  sevenDeuceBonus: SevenDeuceBonusInfo | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setConnection: (connected: boolean, error?: string) => void;
  setUser: (userId: string, username: string, token: string) => void;
  setRoom: (room: Room | null) => void;
  updateRoom: (room: Room) => void;
  setGameState: (state: GameState | null) => void;
  updatePlayer: (player: RoomPlayer) => void;
  updatePlayerPreference: (playerId: string, updates: Partial<RoomPlayer>) => void;
  removePlayer: (playerId: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  setWinners: (winners: WinnerInfo[]) => void;
  setTurnTimer: (timeRemaining: number, playerId: string) => void;
  setTurnTimerWarning: (playerId: string) => void;
  clearTurnTimer: () => void;
  setShownHand: (playerId: string, cards: Card[]) => void;
  clearShownHands: () => void;
  setSevenDeuceBonus: (bonus: SevenDeuceBonusInfo) => void;
  clearSevenDeuceBonus: () => void;
  setRunItPrompt: (prompt: RunItPrompt | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState = {
  isConnected: false,
  connectionError: null,
  userId: null,
  username: null,
  token: null,
  room: null,
  players: [],
  gameState: null,
  chat: [],
  winners: [],
  turnTimeRemaining: null,
  turnTimerPlayerId: null,
  turnTimerWarning: false,
  shownHands: new Map<string, Card[]>(),
  sevenDeuceBonus: null,
  isLoading: false,
  error: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setConnection: (connected, error) =>
    set({
      isConnected: connected,
      connectionError: error || null,
    }),

  setUser: (userId, username, token) =>
    set({ userId, username, token }),

  setRoom: (room) =>
    set({
      room,
      players: [],
      gameState: null,
      chat: [],
      winners: [],
    }),

  updateRoom: (room) =>
    set({ room }),

  setGameState: (state) =>
    set((prev) => {
      // Merge players from game state with existing players to prevent race conditions
      // where room:player-joined updates get overwritten by game:state
      let mergedPlayers = prev.players;
      if (state?.players) {
        // Create a map of existing players by oderId for quick lookup
        const existingPlayersMap = new Map(prev.players.map(p => [p.oderId, p]));

        // Update existing players with new data from game state, add new ones
        state.players.forEach(player => {
          existingPlayersMap.set(player.oderId, player);
        });

        mergedPlayers = Array.from(existingPlayersMap.values());
      }

      return {
        gameState: state,
        players: mergedPlayers,
        // Clear winners, shown hands, and 7-2 bonus when a new hand starts (phase transitions from complete to preflop/starting)
        winners: (state && state.phase !== 'complete' && state.phase !== 'showdown') ? [] : prev.winners,
        shownHands: (state && state.phase !== 'complete' && state.phase !== 'showdown') ? new Map() : prev.shownHands,
        sevenDeuceBonus: (state && state.phase !== 'complete' && state.phase !== 'showdown') ? null : prev.sevenDeuceBonus,
      };
    }),

  updatePlayer: (player) =>
    set((state) => {
      const existingIndex = state.players.findIndex(p => p.oderId === player.oderId);
      if (existingIndex >= 0) {
        const newPlayers = [...state.players];
        newPlayers[existingIndex] = player;
        return { players: newPlayers };
      }
      return { players: [...state.players, player] };
    }),

  updatePlayerPreference: (playerId, updates) =>
    set((state) => {
      const existingIndex = state.players.findIndex(p => p.oderId === playerId);
      if (existingIndex >= 0) {
        const newPlayers = [...state.players];
        // Merge updates with existing player data
        newPlayers[existingIndex] = { ...newPlayers[existingIndex], ...updates };
        return { players: newPlayers };
      }
      return state; // Player not found, no change
    }),

  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter(p => p.oderId !== playerId),
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chat: [...state.chat.slice(-99), message], // Keep last 100 messages
    })),

  setWinners: (winners) =>
    set({ winners }),

  setTurnTimer: (timeRemaining, playerId) =>
    set({ turnTimeRemaining: timeRemaining, turnTimerPlayerId: playerId }),

  setTurnTimerWarning: (playerId) =>
    set({ turnTimerWarning: true, turnTimerPlayerId: playerId }),

  clearTurnTimer: () =>
    set({ turnTimeRemaining: null, turnTimerPlayerId: null, turnTimerWarning: false }),

  setShownHand: (playerId, cards) =>
    set((state) => {
      const newShownHands = new Map(state.shownHands);
      newShownHands.set(playerId, cards);
      return { shownHands: newShownHands };
    }),

  clearShownHands: () =>
    set({ shownHands: new Map() }),

  setSevenDeuceBonus: (bonus) =>
    set({ sevenDeuceBonus: bonus }),

  clearSevenDeuceBonus: () =>
    set({ sevenDeuceBonus: null }),

  setRunItPrompt: (prompt) =>
    set((state) => {
      if (!state.gameState) {
        console.warn('[Store] setRunItPrompt: gameState is null, cannot update');
        return state;
      }
      console.log('[Store] Updating runItPrompt:', prompt);
      return {
        gameState: {
          ...state.gameState,
          runItPrompt: prompt,
        },
      };
    }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set(initialState),
}));

// =============================================================================
// SELECTORS
// =============================================================================

export const selectCurrentPlayer = (state: GameStore) =>
  state.players.find(p => p.oderId === state.userId);

export const selectIsMyTurn = (state: GameStore) => {
  const currentPlayer = selectCurrentPlayer(state);
  if (!currentPlayer || !state.gameState) return false;
  return state.gameState.currentPlayerSeat === currentPlayer.seat;
};

export const selectCanStartGame = (state: GameStore) => {
  if (!state.room || !state.gameState) return false;
  if (state.gameState.phase !== 'waiting') return false;
  return state.players.filter(p => p.status === 'active').length >= 2;
};
