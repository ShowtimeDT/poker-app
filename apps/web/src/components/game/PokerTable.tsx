'use client';

import { motion } from 'framer-motion';
import type { GameState, Card, WinnerInfo, Board } from '@poker/shared';
import { cn, formatChips } from '@/lib/utils';
import { PlayingCard, CommunityCards, DualBoardCommunityCards } from './PlayingCard';
import { PotDisplay, BetDisplay } from './ChipStack';
import { PlayerSeat } from './PlayerSeat';
import { HouseRulesLogo } from '@/components/ui/HouseRulesLogo';

// =============================================================================
// CONSTANTS & HELPERS
// =============================================================================

// Ellipse parameters for seat positioning (as percentages)
const ELLIPSE_CENTER_X = 50;
const ELLIPSE_CENTER_Y = 50;
const ELLIPSE_RX = 46; // Horizontal radius
const ELLIPSE_RY = 38; // Vertical radius

/**
 * Calculate seat positions dynamically based on number of seats
 * Uses ellipse parametric formula to place players evenly on the rail
 * Seats are distributed evenly around the ellipse, starting from bottom (90°)
 */
function calculateSeatPositions(numSeats: number): { x: number; y: number; betX: number; betY: number }[] {
  const positions: { x: number; y: number; betX: number; betY: number }[] = [];
  const angleStep = 360 / numSeats;
  const startAngle = 90; // Start from bottom

  for (let i = 0; i < numSeats; i++) {
    // Calculate angle in degrees, then convert to radians
    const angleDeg = startAngle + (i * angleStep);
    const angleRad = (angleDeg * Math.PI) / 180;

    // Calculate seat position on ellipse
    const x = ELLIPSE_CENTER_X + ELLIPSE_RX * Math.cos(angleRad);
    const y = ELLIPSE_CENTER_Y + ELLIPSE_RY * Math.sin(angleRad);

    // Calculate bet position (50% of the way from seat to center)
    const betX = ELLIPSE_CENTER_X + (x - ELLIPSE_CENTER_X) * 0.5;
    const betY = ELLIPSE_CENTER_Y + (y - ELLIPSE_CENTER_Y) * 0.5;

    positions.push({
      x: Math.round(x),
      y: Math.round(y),
      betX: Math.round(betX),
      betY: Math.round(betY),
    });
  }

  return positions;
}

// =============================================================================
// TYPES
// =============================================================================

interface PokerTableProps {
  gameState: GameState;
  currentPlayerId?: string;
  winners?: WinnerInfo[];
  turnTimeRemaining?: number | null;
  turnTimerPlayerId?: string | null;
  turnTimerWarning?: boolean;
  turnTimeTotal?: number;
  shownHands?: Map<string, Card[]>;
  onSeatClick?: (seat: number) => void;
  maxSeats?: number;
  className?: string;
  // Run-it-twice/thrice boards
  runItBoards?: Board[] | null;
  runItFinalChoice?: 1 | 2 | 3 | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PokerTable({
  gameState,
  currentPlayerId,
  winners = [],
  turnTimeRemaining,
  turnTimerPlayerId,
  turnTimerWarning = false,
  turnTimeTotal = 30,
  shownHands,
  onSeatClick,
  maxSeats = 9,
  className,
  runItBoards,
  runItFinalChoice,
}: PokerTableProps) {
  const { players, communityCards, communityCards2, ghostCards, pot, dealerSeat, currentPlayerSeat, phase, isBombPot, isDualBoard } = gameState;

  // Calculate seat positions dynamically based on max seats
  const seatPositions = calculateSeatPositions(maxSeats);

  // Create a map of oderId -> winnerInfo for quick lookup
  const winnerMap = new Map(winners.map(w => [w.playerId, w]));

  // Check if the hand was won by fold (should muck cards by default)
  const wonByFold = winners.length > 0 && winners.some(w => w.wonByFold);

  // Find the current user's seat for view rotation
  const currentUserPlayer = players.find(p => p.oderId === currentPlayerId);
  const currentUserSeat = currentUserPlayer?.seat ?? 0;

  // Calculate rotation offset so current user always appears at bottom (visual position 0)
  // This rotates the "camera" around the table
  const getVisualPosition = (actualSeat: number): number => {
    return (actualSeat - currentUserSeat + maxSeats) % maxSeats;
  };

  // Reverse: given a visual position, what actual seat is it?
  const getActualSeat = (visualPosition: number): number => {
    return (visualPosition + currentUserSeat) % maxSeats;
  };

  // Debug logging for card display issues
  if (process.env.NODE_ENV === 'development') {
    console.log('[PokerTable] phase:', phase, 'currentPlayerId:', currentPlayerId, 'currentUserSeat:', currentUserSeat);
    console.log('[PokerTable] players:', players.map(p => ({
      oderId: p.oderId,
      seat: p.seat,
      visualPos: getVisualPosition(p.seat),
      hasCards: !!p.holeCards,
      cardCount: p.holeCards?.length || 0,
    })));
  }

  // Map players to their actual seats
  const seatMap = new Map(players.map(p => [p.seat, p]));

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Table Surface */}
      <TableSurface />

      {/* Community Cards / Run-It Boards */}
      <div className={cn(
        "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
        // Adjust vertical position based on number of boards
        runItBoards && runItBoards.length > 1 ? "top-[38%]" :
        isDualBoard && communityCards2 ? "top-[40%]" : "top-[42%]"
      )}>
        {/* Run-it-twice/thrice boards */}
        {runItBoards && runItBoards.length > 1 && runItFinalChoice && runItFinalChoice > 1 ? (
          <RunItBoardsDisplay
            boards={runItBoards}
            finalChoice={runItFinalChoice}
          />
        ) : isDualBoard && communityCards2 ? (
          <DualBoardCommunityCards
            board1Cards={communityCards}
            board2Cards={communityCards2}
            isRunout={gameState?.isRunout}
            runoutStartPhase={gameState?.runoutStartPhase}
          />
        ) : (
          <CommunityCards
            cards={communityCards}
            ghostCards={ghostCards}
            isRunout={gameState?.isRunout}
            runoutStartPhase={gameState?.runoutStartPhase}
          />
        )}
      </div>

      {/* Bomb Pot Indicator */}
      {isBombPot && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "px-3 py-1.5 rounded-full",
              "bg-gradient-to-r from-orange-600 to-red-600",
              "text-white text-xs font-bold uppercase tracking-wider",
              "shadow-lg shadow-orange-600/30",
              "border border-orange-400/50"
            )}
          >
            BOMB POT {isDualBoard && '(2 BOARDS)'}
          </motion.div>
        </div>
      )}

      {/* Pot Display - centered below the bottom board */}
      {pot > 0 && (
        <div className={cn(
          "absolute left-1/2 -translate-x-1/2",
          isDualBoard && communityCards2
            ? "top-[60%]"  // Below dual boards
            : "top-[54%]"  // Below single board
        )}>
          <PotDisplay amount={pot} />
        </div>
      )}

      {/* Player Seats - iterate through visual positions */}
      {seatPositions.map((pos, visualPosition) => {
        // Convert visual position to actual seat number
        const actualSeat = getActualSeat(visualPosition);
        const player = seatMap.get(actualSeat);
        const isCurrentPlayer = player?.oderId === currentPlayerId;
        const isActivePlayer = actualSeat === currentPlayerSeat;
        const isDealer = actualSeat === dealerSeat;

        return (
          <div
            key={visualPosition}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {player ? (
              <>
                <PlayerSeat
                  player={player}
                  isCurrentPlayer={isCurrentPlayer}
                  isActivePlayer={isActivePlayer && phase !== 'waiting'}
                  isDealer={isDealer}
                  showCards={isCurrentPlayer || ((phase === 'showdown' || phase === 'complete') && !wonByFold)}
                  winnerInfo={winnerMap.get(player.oderId)}
                  turnTimeRemaining={player.oderId === turnTimerPlayerId ? turnTimeRemaining : null}
                  turnTimerWarning={player.oderId === turnTimerPlayerId && turnTimerWarning}
                  turnTimeTotal={turnTimeTotal}
                  shownCards={shownHands?.get(player.oderId)}
                  hasCards={phase !== 'waiting' && !player.isFolded}
                />
                {/* Bet Display */}
                {player.bet > 0 && (
                  <div
                    className="absolute"
                    style={{
                      left: `${(pos.betX - pos.x) * 3}%`,
                      top: `${(pos.betY - pos.y) * 3}%`,
                    }}
                  >
                    <BetDisplay amount={player.bet} />
                  </div>
                )}
              </>
            ) : (
              <EmptySeat
                seat={actualSeat}
                onClick={() => onSeatClick?.(actualSeat)}
              />
            )}
          </div>
        );
      })}

      {/* Dealer Button - use visual position for display */}
      <DealerButton
        visualPosition={getVisualPosition(dealerSeat)}
        visible={phase !== 'waiting'}
        seatPositions={seatPositions}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TableSurface() {
  return (
    <div className="absolute inset-0">
      {/* SVG-based premium table with casino rail */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 562"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Purple felt gradient - brighter center */}
          <radialGradient id="feltGradient" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#4a1c6b" />
            <stop offset="40%" stopColor="#3d1a5c" />
            <stop offset="70%" stopColor="#2d1245" />
            <stop offset="100%" stopColor="#1f0d30" />
          </radialGradient>

          {/* Rail gradient (rich mahogany wood look) */}
          <linearGradient id="railGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a3728" />
            <stop offset="20%" stopColor="#3d2d20" />
            <stop offset="50%" stopColor="#2a1f16" />
            <stop offset="80%" stopColor="#1f170f" />
            <stop offset="100%" stopColor="#1a130c" />
          </linearGradient>

          {/* Silver border gradient */}
          <linearGradient id="silverBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8e8e8" />
            <stop offset="25%" stopColor="#c0c0c0" />
            <stop offset="50%" stopColor="#a8a8a8" />
            <stop offset="75%" stopColor="#c0c0c0" />
            <stop offset="100%" stopColor="#909090" />
          </linearGradient>

          {/* Silver glow filter */}
          <filter id="silverGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feFlood floodColor="#c0c0c0" floodOpacity="0.3"/>
            <feComposite in2="blur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Inner shadow for felt depth */}
          <filter id="innerShadow">
            <feOffset dx="0" dy="3"/>
            <feGaussianBlur stdDeviation="6"/>
            <feComposite operator="out" in="SourceGraphic"/>
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
            <feBlend in="SourceGraphic" mode="normal"/>
          </filter>

          {/* Drop shadow for table lift */}
          <filter id="tableDropShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="10" stdDeviation="20" floodColor="#000" floodOpacity="0.7"/>
          </filter>
        </defs>

        {/* === LAYER 0: Drop shadow for depth === */}
        <ellipse
          cx="500" cy="281" rx="480" ry="260"
          fill="rgba(0,0,0,0.6)"
          filter="url(#tableDropShadow)"
        />

        {/* === LAYER 1: Outer silver glow === */}
        <ellipse
          cx="500" cy="281" rx="480" ry="260"
          fill="none"
          stroke="url(#silverBorder)"
          strokeWidth="3"
          filter="url(#silverGlow)"
        />

        {/* === LAYER 2: Main outer silver border === */}
        <ellipse
          cx="500" cy="281" rx="478" ry="258"
          fill="none"
          stroke="url(#silverBorder)"
          strokeWidth="2.5"
        />

        {/* === LAYER 3: Rail/padding (casino-style wood) === */}
        <ellipse
          cx="500" cy="281" rx="472" ry="252"
          fill="url(#railGradient)"
        />

        {/* === LAYER 4: Rail highlight (top edge) === */}
        <ellipse
          cx="500" cy="281" rx="470" ry="250"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* === LAYER 5: Inner silver accent line (where felt meets rail) === */}
        <ellipse
          cx="500" cy="281" rx="428" ry="205"
          fill="none"
          stroke="url(#silverBorder)"
          strokeWidth="2"
          filter="url(#silverGlow)"
        />

        {/* === LAYER 6: Rail inner shadow === */}
        <ellipse
          cx="500" cy="281" rx="426" ry="203"
          fill="none"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="3"
        />

        {/* === LAYER 7: Purple felt surface (EXPANDED) === */}
        <ellipse
          cx="500" cy="281" rx="420" ry="198"
          fill="url(#feltGradient)"
          filter="url(#innerShadow)"
        />

        {/* === LAYER 8: Felt inner subtle highlight === */}
        <ellipse
          cx="500" cy="275" rx="405" ry="185"
          fill="none"
          stroke="rgba(255,255,255,0.02)"
          strokeWidth="1"
        />
      </svg>

      {/* Center "House Rules" branding with shimmer - positioned over the SVG */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-10 opacity-15">
        <HouseRulesLogo size="lg" shimmer={true} />
      </div>
    </div>
  );
}

interface EmptySeatProps {
  seat: number;
  onClick?: () => void;
}

function EmptySeat({ seat, onClick }: EmptySeatProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'w-14 h-14 rounded-full',
        'bg-black/60 border-2 border-dashed border-gray-600/50',
        'flex items-center justify-center',
        'text-gray-400/70 text-sm font-medium',
        'hover:bg-black/80 hover:border-gold/50 hover:text-gold/90',
        'transition-colors duration-200 cursor-pointer'
      )}
    >
      Sit
    </motion.button>
  );
}

interface DealerButtonProps {
  visualPosition: number;
  visible: boolean;
  seatPositions: { x: number; y: number; betX: number; betY: number }[];
}

function DealerButton({ visualPosition, visible, seatPositions }: DealerButtonProps) {
  if (!visible) return null;

  const pos = seatPositions[visualPosition];
  if (!pos) return null;

  const numSeats = seatPositions.length;

  // Position dealer button to the side of the player based on their position around the table
  // Calculate angle for this seat (same formula as seat positioning)
  const angleStep = 360 / numSeats;
  const angleDeg = 90 + (visualPosition * angleStep);
  const angleRad = (angleDeg * Math.PI) / 180;

  // Offset perpendicular to the direction from center (tangent to ellipse)
  // This places the dealer button to the side of the player, not toward center
  const tangentAngle = angleRad + Math.PI / 2; // 90 degrees from radial direction
  const offsetMagnitude = 6;
  let offsetX = offsetMagnitude * Math.cos(tangentAngle);
  let offsetY = offsetMagnitude * Math.sin(tangentAngle) * 0.7; // Reduce Y offset due to ellipse aspect ratio

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute dealer-button z-20"
      style={{
        left: `${pos.x + offsetX}%`,
        top: `${pos.y + offsetY}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      D
    </motion.div>
  );
}

// =============================================================================
// RUN-IT BOARDS DISPLAY
// =============================================================================

interface RunItBoardsDisplayProps {
  boards: Board[];
  finalChoice: 2 | 3;
}

/**
 * Display multiple run-it boards stacked vertically on the table
 * Similar layout to DualBoardCommunityCards but supports 2 or 3 boards
 */
function RunItBoardsDisplay({ boards, finalChoice }: RunItBoardsDisplayProps) {
  // Board colors for visual distinction
  const boardStyles = [
    { labelColor: 'text-gold', borderColor: 'border-gold/30' },
    { labelColor: 'text-purple-400', borderColor: 'border-purple-400/30' },
    { labelColor: 'text-blue-400', borderColor: 'border-blue-400/30' },
  ];

  return (
    <div className="flex flex-col gap-1 items-center">
      {boards.map((board, index) => (
        <div key={board.index} className="relative">
          {/* Board Label */}
          <div className={cn(
            "absolute -left-6 top-1/2 -translate-y-1/2",
            "text-[10px] font-bold tracking-wider uppercase",
            "bg-black/40 px-1.5 py-0.5 rounded",
            boardStyles[index]?.labelColor
          )}>
            {index + 1}
          </div>

          {/* Community Cards for this board */}
          <div className={cn(
            "flex gap-1.5 items-center justify-center",
            "p-1 rounded",
            boardStyles[index]?.borderColor,
            "border border-transparent"
          )}>
            {board.communityCards.map((card, cardIndex) => (
              <PlayingCard
                key={`${board.index}-${cardIndex}-${card.code}`}
                card={card}
                size="sm"
                animationDelay={index * 1.0 + cardIndex * 0.15}
                dramaticReveal={cardIndex === 4}
                dealFrom="top"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PlayerSeat } from './PlayerSeat';
