'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { RunItChoice, RunItPrompt as RunItPromptType } from '@poker/shared';

interface RunItPromptProps {
  prompt: RunItPromptType | null;
  currentPlayerId: string | null;
  timeRemaining: number;
  showThrice: boolean;
  onChoice: (choice: RunItChoice) => void;
}

/**
 * Run it twice/thrice decision prompt - appears when all-in with cards to come
 */
export function RunItPrompt({
  prompt,
  currentPlayerId,
  timeRemaining,
  showThrice,
  onChoice,
}: RunItPromptProps) {
  if (!prompt || !currentPlayerId) return null;

  // Check if current player is eligible
  const isEligible = prompt.eligiblePlayerIds.includes(currentPlayerId);
  const myChoice = prompt.choices.find(c => c.playerId === currentPlayerId);
  const hasChosen = myChoice?.choice !== null;

  if (!isEligible) return null;

  const progress = Math.max(0, (timeRemaining / 5) * 100); // 5 second timeout

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <div className={cn(
          'bg-dark-surface/95 backdrop-blur-md',
          'border border-gold/50 rounded-xl',
          'px-8 py-6 shadow-2xl',
          'text-center min-w-[320px] max-w-[400px]'
        )}>
          {/* Timer circle */}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-700"
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
                animate={{ strokeDashoffset: 175.93 * (1 - progress / 100) }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
              {timeRemaining}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-2">
            Run It Out?
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-6">
            All-in with cards to come. How many times?
            <br />
            <span className="text-xs text-gold">Lowest choice wins</span>
          </p>

          {/* Choice buttons */}
          {!hasChosen ? (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => onChoice(1)}
                className={cn(
                  'px-5 py-3 rounded-lg font-semibold',
                  'bg-gray-700 text-white',
                  'hover:bg-gray-600 transition-colors',
                  'border-2 border-transparent hover:border-gray-500'
                )}
              >
                Once
              </button>
              <button
                onClick={() => onChoice(2)}
                className={cn(
                  'px-5 py-3 rounded-lg font-semibold',
                  'bg-gold text-black',
                  'hover:bg-gold-light transition-colors',
                  'border-2 border-transparent hover:border-gold-light'
                )}
              >
                Twice
              </button>
              {showThrice && (
                <button
                  onClick={() => onChoice(3)}
                  className={cn(
                    'px-5 py-3 rounded-lg font-semibold',
                    'bg-purple-600 text-white',
                    'hover:bg-purple-500 transition-colors',
                    'border-2 border-transparent hover:border-purple-400'
                  )}
                >
                  3 Times
                </button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gold font-semibold">
                You chose: {myChoice?.choice === 1 ? 'Once' : myChoice?.choice === 2 ? 'Twice' : '3 Times'}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Waiting for other players...
              </p>
            </div>
          )}

          {/* Other players' choices */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Choices:</p>
            <div className="flex justify-center gap-2">
              {prompt.choices.map((c, i) => (
                <div
                  key={c.playerId}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    c.choice === null
                      ? 'bg-gray-700 text-gray-400'
                      : c.choice === 1
                      ? 'bg-gray-600 text-white'
                      : c.choice === 2
                      ? 'bg-gold text-black'
                      : 'bg-purple-600 text-white'
                  )}
                >
                  {c.choice === null ? '?' : c.choice}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
