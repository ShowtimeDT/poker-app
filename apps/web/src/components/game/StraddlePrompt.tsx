'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatChips } from '@/lib/utils';

interface StraddlePromptProps {
  isVisible: boolean;
  amount: number;
  timeRemaining: number;
  previousStraddlerName?: string;
  isDoubleStraddle?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Straddle prompt modal - appears when it's player's turn to straddle
 */
export function StraddlePrompt({
  isVisible,
  amount,
  timeRemaining,
  previousStraddlerName,
  isDoubleStraddle,
  onAccept,
  onDecline,
}: StraddlePromptProps) {
  const progress = Math.max(0, (timeRemaining / 5) * 100); // 5 second timeout

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40"
        >
          <div className={cn(
            'bg-dark-surface/95 backdrop-blur-md',
            'border border-gold/50 rounded-xl',
            'px-6 py-4 shadow-xl',
            'text-center min-w-[280px]'
          )}>
            {/* Timer progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700 rounded-t-xl overflow-hidden">
              <motion.div
                className="h-full bg-gold"
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Title and context */}
            {isDoubleStraddle && previousStraddlerName ? (
              <>
                <p className="text-sm text-gray-400 mb-1">
                  {previousStraddlerName} straddled
                </p>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Double straddle?
                </h3>
              </>
            ) : (
              <h3 className="text-lg font-semibold text-white mb-2">
                Straddle?
              </h3>
            )}

            {/* Amount */}
            <p className="text-2xl font-bold text-gold mb-4">
              {formatChips(amount)}
            </p>

            {/* Time remaining */}
            <p className="text-sm text-gray-400 mb-4">
              {timeRemaining}s remaining
            </p>

            {/* Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={onDecline}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium',
                  'bg-gray-700 text-white',
                  'hover:bg-gray-600 transition-colors'
                )}
              >
                No
              </button>
              <button
                onClick={onAccept}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium',
                  'bg-gold text-black',
                  'hover:bg-gold-light transition-colors'
                )}
              >
                Yes
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
