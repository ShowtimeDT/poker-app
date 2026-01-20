'use client';

import { motion } from 'framer-motion';
import type { Card, Suit, GamePhase } from '@poker/shared';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  animationDelay?: number;
  onClick?: () => void;
  isWinner?: boolean;
  dealFrom?: 'dealer' | 'top' | 'left' | 'right';
  dramaticReveal?: boolean;
  variant?: 'normal' | 'ghost';  // Ghost cards shown with gold styling
}

const sizeClasses = {
  xs: 'w-9 h-[3.25rem] text-[10px]',
  sm: 'w-12 h-[4.5rem] text-xs',
  md: 'w-16 h-[5.5rem] text-sm',
  lg: 'w-24 h-32 text-base',
};

const suitSymbols: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<Suit, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

// Deal animation variants based on source
const dealVariants = {
  dealer: {
    initial: { x: -200, y: -100, rotate: -20, scale: 0.3, opacity: 0 },
    animate: { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
  },
  top: {
    initial: { y: -150, rotate: -10, scale: 0.5, opacity: 0 },
    animate: { y: 0, rotate: 0, scale: 1, opacity: 1 },
  },
  left: {
    initial: { x: -150, rotate: -15, scale: 0.5, opacity: 0 },
    animate: { x: 0, rotate: 0, scale: 1, opacity: 1 },
  },
  right: {
    initial: { x: 150, rotate: 15, scale: 0.5, opacity: 0 },
    animate: { x: 0, rotate: 0, scale: 1, opacity: 1 },
  },
};

export function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  className,
  animationDelay = 0,
  onClick,
  isWinner = false,
  dealFrom = 'dealer',
  dramaticReveal = false,
  variant = 'normal',
}: PlayingCardProps) {
  const showBack = faceDown || !card;
  const dealVariant = dealVariants[dealFrom];
  const isGhost = variant === 'ghost';

  return (
    <motion.div
      initial={{ ...dealVariant.initial, rotateY: showBack ? 180 : 0 }}
      animate={{
        ...dealVariant.animate,
        rotateY: showBack ? 180 : 0,
        filter: isWinner ? 'brightness(1.1)' : 'brightness(1)',
      }}
      transition={{
        delay: animationDelay,
        duration: dramaticReveal ? 2.5 : 0.5,
        type: 'spring',
        stiffness: dramaticReveal ? 80 : 300,
        damping: dramaticReveal ? 12 : 20,
      }}
      whileHover={onClick ? { y: -8, scale: 1.05 } : undefined}
      onClick={onClick}
      className={cn(
        'relative rounded-lg shadow-card cursor-default select-none',
        sizeClasses[size],
        onClick && 'cursor-pointer',
        isWinner && 'shadow-card-winner winner-glow',
        // Ghost card styling - gold border and semi-transparent
        isGhost
          ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-gold opacity-85'
          : 'bg-white',
        className
      )}
      style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
    >
      {/* Card Front */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg p-1.5 overflow-hidden',
          'backface-hidden',
          showBack && 'invisible',
          isGhost ? 'bg-gradient-to-br from-amber-50 to-amber-100' : 'bg-white'
        )}
        style={{ backfaceVisibility: 'hidden' }}
      >
        {/* Light reflection/shine effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
            transform: 'translateX(-100%)',
          }}
        />

        {card && (
          <>
            {/* Top left */}
            <div className={cn('absolute top-1 left-1.5 flex flex-col items-center leading-none', suitColors[card.suit])}>
              <span className="font-bold">{card.rank}</span>
              <span>{suitSymbols[card.suit]}</span>
            </div>

            {/* Center suit */}
            <div className={cn('absolute inset-0 flex items-center justify-center', suitColors[card.suit])}>
              <span className={cn(
                size === 'xs' && 'text-2xl',
                size === 'sm' && 'text-4xl',
                size === 'md' && 'text-5xl',
                size === 'lg' && 'text-7xl',
                'drop-shadow-sm'
              )}>
                {suitSymbols[card.suit]}
              </span>
            </div>

            {/* Bottom right (inverted) */}
            <div className={cn('absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180', suitColors[card.suit])}>
              <span className="font-bold">{card.rank}</span>
              <span>{suitSymbols[card.suit]}</span>
            </div>
          </>
        )}
      </div>

      {/* Card Back */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg playing-card-back',
          'backface-hidden',
          !showBack && 'invisible'
        )}
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        {/* Decorative pattern */}
        <div className="absolute inset-2 rounded border border-gold/30 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-gold/40 flex items-center justify-center">
            <span className="text-gold/60 text-xl">♠</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface CardFanProps {
  cards: Card[];
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  spread?: number;
}

export function CardFan({
  cards,
  faceDown = false,
  size = 'md',
  className,
  spread = 15,
}: CardFanProps) {
  const offset = (cards.length - 1) * spread / 2;

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {cards.map((card, index) => (
        <motion.div
          key={card.code}
          initial={{ x: 0, rotate: 0 }}
          animate={{
            x: (index * spread) - offset,
            rotate: ((index - (cards.length - 1) / 2) * 5),
          }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          className="absolute"
          style={{ zIndex: index }}
        >
          <PlayingCard
            card={card}
            faceDown={faceDown}
            size={size}
            animationDelay={index * 0.1}
          />
        </motion.div>
      ))}
    </div>
  );
}

interface CommunityCardsProps {
  cards: Card[];
  ghostCards?: Card[];  // Cards that "would have come" - displayed in gold styling
  className?: string;
  winningCardCodes?: string[];
  isRunout?: boolean;
  runoutStartPhase?: GamePhase;
}

interface DualBoardCommunityCardsProps {
  board1Cards: Card[];
  board2Cards: Card[];
  className?: string;
  winningCardCodes1?: string[];
  winningCardCodes2?: string[];
  isRunout?: boolean;
  runoutStartPhase?: GamePhase;
}

/**
 * Dual-board community cards display for bomb pots
 * Shows two separate boards stacked vertically with compact spacing
 */
export function DualBoardCommunityCards({
  board1Cards,
  board2Cards,
  className,
  winningCardCodes1 = [],
  winningCardCodes2 = [],
  isRunout,
  runoutStartPhase,
}: DualBoardCommunityCardsProps) {
  return (
    <div className={cn('flex flex-col gap-1 items-center', className)}>
      {/* Board 1 Section */}
      <div className="relative">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] text-gold font-bold tracking-wider uppercase bg-black/40 px-1.5 py-0.5 rounded">
          1
        </div>
        <CommunityCards
          cards={board1Cards}
          winningCardCodes={winningCardCodes1}
          isRunout={isRunout}
          runoutStartPhase={runoutStartPhase}
        />
      </div>

      {/* Board 2 Section */}
      <div className="relative">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] text-purple-400 font-bold tracking-wider uppercase bg-black/40 px-1.5 py-0.5 rounded">
          2
        </div>
        <CommunityCards
          cards={board2Cards}
          winningCardCodes={winningCardCodes2}
          isRunout={isRunout}
          runoutStartPhase={runoutStartPhase}
        />
      </div>
    </div>
  );
}

interface GhostCardsProps {
  cards: Card[];
  className?: string;
}

/**
 * Ghost cards display - shows what "would have come" when everyone folds
 * Displayed in gold styling with a label
 */
export function GhostCards({ cards, className }: GhostCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className={cn('flex flex-col items-center gap-2', className)}
    >
      <div className="text-xs text-gold/80 font-medium tracking-wide uppercase">
        What would have come...
      </div>
      <div className="flex gap-2">
        {cards.map((card, index) => (
          <PlayingCard
            key={card.code}
            card={card}
            size="sm"
            variant="ghost"
            animationDelay={0.5 + index * 0.15}
            dealFrom="top"
          />
        ))}
      </div>
    </motion.div>
  );
}

export function CommunityCards({ cards, ghostCards = [], className, winningCardCodes = [], isRunout, runoutStartPhase }: CommunityCardsProps) {
  // Merge regular cards and ghost cards into 5 slots
  // Regular cards first, then ghost cards fill remaining slots
  const mergedSlots: { card: Card | null; isGhost: boolean }[] = Array(5).fill(null).map((_, i) => {
    if (i < cards.length) {
      return { card: cards[i], isGhost: false };
    }
    const ghostIndex = i - cards.length;
    if (ghostIndex < ghostCards.length) {
      return { card: ghostCards[ghostIndex], isGhost: true };
    }
    return { card: null, isGhost: false };
  });

  // Calculate runout card delay for dramatic all-in reveals
  // Cards dealt before runout started: no delay (already visible)
  // Cards dealt during runout: staggered delays for suspense
  const getRunoutCardDelay = (index: number, startPhase: GamePhase): number => {
    const phaseToFirstCard: Record<string, number> = {
      'preflop': 0,  // Flop starts at index 0
      'flop': 3,     // Turn is index 3
      'turn': 4,     // River is index 4
    };

    const firstRunoutCard = phaseToFirstCard[startPhase] ?? 0;

    // Cards before runout: no delay (already visible)
    if (index < firstRunoutCard) return 0;

    // Dramatic timing for runout:
    // - Flop cards: quick succession (0.15s apart)
    // - 2 second pause before turn
    // - 3 second pause before river (with slow 2.5s animation)
    if (startPhase === 'preflop') {
      // Full runout from preflop
      if (index < 3) {
        // Flop cards: quick succession
        return index * 0.15;
      } else if (index === 3) {
        // Turn: flop time (~0.5s) + 2s pause
        return 0.5 + 2.0;
      } else {
        // River: turn time + 3s pause
        return 0.5 + 2.0 + 3.0;
      }
    } else if (startPhase === 'flop') {
      // Runout from flop (turn + river)
      if (index === 3) {
        // Turn: 2s pause
        return 2.0;
      } else {
        // River: turn + 3s pause
        return 2.0 + 3.0;
      }
    } else if (startPhase === 'turn') {
      // Runout from turn (just river)
      // River: 3s pause for dramatic effect
      return 3.0;
    }

    return 0;
  };

  // Determine animation delays based on street (normal play)
  // Flop (first 3): quick succession
  // Turn (4th): dramatic pause then reveal
  // River (5th): most dramatic reveal
  const getAnimationDelay = (index: number, cardCount: number) => {
    if (index < 3) {
      // Flop: quick succession with 0.15s between each
      return index * 0.15;
    } else if (index === 3) {
      // Turn: dramatic pause (0.6s base)
      return cardCount === 4 ? 0.3 : 0.45 + index * 0.15;
    } else {
      // River: most dramatic (0.8s base)
      return cardCount === 5 ? 0.4 : 0.6 + index * 0.15;
    }
  };

  const isDramaticReveal = (index: number, cardCount: number) => {
    // Turn and river get dramatic reveals in normal play
    // During runout, river always gets dramatic reveal
    if (isRunout && index === 4) return true;
    return (index === 3 && cardCount === 4) || (index === 4 && cardCount === 5);
  };

  // Determine if a card is part of the runout sequence
  const isRunoutCard = (index: number): boolean => {
    if (!isRunout || !runoutStartPhase) return false;
    const phaseToFirstCard: Record<string, number> = {
      'preflop': 0,
      'flop': 3,
      'turn': 4,
    };
    const firstRunoutCard = phaseToFirstCard[runoutStartPhase] ?? 0;
    return index >= firstRunoutCard;
  };

  // Ghost cards get a delayed appearance after regular cards
  const getGhostCardDelay = (index: number): number => {
    // Start ghost cards after a brief pause (0.5s) following last regular card
    const baseDelay = 0.5;
    const ghostIndex = index - cards.length;
    return baseDelay + ghostIndex * 0.15;
  };

  return (
    <div className={cn('flex gap-2 items-center justify-center', className)}>
      {mergedSlots.map(({ card, isGhost }, index) => {
        // Use appropriate timing based on card type
        let animationDelay: number;
        if (isGhost) {
          animationDelay = getGhostCardDelay(index);
        } else if (isRunout && runoutStartPhase && isRunoutCard(index)) {
          animationDelay = getRunoutCardDelay(index, runoutStartPhase);
        } else {
          animationDelay = getAnimationDelay(index, cards.length);
        }

        return (
          <div key={index} className="relative">
            {card ? (
              <PlayingCard
                card={card}
                size="md"
                animationDelay={animationDelay}
                dramaticReveal={!isGhost && isDramaticReveal(index, cards.length)}
                dealFrom="top"
                isWinner={!isGhost && winningCardCodes.includes(card.code)}
                variant={isGhost ? 'ghost' : 'normal'}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="w-16 h-[5.5rem] rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-900/20 relative"
              >
                {/* Subtle glow effect on empty slots */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-gold/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
