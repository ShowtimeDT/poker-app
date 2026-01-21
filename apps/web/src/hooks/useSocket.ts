'use client';

import { useEffect, useCallback } from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useGameStore } from '@/stores/gameStore';
import type { PlayerAction, GameVariant } from '@poker/shared';

// =============================================================================
// SOCKET HOOK
// =============================================================================

export function useSocket() {
  const {
    token,
    setConnection,
    setRoom,
    updateRoom,
    setUser,
    setGameState,
    updatePlayer,
    updatePlayerPreference,
    removePlayer,
    addChatMessage,
    setWinners,
    setTurnTimer,
    setTurnTimerWarning,
    clearTurnTimer,
    setShownHand,
    setSevenDeuceBonus,
    setRunItPrompt,
    setRunItResult,
    clearRunItResult,
    setError,
  } = useGameStore();

  // Initialize socket and listeners
  useEffect(() => {
    const socket = getSocket(token || undefined);

    // Connection events
    socket.on('connect', () => {
      setConnection(true);
    });

    socket.on('disconnect', () => {
      setConnection(false);
    });

    socket.on('connect_error', (err) => {
      setConnection(false, err.message);
    });

    // Game events
    socket.on('game:state', (state) => {
      console.log('[Socket] game:state received, phase:', state.phase, 'players with cards:', state.players.filter((p: any) => p.holeCards?.length > 0).length);
      setGameState(state);
    });

    socket.on('game:action', (action) => {
      // Action is already reflected in game:state
      console.log('Action:', action);
    });

    socket.on('game:winner', (winners) => {
      setWinners(winners);
      clearTurnTimer(); // Clear timer when hand ends
    });

    // Timer events
    socket.on('game:timer', (data: { timeRemaining: number; playerId: string }) => {
      setTurnTimer(data.timeRemaining, data.playerId);
    });

    socket.on('game:timer-warning', (data: { playerId: string; extraTime: number }) => {
      setTurnTimerWarning(data.playerId);
    });

    socket.on('game:auto-fold', (data: { playerId: string }) => {
      console.log('[Socket] Player auto-folded:', data.playerId);
      clearTurnTimer();
    });

    socket.on('game:hand-shown', (data: { playerId: string; cards: any[] }) => {
      console.log('[Socket] Player showed hand:', data.playerId, data.cards);
      setShownHand(data.playerId, data.cards);
    });

    // 7-2 bonus event
    socket.on('game:seven-deuce-bonus', (bonus: any) => {
      console.log('[Socket] 7-2 bonus:', bonus);
      setSevenDeuceBonus(bonus);
    });

    // Run-it events
    socket.on('game:run-it-prompt', (prompt: any) => {
      console.log('[Socket] Run-it prompt received:', prompt);
      // Update the runItPrompt in gameState - this is important for real-time updates
      // when players select/confirm choices
      setRunItPrompt(prompt);
    });

    socket.on('game:run-it-decision', (data: any) => {
      console.log('[Socket] Run-it decision:', data);
      // Player made a choice - the updated prompt will come via game:run-it-prompt
    });

    socket.on('game:run-it-result', (data: { boards: any[]; finalChoice: 1 | 2 | 3 }) => {
      console.log('[Socket] Run-it result:', data);
      // Store boards for animation display (winners will come later via game:state)
      setRunItResult(data.boards, data.finalChoice);
    });

    // Room events
    socket.on('room:joined', (data: { room: any; userId: string; username: string }) => {
      setRoom(data.room);
      setUser(data.userId, data.username, token || '');
      console.log('[Socket] Joined room:', data.room.code, 'as', data.username);
    });

    socket.on('room:player-joined', (player) => {
      updatePlayer(player);
    });

    socket.on('room:player-left', (playerId) => {
      removePlayer(playerId);
    });

    socket.on('room:chat', (message) => {
      addChatMessage(message);
    });

    // Bomb pot preference changes
    socket.on('player:bomb-pot-preference-changed', (data: { playerId: string; enabled: boolean }) => {
      console.log('[Socket] Bomb pot preference changed:', data.playerId, data.enabled);
      // Update player's bomb pot preference without affecting other player data
      updatePlayerPreference(data.playerId, { bombPotWhenDealer: data.enabled });
    });

    // Straddle preference changes
    socket.on('player:straddle-preference-changed', (data: { playerId: string; enabled: boolean }) => {
      console.log('[Socket] Straddle preference changed:', data.playerId, data.enabled);
      // Update player's straddle preference without affecting other player data
      updatePlayerPreference(data.playerId, { straddleNextHand: data.enabled });
    });

    // Room settings updated (by host)
    socket.on('room:settings-updated', (data: { room: any }) => {
      console.log('[Socket] Room settings updated:', data.room);
      updateRoom(data.room);
    });

    // Error handling
    socket.on('error', (error) => {
      setError(error.message);
    });

    // Cleanup
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('game:state');
      socket.off('game:action');
      socket.off('game:winner');
      socket.off('game:timer');
      socket.off('game:timer-warning');
      socket.off('game:auto-fold');
      socket.off('game:hand-shown');
      socket.off('game:seven-deuce-bonus');
      socket.off('game:run-it-prompt');
      socket.off('game:run-it-decision');
      socket.off('game:run-it-result');
      socket.off('room:joined');
      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:chat');
      socket.off('player:bomb-pot-preference-changed');
      socket.off('player:straddle-preference-changed');
      socket.off('room:settings-updated');
      socket.off('error');
    };
  }, [token, setConnection, setRoom, updateRoom, setUser, setGameState, updatePlayer, updatePlayerPreference, removePlayer, addChatMessage, setWinners, setTurnTimer, setTurnTimerWarning, clearTurnTimer, setShownHand, setSevenDeuceBonus, setRunItPrompt, setRunItResult, clearRunItResult, setError]);

  // Note: We intentionally do NOT disconnect the socket on component unmount.
  // The socket singleton should persist across component re-renders and React
  // Strict Mode double-mounting to maintain the server-side room association.
  // The socket will only disconnect when the user explicitly leaves or the
  // browser tab is closed.
}

// =============================================================================
// GAME ACTIONS HOOK
// =============================================================================

export function useGameActions() {
  const token = useGameStore((state) => state.token);

  const joinRoom = useCallback((roomCode: string, password?: string) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:join', roomCode, password);
  }, [token]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket(token || undefined);
    socket.emit('room:leave');
  }, [token]);

  const sitDown = useCallback((seat: number, buyIn: number) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:sit', seat, buyIn);
  }, [token]);

  const standUp = useCallback(() => {
    const socket = getSocket(token || undefined);
    socket.emit('room:stand');
  }, [token]);

  const sitOut = useCallback((sittingOut: boolean) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:sit-out', sittingOut);
  }, [token]);

  const sendAction = useCallback((action: PlayerAction) => {
    const socket = getSocket(token || undefined);
    socket.emit('game:action', action);
  }, [token]);

  const sendChat = useCallback((message: string) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:chat', message);
  }, [token]);

  const chooseVariant = useCallback((variant: GameVariant) => {
    const socket = getSocket(token || undefined);
    socket.emit('game:choose-variant', variant);
  }, [token]);

  const startGame = useCallback(() => {
    const socket = getSocket(token || undefined);
    socket.emit('game:start');
  }, [token]);

  const startBombPot = useCallback((amount?: number) => {
    const socket = getSocket(token || undefined);
    socket.emit('game:start-bomb-pot', amount);
  }, [token]);

  const showHand = useCallback(() => {
    const socket = getSocket(token || undefined);
    socket.emit('game:show-hand');
  }, [token]);

  const rebuy = useCallback((amount: number) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:rebuy', amount);
  }, [token]);

  const setBombPotPreference = useCallback((enabled: boolean) => {
    const socket = getSocket(token || undefined);
    socket.emit('player:set-bomb-pot-preference', enabled);
  }, [token]);

  const setStraddlePreference = useCallback((enabled: boolean) => {
    const socket = getSocket(token || undefined);
    socket.emit('player:set-straddle-preference', enabled);
  }, [token]);

  const updateRoomSettings = useCallback((settings: {
    stakes?: { smallBlind?: number; bigBlind?: number; minBuyIn?: number; maxBuyIn?: number };
    maxPlayers?: number;
    customRules?: Record<string, any>;
  }) => {
    const socket = getSocket(token || undefined);
    socket.emit('room:update-settings', settings);
  }, [token]);

  const sendStraddle = useCallback((accepted: boolean) => {
    const socket = getSocket(token || undefined);
    socket.emit('game:straddle', accepted);
  }, [token]);

  const sendRunItSelect = useCallback((choice: 1 | 2 | 3) => {
    console.log('[Socket] Sending run-it-select:', choice);
    const socket = getSocket(token || undefined);
    socket.emit('game:run-it-select', choice);
  }, [token]);

  const sendRunItConfirm = useCallback(() => {
    const socket = getSocket(token || undefined);
    socket.emit('game:run-it-confirm');
  }, [token]);

  return {
    joinRoom,
    leaveRoom,
    sitDown,
    standUp,
    sitOut,
    sendAction,
    sendChat,
    chooseVariant,
    startGame,
    startBombPot,
    showHand,
    rebuy,
    setBombPotPreference,
    setStraddlePreference,
    updateRoomSettings,
    sendStraddle,
    sendRunItSelect,
    sendRunItConfirm,
  };
}
