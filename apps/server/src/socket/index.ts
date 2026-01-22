import type { Server, Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerAction,
  RoomPlayer,
  GameVariant,
  RebuyPrompt,
} from '@poker/shared';
import { RoomManager } from '../services/RoomManager.js';

// =============================================================================
// TYPES
// =============================================================================

interface SocketData {
  oderId: string;
  odername: string;
  roomId?: string;
}

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type TypedIO = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

// =============================================================================
// TURN TIMER MANAGEMENT
// =============================================================================

interface TurnTimer {
  timerId: NodeJS.Timeout;
  intervalId: NodeJS.Timeout;
  timeRemaining: number;
  hasWarned: boolean;
  playerId: string;
}

const turnTimers: Map<string, TurnTimer> = new Map(); // roomId -> TurnTimer

// Track socket IDs by oderId for reliable lookups
// This is updated on connect/disconnect and ensures we can always find the right socket
const socketIdByOderId: Map<string, string> = new Map(); // oderId -> socketId

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer.timerId);
    clearInterval(timer.intervalId);
    turnTimers.delete(roomId);
  }
}

function startTurnTimer(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  playerId: string,
  turnTimeSeconds: number,
  warningTimeSeconds: number,
  fastify: FastifyInstance
) {
  // Clear any existing timer
  clearTurnTimer(roomId);

  let timeRemaining = turnTimeSeconds;
  let hasWarned = false;

  // Send timer updates every second
  const intervalId = setInterval(() => {
    timeRemaining--;

    // Broadcast timer update
    io.to(roomId).emit('game:timer', { timeRemaining, playerId });

    // If time runs out without warning, add warning time
    if (timeRemaining <= 0 && !hasWarned) {
      hasWarned = true;
      timeRemaining = warningTimeSeconds;
      io.to(roomId).emit('game:timer-warning', { playerId, extraTime: warningTimeSeconds });
      fastify.log.info(`Timer warning for player in room ${roomId}`);
    }
  }, 1000);

  // Auto-fold timer
  const timerId = setTimeout(() => {
    clearInterval(intervalId);
    turnTimers.delete(roomId);

    // Auto-fold the player
    const result = roomManager.processAction(roomId, playerId, {
      type: 'fold',
      timestamp: Date.now(),
    });

    if (result.success) {
      io.to(roomId).emit('game:action', { type: 'fold', timestamp: Date.now(), playerId });
      io.to(roomId).emit('game:auto-fold', { playerId });
      fastify.log.info(`Auto-fold for player ${playerId} in room ${roomId}`);

      // Set player to sitting-out immediately after timeout
      // They must click "I'm Back" to continue playing
      roomManager.updatePlayer(roomId, playerId, { status: 'sitting-out' });
      fastify.log.info(`Player ${playerId} set to sitting-out after timeout`);

      // Send updated state
      const activeRoom = roomManager.getRoom(roomId);
      if (activeRoom) {
        activeRoom.players.forEach((p, oderId) => {
          const personalState = roomManager.getGameState(roomId, oderId);
          if (personalState) {
            const socketId = getSocketId(io, oderId);
            if (socketId) {
              io.to(socketId).emit('game:state', personalState);
            }
          }
        });
      }

      // Handle winners if hand ended
      if (result.winners) {
        io.to(roomId).emit('game:winner', result.winners);

        // Auto-start next hand after a delay (same logic as regular action handler)
        if (activeRoom) {
          setTimeout(() => {
            // Verify room still exists
            const room = roomManager.getRoom(roomId);
            if (!room) return;

            // Check if waitForAllRebuys is enabled and there are busted players
            if (room.room.customRules.waitForAllRebuys) {
              const bustedPlayers = Array.from(room.players.values())
                .filter(p => p.chips === 0 && p.status !== 'disconnected' && p.status !== 'sitting-out');

              if (bustedPlayers.length > 0) {
                startRebuyPromptPhase(io, roomManager, roomId, fastify);
                return;
              }
            }

            const activePlayers = Array.from(room.players.values()).filter(p => p.status === 'active' && p.chips > 0);
            if (activePlayers.length < 2) {
              // Not enough players to continue - send updated state
              io.to(roomId).emit('game:winner', []);
              broadcastGameState(io, roomManager, roomId);
              fastify.log.info(`Waiting for more players after auto-fold in room ${room.room.code}`);
              return;
            }

            // Start next hand (with bomb pot check)
            const result = startNextHand(roomManager, roomId, fastify);
            if (result?.state) {
              const { state } = result;
              broadcastGameState(io, roomManager, roomId);

              // Check for straddle phase
              if (!result.isBombPot && room.room.customRules.straddleEnabled) {
                handleStraddlePhase(io, roomManager, roomId, fastify);
              } else {
                // Start turn timer for first player of new hand
                if (room.room.customRules.turnTimeEnabled) {
                  const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
                  if (currentPlayer) {
                    startTurnTimer(
                      io,
                      roomManager,
                      roomId,
                      currentPlayer.oderId,
                      room.room.customRules.turnTimeSeconds,
                      room.room.customRules.warningTimeSeconds,
                      fastify
                    );
                  }
                }
              }
              fastify.log.info(`Auto-started new hand after auto-fold in room ${room.room.code}`);
            }
          }, 5000); // 5 second delay before next hand
        }
      }
    }
  }, (turnTimeSeconds + warningTimeSeconds) * 1000);

  turnTimers.set(roomId, {
    timerId,
    intervalId,
    timeRemaining,
    hasWarned,
    playerId,
  });
}

// =============================================================================
// STRADDLE TIMERS
// =============================================================================

interface StraddleTimer {
  timerId: NodeJS.Timeout;
  intervalId: NodeJS.Timeout;
  playerId: string;
}

const straddleTimers: Map<string, StraddleTimer> = new Map(); // roomId -> StraddleTimer

// =============================================================================
// RUN-IT TIMERS
// =============================================================================

interface RunItTimer {
  timerId: NodeJS.Timeout;
  intervalId: NodeJS.Timeout;
  timeRemaining: number;
}

const runItTimers: Map<string, RunItTimer> = new Map(); // roomId -> RunItTimer

function clearStraddleTimer(roomId: string) {
  const timer = straddleTimers.get(roomId);
  if (timer) {
    clearTimeout(timer.timerId);
    clearInterval(timer.intervalId);
    straddleTimers.delete(roomId);
  }
}

function startStraddleTimer(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  playerId: string,
  timeoutSeconds: number,
  fastify: FastifyInstance
) {
  // Clear any existing timer
  clearStraddleTimer(roomId);

  let timeRemaining = timeoutSeconds;

  // Send timer updates every second
  const intervalId = setInterval(() => {
    timeRemaining--;
    // Use the same timer event for consistency
    io.to(roomId).emit('game:timer', { timeRemaining, playerId });
  }, 1000);

  // Auto-decline timer
  const timerId = setTimeout(() => {
    clearInterval(intervalId);
    straddleTimers.delete(roomId);

    // Auto-decline the straddle
    const result = roomManager.processStraddle(roomId, playerId, false);

    if (result) {
      io.to(roomId).emit('game:straddle-declined', {
        seat: result.seat || 0,
      });
      fastify.log.info(`Auto-decline straddle for player ${playerId} in room ${roomId}`);

      // Send updated state
      broadcastGameState(io, roomManager, roomId);

      // Straddle phase complete
      roomManager.endStraddlePhase(roomId);
      finishStraddlePhase(io, roomManager, roomId, fastify);
    }
  }, timeoutSeconds * 1000);

  straddleTimers.set(roomId, {
    timerId,
    intervalId,
    playerId,
  });
}

// =============================================================================
// RUN-IT TIMER FUNCTIONS
// =============================================================================

function clearRunItTimer(roomId: string) {
  const timer = runItTimers.get(roomId);
  if (timer) {
    clearTimeout(timer.timerId);
    clearInterval(timer.intervalId);
    runItTimers.delete(roomId);
  }
}

function startRunItTimer(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  timeoutSeconds: number,
  fastify: FastifyInstance
) {
  // Clear any existing timer
  clearRunItTimer(roomId);

  let timeRemaining = timeoutSeconds;

  // Send timer updates every second
  const intervalId = setInterval(() => {
    timeRemaining--;

    // Broadcast timer update to all players in room
    // Use a synthetic player ID for the run-it timer
    io.to(roomId).emit('game:timer', { timeRemaining, playerId: 'run-it' });

    // Check if all confirmed and same choice - end early
    if (roomManager.allConfirmedChoicesSame(roomId)) {
      clearRunItTimer(roomId);
      finalizeRunIt(io, roomManager, roomId, fastify);
    }
  }, 1000);

  // Auto-finalize timer
  const timerId = setTimeout(() => {
    clearInterval(intervalId);
    runItTimers.delete(roomId);
    finalizeRunIt(io, roomManager, roomId, fastify);
  }, timeoutSeconds * 1000);

  runItTimers.set(roomId, {
    timerId,
    intervalId,
    timeRemaining,
  });
}

// =============================================================================
// REBUY PROMPT FUNCTIONS (waitForAllRebuys feature)
// =============================================================================

function startRebuyPromptPhase(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  // Start the rebuy prompt (60 second timeout)
  const prompt = roomManager.startRebuyPrompt(roomId, 60);
  if (!prompt) {
    // No busted players, try to start next hand
    tryStartNextHand(io, roomManager, roomId, fastify);
    return;
  }

  fastify.log.info(`Rebuy prompt started for ${prompt.playerIds.length} player(s) in room ${activeRoom.room.code}`);

  // Broadcast the prompt to all clients
  io.to(roomId).emit('room:rebuy-prompt', prompt);

  // Set timeout to auto-decline pending players
  const timer = setTimeout(() => {
    const currentPrompt = roomManager.getRebuyPrompt(roomId);
    if (!currentPrompt) return;

    // Auto-decline all pending players
    currentPrompt.decisions.forEach(d => {
      if (d.decision === 'pending') {
        d.decision = 'decline';
        // Set player to sitting-out
        const player = activeRoom.players.get(d.playerId);
        if (player) {
          player.status = 'sitting-out';
          roomManager.updatePlayer(roomId, d.playerId, { status: 'sitting-out' });
        }
        fastify.log.info(`Auto-declined rebuy for player ${d.playerId} (timeout)`);
      }
    });

    finishRebuyPromptPhase(io, roomManager, roomId, fastify);
  }, 60000);

  roomManager.setRebuyPromptTimer(roomId, timer);
}

function finishRebuyPromptPhase(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  // Clear the prompt and timer
  roomManager.clearRebuyPrompt(roomId);

  // Broadcast that the prompt is cleared
  io.to(roomId).emit('room:rebuy-prompt', null);

  fastify.log.info(`Rebuy prompt phase finished in room ${activeRoom.room.code}`);

  // Send updated state to all players
  broadcastGameState(io, roomManager, roomId);

  // Try to start next hand
  tryStartNextHand(io, roomManager, roomId, fastify);
}

function tryStartNextHand(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  const activePlayers = Array.from(activeRoom.players.values())
    .filter(p => p.status === 'active' && p.chips > 0);

  if (activePlayers.length < 2) {
    fastify.log.info(`Waiting for more players in room ${activeRoom.room.code} (only ${activePlayers.length} active)`);
    io.to(roomId).emit('game:winner', []);
    broadcastGameState(io, roomManager, roomId);
    return;
  }

  // Start next hand
  const result = startNextHand(roomManager, roomId, fastify);
  if (result?.state) {
    const { state } = result;
    broadcastGameState(io, roomManager, roomId);

    // Check for straddle phase (only for non-bomb-pot hands)
    if (!result.isBombPot && activeRoom.room.customRules.straddleEnabled) {
      handleStraddlePhase(io, roomManager, roomId, fastify);
    } else {
      // Start turn timer for first player
      if (activeRoom.room.customRules.turnTimeEnabled) {
        const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
        if (currentPlayer) {
          startTurnTimer(
            io,
            roomManager,
            roomId,
            currentPlayer.oderId,
            activeRoom.room.customRules.turnTimeSeconds,
            activeRoom.room.customRules.warningTimeSeconds,
            fastify
          );
        }
      }
    }

    fastify.log.info(`Started new hand in room ${activeRoom.room.code}`);
  }
}

function finalizeRunIt(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
) {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  // Clear the timer if it's still running
  clearRunItTimer(roomId);

  // Get the final choice
  const finalChoice = roomManager.getFinalRunItChoice(roomId);

  fastify.log.info(`Run-it finalized in room ${activeRoom.room.code}: ${finalChoice} time(s)`);

  if (finalChoice === 1) {
    // Run once = normal runout
    roomManager.skipRunIt(roomId);

    // Broadcast state update
    broadcastGameState(io, roomManager, roomId);

    // Get winners after runout
    const state = roomManager.getGameState(roomId);
    if (state?.phase === 'complete') {
      const winners = activeRoom.gameState.getLastWinners();
      const winnerDelay = calculateRunoutDelay(state.runoutStartPhase);

      setTimeout(() => {
        io.to(roomId).emit('game:winner', winners);
        // Emit 7-2 bonus if applicable
        if (state.sevenDeuceBonus) {
          io.to(roomId).emit('game:seven-deuce-bonus', state.sevenDeuceBonus);
        }
      }, winnerDelay);

      // Auto-start next hand
      scheduleNextHand(io, roomManager, roomId, winnerDelay + 5000, fastify);
    }
  } else {
    // Run multiple times
    const boards = roomManager.executeRunIt(roomId, finalChoice);

    if (boards) {
      // Strip winners from boards for the result event (clients should animate first)
      const boardsWithoutWinners = boards.map(b => ({
        ...b,
        winners: [], // Hide winners until after animation
      }));

      // Emit run-it result (without winners so client can animate)
      io.to(roomId).emit('game:run-it-result', { boards: boardsWithoutWinners, finalChoice });

      // Get winners (already calculated by executeRunIt)
      const winners = activeRoom.gameState.getLastWinners();

      // Calculate delay for winner announcement (let boards animate)
      const boardAnimationDelay = finalChoice * 2000; // 2s per board

      // Delay broadcasting full state until after animation completes
      // This prevents the client from seeing winners early via game:state
      setTimeout(() => {
        // Now broadcast the full state with winners
        broadcastGameState(io, roomManager, roomId);
        io.to(roomId).emit('game:winner', winners);
        // Emit 7-2 bonus if applicable
        const state = roomManager.getGameState(roomId);
        if (state?.sevenDeuceBonus) {
          io.to(roomId).emit('game:seven-deuce-bonus', state.sevenDeuceBonus);
        }
      }, boardAnimationDelay);

      // Auto-start next hand
      scheduleNextHand(io, roomManager, roomId, boardAnimationDelay + 5000, fastify);
    }
  }
}

function scheduleNextHand(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  delay: number,
  fastify: FastifyInstance
) {
  setTimeout(() => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Check if waitForAllRebuys is enabled and there are busted players
    if (room.room.customRules.waitForAllRebuys) {
      const bustedPlayers = Array.from(room.players.values())
        .filter(p => p.chips === 0 && p.status !== 'disconnected' && p.status !== 'sitting-out');

      if (bustedPlayers.length > 0) {
        // Start the rebuy prompt phase instead of starting the next hand
        startRebuyPromptPhase(io, roomManager, roomId, fastify);
        return;
      }
    }

    const activePlayers = Array.from(room.players.values()).filter(p => p.status === 'active' && p.chips > 0);
    if (activePlayers.length < 2) {
      io.to(roomId).emit('game:winner', []);
      broadcastGameState(io, roomManager, roomId);
      fastify.log.info(`Waiting for more players in room ${room.room.code}`);
      return;
    }

    const result = startNextHand(roomManager, roomId, fastify);
    if (result?.state) {
      const { state } = result;
      broadcastGameState(io, roomManager, roomId);

      // Check for straddle phase
      if (!result.isBombPot && room.room.customRules.straddleEnabled) {
        handleStraddlePhase(io, roomManager, roomId, fastify);
      } else {
        // Start turn timer
        if (room.room.customRules.turnTimeEnabled) {
          const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
          if (currentPlayer) {
            startTurnTimer(
              io,
              roomManager,
              roomId,
              currentPlayer.oderId,
              room.room.customRules.turnTimeSeconds,
              room.room.customRules.warningTimeSeconds,
              fastify
            );
          }
        }
      }
    }
  }, delay);
}

// =============================================================================
// SOCKET SETUP
// =============================================================================

export function setupSocketHandlers(
  io: TypedIO,
  roomManager: RoomManager,
  fastify: FastifyInstance
): void {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const clientAnonId = socket.handshake.auth.anonId;

      if (!token) {
        // Allow anonymous connections - use client-provided ID for consistency across reconnections
        // This ensures the same user keeps the same ID even if socket reconnects
        if (clientAnonId && typeof clientAnonId === 'string' && clientAnonId.startsWith('anon_')) {
          socket.data.oderId = clientAnonId;
        } else {
          socket.data.oderId = `anon_${generateId()}`;
        }
        socket.data.odername = `Player${Math.floor(Math.random() * 10000)}`;
        fastify.log.info(`Anonymous socket connected: ${socket.id} with oderId: ${socket.data.oderId}`);
        return next();
      }

      // Verify JWT token
      const decoded = fastify.jwt.verify<{ sub: string; username: string }>(token);
      socket.data.oderId = decoded.sub;
      socket.data.odername = decoded.username;
      fastify.log.info(`Authenticated socket connected: ${socket.id} with oderId: ${socket.data.oderId}`);
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: TypedSocket) => {
    fastify.log.info(`Socket connected: ${socket.id} (${socket.data.odername}) oderId: ${socket.data.oderId}`);

    // Register this socket in our tracking map for reliable lookups
    socketIdByOderId.set(socket.data.oderId, socket.id);
    fastify.log.info(`Registered socket mapping: ${socket.data.oderId} -> ${socket.id}`);

    // Register event handlers
    handleRoomEvents(socket, io, roomManager, fastify);
    handleGameEvents(socket, io, roomManager, fastify);
    handleDisconnect(socket, io, roomManager, fastify);
  });
}

// =============================================================================
// BOMB POT HELPERS
// =============================================================================

/**
 * Check if the next dealer has bomb pot preference enabled
 * Returns the bomb pot amount if enabled, undefined otherwise
 */
function checkBombPotTrigger(
  roomManager: RoomManager,
  roomId: string
): { bombPotAmount: number; dualBoard: boolean } | null {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return null;

  // Check if bomb pots are enabled in room settings
  if (!activeRoom.room.customRules.bombPotEnabled) return null;

  const currentState = roomManager.getGameState(roomId);
  if (!currentState) return null;

  // Find the next dealer seat (calculated based on current state)
  const activePlayers = Array.from(activeRoom.players.values())
    .filter(p => p.status === 'active' && p.chips > 0)
    .sort((a, b) => a.seat - b.seat);

  if (activePlayers.length < 2) return null;

  // Calculate next dealer seat (same logic as engine)
  let nextDealerSeat = currentState.dealerSeat;
  const activeSeats = activePlayers.map(p => p.seat);
  for (const seat of activeSeats) {
    if (seat > nextDealerSeat) {
      nextDealerSeat = seat;
      break;
    }
  }
  if (nextDealerSeat === currentState.dealerSeat) {
    nextDealerSeat = activeSeats[0];
  }

  // Find the player at the next dealer seat
  const nextDealer = activePlayers.find(p => p.seat === nextDealerSeat);
  if (!nextDealer || !nextDealer.bombPotWhenDealer) return null;

  // Calculate bomb pot amount (use custom rules or default to 10x big blind)
  const bombPotAmount = activeRoom.room.customRules.bombPotAmount ||
    (activeRoom.room.stakes.bigBlind * 10);

  // Always use dual board for bomb pots triggered by player preference
  return { bombPotAmount, dualBoard: true };
}

/**
 * Start the next hand, checking for bomb pot trigger
 * Returns the game state or null if failed
 */
function startNextHand(
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): { state: ReturnType<typeof roomManager.startHand>; isBombPot: boolean; isDualBoard: boolean } | null {
  const room = roomManager.getRoom(roomId);
  if (!room) return null;

  // Check if bomb pot should be triggered
  const bombPotConfig = checkBombPotTrigger(roomManager, roomId);

  let state;
  if (bombPotConfig) {
    // Start bomb pot hand
    state = roomManager.startHand(roomId, bombPotConfig.bombPotAmount, bombPotConfig.dualBoard);
    if (state) {
      // Note: bombPotWhenDealer preference persists - user must manually uncheck it
      fastify.log.info(`Bomb pot triggered (dual board: ${bombPotConfig.dualBoard}) in room ${room.room.code}`);
    }
    return state ? { state, isBombPot: true, isDualBoard: bombPotConfig.dualBoard } : null;
  } else {
    // Start normal hand
    state = roomManager.startHand(roomId);
    return state ? { state, isBombPot: false, isDualBoard: false } : null;
  }
}

/**
 * Handle straddle flow with auto-straddle support
 * Processes auto-straddles automatically and shows prompts for manual decisions
 */
function handleStraddlePhase(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom || !activeRoom.room.customRules.straddleEnabled) {
    return;
  }

  // Start the straddle prompt chain
  processStraddleChain(io, roomManager, roomId, fastify);
}

/**
 * Process the straddle chain - handles auto-straddles and shows prompts
 */
function processStraddleChain(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  const straddleInfo = roomManager.startStraddlePrompts(roomId);

  if (!straddleInfo.prompt) {
    // No more straddle opportunities, end straddle phase
    roomManager.endStraddlePhase(roomId);
    finishStraddlePhase(io, roomManager, roomId, fastify);
    return;
  }

  if (straddleInfo.autoStraddle) {
    // Player has auto-straddle enabled - process it automatically
    const result = roomManager.processStraddle(roomId, straddleInfo.prompt.playerId, true);

    if (result?.success) {
      // Broadcast the auto-straddle
      const player = activeRoom.players.get(straddleInfo.prompt.playerId);
      io.to(roomId).emit('game:straddle-placed', {
        playerId: straddleInfo.prompt.playerId,
        amount: result.straddleAmount || 0,
        seat: player?.seat || 0,
      });

      // Note: straddleNextHand preference persists - user must manually uncheck it

      fastify.log.info(`Auto-straddle by ${player?.odername} for ${result.straddleAmount} in room ${activeRoom.room.code}`);

      // Send updated state
      broadcastGameState(io, roomManager, roomId);

      // Continue to next in chain
      if (result.next) {
        // Small delay before processing next auto-straddle for visual feedback
        setTimeout(() => {
          processStraddleChainNext(io, roomManager, roomId, result.next!, fastify);
        }, 500);
      } else {
        // No next prompt means straddle phase is complete
        roomManager.endStraddlePhase(roomId);
        finishStraddlePhase(io, roomManager, roomId, fastify);
      }
    }
  } else {
    // Player needs to manually decide - show prompt and start timer
    broadcastGameState(io, roomManager, roomId);
    startStraddleTimer(io, roomManager, roomId, straddleInfo.prompt.playerId, straddleInfo.prompt.timeoutSeconds, fastify);
    fastify.log.info(`Straddle prompt for ${straddleInfo.prompt.playerId} (amount: ${straddleInfo.prompt.amount}) in room ${activeRoom.room.code}`);
  }
}

/**
 * Process the next straddle in the chain based on previous result
 */
function processStraddleChainNext(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  nextInfo: { prompt: import('@poker/shared').StraddlePrompt | null; autoStraddle: boolean },
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  if (!nextInfo.prompt) {
    // No more straddle opportunities
    roomManager.endStraddlePhase(roomId);
    finishStraddlePhase(io, roomManager, roomId, fastify);
    return;
  }

  if (nextInfo.autoStraddle) {
    // Auto-straddle (only happens for UTG position)
    const result = roomManager.processStraddle(roomId, nextInfo.prompt.playerId, true);

    if (result?.success) {
      const player = activeRoom.players.get(nextInfo.prompt.playerId);
      io.to(roomId).emit('game:straddle-placed', {
        playerId: nextInfo.prompt.playerId,
        amount: result.straddleAmount || 0,
        seat: player?.seat || 0,
      });

      // Note: straddleNextHand preference persists - user must manually uncheck it

      fastify.log.info(`Auto-straddle by ${player?.odername} for ${result.straddleAmount} in room ${activeRoom.room.code}`);
      broadcastGameState(io, roomManager, roomId);

      if (result.next) {
        setTimeout(() => {
          processStraddleChainNext(io, roomManager, roomId, result.next!, fastify);
        }, 500);
      } else {
        roomManager.endStraddlePhase(roomId);
        finishStraddlePhase(io, roomManager, roomId, fastify);
      }
    }
  } else {
    // Manual decision needed
    broadcastGameState(io, roomManager, roomId);
    startStraddleTimer(io, roomManager, roomId, nextInfo.prompt.playerId, nextInfo.prompt.timeoutSeconds, fastify);
    fastify.log.info(`Straddle prompt for ${nextInfo.prompt.playerId} (amount: ${nextInfo.prompt.amount}) in room ${activeRoom.room.code}`);
  }
}

/**
 * Finish the straddle phase and start turn timer
 */
function finishStraddlePhase(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string,
  fastify: FastifyInstance
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  // Send final state
  broadcastGameState(io, roomManager, roomId);

  // Start turn timer for first player
  if (activeRoom.room.customRules.turnTimeEnabled) {
    const state = roomManager.getGameState(roomId);
    const currentPlayer = state?.players.find(p => p.seat === state?.currentPlayerSeat);
    if (currentPlayer) {
      startTurnTimer(
        io,
        roomManager,
        roomId,
        currentPlayer.oderId,
        activeRoom.room.customRules.turnTimeSeconds,
        activeRoom.room.customRules.warningTimeSeconds,
        fastify
      );
    }
  }
}

/**
 * Helper to broadcast game state to all players
 */
function broadcastGameState(
  io: TypedIO,
  roomManager: RoomManager,
  roomId: string
): void {
  const activeRoom = roomManager.getRoom(roomId);
  if (!activeRoom) return;

  activeRoom.players.forEach((player, oderId) => {
    const personalState = roomManager.getGameState(roomId, oderId);
    if (personalState) {
      const socketId = getSocketId(io, oderId);
      if (socketId) {
        io.to(socketId).emit('game:state', personalState);
      }
    }
  });

  // Also send to spectators
  activeRoom.spectators.forEach((oderId) => {
    const spectatorState = roomManager.getGameState(roomId);
    if (spectatorState) {
      const socketId = getSocketId(io, oderId);
      if (socketId) {
        io.to(socketId).emit('game:state', spectatorState);
      }
    }
  });
}

// =============================================================================
// ROOM EVENTS
// =============================================================================

function handleRoomEvents(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager,
  fastify: FastifyInstance
): void {
  // Set bomb pot preference
  socket.on('player:set-bomb-pot-preference', (enabled: boolean) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    const player = activeRoom.players.get(socket.data.oderId);
    if (!player) {
      socket.emit('error', { code: 'NOT_SEATED', message: 'You are not seated at this table' });
      return;
    }

    // Update player's bomb pot preference
    player.bombPotWhenDealer = enabled;
    roomManager.updatePlayer(roomId, socket.data.oderId, { bombPotWhenDealer: enabled });

    // Broadcast preference change to all players
    io.to(roomId).emit('player:bomb-pot-preference-changed', {
      playerId: socket.data.oderId,
      enabled,
    });

    fastify.log.info(`${socket.data.odername} ${enabled ? 'enabled' : 'disabled'} bomb pot when dealer`);
  });

  // Set straddle preference
  socket.on('player:set-straddle-preference', (enabled: boolean) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    const player = activeRoom.players.get(socket.data.oderId);
    if (!player) {
      socket.emit('error', { code: 'NOT_SEATED', message: 'You are not seated at this table' });
      return;
    }

    // Update player's straddle preference
    player.straddleNextHand = enabled;
    roomManager.updatePlayer(roomId, socket.data.oderId, { straddleNextHand: enabled });

    // Broadcast preference change to all players
    io.to(roomId).emit('player:straddle-preference-changed', {
      playerId: socket.data.oderId,
      enabled,
    });

    fastify.log.info(`${socket.data.odername} ${enabled ? 'enabled' : 'disabled'} straddle next hand`);
  });

  // Join room
  socket.on('room:join', (roomCode, password) => {
    const activeRoom = roomManager.getRoomByCode(roomCode);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // TODO: Validate password if room has one

    // Join socket room
    socket.join(activeRoom.room.id);
    socket.data.roomId = activeRoom.room.id;

    // Add as spectator initially
    activeRoom.spectators.add(socket.data.oderId);

    // Send room info first (so frontend knows host, stakes, etc.)
    socket.emit('room:joined', {
      room: activeRoom.room,
      userId: socket.data.oderId,
      username: socket.data.odername,
    });

    // Send current game state
    const state = roomManager.getGameState(activeRoom.room.id, socket.data.oderId);
    if (state) {
      socket.emit('game:state', state);
    }

    fastify.log.info(`${socket.data.odername} joined room ${roomCode}`);
  });

  // Sit at table
  socket.on('room:sit', (seat, buyIn) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // Check if user is already seated
    if (activeRoom.players.has(socket.data.oderId)) {
      socket.emit('error', { code: 'ALREADY_SEATED', message: 'You are already seated at this table' });
      return;
    }

    const player: RoomPlayer = {
      id: generateId(),
      oderId: socket.data.oderId,
      odername: socket.data.odername,
      seat,
      chips: buyIn,
      status: 'active',
      isDealer: false,
      isTurn: false,
      bet: 0,
      totalBetThisRound: 0,
      hasActed: false,
      isAllIn: false,
      isFolded: false,
    };

    const result = roomManager.joinRoom(roomId, player);
    if (!result.success) {
      socket.emit('error', { code: 'JOIN_FAILED', message: result.error || 'Failed to join' });
      return;
    }

    // Remove from spectators since they're now a seated player
    activeRoom.spectators.delete(socket.data.oderId);

    // Notify all players
    io.to(roomId).emit('room:player-joined', player);

    // CRITICAL: Send game state directly to the socket that just sat down first
    // This ensures they receive it even if getSocketId lookup fails
    const sittingPlayerState = roomManager.getGameState(roomId, socket.data.oderId);
    if (sittingPlayerState) {
      socket.emit('game:state', sittingPlayerState);
      fastify.log.info(`Sent game:state directly to sitting player ${socket.data.odername}`);
    }

    // Send personalized state to each OTHER player (so hole cards are correct)
    if (activeRoom) {
      activeRoom.players.forEach((p, oderId) => {
        // Skip the player who just sat - we already sent them their state above
        if (oderId === socket.data.oderId) return;

        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          } else {
            fastify.log.warn(`Could not find socket for player ${oderId} when sending game:state after sit`);
          }
        }
      });
      // Send to spectators too
      activeRoom.spectators.forEach((oderId) => {
        const spectatorState = roomManager.getGameState(roomId);
        if (spectatorState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', spectatorState);
          }
        }
      });
    }

    fastify.log.info(`${socket.data.odername} sat at seat ${seat}`);
  });

  // Stand from table
  socket.on('room:stand', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    roomManager.leaveRoom(roomId, socket.data.oderId);
    io.to(roomId).emit('room:player-left', socket.data.oderId);

    // Send personalized state to each remaining player
    const activeRoom = roomManager.getRoom(roomId);
    if (activeRoom) {
      activeRoom.players.forEach((p, oderId) => {
        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          }
        }
      });
    }
  });

  // Sit out / return to play
  socket.on('room:sit-out', (sittingOut: boolean) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const newStatus = sittingOut ? 'sitting-out' : 'active';
    const currentState = roomManager.getGameState(roomId);

    // If player is coming back during an active hand, mark them as folded
    // so they don't join mid-hand (they'll be included in the next hand)
    const isHandActive = currentState?.phase &&
      currentState.phase !== 'waiting' &&
      currentState.phase !== 'complete';

    if (!sittingOut && isHandActive) {
      // Coming back during active hand - set status to active but mark as folded
      roomManager.updatePlayer(roomId, socket.data.oderId, { status: newStatus, isFolded: true });
      fastify.log.info(`${socket.data.odername} will join next hand (marked folded for current hand)`);
    } else {
      roomManager.updatePlayer(roomId, socket.data.oderId, { status: newStatus });
    }

    // Send updated state to all players
    const activeRoom = roomManager.getRoom(roomId);
    if (activeRoom) {
      activeRoom.players.forEach((p, oderId) => {
        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          }
        }
      });

      // If player came back (not sitting out), check if we can auto-start
      if (!sittingOut) {
        const currentState = roomManager.getGameState(roomId);
        const playersWithChips = Array.from(activeRoom.players.values()).filter(p => p.status === 'active' && p.chips > 0);

        if (playersWithChips.length >= 2 && (currentState?.phase === 'waiting' || currentState?.phase === 'complete')) {
          // Auto-start the next hand after a short delay
          setTimeout(() => {
            const room = roomManager.getRoom(roomId);
            if (!room) return;

            // Re-check conditions
            const activePlayers = Array.from(room.players.values()).filter(p => p.status === 'active' && p.chips > 0);
            if (activePlayers.length < 2) return;

            const result = startNextHand(roomManager, roomId, fastify);
            if (result?.state) {
              const { state } = result;
              // Send personalized state to each player
              room.players.forEach((player, oderId) => {
                const personalState = roomManager.getGameState(roomId, oderId);
                if (personalState) {
                  const socketId = getSocketId(io, oderId);
                  if (socketId) {
                    io.to(socketId).emit('game:state', personalState);
                  }
                }
              });

              // Start turn timer for first player
              if (room.room.customRules.turnTimeEnabled) {
                const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
                if (currentPlayer) {
                  startTurnTimer(
                    io,
                    roomManager,
                    roomId,
                    currentPlayer.oderId,
                    room.room.customRules.turnTimeSeconds,
                    room.room.customRules.warningTimeSeconds,
                    fastify
                  );
                }
              }

              fastify.log.info(`Auto-started new hand after player returned in room ${room.room.code}`);
            }
          }, 1000); // 1 second delay before auto-starting
        }
      }
    }

    fastify.log.info(`${socket.data.odername} ${sittingOut ? 'sitting out' : 'back in play'}`);
  });

  // Rebuy - add chips when player has 0
  socket.on('room:rebuy', (amount: number) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    const player = activeRoom.players.get(socket.data.oderId);
    if (!player) {
      socket.emit('error', { code: 'NOT_SEATED', message: 'You are not seated at this table' });
      return;
    }

    // Validate rebuy amount
    const { minBuyIn, maxBuyIn } = activeRoom.room.stakes;
    if (amount < minBuyIn || amount > maxBuyIn) {
      socket.emit('error', { code: 'INVALID_AMOUNT', message: `Rebuy amount must be between ${minBuyIn} and ${maxBuyIn}` });
      return;
    }

    // Only allow rebuy if player has 0 chips
    if (player.chips > 0) {
      socket.emit('error', { code: 'HAS_CHIPS', message: 'You can only rebuy when you have 0 chips' });
      return;
    }

    // Update player chips
    player.chips = amount;
    player.status = 'active';
    roomManager.updatePlayer(roomId, socket.data.oderId, { chips: amount, status: 'active' });

    fastify.log.info(`${socket.data.odername} rebought for ${amount} chips`);

    // Notify all players of the rebuy
    io.to(roomId).emit('room:player-rebuy', { playerId: socket.data.oderId, amount });

    // Send updated state to all players
    broadcastGameState(io, roomManager, roomId);

    // Check if waitForAllRebuys is enabled and there's an active rebuy prompt
    const rebuyPrompt = roomManager.getRebuyPrompt(roomId);
    if (activeRoom.room.customRules.waitForAllRebuys && rebuyPrompt) {
      // Record the rebuy decision
      roomManager.recordRebuyDecision(roomId, socket.data.oderId, 'rebuy', amount);

      // Broadcast updated prompt
      const updatedPrompt = roomManager.getRebuyPrompt(roomId);
      io.to(roomId).emit('room:rebuy-prompt', updatedPrompt);

      // Check if all decisions have been made
      if (roomManager.allRebuyDecisionsMade(roomId)) {
        finishRebuyPromptPhase(io, roomManager, roomId, fastify);
      }
      return;
    }

    // Original behavior: Check if we can now start a new hand (2+ players with chips)
    // This triggers when phase is 'waiting' OR 'complete' (after a hand just ended)
    const playersWithChips = Array.from(activeRoom.players.values()).filter(p => p.status === 'active' && p.chips > 0);
    const currentState = roomManager.getGameState(roomId);
    const canStartHand = currentState?.phase === 'waiting' || currentState?.phase === 'complete';

    if (playersWithChips.length >= 2 && canStartHand) {
      // Auto-start the next hand after a short delay
      setTimeout(() => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Re-check conditions (phase might have changed)
        const recheckState = roomManager.getGameState(roomId);
        if (recheckState?.phase !== 'waiting' && recheckState?.phase !== 'complete') {
          // Hand already started by another trigger
          return;
        }

        // Don't auto-start if waitForAllRebuys is enabled and there's an active prompt
        if (room.room.customRules.waitForAllRebuys && roomManager.getRebuyPrompt(roomId)) {
          return;
        }

        const activePlayers = Array.from(room.players.values()).filter(p => p.status === 'active' && p.chips > 0);
        if (activePlayers.length < 2) return;

        const result = startNextHand(roomManager, roomId, fastify);
        if (result?.state) {
          const { state } = result;
          broadcastGameState(io, roomManager, roomId);

          // Check for straddle phase
          if (!result.isBombPot && room.room.customRules.straddleEnabled) {
            handleStraddlePhase(io, roomManager, roomId, fastify);
          } else {
            // Start turn timer for first player
            if (room.room.customRules.turnTimeEnabled) {
              const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
              if (currentPlayer) {
                startTurnTimer(
                  io,
                  roomManager,
                  roomId,
                  currentPlayer.oderId,
                  room.room.customRules.turnTimeSeconds,
                  room.room.customRules.warningTimeSeconds,
                  fastify
                );
              }
            }
          }

          fastify.log.info(`Auto-started new hand after rebuy in room ${room.room.code}`);
        }
      }, 1000); // 1 second delay before auto-starting
    }
  });

  // Decline rebuy - sit out instead of rebuying
  socket.on('room:decline-rebuy', () => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    const player = activeRoom.players.get(socket.data.oderId);
    if (!player) {
      socket.emit('error', { code: 'NOT_SEATED', message: 'You are not seated at this table' });
      return;
    }

    // Only allow decline if in rebuy prompt phase
    const rebuyPrompt = roomManager.getRebuyPrompt(roomId);
    if (!rebuyPrompt) {
      socket.emit('error', { code: 'NO_REBUY_PROMPT', message: 'No rebuy prompt active' });
      return;
    }

    // Check if player is part of the rebuy prompt
    if (!rebuyPrompt.playerIds.includes(socket.data.oderId)) {
      socket.emit('error', { code: 'NOT_IN_PROMPT', message: 'You are not part of this rebuy prompt' });
      return;
    }

    // Record the decline decision
    roomManager.recordRebuyDecision(roomId, socket.data.oderId, 'decline');

    // Set player to sitting-out
    player.status = 'sitting-out';
    roomManager.updatePlayer(roomId, socket.data.oderId, { status: 'sitting-out' });

    fastify.log.info(`${socket.data.odername} declined rebuy (sitting out)`);

    // Broadcast updated prompt
    const updatedPrompt = roomManager.getRebuyPrompt(roomId);
    io.to(roomId).emit('room:rebuy-prompt', updatedPrompt);

    // Send updated state
    broadcastGameState(io, roomManager, roomId);

    // Check if all decisions have been made
    if (roomManager.allRebuyDecisionsMade(roomId)) {
      finishRebuyPromptPhase(io, roomManager, roomId, fastify);
    }
  });

  // Leave room
  socket.on('room:leave', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    socket.leave(roomId);
    roomManager.leaveRoom(roomId, socket.data.oderId);
    io.to(roomId).emit('room:player-left', socket.data.oderId);
    socket.data.roomId = undefined;

    fastify.log.info(`${socket.data.odername} left room`);
  });

  // Chat
  socket.on('room:chat', (message) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    io.to(roomId).emit('room:chat', {
      id: generateId(),
      oderId: socket.data.oderId,
      odername: socket.data.odername,
      message,
      timestamp: Date.now(),
    });
  });

  // Update rules
  socket.on('room:update-rules', (rules) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom || activeRoom.room.hostId !== socket.data.oderId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only host can update rules' });
      return;
    }

    roomManager.updateRules(roomId, rules);
    io.to(roomId).emit('room:rules-updated', activeRoom.room.customRules);
  });

  // Switch variant
  socket.on('room:switch-variant', (variant: GameVariant) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const success = roomManager.switchVariant(roomId, variant);
    if (success) {
      io.to(roomId).emit('game:variant-changed', variant);
    } else {
      socket.emit('error', { code: 'SWITCH_FAILED', message: 'Cannot switch variant now' });
    }
  });

  // Update room settings (host only)
  socket.on('room:update-settings', (settings) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const updatedRoom = roomManager.updateSettings(roomId, socket.data.oderId, settings);
    if (!updatedRoom) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only host can update settings' });
      return;
    }

    // Broadcast updated room to all players
    io.to(roomId).emit('room:settings-updated', { room: updatedRoom });
    fastify.log.info(`Room ${updatedRoom.code} settings updated by host`);
  });
}

// =============================================================================
// GAME EVENTS
// =============================================================================

function handleGameEvents(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager,
  fastify: FastifyInstance
): void {
  // Player action
  socket.on('game:action', (action: PlayerAction) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: 'Not in a room' });
      return;
    }

    const result = roomManager.processAction(roomId, socket.data.oderId, action);

    if (!result.success) {
      socket.emit('error', { code: 'INVALID_ACTION', message: result.error || 'Invalid action' });
      return;
    }

    // Clear the turn timer since player acted
    clearTurnTimer(roomId);

    // Broadcast action
    io.to(roomId).emit('game:action', { ...action, playerId: socket.data.oderId });

    // Broadcast updated state
    if (result.state) {
      // CRITICAL: Send game state directly to the socket that took the action first
      const actingPlayerState = roomManager.getGameState(roomId, socket.data.oderId);
      if (actingPlayerState) {
        socket.emit('game:state', actingPlayerState);
      }

      // Send personalized state to each OTHER player
      const activeRoom = roomManager.getRoom(roomId);
      activeRoom?.players.forEach((player, oderId) => {
        // Skip the acting player - we already sent them their state above
        if (oderId === socket.data.oderId) return;

        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          } else {
            fastify.log.warn(`Could not find socket for player ${oderId} during game:action`);
          }
        }
      });
      // Send to spectators (no hole cards)
      activeRoom?.spectators.forEach((oderId) => {
        const spectatorState = roomManager.getGameState(roomId);
        if (spectatorState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', spectatorState);
          }
        }
      });

      // Check if run-it should be prompted
      if (roomManager.shouldPromptRunIt(roomId)) {
        const prompt = roomManager.startRunItPrompt(roomId);
        if (prompt) {
          fastify.log.info(`Starting run-it prompt in room ${activeRoom?.room.code}`);
          io.to(roomId).emit('game:run-it-prompt', prompt);

          // Start the run-it timer (5 seconds)
          startRunItTimer(io, roomManager, roomId, 5, fastify);

          // Re-broadcast state with the prompt
          broadcastGameState(io, roomManager, roomId);
          return; // Don't check winners yet - wait for run-it to complete
        }
      }

      // Start timer for next player if game is still active
      const updatedState = roomManager.getGameState(roomId);
      if (updatedState && updatedState.phase !== 'waiting' && updatedState.phase !== 'showdown' && updatedState.phase !== 'complete') {
        const currentPlayer = updatedState.players.find(p => p.seat === updatedState.currentPlayerSeat);
        if (currentPlayer && activeRoom?.room.customRules.turnTimeEnabled) {
          startTurnTimer(
            io,
            roomManager,
            roomId,
            currentPlayer.oderId,
            activeRoom.room.customRules.turnTimeSeconds,
            activeRoom.room.customRules.warningTimeSeconds,
            fastify
          );
        }
      }
    }

    // Handle winners
    if (result.winners) {
      // Clear timer since hand is over
      clearTurnTimer(roomId);

      // Check if this was a runout (all-in with remaining cards)
      const currentState = roomManager.getGameState(roomId);
      const isRunout = currentState?.isRunout;
      const winnerDelay = isRunout ? calculateRunoutDelay(currentState?.runoutStartPhase) : 0;

      // Emit winner with delay if runout (to let card animations play)
      if (winnerDelay > 0) {
        setTimeout(() => {
          io.to(roomId).emit('game:winner', result.winners!);
          // Emit 7-2 bonus if applicable
          if (currentState?.sevenDeuceBonus) {
            io.to(roomId).emit('game:seven-deuce-bonus', currentState.sevenDeuceBonus);
          }
        }, winnerDelay);
      } else {
        io.to(roomId).emit('game:winner', result.winners);
        // Emit 7-2 bonus if applicable
        if (currentState?.sevenDeuceBonus) {
          io.to(roomId).emit('game:seven-deuce-bonus', currentState.sevenDeuceBonus);
        }
      }

      // Auto-start next hand after a delay (add runout animation time if applicable)
      const activeRoom = roomManager.getRoom(roomId);
      if (activeRoom) {
        const nextHandDelay = 5000 + winnerDelay; // Base 5s + runout animation time
        setTimeout(() => {
          // Verify room still exists
          const room = roomManager.getRoom(roomId);
          if (!room) return;

          // Check if waitForAllRebuys is enabled and there are busted players
          if (room.room.customRules.waitForAllRebuys) {
            const bustedPlayers = Array.from(room.players.values())
              .filter(p => p.chips === 0 && p.status !== 'disconnected' && p.status !== 'sitting-out');

            if (bustedPlayers.length > 0) {
              // Start the rebuy prompt phase instead of starting the next hand
              startRebuyPromptPhase(io, roomManager, roomId, fastify);
              return;
            }
          }

          const activePlayers = Array.from(room.players.values()).filter(p => p.status === 'active' && p.chips > 0);
          if (activePlayers.length < 2) {
            // Not enough players to continue - clear winners and send updated state
            io.to(roomId).emit('game:winner', []);
            broadcastGameState(io, roomManager, roomId);
            fastify.log.info(`Waiting for rebuy - only ${activePlayers.length} player(s) with chips in room ${room.room.code}`);
            return;
          }

          // Start next hand (with bomb pot check)
          const result = startNextHand(roomManager, roomId, fastify);
          if (result?.state) {
            const { state } = result;
            broadcastGameState(io, roomManager, roomId);

            // Check for straddle phase (only for non-bomb-pot hands)
            if (!result.isBombPot && room.room.customRules.straddleEnabled) {
              // Start straddle phase - will handle turn timer after straddles complete
              handleStraddlePhase(io, roomManager, roomId, fastify);
            } else {
              // Start turn timer for first player of new hand (no straddles)
              if (room.room.customRules.turnTimeEnabled) {
                const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
                if (currentPlayer) {
                  startTurnTimer(
                    io,
                    roomManager,
                    roomId,
                    currentPlayer.oderId,
                    room.room.customRules.turnTimeSeconds,
                    room.room.customRules.warningTimeSeconds,
                    fastify
                  );
                }
              }
            }
          }
        }, nextHandDelay); // Base 5s delay + runout animation time
      }
    }
  });

  // Start game (host only)
  socket.on('game:start', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    if (activeRoom.room.hostId !== socket.data.oderId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only host can start the game' });
      return;
    }

    // Check minimum players
    const activePlayers = Array.from(activeRoom.players.values()).filter(p => p.status === 'active');
    if (activePlayers.length < 2) {
      socket.emit('error', { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players to start' });
      return;
    }

    const result = startNextHand(roomManager, roomId, fastify);
    if (result?.state) {
      const { state } = result;
      // CRITICAL: Send game state directly to the host who started the game first
      const hostState = roomManager.getGameState(roomId, socket.data.oderId);
      if (hostState) {
        socket.emit('game:state', hostState);
        fastify.log.info(`Sent game:state directly to host ${socket.data.odername}`);
      }

      // Send personalized state to each OTHER player (hides other players' hole cards)
      activeRoom.players.forEach((player, oderId) => {
        // Skip the host - we already sent them their state above
        if (oderId === socket.data.oderId) return;

        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          fastify.log.info(`Sending game state to ${oderId}, socketId: ${socketId}, holeCards: ${personalState.players.find(p => p.oderId === oderId)?.holeCards?.length || 0}`);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          } else {
            fastify.log.warn(`Could not find socket for player ${oderId} during game:start`);
          }
        }
      });
      // Also send to spectators
      activeRoom.spectators.forEach((oderId) => {
        const spectatorState = roomManager.getGameState(roomId);
        if (spectatorState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', spectatorState);
          }
        }
      });

      // Check for straddle phase (only for non-bomb-pot hands)
      if (!result.isBombPot && activeRoom.room.customRules.straddleEnabled) {
        // Start straddle phase - will handle turn timer after straddles complete
        handleStraddlePhase(io, roomManager, roomId, fastify);
      } else {
        // Start turn timer for first player (no straddles)
        if (activeRoom.room.customRules.turnTimeEnabled) {
          const currentPlayer = state.players.find(p => p.seat === state.currentPlayerSeat);
          if (currentPlayer) {
            startTurnTimer(
              io,
              roomManager,
              roomId,
              currentPlayer.oderId,
              activeRoom.room.customRules.turnTimeSeconds,
              activeRoom.room.customRules.warningTimeSeconds,
              fastify
            );
          }
        }
      }

      fastify.log.info(`Game started in room ${activeRoom.room.code}`);
    }
  });

  // Start bomb pot hand (special hand type: forced ante from all, skip preflop betting, flop dealt immediately)
  socket.on('game:start-bomb-pot', (amount) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom || activeRoom.room.hostId !== socket.data.oderId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only host can start bomb pot' });
      return;
    }

    // TODO: Implement proper bomb pot logic:
    // 1. Force ante from all seated players
    // 2. Deal hole cards
    // 3. Skip preflop betting entirely
    // 4. Deal flop immediately
    // 5. Start betting from first position
    const state = roomManager.startHand(roomId, amount);
    if (state) {
      // Send personalized state to each player
      activeRoom.players.forEach((player, oderId) => {
        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          }
        }
      });
      // Send to spectators (no hole cards)
      activeRoom.spectators.forEach((oderId) => {
        const spectatorState = roomManager.getGameState(roomId);
        if (spectatorState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', spectatorState);
          }
        }
      });
    }
  });

  // Dealer's choice
  socket.on('game:choose-variant', (variant: GameVariant) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) return;

    // Verify it's the dealer making the choice
    const state = roomManager.getGameState(roomId);
    if (!state) return;

    const dealer = activeRoom.players.get(socket.data.oderId);
    if (!dealer || dealer.seat !== state.dealerSeat) {
      socket.emit('error', { code: 'NOT_DEALER', message: 'Only dealer can choose' });
      return;
    }

    const success = roomManager.switchVariant(roomId, variant);
    if (success) {
      io.to(roomId).emit('game:variant-changed', variant);
    }
  });

  // Straddle response
  socket.on('game:straddle', (accepted: boolean) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) return;

    const result = roomManager.processStraddle(roomId, socket.data.oderId, accepted);
    if (!result) {
      socket.emit('error', { code: 'STRADDLE_FAILED', message: 'Failed to process straddle' });
      return;
    }

    // Clear straddle timer
    clearStraddleTimer(roomId);

    if (accepted) {
      // Broadcast that straddle was placed
      io.to(roomId).emit('game:straddle-placed', {
        playerId: socket.data.oderId,
        amount: result.straddleAmount || 0,
        seat: activeRoom.players.get(socket.data.oderId)?.seat || 0,
      });
    } else {
      // Broadcast that straddle was declined
      io.to(roomId).emit('game:straddle-declined', {
        seat: activeRoom.players.get(socket.data.oderId)?.seat || 0,
      });
    }

    // Send updated state to all players
    broadcastGameState(io, roomManager, roomId);

    // Check if there's another straddle prompt
    if (result.next) {
      // Process the next in chain (handles auto-straddle logic)
      processStraddleChainNext(io, roomManager, roomId, result.next, fastify);
    } else {
      // Straddle phase complete
      roomManager.endStraddlePhase(roomId);
      finishStraddlePhase(io, roomManager, roomId, fastify);
    }

    fastify.log.info(`Straddle ${accepted ? 'accepted' : 'declined'} by ${socket.data.odername}`);
  });

  // Show hand voluntarily (after winning by fold)
  socket.on('game:show-hand', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) return;

    // Get the player's hole cards
    const cards = roomManager.getPlayerHoleCards(roomId, socket.data.oderId);
    if (!cards) {
      socket.emit('error', { code: 'NO_CARDS', message: 'No cards to show' });
      return;
    }

    // Broadcast the shown hand to all players
    io.to(roomId).emit('game:hand-shown', {
      playerId: socket.data.oderId,
      cards,
    });

    fastify.log.info(`${socket.data.odername} showed their hand in room ${activeRoom.room.code}`);
  });

  // Run-it select (player selects an option but hasn't confirmed yet)
  socket.on('game:run-it-select', (choice: 1 | 2 | 3) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) return;

    // Process the choice
    const success = roomManager.processRunItChoice(roomId, socket.data.oderId, choice);
    if (!success) {
      socket.emit('error', { code: 'INVALID_CHOICE', message: 'Cannot make this choice' });
      return;
    }

    // Broadcast the decision to all players
    const prompt = roomManager.getRunItPrompt(roomId);
    if (prompt) {
      io.to(roomId).emit('game:run-it-decision', {
        playerId: socket.data.oderId,
        choice,
        confirmed: false,
      });
      // Also broadcast updated prompt
      io.to(roomId).emit('game:run-it-prompt', prompt);
    }

    fastify.log.info(`${socket.data.odername} selected run-it ${choice} time(s)`);
  });

  // Run-it confirm (player locks in their choice)
  socket.on('game:run-it-confirm', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom) return;

    // Confirm the choice
    const success = roomManager.confirmRunItChoice(roomId, socket.data.oderId);
    if (!success) {
      socket.emit('error', { code: 'CANNOT_CONFIRM', message: 'Cannot confirm - select a choice first' });
      return;
    }

    // Get the confirmed choice
    const prompt = roomManager.getRunItPrompt(roomId);
    const playerChoice = prompt?.choices.find(c => c.playerId === socket.data.oderId);

    // Broadcast the confirmation to all players
    if (prompt && playerChoice) {
      io.to(roomId).emit('game:run-it-decision', {
        playerId: socket.data.oderId,
        choice: playerChoice.choice!,
        confirmed: true,
      });
      // Also broadcast updated prompt
      io.to(roomId).emit('game:run-it-prompt', prompt);
    }

    fastify.log.info(`${socket.data.odername} confirmed run-it choice`);

    // Check if all confirmed and same choice - end early
    if (roomManager.allConfirmedChoicesSame(roomId)) {
      clearRunItTimer(roomId);
      finalizeRunIt(io, roomManager, roomId, fastify);
    }
  });
}

// =============================================================================
// DISCONNECT HANDLING
// =============================================================================

function handleDisconnect(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager,
  fastify: FastifyInstance
): void {
  socket.on('disconnect', (reason) => {
    fastify.log.info(`Socket disconnected: ${socket.id} (${reason}) oderId: ${socket.data.oderId}`);

    // Note: We don't remove from socketIdByOderId immediately because the user might reconnect
    // The getSocketId function will clean up stale mappings and update with new socket IDs

    const roomId = socket.data.roomId;
    if (!roomId) return;

    // Mark player as disconnected (don't remove immediately for reconnection)
    roomManager.updatePlayer(roomId, socket.data.oderId, { status: 'disconnected' });

    // Handle disconnect during rebuy prompt
    const rebuyPrompt = roomManager.getRebuyPrompt(roomId);
    if (rebuyPrompt && rebuyPrompt.playerIds.includes(socket.data.oderId)) {
      // Auto-decline the disconnected player
      roomManager.recordRebuyDecision(roomId, socket.data.oderId, 'decline');
      fastify.log.info(`Auto-declined rebuy for disconnected player ${socket.data.oderId}`);

      // Broadcast updated prompt
      const updatedPrompt = roomManager.getRebuyPrompt(roomId);
      io.to(roomId).emit('room:rebuy-prompt', updatedPrompt);

      // Check if all decisions have been made
      if (roomManager.allRebuyDecisionsMade(roomId)) {
        finishRebuyPromptPhase(io, roomManager, roomId, fastify);
      }
    }

    // Send personalized state to each remaining player (preserves their hole cards)
    const activeRoom = roomManager.getRoom(roomId);
    if (activeRoom) {
      activeRoom.players.forEach((player, oderId) => {
        const personalState = roomManager.getGameState(roomId, oderId);
        if (personalState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', personalState);
          }
        }
      });
      // Send to spectators (no hole cards)
      activeRoom.spectators.forEach((oderId) => {
        const spectatorState = roomManager.getGameState(roomId);
        if (spectatorState) {
          const socketId = getSocketId(io, oderId);
          if (socketId) {
            io.to(socketId).emit('game:state', spectatorState);
          }
        }
      });
    }

    // Set timeout to remove player if they don't reconnect
    setTimeout(() => {
      const currentRoom = roomManager.getPlayerRoom(socket.data.oderId);
      if (currentRoom === roomId) {
        roomManager.leaveRoom(roomId, socket.data.oderId);
        io.to(roomId).emit('room:player-left', socket.data.oderId);
      }
    }, 60000); // 1 minute timeout
  });
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Calculate delay for winner announcement during runout
 * Based on dramatic timing: 2s pause before turn, 3s pause before river,
 * 2.5s slow river animation, plus 1s pause before winner
 */
function calculateRunoutDelay(runoutStartPhase: string | undefined): number {
  if (!runoutStartPhase) return 0;

  // Timing matches client-side animation:
  // - Flop: ~0.5s
  // - 2s pause before turn
  // - 3s pause before river
  // - 2.5s river animation
  // - 1s pause before winner announcement

  if (runoutStartPhase === 'preflop') {
    // Full runout: flop(0.5s) + pause(2s) + pause(3s) + river anim(2.5s) + pause(1s)
    return 9000;
  } else if (runoutStartPhase === 'flop') {
    // Turn + river: pause(2s) + pause(3s) + river anim(2.5s) + pause(1s)
    return 8500;
  } else if (runoutStartPhase === 'turn') {
    // Just river: pause(3s) + river anim(2.5s) + pause(1s)
    return 6500;
  }

  return 0;
}

function getSocketId(io: TypedIO, oderId: string): string | null {
  // First, check our tracking map (faster and more reliable)
  const trackedSocketId = socketIdByOderId.get(oderId);
  if (trackedSocketId) {
    // Verify the socket still exists
    const socket = io.sockets.sockets.get(trackedSocketId);
    if (socket && socket.connected) {
      return trackedSocketId;
    }
    // Socket no longer exists, clean up the stale mapping
    socketIdByOderId.delete(oderId);
  }

  // Fallback: Find socket by oderId by iterating all sockets
  for (const [id, socket] of io.sockets.sockets) {
    if ((socket as TypedSocket).data.oderId === oderId) {
      // Update our tracking map for future lookups
      socketIdByOderId.set(oderId, id);
      return id;
    }
  }

  console.warn(`[Socket] Could not find socket for oderId: ${oderId}. Active sockets: ${io.sockets.sockets.size}, Tracked mappings: ${socketIdByOderId.size}`);
  return null;
}
