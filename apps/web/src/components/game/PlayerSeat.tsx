'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { RoomPlayer, Card, WinnerInfo } from '@poker/shared';
import { cn, formatChips } from '@/lib/utils';
import { PlayingCard } from './PlayingCard';

// =============================================================================
// TYPES
// =============================================================================

interface PlayerSeatProps {
  player: RoomPlayer;
  isCurrentPlayer?: boolean;
  isActivePlayer?: boolean;
  isDealer?: boolean;
  showCards?: boolean;
  winnerInfo?: WinnerInfo;
  turnTimeRemaining?: number | null;
  turnTimerWarning?: boolean;
  turnTimeTotal?: number;
  shownCards?: Card[];  // Cards voluntarily shown after winning by fold
  hasCards?: boolean;   // Whether player has cards (for card indicator)
  lastAction?: { action: string; amount?: number } | null;  // Last action for floating label
  winStreak?: number;   // Consecutive wins for streak indicator
  className?: string;
  // Deal animation props
  dealAnimationDelay?: number;  // Delay before card animation starts
  dealFromPosition?: { x: number; y: number };  // Position to animate cards from (dealer position)
  handNumber?: number;  // Current hand number (used to trigger card remount for animations)
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PlayerSeat({
  player,
  isCurrentPlayer = false,
  isActivePlayer = false,
  isDealer = false,
  showCards = false,
  winnerInfo,
  turnTimeRemaining,
  turnTimerWarning = false,
  turnTimeTotal = 30,
  shownCards,
  hasCards = false,
  lastAction,
  winStreak = 0,
  className,
  dealAnimationDelay,
  dealFromPosition,
  handNumber,
}: PlayerSeatProps) {
  const { odername, avatarUrl, chips, holeCards, isFolded, isAllIn, status } = player;

  // Debug logging for card display issues
  if (process.env.NODE_ENV === 'development' && (holeCards?.length || isCurrentPlayer)) {
    console.log('[PlayerSeat]', odername, {
      isCurrentPlayer,
      showCards,
      hasCards: !!holeCards,
      cardCount: holeCards?.length || 0,
      cards: holeCards,
      isFolded,
    });
  }

  const isDisconnected = status === 'disconnected' || status === 'away';
  const isSittingOut = status === 'sitting-out';
  const isOnStreak = winStreak >= 2;

  // Show card indicator for other players who are still in hand but we can't see their cards
  const showCardIndicator = hasCards && !isFolded && !isSittingOut && !isCurrentPlayer && !holeCards?.length && !shownCards;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'relative flex flex-col items-center gap-1',
        (isFolded || isSittingOut) && 'opacity-50',
        isActivePlayer && 'spotlight-effect',
        isOnStreak && 'fire-effect',
        className
      )}
    >
      {/* Winner Effects */}
      <AnimatePresence>
        {winnerInfo && (
          <>
            {/* Enhanced Chip Rain Animation */}
            <ChipRain />

            {/* Gold sparkle effect */}
            <GoldSparkles />

            {/* Winner Badge with gold gradient */}
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="absolute -top-28 left-1/2 -translate-x-1/2 z-20"
            >
              <div className="relative">
                {/* Glow behind badge */}
                <div className="absolute inset-0 bg-yellow-400/30 blur-xl rounded-lg" />
                <div className="relative bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 rounded-lg px-6 py-3 shadow-lg border border-yellow-400/50 winner-glow">
                  <div className="text-yellow-100 text-lg font-bold text-center whitespace-nowrap gold-shimmer-text">
                    WINNER
                  </div>
                  <div className="text-yellow-100 text-xl font-bold text-center whitespace-nowrap">
                    +{formatChips(winnerInfo.amount)}
                  </div>
                  {winnerInfo.hand && (
                    <div className="text-yellow-200 text-sm text-center whitespace-nowrap font-medium mt-1">
                      {winnerInfo.hand.description}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Action Label */}
      <AnimatePresence>
        {lastAction && !winnerInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 z-10"
          >
            <ActionLabel action={lastAction.action} amount={lastAction.amount} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Streak Indicator */}
      <AnimatePresence>
        {isOnStreak && !winnerInfo && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-8 -right-2 z-20"
          >
            <StreakBadge streak={winStreak} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hole Cards - show either normal cards or voluntarily shown cards */}
      {/* Don't show cards for folded or sitting-out players */}
      {!isSittingOut && ((holeCards && holeCards.length > 0) || shownCards) ? (
        <HoleCards
          cards={shownCards || holeCards || []}
          showCards={!!shownCards || showCards || isCurrentPlayer}
          isFolded={isFolded && !shownCards}
          isCurrentPlayer={isCurrentPlayer}
          dealAnimationDelay={dealAnimationDelay}
          dealFromPosition={dealFromPosition}
          handNumber={handNumber}
        />
      ) : showCardIndicator ? (
        // Card indicator for players still in hand
        <CardIndicator />
      ) : null}

      {/* Avatar */}
      <PlayerAvatar
        username={odername}
        avatarUrl={avatarUrl}
        isActive={isActivePlayer}
        isDisconnected={isDisconnected}
        isAllIn={isAllIn}
        isWinner={!!winnerInfo}
        turnTimeRemaining={isActivePlayer ? turnTimeRemaining : null}
        turnTimerWarning={turnTimerWarning}
        turnTimeTotal={turnTimeTotal}
      />

      {/* Player Info */}
      <PlayerInfo
        username={odername}
        chips={chips}
        isCurrentPlayer={isCurrentPlayer}
        isAllIn={isAllIn}
        isSittingOut={isSittingOut}
        turnTimeRemaining={turnTimeRemaining}
        turnTimerWarning={turnTimerWarning}
        turnTimeTotal={turnTimeTotal}
        isActivePlayer={isActivePlayer}
      />
    </motion.div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface HoleCardsProps {
  cards: Card[];
  showCards: boolean;
  isFolded?: boolean;
  isCurrentPlayer?: boolean;
  dealAnimationDelay?: number;
  dealFromPosition?: { x: number; y: number };
  handNumber?: number;
}

function HoleCards({
  cards,
  showCards,
  isFolded,
  isCurrentPlayer = false,
  dealAnimationDelay,
  dealFromPosition,
  handNumber,
}: HoleCardsProps) {
  if (isFolded) return null;

  // Current player gets larger, more visible cards
  const cardSize = isCurrentPlayer ? 'sm' : 'xs';

  // Use custom deal animation if position is provided
  const useDealAnimation = dealFromPosition !== undefined && dealAnimationDelay !== undefined;

  return (
    <div className={cn(
      'flex -mb-1',
      isCurrentPlayer ? 'gap-1' : 'gap-0.5'
    )}>
      {cards.map((card, i) => (
        <PlayingCard
          // Include handNumber in key to force remount when new hand starts
          // This ensures the deal animation plays fresh each hand
          key={`${card.code}-hand${handNumber ?? 0}`}
          card={card}
          faceDown={!showCards}
          size={cardSize}
          // Use deal animation if provided, otherwise default timing
          animationDelay={useDealAnimation ? dealAnimationDelay + (i * 0.08) : i * 0.1}
          dealFrom={useDealAnimation ? 'custom' : 'dealer'}
          dealFromPosition={dealFromPosition}
        />
      ))}
    </div>
  );
}

// Card indicator for players still in hand (when we can't see their actual cards)
function CardIndicator() {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex gap-0.5 -mb-2"
    >
      {/* Two face-down card icons */}
      <div className="w-8 h-11 rounded bg-gradient-to-br from-purple-700 to-purple-900 border border-purple-500/50 shadow-sm flex items-center justify-center">
        <span className="text-gold/50 text-sm">♠</span>
      </div>
      <div className="w-8 h-11 rounded bg-gradient-to-br from-purple-700 to-purple-900 border border-purple-500/50 shadow-sm flex items-center justify-center -ml-3">
        <span className="text-gold/50 text-sm">♠</span>
      </div>
    </motion.div>
  );
}

interface PlayerAvatarProps {
  username: string;
  avatarUrl?: string;
  isActive: boolean;
  isDisconnected: boolean;
  isAllIn?: boolean;
  isWinner?: boolean;
  turnTimeRemaining?: number | null;
  turnTimerWarning?: boolean;
  turnTimeTotal?: number;
}

function PlayerAvatar({
  username,
  avatarUrl,
  isActive,
  isDisconnected,
  isAllIn,
  isWinner,
  turnTimeRemaining,
  turnTimerWarning = false,
  turnTimeTotal = 30,
}: PlayerAvatarProps) {
  const showTimer = turnTimeRemaining !== null && turnTimeRemaining !== undefined && isActive;
  const timerProgress = showTimer ? (turnTimeRemaining / turnTimeTotal) * 100 : 100;
  const timerColor = turnTimerWarning ? '#ef4444' : timerProgress < 30 ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative">
      {/* Timer Ring */}
      {showTimer && (
        <svg
          className="absolute -inset-1 w-[58px] h-[58px] -rotate-90"
          viewBox="0 0 58 58"
        >
          {/* Background circle */}
          <circle
            cx="29"
            cy="29"
            r="26"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <motion.circle
            cx="29"
            cy="29"
            r="26"
            fill="none"
            stroke={timerColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 26}`}
            strokeDashoffset={`${2 * Math.PI * 26 * (1 - timerProgress / 100)}`}
            initial={false}
            animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - timerProgress / 100) }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </svg>
      )}


      <motion.div
        animate={isActive && !showTimer ? { scale: [1, 1.05, 1] } : isWinner ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: isWinner ? 0.5 : 1, repeat: (isActive && !showTimer || isWinner) ? Infinity : 0 }}
        className={cn(
          'w-[52px] h-[52px] rounded-full overflow-hidden',
          'border-3 transition-all duration-300',
          isWinner
            ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
            : isActive
            ? 'border-gold shadow-glow-gold'
            : 'border-purple-500/60',
          isDisconnected && 'opacity-50 grayscale',
          isAllIn && !isWinner && 'border-accent-red shadow-glow-red'
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-purple-700 flex items-center justify-center">
            <span className="text-lg font-bold text-purple-100">
              {getInitial(username)}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

interface PlayerInfoProps {
  username: string;
  chips: number;
  isCurrentPlayer: boolean;
  isAllIn?: boolean;
  isSittingOut?: boolean;
  turnTimeRemaining?: number | null;
  turnTimerWarning?: boolean;
  turnTimeTotal?: number;
  isActivePlayer?: boolean;
}

function PlayerInfo({
  username,
  chips,
  isCurrentPlayer,
  isAllIn,
  isSittingOut,
  turnTimeRemaining,
  turnTimerWarning = false,
  turnTimeTotal = 30,
  isActivePlayer = false,
}: PlayerInfoProps) {
  const showTimer = turnTimeRemaining !== null && turnTimeRemaining !== undefined && isActivePlayer;
  const timerProgress = showTimer ? (turnTimeRemaining / turnTimeTotal) * 100 : 100;

  // Color interpolates from green (100%) to yellow (50%) to red (0%)
  const getTimerColor = () => {
    if (turnTimerWarning) return '#ef4444'; // Red when warning
    if (timerProgress > 50) {
      // Green to yellow (100% -> 50%)
      const greenToYellow = (timerProgress - 50) / 50;
      return `rgb(${Math.round(34 + (245 - 34) * (1 - greenToYellow))}, ${Math.round(197 + (158 - 197) * (1 - greenToYellow))}, ${Math.round(94 + (11 - 94) * (1 - greenToYellow))})`;
    } else {
      // Yellow to red (50% -> 0%)
      const yellowToRed = timerProgress / 50;
      return `rgb(${Math.round(239 + (245 - 239) * yellowToRed)}, ${Math.round(68 + (158 - 68) * yellowToRed)}, ${Math.round(68 + (11 - 68) * yellowToRed)})`;
    }
  };

  return (
    <div
      className={cn(
        'bg-[#1a2744] rounded-lg px-3 py-1.5 min-w-[90px]',
        'border transition-colors duration-200',
        isCurrentPlayer
          ? 'border-gold/50 shadow-glow-gold'
          : 'border-[#2a3a5a]/60'
      )}
    >
      <div className="text-xs font-medium text-white truncate max-w-[85px] text-center">
        {username}
      </div>
      <div className="flex items-center justify-center gap-1">
        <span className="text-sm font-mono font-bold text-gold">
          {formatChips(chips)}
        </span>
        {isAllIn && (
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-[10px] font-bold text-ruby uppercase px-1 py-0.5 bg-ruby/20 rounded"
          >
            ALL IN
          </motion.span>
        )}
        {isSittingOut && (
          <span className="text-[10px] font-bold text-gray-400 uppercase px-1 py-0.5 bg-gray-700/50 rounded">
            OUT
          </span>
        )}
      </div>

      {/* Timer Progress Bar - below name/chips */}
      {showTimer && (
        <div className="mt-1.5 w-full h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: getTimerColor() }}
            initial={false}
            animate={{ width: `${timerProgress}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ACTION LABEL COMPONENT
// =============================================================================

interface ActionLabelProps {
  action: string;
  amount?: number;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  fold: { bg: 'bg-gray-700', text: 'text-gray-200', border: 'border-gray-500/50' },
  check: { bg: 'bg-purple-700', text: 'text-white', border: 'border-purple-500/50' },
  call: { bg: 'bg-emerald', text: 'text-white', border: 'border-emerald-light/50' },
  bet: { bg: 'bg-gold', text: 'text-dark', border: 'border-gold-light/50' },
  raise: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-400/50' },
  'all-in': { bg: 'bg-ruby', text: 'text-white', border: 'border-ruby-light/50' },
};

function ActionLabel({ action, amount }: ActionLabelProps) {
  const style = ACTION_STYLES[action.toLowerCase()] || ACTION_STYLES.check;
  const displayAction = action.toUpperCase().replace('-', ' ');

  return (
    <div className={cn(
      'px-4 py-1.5 rounded-full font-bold text-sm uppercase tracking-wide',
      'shadow-lg border whitespace-nowrap',
      'floating-action',
      style.bg,
      style.text,
      style.border
    )}>
      {displayAction}
      {amount !== undefined && amount > 0 && (
        <span className="ml-1 font-mono">${formatChips(amount)}</span>
      )}
    </div>
  );
}

// =============================================================================
// STREAK BADGE COMPONENT
// =============================================================================

interface StreakBadgeProps {
  streak: number;
}

function StreakBadge({ streak }: StreakBadgeProps) {
  // Different intensity based on streak
  const intensity = streak >= 5 ? 'inferno' : streak >= 3 ? 'fire' : 'warm';
  const flameSize = streak >= 5 ? 'text-2xl' : streak >= 3 ? 'text-xl' : 'text-lg';

  return (
    <div className="relative">
      {/* Fire glow */}
      <div className={cn(
        'absolute inset-0 rounded-full blur-md',
        intensity === 'inferno' ? 'bg-red-600/60' : intensity === 'fire' ? 'bg-orange-500/50' : 'bg-orange-400/40'
      )} />
      <div className={cn(
        'relative flex items-center gap-1 px-2 py-1 rounded-full',
        'bg-gradient-to-r from-orange-600 to-red-600',
        'border border-orange-400/50 shadow-lg',
        'animate-fire-flicker'
      )}>
        <span className={flameSize}>🔥</span>
        <span className="text-white font-bold text-sm">{streak}</span>
      </div>
    </div>
  );
}

// =============================================================================
// GOLD SPARKLES COMPONENT
// =============================================================================

function GoldSparkles() {
  // Generate random sparkles
  const sparkles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 120,
    y: (Math.random() - 0.5) * 80,
    delay: Math.random() * 0.5,
    duration: 0.8 + Math.random() * 0.4,
    size: 8 + Math.random() * 8,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          initial={{
            x: 0,
            y: 0,
            opacity: 0,
            scale: 0,
          }}
          animate={{
            x: sparkle.x,
            y: sparkle.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.5, 1, 0],
          }}
          transition={{
            duration: sparkle.duration,
            delay: sparkle.delay,
            ease: 'easeOut',
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: sparkle.size, height: sparkle.size }}
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(250, 204, 21, 1) 0%, rgba(250, 204, 21, 0) 70%)',
              boxShadow: '0 0 10px rgba(250, 204, 21, 0.8)',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// CHIP RAIN ANIMATION
// =============================================================================

const CHIP_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
];

function ChipRain() {
  // Generate random chips
  const chips = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 80, // Random x offset from -40 to 40
    delay: Math.random() * 0.5, // Stagger the start
    duration: 0.8 + Math.random() * 0.4, // Random fall duration
    color: CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)],
    rotation: Math.random() * 360,
    size: 12 + Math.random() * 8, // Random size 12-20px
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {chips.map((chip) => (
        <motion.div
          key={chip.id}
          initial={{
            y: -60,
            x: chip.x,
            opacity: 1,
            rotate: 0,
            scale: 0.5,
          }}
          animate={{
            y: 80,
            x: chip.x + (Math.random() - 0.5) * 20,
            opacity: [1, 1, 0],
            rotate: chip.rotation,
            scale: 1,
          }}
          transition={{
            duration: chip.duration,
            delay: chip.delay,
            ease: 'easeIn',
          }}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ width: chip.size, height: chip.size }}
        >
          {/* Poker chip */}
          <div
            className={cn(
              'w-full h-full rounded-full border-2 border-white/40 shadow-md',
              chip.color
            )}
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
            }}
          >
            {/* Inner circle detail */}
            <div className="absolute inset-1 rounded-full border border-white/20" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getInitial(username: string): string {
  return username.charAt(0).toUpperCase();
}
