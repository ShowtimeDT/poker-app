import type {
  Room,
  GameState,
  RoomPlayer,
  GameVariant,
  Stakes,
  CustomRules,
  PlayerAction,
  WinnerInfo,
} from '@poker/shared';
import { DEFAULT_CUSTOM_RULES } from '@poker/shared';
import { PokerGameState } from '@poker/engine';
import { nanoid } from 'nanoid';

// =============================================================================
// TYPES
// =============================================================================

interface ActiveRoom {
  room: Room;
  gameState: PokerGameState;
  players: Map<string, RoomPlayer>;
  spectators: Set<string>;
  turnTimer?: NodeJS.Timeout;
}

interface CreateRoomOptions {
  name: string;
  variant: GameVariant;
  stakes: Stakes;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  hostId: string;
  customRules?: Partial<CustomRules>;
}

// =============================================================================
// ROOM MANAGER
// =============================================================================

/**
 * Manages active poker rooms and game state
 * Handles room lifecycle, player management, and game flow
 */
export class RoomManager {
  private rooms: Map<string, ActiveRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // oderId -> roomId
  private roomCodes: Map<string, string> = new Map(); // code -> roomId

  // ---------------------------------------------------------------------------
  // Room Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create a new room
   */
  createRoom(options: CreateRoomOptions): Room {
    const roomId = nanoid();
    const code = this.generateUniqueCode();

    const room: Room = {
      id: roomId,
      name: options.name,
      code,
      variant: options.variant,
      stakes: options.stakes,
      maxPlayers: options.maxPlayers,
      isPrivate: options.isPrivate,
      hasPassword: !!options.password,
      hostId: options.hostId,
      status: 'waiting',
      createdAt: new Date(),
      customRules: { ...DEFAULT_CUSTOM_RULES, ...options.customRules },
      allowedVariants: [options.variant],
      currentVariant: options.variant,
    };

    const gameState = new PokerGameState(
      roomId,
      options.variant,
      options.stakes,
      room.customRules
    );

    const activeRoom: ActiveRoom = {
      room,
      gameState,
      players: new Map(),
      spectators: new Set(),
    };

    this.rooms.set(roomId, activeRoom);
    this.roomCodes.set(code, roomId);

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): ActiveRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room by code
   */
  getRoomByCode(code: string): ActiveRoom | undefined {
    const roomId = this.roomCodes.get(code.toUpperCase());
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  /**
   * Close a room
   */
  closeRoom(roomId: string): void {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return;

    // Clear timers
    if (activeRoom.turnTimer) {
      clearTimeout(activeRoom.turnTimer);
    }

    // Remove player mappings
    activeRoom.players.forEach((_, oderId) => {
      this.playerRooms.delete(oderId);
    });

    // Remove room
    this.roomCodes.delete(activeRoom.room.code);
    this.rooms.delete(roomId);
  }

  /**
   * List all public rooms
   */
  listPublicRooms(): Room[] {
    return Array.from(this.rooms.values())
      .filter(r => !r.room.isPrivate && r.room.status !== 'closed')
      .map(r => r.room);
  }

  // ---------------------------------------------------------------------------
  // Player Management
  // ---------------------------------------------------------------------------

  /**
   * Add player to room
   */
  joinRoom(
    roomId: string,
    player: RoomPlayer
  ): { success: boolean; error?: string } {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) {
      return { success: false, error: 'Room not found' };
    }

    if (activeRoom.players.size >= activeRoom.room.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    // Check if seat is taken
    const seatTaken = Array.from(activeRoom.players.values())
      .some(p => p.seat === player.seat);
    if (seatTaken) {
      return { success: false, error: 'Seat is taken' };
    }

    // Add player
    activeRoom.players.set(player.oderId, player);
    this.playerRooms.set(player.oderId, roomId);

    // Add to game state
    activeRoom.gameState.addPlayer(player);

    return { success: true };
  }

  /**
   * Remove player from room
   */
  leaveRoom(roomId: string, oderId: string): void {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return;

    activeRoom.players.delete(oderId);
    activeRoom.spectators.delete(oderId);
    this.playerRooms.delete(oderId);

    activeRoom.gameState.removePlayer(oderId);

    // Close room if empty
    if (activeRoom.players.size === 0) {
      this.closeRoom(roomId);
    }
  }

  /**
   * Get player's current room
   */
  getPlayerRoom(oderId: string): string | undefined {
    return this.playerRooms.get(oderId);
  }

  /**
   * Update player in room
   */
  updatePlayer(roomId: string, oderId: string, updates: Partial<RoomPlayer>): void {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return;

    const player = activeRoom.players.get(oderId);
    if (player) {
      Object.assign(player, updates);
    }
  }

  /**
   * Update room settings (host only)
   * Changes take effect on the next hand
   */
  updateSettings(
    roomId: string,
    hostId: string,
    settings: {
      stakes?: Partial<import('@poker/shared').Stakes>;
      maxPlayers?: number;
      customRules?: Partial<import('@poker/shared').CustomRules>;
    }
  ): import('@poker/shared').Room | null {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return null;

    // Verify the requester is the host
    if (activeRoom.room.hostId !== hostId) {
      return null;
    }

    // Update stakes
    if (settings.stakes) {
      activeRoom.room.stakes = {
        ...activeRoom.room.stakes,
        ...settings.stakes,
      };
      // Also update the game state's stakes
      activeRoom.gameState.updateStakes(activeRoom.room.stakes);
    }

    // Update max players (only if it's >= current player count)
    if (settings.maxPlayers !== undefined) {
      const currentPlayerCount = activeRoom.players.size;
      if (settings.maxPlayers >= currentPlayerCount && settings.maxPlayers >= 2 && settings.maxPlayers <= 10) {
        activeRoom.room.maxPlayers = settings.maxPlayers;
      }
    }

    // Update custom rules
    if (settings.customRules) {
      activeRoom.room.customRules = {
        ...activeRoom.room.customRules,
        ...settings.customRules,
      };
    }

    return activeRoom.room;
  }

  // ---------------------------------------------------------------------------
  // Game Actions
  // ---------------------------------------------------------------------------

  /**
   * Start a new hand
   * @param bombPotAmount - If provided, everyone antes this amount (bomb pot)
   * @param dualBoard - If true and bomb pot, deal two separate boards
   */
  startHand(roomId: string, bombPotAmount?: number, dualBoard?: boolean): GameState | null {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return null;

    try {
      activeRoom.gameState.startHand(bombPotAmount, dualBoard);
      activeRoom.room.status = 'playing';
      return activeRoom.gameState.getState();
    } catch (error) {
      console.error('Failed to start hand:', error);
      return null;
    }
  }

  /**
   * Process player action
   */
  processAction(
    roomId: string,
    oderId: string,
    action: PlayerAction
  ): { success: boolean; error?: string; state?: GameState; winners?: WinnerInfo[] } {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) {
      return { success: false, error: 'Room not found' };
    }

    const result = activeRoom.gameState.processAction(oderId, action);
    if (!result.valid) {
      return { success: false, error: result.error };
    }

    const state = activeRoom.gameState.getState();

    // Check for hand completion - get winners from cached result (already resolved)
    let winners: WinnerInfo[] | undefined;
    if (state.phase === 'complete') {
      winners = activeRoom.gameState.getLastWinners();
      activeRoom.room.status = 'waiting';
    }

    return { success: true, state, winners };
  }

  /**
   * Process straddle decision
   */
  processStraddle(
    roomId: string,
    playerId: string,
    accepted: boolean
  ): { success: boolean; straddleAmount?: number; next?: { prompt: import('@poker/shared').StraddlePrompt | null; autoStraddle: boolean } | null; seat?: number } | null {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return null;

    const player = activeRoom.players.get(playerId);
    if (!player) return null;

    const result = activeRoom.gameState.processStraddle(playerId, accepted);
    if (!result.success) return null;

    const state = activeRoom.gameState.getState();
    const straddle = state.straddles?.[state.straddles.length - 1];

    return {
      success: true,
      straddleAmount: accepted && straddle ? straddle.amount : undefined,
      next: result.next,
      seat: player.seat,
    };
  }

  /**
   * Start straddle prompts for a room (called after blinds are posted)
   * Returns the prompt and whether the player has auto-straddle enabled
   */
  startStraddlePrompts(roomId: string): { prompt: import('@poker/shared').StraddlePrompt | null; autoStraddle: boolean } {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return { prompt: null, autoStraddle: false };

    return activeRoom.gameState.startStraddlePrompt();
  }

  /**
   * End straddle phase (called when straddle is declined or no more straddlers)
   */
  endStraddlePhase(roomId: string): void {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return;

    activeRoom.gameState.endStraddlePhase();
  }

  /**
   * Get valid actions for current player
   */
  getValidActions(roomId: string): string[] {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return [];

    return activeRoom.gameState.getValidActions();
  }

  /**
   * Get current game state
   */
  getGameState(roomId: string, forPlayerId?: string): GameState | null {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return null;

    return activeRoom.gameState.getState(forPlayerId);
  }

  /**
   * Get a player's hole cards (for show hand feature)
   */
  getPlayerHoleCards(roomId: string, playerId: string) {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return undefined;

    return activeRoom.gameState.getPlayerHoleCards(playerId);
  }

  // ---------------------------------------------------------------------------
  // Room Configuration
  // ---------------------------------------------------------------------------

  /**
   * Update room custom rules
   */
  updateRules(roomId: string, rules: Partial<CustomRules>): void {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return;

    activeRoom.room.customRules = { ...activeRoom.room.customRules, ...rules };
    activeRoom.gameState.updateRules(activeRoom.room.customRules);
  }

  /**
   * Switch game variant
   */
  switchVariant(roomId: string, variant: GameVariant): boolean {
    const activeRoom = this.rooms.get(roomId);
    if (!activeRoom) return false;

    if (activeRoom.room.status === 'playing') {
      return false; // Can't switch during hand
    }

    try {
      activeRoom.gameState.switchVariant(variant);
      activeRoom.room.currentVariant = variant;
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Generate unique 6-character room code
   */
  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;

    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        const randomBytes = new Uint8Array(1);
        crypto.getRandomValues(randomBytes);
        code += chars[randomBytes[0] % chars.length];
      }
    } while (this.roomCodes.has(code));

    return code;
  }

  /**
   * Get room statistics
   */
  getStats(): { totalRooms: number; totalPlayers: number; publicRooms: number } {
    let totalPlayers = 0;
    let publicRooms = 0;

    this.rooms.forEach(room => {
      totalPlayers += room.players.size;
      if (!room.room.isPrivate) publicRooms++;
    });

    return {
      totalRooms: this.rooms.size,
      totalPlayers,
      publicRooms,
    };
  }
}
