'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { SevenDeuceBonusInfo } from '@poker/shared';
import { cn, formatChips } from '@/lib/utils';

interface SevenDeuceCelebrationProps {
  bonus: SevenDeuceBonusInfo | null;
  winnerName?: string;
  onClose?: () => void;
}

/**
 * Celebration overlay when a player wins with 7-2
 */
export function SevenDeuceCelebration({ bonus, winnerName, onClose }: SevenDeuceCelebrationProps) {
  if (!bonus) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotateX: -20 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
            delay: 0.1,
          }}
          className={cn(
            'relative px-8 py-6 rounded-2xl',
            'bg-gradient-to-br from-purple-900 to-purple-950',
            'border-2 border-gold',
            'shadow-2xl shadow-gold/30',
            'text-center'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Confetti/sparkle effects */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  opacity: 0,
                  x: '50%',
                  y: '50%',
                }}
                animate={{
                  opacity: [0, 1, 0],
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                }}
                transition={{
                  duration: 1.5,
                  delay: Math.random() * 0.5,
                  repeat: Infinity,
                  repeatDelay: Math.random() * 2,
                }}
                className="absolute w-2 h-2 rounded-full bg-gold/60"
                style={{
                  filter: 'blur(1px)',
                }}
              />
            ))}
          </div>

          {/* Card icons */}
          <div className="flex justify-center gap-2 mb-3">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-12 h-16 rounded-lg bg-white flex items-center justify-center shadow-lg"
            >
              <span className="text-2xl font-bold text-gray-800">7</span>
            </motion.div>
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="w-12 h-16 rounded-lg bg-white flex items-center justify-center shadow-lg"
            >
              <span className="text-2xl font-bold text-gray-800">2</span>
            </motion.div>
          </div>

          {/* Title */}
          <motion.h2
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 400 }}
            className="text-3xl font-display font-bold text-gold mb-2"
          >
            7-2 WINNER!
          </motion.h2>

          {/* Winner name */}
          {winnerName && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-white mb-3"
            >
              {winnerName}
            </motion.p>
          )}

          {/* Bonus amount */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 300 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/20 border border-gold/50"
          >
            <span className="text-gold font-bold text-xl">
              +{formatChips(bonus.totalBonus)}
            </span>
            <span className="text-gold/70 text-sm">bonus</span>
          </motion.div>

          {/* Click to dismiss hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-4 text-xs text-gray-400"
          >
            Click anywhere to dismiss
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
