'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PokerTable } from '@/components/game/PokerTable';
import { ActionButtons, PreTurnActions } from '@/components/game/ActionButtons';
import { RebuyModal } from '@/components/game/RebuyModal';
import { ShowMuckButtons } from '@/components/game/ShowMuckButtons';
import { HostSettingsModal, RoomSettingsUpdate } from '@/components/game/HostSettingsModal';
import { SevenDeuceCelebration } from '@/components/game/SevenDeuceCelebration';
import { StraddlePrompt } from '@/components/game/StraddlePrompt';
import { RunItPrompt } from '@/components/game/RunItPrompt';
import { RunItBoards } from '@/components/game/RunItBoards';
import { useSocket, useGameActions } from '@/hooks/useSocket';
import { useGameStore, selectIsMyTurn, selectCurrentPlayer } from '@/stores/gameStore';
import { cn } from '@/lib/utils';
import { CopyIcon, SettingsIcon, LogOutIcon, MessageIcon } from '@/components/ui/Icons';
import type { ActionType } from '@poker/shared';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;

  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [rebuyDismissed, setRebuyDismissed] = useState(false);
  const [rebuyReady, setRebuyReady] = useState(false);
  const [showMuckDismissed, setShowMuckDismissed] = useState(false);
  const [preTurnAction, setPreTurnAction] = useState<'check-fold' | 'fold' | 'call' | 'call-any' | null>(null);

  // Initialize socket connection
  useSocket();

  const {
    room,
    gameState,
    winners,
    chat,
    userId,
    isConnected,
    error,
    setError,
    turnTimeRemaining,
    turnTimerPlayerId,
    turnTimerWarning,
    shownHands,
    sevenDeuceBonus,
    clearSevenDeuceBonus,
    runItBoards,
    runItFinalChoice,
  } = useGameStore();

  const { joinRoom, leaveRoom, sitDown, sitOut, sendAction, sendChat, startGame, showHand, rebuy, setBombPotPreference, setStraddlePreference, updateRoomSettings, sendStraddle, sendRunItSelect, sendRunItConfirm } = useGameActions();

  const isMyTurn = useGameStore(selectIsMyTurn);
  const currentPlayer = useGameStore(selectCurrentPlayer);
  const isSittingOut = currentPlayer?.status === 'sitting-out';

  // Wrapper to convert ActionType to PlayerAction
  const handleAction = useCallback((type: ActionType, amount?: number) => {
    sendAction({
      type,
      amount,
      timestamp: Date.now(),
    });
  }, [sendAction]);

  // Join room on mount
  useEffect(() => {
    if (isConnected && roomCode) {
      joinRoom(roomCode);
    }

    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, roomCode]); // Only re-run when connection/room changes, not when callbacks change

  // Reset rebuy states when player gets chips (after rebuy)
  useEffect(() => {
    if (currentPlayer && currentPlayer.chips > 0) {
      setRebuyDismissed(false);
      setRebuyReady(false);
    }
  }, [currentPlayer?.chips]);

  // Delay rebuy modal to show after runout animation and winner announcement
  // This ensures the player can watch the dramatic card reveal before being prompted
  useEffect(() => {
    // Only trigger when phase becomes 'complete' and player has 0 chips
    if (gameState?.phase !== 'complete' || !currentPlayer || currentPlayer.chips > 0) {
      return;
    }

    // Calculate delay based on runout animation timing
    let delay = 5000; // Base 5 second delay (matches server's next hand delay)

    if (gameState.isRunout && gameState.runoutStartPhase) {
      // Add runout animation time
      // Timing: flop(0.5s) + pause(2s) + pause(3s) + river anim(2.5s) + pause(1s) = 9s from preflop
      if (gameState.runoutStartPhase === 'preflop') {
        delay += 9000;
      } else if (gameState.runoutStartPhase === 'flop') {
        delay += 8500;
      } else if (gameState.runoutStartPhase === 'turn') {
        delay += 6500;
      }
    }

    const timer = setTimeout(() => {
      setRebuyReady(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.isRunout, gameState?.runoutStartPhase, gameState?.handNumber, currentPlayer?.chips]);

  // Also show rebuy immediately if we're in 'waiting' phase with 0 chips (no animation to wait for)
  useEffect(() => {
    if (gameState?.phase === 'waiting' && currentPlayer && currentPlayer.chips === 0) {
      setRebuyReady(true);
    }
  }, [gameState?.phase, currentPlayer?.chips]);

  // Reset show/muck state when a new hand starts
  useEffect(() => {
    if (gameState?.phase && gameState.phase !== 'complete' && gameState.phase !== 'showdown') {
      setShowMuckDismissed(false);
    }
  }, [gameState?.phase]);

  // Reset pre-turn action when a new hand starts
  useEffect(() => {
    if (gameState?.phase === 'preflop') {
      setPreTurnAction(null);
    }
  }, [gameState?.phase]);

  // Execute pre-turn action when it becomes player's turn
  useEffect(() => {
    if (!isMyTurn || !preTurnAction || !gameState?.validActions || !currentPlayer) return;

    const toCall = gameState.currentBet - currentPlayer.totalBetThisRound;

    // Small delay to ensure UI updates first
    const timer = setTimeout(() => {
      switch (preTurnAction) {
        case 'check-fold':
          // Check if possible, fold otherwise
          if (gameState.validActions?.includes('check')) {
            handleAction('check');
          } else if (gameState.validActions?.includes('fold')) {
            handleAction('fold');
          }
          break;
        case 'fold':
          if (gameState.validActions?.includes('fold')) {
            handleAction('fold');
          }
          break;
        case 'call':
          if (gameState.validActions?.includes('call') && toCall === (gameState.currentBet - currentPlayer.totalBetThisRound)) {
            // Only call if the amount hasn't changed
            handleAction('call');
          }
          // If amount changed, don't auto-call - let user decide
          break;
        case 'call-any':
          if (gameState.validActions?.includes('call')) {
            handleAction('call');
          } else if (gameState.validActions?.includes('check')) {
            handleAction('check');
          }
          break;
      }
      setPreTurnAction(null);
    }, 100);

    return () => clearTimeout(timer);
  }, [isMyTurn, preTurnAction, gameState?.validActions, gameState?.currentBet, currentPlayer, handleAction]);

  // Handle sit down
  const handleSitDown = (seat: number) => {
    const buyIn = room?.stakes.maxBuyIn || 10000;
    sitDown(seat, buyIn);
  };

  // Handle chat submit
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChat(chatInput.trim());
      setChatInput('');
    }
  };

  // Copy invite link
  const copyInviteLink = () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast
  };

  // If not connected or loading
  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="room-page">
      {/* Floating Top Left Controls */}
      <div className="room-header-left">
        <button
          onClick={() => router.push('/lobby')}
          className="back-button"
        >
          ← Back
        </button>
        <div>
          <h1 className="room-title">{room?.name || 'Poker Room'}</h1>
          <div className="room-code">
            <span className="font-mono">{roomCode}</span>
            <button onClick={copyInviteLink} className="copy-button">
              <CopyIcon size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Top Right Controls */}
      <div className="room-header-right">
        {/* Sit Out Button - only show if seated */}
        {currentPlayer && (
          <button
            onClick={() => sitOut(!isSittingOut)}
            className={cn(
              'sit-out-button',
              isSittingOut && 'active'
            )}
          >
            {isSittingOut ? 'I\'m Back' : 'Sit Out'}
          </button>
        )}
        <button
          onClick={() => setShowChat(!showChat)}
          className={cn(
            'header-icon-button',
            showChat && 'active'
          )}
        >
          <MessageIcon size={20} />
        </button>
        {/* Settings button - only visible to host */}
        {room && userId === room.hostId && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'header-icon-button',
              showSettings && 'active'
            )}
            title="Game Settings (Host)"
          >
            <SettingsIcon size={20} />
          </button>
        )}
        <button
          onClick={() => {
            leaveRoom();
            router.push('/lobby');
          }}
          className="header-icon-button danger"
        >
          <LogOutIcon size={20} />
        </button>
      </div>

      {/* Game Area - Table takes up most space, leaving room for action bar */}
      <div className="game-area">
        {/* Table Container - centered with proper sizing */}
        <div className="table-container">
          {gameState && (
            <PokerTable
              gameState={gameState}
              currentPlayerId={userId || undefined}
              winners={winners}
              turnTimeRemaining={turnTimeRemaining}
              turnTimerPlayerId={turnTimerPlayerId}
              turnTimerWarning={turnTimerWarning}
              turnTimeTotal={room?.customRules.turnTimeSeconds || 30}
              shownHands={shownHands}
              onSeatClick={handleSitDown}
              maxSeats={room?.maxPlayers || 9}
              className="poker-table-wrapper"
            />
          )}
        </div>

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && (
            <ChatPanel
              messages={chat}
              input={chatInput}
              onInputChange={setChatInput}
              onSubmit={handleChatSubmit}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar - only show when game is active and it's my turn */}
      {currentPlayer && isMyTurn && gameState && gameState.phase !== 'waiting' && gameState.validActions && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="action-bar-wrapper"
        >
          <ActionButtons
            validActions={gameState.validActions}
            currentBet={gameState.currentBet}
            playerBet={currentPlayer.totalBetThisRound}
            playerChips={currentPlayer.chips}
            pot={gameState.pot}
            minRaise={gameState.minRaise}
            bigBlind={room?.stakes.bigBlind || 2}
            onAction={handleAction}
          />
        </motion.div>
      )}

      {/* Pre-Turn Actions - shown when it's NOT your turn but game is active */}
      {currentPlayer && !isMyTurn && gameState &&
       gameState.phase !== 'waiting' &&
       gameState.phase !== 'complete' &&
       gameState.phase !== 'showdown' &&
       !currentPlayer.isFolded && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pre-turn-wrapper"
        >
          <PreTurnActions
            selectedAction={preTurnAction}
            onSelectAction={setPreTurnAction}
            canCheck={gameState.currentBet === currentPlayer.totalBetThisRound}
            toCall={gameState.currentBet - currentPlayer.totalBetThisRound}
          />
        </motion.div>
      )}

      {/* Straddle Prompt - appears when it's player's turn to straddle */}
      {gameState?.straddlePrompt && gameState.straddlePrompt.playerId === userId && (
        <StraddlePrompt
          isVisible={true}
          amount={gameState.straddlePrompt.amount}
          timeRemaining={turnTimeRemaining ?? gameState.straddlePrompt.timeoutSeconds}
          previousStraddlerName={gameState.straddlePrompt.previousStraddlerName}
          isDoubleStraddle={gameState.straddlePrompt.isDoubleStraddle}
          onAccept={() => sendStraddle(true)}
          onDecline={() => sendStraddle(false)}
        />
      )}

      {/* Run It Prompt - appears when all-in with cards to come */}
      {gameState?.runItPrompt && (
        <RunItPrompt
          prompt={gameState.runItPrompt}
          currentPlayerId={userId}
          timeRemaining={turnTimeRemaining ?? 5}
          showThrice={room?.customRules?.runItThrice ?? false}
          onSelect={sendRunItSelect}
          onConfirm={sendRunItConfirm}
          players={gameState.players.map(p => ({ oderId: p.oderId, name: p.odername }))}
        />
      )}

      {/* Run It Boards - displays multiple boards when running it twice/thrice */}
      {runItBoards && runItBoards.length > 0 && runItFinalChoice && runItFinalChoice > 1 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <RunItBoards
            boards={runItBoards}
            finalChoice={runItFinalChoice}
          />
        </div>
      )}

      {/* Show/Muck Buttons - appears when player wins by fold */}
      {(() => {
        const myWin = winners.find(w => w.playerId === userId && w.wonByFold);
        const alreadyShown = userId && shownHands.has(userId);
        if (myWin && !alreadyShown && !showMuckDismissed) {
          return (
            <ShowMuckButtons
              onShow={() => {
                showHand();
                setShowMuckDismissed(true);
              }}
              onMuck={() => {
                setShowMuckDismissed(true);
              }}
              autoMuckSeconds={5}
            />
          );
        }
        return null;
      })()}

      {/* Player Preference Toggles - Lower Left */}
      {currentPlayer && (room?.customRules?.bombPotEnabled || room?.customRules?.straddleEnabled) && (
        <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-2">
          {/* Bomb Pot Toggle */}
          {room?.customRules?.bombPotEnabled && (
            <label className="flex items-center gap-2 cursor-pointer select-none bg-dark-surface/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-purple-800/30 hover:border-purple-600/50 transition-colors">
              <input
                type="checkbox"
                checked={currentPlayer.bombPotWhenDealer || false}
                onChange={(e) => setBombPotPreference(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-gray-300">
                Bomb Pot when Dealer
              </span>
              {currentPlayer.bombPotWhenDealer && (
                <span className="text-xs text-orange-500 font-semibold">ON</span>
              )}
            </label>
          )}
          {/* Straddle Toggle */}
          {room?.customRules?.straddleEnabled && (
            <label className="flex items-center gap-2 cursor-pointer select-none bg-dark-surface/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-purple-800/30 hover:border-purple-600/50 transition-colors">
              <input
                type="checkbox"
                checked={currentPlayer.straddleNextHand || false}
                onChange={(e) => setStraddlePreference(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-gold focus:ring-gold focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-gray-300">
                Straddle Next Hand
              </span>
              {currentPlayer.straddleNextHand && (
                <span className="text-xs text-gold font-semibold">ON</span>
              )}
            </label>
          )}
        </div>
      )}

      {/* Start Game Button (for host when waiting) */}
      {gameState?.phase === 'waiting' && room?.hostId === userId && (
        <div className="flex-shrink-0 p-4 border-t border-purple-800/30 text-center">
          <button
            onClick={() => startGame()}
            className="btn btn-primary"
          >
            Start Game
          </button>
          <p className="text-gray-400 text-sm mt-2">
            {gameState?.players?.length || 0} player(s) at table - need at least 2 to start
          </p>
        </div>
      )}

      {/* Rebuy Modal - show when player has 0 chips and animations are complete */}
      <RebuyModal
        isOpen={
          !rebuyDismissed &&
          rebuyReady &&
          !!currentPlayer &&
          currentPlayer.chips === 0
        }
        minBuyIn={room?.stakes.minBuyIn || 1000}
        maxBuyIn={room?.stakes.maxBuyIn || 10000}
        onRebuy={(amount) => {
          rebuy(amount);
          setRebuyDismissed(false); // Reset for future rebuys
          setRebuyReady(false); // Reset for future rebuys
        }}
        onClose={() => {
          setRebuyDismissed(true);
          leaveRoom();
          router.push('/lobby');
        }}
      />

      {/* Host Settings Modal - only for host */}
      {room && userId === room.hostId && (
        <HostSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          room={room}
          onSave={(settings: RoomSettingsUpdate) => {
            updateRoomSettings(settings);
          }}
        />
      )}

      {/* 7-2 Game Celebration */}
      {sevenDeuceBonus && (
        <SevenDeuceCelebration
          bonus={sevenDeuceBonus}
          winnerName={gameState?.players.find(p => p.oderId === sevenDeuceBonus.winnerId)?.odername}
          onClose={clearSevenDeuceBonus}
        />
      )}

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-accent-red text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ChatPanelProps {
  messages: Array<{ id: string; odername: string; message: string; timestamp: number }>;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ChatPanel({ messages, input, onInputChange, onSubmit }: ChatPanelProps) {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="flex-shrink-0 border-l border-purple-800/30 bg-dark-surface/50 flex flex-col"
    >
      <div className="p-3 border-b border-purple-800/30">
        <h3 className="font-semibold text-white">Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className="text-purple-400 font-medium">{msg.odername}: </span>
            <span className="text-gray-300">{msg.message}</span>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="p-3 border-t border-purple-800/30">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Type a message..."
          className="input text-sm"
        />
      </form>
    </motion.div>
  );
}
