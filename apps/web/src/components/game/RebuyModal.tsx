'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatChips } from '@/lib/utils';
import { HouseRulesLogo } from '@/components/ui/HouseRulesLogo';

interface PendingPlayer {
  name: string;
  oderId: string;
  decided: boolean;
}

interface RebuyModalProps {
  isOpen: boolean;
  minBuyIn: number;
  maxBuyIn: number;
  onRebuy: (amount: number) => void;
  onClose: () => void;
  onDecline?: () => void;           // Sit out option (for waitForAllRebuys)
  hasConfirmedRebuy?: boolean;      // Already confirmed rebuy
  pendingPlayers?: PendingPlayer[]; // Other players still deciding
  timeoutAt?: number;               // Timestamp when auto-decline kicks in
}

export function RebuyModal({
  isOpen,
  minBuyIn,
  maxBuyIn,
  onRebuy,
  onClose,
  onDecline,
  hasConfirmedRebuy,
  pendingPlayers,
  timeoutAt,
}: RebuyModalProps) {
  const [amount, setAmount] = useState(maxBuyIn);
  const [inputValue, setInputValue] = useState(maxBuyIn.toString());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Reset amount to maxBuyIn when modal opens or maxBuyIn changes
  useEffect(() => {
    if (isOpen) {
      setAmount(maxBuyIn);
      setInputValue(maxBuyIn.toString());
    }
  }, [isOpen, maxBuyIn]);

  // Countdown timer
  useEffect(() => {
    if (!timeoutAt || !isOpen) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((timeoutAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timeoutAt, isOpen]);

  // Handle slider change
  const handleSliderChange = (value: number) => {
    setAmount(value);
    setInputValue(value.toString());
  };

  // Handle text input change
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Parse and validate the number
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      // Clamp to valid range
      const clamped = Math.min(Math.max(parsed, minBuyIn), maxBuyIn);
      setAmount(clamped);
    }
  };

  // Handle input blur - clamp the display value
  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < minBuyIn) {
      setAmount(minBuyIn);
      setInputValue(minBuyIn.toString());
    } else if (parsed > maxBuyIn) {
      setAmount(maxBuyIn);
      setInputValue(maxBuyIn.toString());
    } else {
      setAmount(parsed);
      setInputValue(parsed.toString());
    }
  };

  const handleRebuy = () => {
    if (amount >= minBuyIn && amount <= maxBuyIn) {
      onRebuy(amount);
    }
  };

  // Calculate who's still deciding
  const playersStillDeciding = pendingPlayers?.filter(p => !p.decided) || [];
  const isWaitingForOthers = hasConfirmedRebuy && playersStillDeciding.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-surface border border-purple-700/50 rounded-xl p-6 w-full max-w-md shadow-2xl"
          >
            {/* Header with Logo */}
            <div className="text-center mb-6">
              <div className="mb-3 opacity-60">
                <HouseRulesLogo size="sm" shimmer={false} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {hasConfirmedRebuy ? 'Rebuy Confirmed!' : 'Out of Chips!'}
              </h2>
              <p className="text-gray-400">
                {hasConfirmedRebuy
                  ? 'Waiting for other players to decide...'
                  : 'Would you like to rebuy and continue playing?'}
              </p>
            </div>

            {/* Timer (only show when waitForAllRebuys is active) */}
            {timeRemaining !== null && !hasConfirmedRebuy && (
              <div className="text-center mb-4">
                <span className={cn(
                  "text-lg font-mono font-bold",
                  timeRemaining <= 10 ? "text-red-400" : "text-gold"
                )}>
                  {timeRemaining}s
                </span>
                <span className="text-gray-500 text-sm ml-2">to decide</span>
              </div>
            )}

            {/* Amount Selection - only show if not already confirmed */}
            {!hasConfirmedRebuy && (
              <div className="space-y-4 mb-6">
                {/* Text Input */}
                <div className="flex justify-center">
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onBlur={handleInputBlur}
                    min={minBuyIn}
                    max={maxBuyIn}
                    className="w-32 text-center text-xl font-bold bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gold focus:outline-none focus:border-gold"
                  />
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min={minBuyIn}
                    max={maxBuyIn}
                    step={Math.max(1, Math.floor((maxBuyIn - minBuyIn) / 100))}
                    value={amount}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gold"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatChips(minBuyIn)}</span>
                    <span className="text-gold font-bold text-lg">{formatChips(amount)}</span>
                    <span>{formatChips(maxBuyIn)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting for others indicator */}
            {isWaitingForOthers && (
              <div className="mb-6 p-4 bg-purple-900/30 border border-purple-700/50 rounded-lg">
                <h3 className="text-sm font-medium text-purple-300 mb-2">
                  Waiting for {playersStillDeciding.length} player{playersStillDeciding.length > 1 ? 's' : ''}:
                </h3>
                <div className="space-y-1">
                  {playersStillDeciding.map(p => (
                    <div key={p.oderId} className="flex items-center gap-2 text-gray-400 text-sm">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
                {timeRemaining !== null && (
                  <p className="text-xs text-gray-500 mt-2">
                    Auto-sit out in {timeRemaining}s if they don't decide
                  </p>
                )}
              </div>
            )}

            {/* Players who've decided (show if waiting for others) */}
            {pendingPlayers && pendingPlayers.some(p => p.decided) && isWaitingForOthers && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-gray-500 mb-1">Already decided:</h3>
                <div className="flex flex-wrap gap-1">
                  {pendingPlayers.filter(p => p.decided).map(p => (
                    <span key={p.oderId} className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {hasConfirmedRebuy ? (
                // Already confirmed - show waiting state
                <button
                  disabled
                  className="flex-1 py-3 px-4 rounded-lg bg-green-700/50 text-green-300 font-bold cursor-not-allowed"
                >
                  Rebuy Confirmed ✓
                </button>
              ) : (
                <>
                  <button
                    onClick={onDecline || onClose}
                    className="flex-1 py-3 px-4 rounded-lg bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition-colors"
                  >
                    {onDecline ? 'Sit Out' : 'Leave Table'}
                  </button>
                  <button
                    onClick={handleRebuy}
                    className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-gold to-yellow-500 text-black font-bold hover:opacity-90 transition-opacity"
                  >
                    Rebuy {formatChips(amount)}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
