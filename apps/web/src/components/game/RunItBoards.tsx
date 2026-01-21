'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Board, Card } from '@poker/shared';
import { cn } from '@/lib/utils';
import { PlayingCard } from './PlayingCard';

interface RunItBoardsProps {
  boards: Board[];
  finalChoice: 1 | 2 | 3;
  className?: string;
}

/**
 * Run-it-twice/thrice boards display
 * Shows multiple boards stacked vertically with animation
 */
export function RunItBoards({ boards, finalChoice, className }: RunItBoardsProps) {
  if (!boards || boards.length === 0) return null;

  // Board colors for visual distinction
  const boardColors = [
    { label: 'gold', border: 'border-gold/50', bg: 'bg-gold/10', text: 'text-gold' },
    { label: 'purple', border: 'border-purple-500/50', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    { label: 'blue', border: 'border-blue-500/50', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  ];

  // Calculate animation delay for each card
  // Cards are revealed in sequence across all boards
  const getCardDelay = (boardIndex: number, cardIndex: number): number => {
    // Base delay per board (stagger board reveals)
    const boardDelay = boardIndex * 1.5; // 1.5s between boards

    // Card delays within a board
    if (cardIndex < 3) {
      // Flop: quick succession
      return boardDelay + cardIndex * 0.15;
    } else if (cardIndex === 3) {
      // Turn: pause after flop
      return boardDelay + 0.45 + 0.5;
    } else {
      // River: pause after turn
      return boardDelay + 0.45 + 0.5 + 0.5;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'flex flex-col gap-3 items-center',
          className
        )}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-gold font-semibold tracking-wide uppercase"
        >
          Running it {finalChoice === 2 ? 'Twice' : 'Three Times'}
        </motion.div>

        {/* Boards */}
        {boards.map((board, boardIndex) => (
          <motion.div
            key={board.index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: boardIndex * 0.3 }}
            className={cn(
              'relative rounded-lg p-3',
              boardColors[boardIndex]?.border,
              boardColors[boardIndex]?.bg,
              'border'
            )}
          >
            {/* Board Label */}
            <div className={cn(
              'absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full',
              'text-xs font-bold tracking-wider uppercase',
              'bg-dark-surface/90 px-2 py-1 rounded',
              boardColors[boardIndex]?.text
            )}>
              #{board.index + 1}
            </div>

            {/* Community Cards */}
            <div className="flex gap-1.5 items-center justify-center">
              {board.communityCards.map((card, cardIndex) => (
                <PlayingCard
                  key={`${board.index}-${cardIndex}-${card.code}`}
                  card={card}
                  size="sm"
                  animationDelay={getCardDelay(boardIndex, cardIndex)}
                  dramaticReveal={cardIndex === 4}
                  dealFrom="top"
                />
              ))}
            </div>

            {/* Pot Share */}
            <div className={cn(
              'absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full',
              'text-[10px] font-medium',
              'bg-dark-surface/90 px-2 py-1 rounded',
              'text-gray-400'
            )}>
              {Math.round(board.potShare / 2)}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
