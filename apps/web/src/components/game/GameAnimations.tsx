'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Card, ActionType, WinnerInfo } from '@poker/shared';

// =============================================================================
// CARD DEAL ANIMATION
// =============================================================================

interface CardDealAnimationProps {
  cards: Card[];
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  delay?: number;
  onComplete?: () => void;
}

export function CardDealAnimation({
  cards,
  fromPosition,
  toPosition,
  delay = 0,
  onComplete,
}: CardDealAnimationProps) {
  return (
    <AnimatePresence>
      {cards.map((card, index) => (
        <motion.div
          key={card.code}
          initial={{
            x: fromPosition.x,
            y: fromPosition.y,
            scale: 0.3,
            rotate: 0,
          }}
          animate={{
            x: toPosition.x,
            y: toPosition.y,
            scale: 1,
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            delay: delay + index * 0.15,
            duration: 0.5,
            type: 'spring',
            stiffness: 300,
            damping: 25,
          }}
          onAnimationComplete={index === cards.length - 1 ? onComplete : undefined}
          className="absolute pointer-events-none"
        >
          <div className="w-16 h-24 rounded-lg playing-card-back shadow-lg" />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// =============================================================================
// CHIP MOVEMENT ANIMATION
// =============================================================================

interface ChipMovementProps {
  amount: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay?: number;
  onComplete?: () => void;
}

export function ChipMovement({
  amount,
  from,
  to,
  delay = 0,
  onComplete,
}: ChipMovementProps) {
  const numChips = Math.min(Math.ceil(Math.log10(amount + 1)), 5);

  return (
    <AnimatePresence>
      {Array.from({ length: numChips }).map((_, index) => (
        <motion.div
          key={index}
          initial={{
            x: from.x,
            y: from.y,
            scale: 0.5,
            opacity: 0,
          }}
          animate={{
            x: to.x + (index - numChips / 2) * 8,
            y: to.y,
            scale: 1,
            opacity: 1,
          }}
          exit={{
            scale: 0,
            opacity: 0,
          }}
          transition={{
            delay: delay + index * 0.05,
            duration: 0.4,
            type: 'spring',
          }}
          onAnimationComplete={index === numChips - 1 ? onComplete : undefined}
          className="absolute w-8 h-8 rounded-full bg-gold border-4 border-dashed border-gold-light shadow-lg"
        />
      ))}
    </AnimatePresence>
  );
}

// =============================================================================
// ACTION FEEDBACK ANIMATION
// =============================================================================

interface ActionFeedbackProps {
  action: ActionType;
  amount?: number;
  playerName: string;
  position: { x: number; y: number };
}

const actionLabels: Record<ActionType, { text: string; color: string }> = {
  fold: { text: 'FOLD', color: 'bg-gray-600' },
  check: { text: 'CHECK', color: 'bg-blue-500' },
  call: { text: 'CALL', color: 'bg-green-500' },
  bet: { text: 'BET', color: 'bg-gold' },
  raise: { text: 'RAISE', color: 'bg-purple-500' },
  'all-in': { text: 'ALL IN!', color: 'bg-accent-red' },
};

export function ActionFeedback({
  action,
  amount,
  playerName,
  position,
}: ActionFeedbackProps) {
  const { text, color } = actionLabels[action];

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0, y: -20 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="absolute pointer-events-none z-30"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={cn(
          'px-4 py-2 rounded-lg text-white font-bold text-lg',
          'shadow-lg border-2 border-white/20',
          color
        )}
      >
        {text}
        {amount && amount > 0 && (
          <span className="ml-2 font-mono">
            {amount.toLocaleString()}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// WINNER CELEBRATION ANIMATION
// =============================================================================

interface WinnerCelebrationProps {
  winners: WinnerInfo[];
  onDismiss?: () => void;
}

export function WinnerCelebration({ winners, onDismiss }: WinnerCelebrationProps) {
  if (winners.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
    >
      <motion.div
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.5, y: 50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="glass-gold rounded-2xl p-8 text-center max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: '50%',
                y: '-10%',
                rotate: 0,
                scale: 0,
              }}
              animate={{
                x: `${20 + Math.random() * 60}%`,
                y: `${80 + Math.random() * 40}%`,
                rotate: Math.random() * 360,
                scale: [0, 1, 1, 0.5],
              }}
              transition={{
                duration: 2,
                delay: i * 0.05,
                ease: 'easeOut',
              }}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: ['#ffd700', '#c0c0c0', '#cd7f32', '#9333ea'][
                  i % 4
                ],
              }}
            />
          ))}
        </div>

        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="text-5xl mb-4"
        >
          🏆
        </motion.div>

        <h2 className="text-3xl font-display font-bold text-gold mb-6">
          {winners.length === 1 ? 'Winner!' : 'Winners!'}
        </h2>

        <div className="space-y-4">
          {winners.map((winner, i) => (
            <motion.div
              key={i}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-purple-900/40 rounded-xl p-4"
            >
              <div className="text-white font-semibold text-xl">
                {winner.playerId}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring' }}
                className="text-gold text-3xl font-mono font-bold mt-1"
              >
                +{winner.amount.toLocaleString()}
              </motion.div>
              {winner.hand && (
                <div className="text-purple-300 text-sm mt-2">
                  {winner.hand.description}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <p className="text-gray-400 text-sm mt-6">
          Click anywhere to continue
        </p>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// TURN TIMER
// =============================================================================

interface TurnTimerProps {
  duration: number; // seconds
  onTimeout?: () => void;
  className?: string;
}

export function TurnTimer({ duration, onTimeout, className }: TurnTimerProps) {
  return (
    <motion.div
      className={cn('relative w-16 h-16', className)}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
    >
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-purple-800/50"
        />
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-gold"
          strokeDasharray={175.93}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: 175.93 }}
          transition={{ duration, ease: 'linear' }}
          onAnimationComplete={onTimeout}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-gold font-bold text-lg"
        >
          ⏱
        </motion.span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// PULSE RING ANIMATION
// =============================================================================

interface PulseRingProps {
  color?: string;
  size?: number;
  className?: string;
}

export function PulseRing({ color = 'gold', size = 80, className }: PulseRingProps) {
  return (
    <div
      className={cn('absolute pointer-events-none', className)}
      style={{ width: size, height: size }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeOut',
          }}
          className={cn(
            'absolute inset-0 rounded-full border-2',
            color === 'gold' && 'border-gold',
            color === 'red' && 'border-accent-red',
            color === 'green' && 'border-accent-green'
          )}
        />
      ))}
    </div>
  );
}
