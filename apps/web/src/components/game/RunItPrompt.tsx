'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { RunItChoice, RunItPrompt as RunItPromptType } from '@poker/shared';

interface RunItPromptProps {
  prompt: RunItPromptType | null;
  currentPlayerId: string | null;
  timeRemaining: number;
  showThrice: boolean;
  onSelect: (choice: RunItChoice) => void;
  onConfirm: () => void;
  players: { oderId: string; name: string }[]; // For displaying player names
}

/**
 * Run it twice/thrice decision prompt - appears when all-in with cards to come
 *
 * Voting behavior:
 * - Players click an option tile to select it (shows at 50% opacity)
 * - Players can change their selection before confirming
 * - Click "Confirm" to lock in choice (shows at 100% opacity)
 * - Both confirm same choice = timer ends early
 * - Timer expires = use whatever each player clicked (no click = "once")
 */
export function RunItPrompt({
  prompt,
  currentPlayerId,
  timeRemaining,
  showThrice,
  onSelect,
  onConfirm,
  players,
}: RunItPromptProps) {
  if (!prompt || !currentPlayerId) return null;

  // Check if current player is eligible
  const isEligible = prompt.eligiblePlayerIds.includes(currentPlayerId);
  const myChoice = prompt.choices.find(c => c.playerId === currentPlayerId);
  const hasSelected = myChoice?.choice !== null;
  const hasConfirmed = myChoice?.confirmed === true;

  if (!isEligible) return null;

  const progress = Math.max(0, (timeRemaining / 5) * 100); // 5 second timeout

  // Get players who selected each option
  const getPlayersForChoice = (choice: RunItChoice) => {
    return prompt.choices
      .filter(c => c.choice === choice)
      .map(c => {
        const player = players.find(p => p.oderId === c.playerId);
        return {
          playerId: c.playerId,
          name: player?.name || 'Player',
          confirmed: c.confirmed,
        };
      });
  };

  const oncePlayers = getPlayersForChoice(1);
  const twicePlayers = getPlayersForChoice(2);
  const thricePlayers = getPlayersForChoice(3);

  // Helper to get player initials
  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

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
          'text-center min-w-[400px] max-w-[500px]'
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
            All-in with cards to come. Select your choice and confirm.
            <br />
            <span className="text-xs text-gold">Both must agree to run multiple times</span>
          </p>

          {/* Option tiles */}
          <div className="flex gap-3 justify-center mb-4">
            {/* Once tile */}
            <OptionTile
              label="Once"
              choice={1}
              selected={myChoice?.choice === 1}
              confirmed={hasConfirmed}
              disabled={hasConfirmed}
              players={oncePlayers}
              onSelect={() => onSelect(1)}
              getInitials={getInitials}
              color="gray"
            />

            {/* Twice tile */}
            <OptionTile
              label="Twice"
              choice={2}
              selected={myChoice?.choice === 2}
              confirmed={hasConfirmed}
              disabled={hasConfirmed}
              players={twicePlayers}
              onSelect={() => onSelect(2)}
              getInitials={getInitials}
              color="gold"
            />

            {/* Thrice tile */}
            {showThrice && (
              <OptionTile
                label="3 Times"
                choice={3}
                selected={myChoice?.choice === 3}
                confirmed={hasConfirmed}
                disabled={hasConfirmed}
                players={thricePlayers}
                onSelect={() => onSelect(3)}
                getInitials={getInitials}
                color="purple"
              />
            )}
          </div>

          {/* Confirm button */}
          {hasSelected && !hasConfirmed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onConfirm}
              className={cn(
                'px-8 py-3 rounded-lg font-bold text-lg',
                'bg-green-600 text-white',
                'hover:bg-green-500 transition-colors',
                'shadow-lg'
              )}
            >
              Confirm
            </motion.button>
          )}

          {hasConfirmed && (
            <p className="text-green-400 font-semibold">
              ✓ Confirmed: {myChoice?.choice === 1 ? 'Once' : myChoice?.choice === 2 ? 'Twice' : '3 Times'}
            </p>
          )}

          {/* Status */}
          <p className="text-xs text-gray-500 mt-4">
            {hasConfirmed
              ? 'Waiting for other players...'
              : hasSelected
                ? 'Click Confirm to lock in your choice'
                : 'Click an option to select'
            }
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface OptionTileProps {
  label: string;
  choice: RunItChoice;
  selected: boolean;
  confirmed: boolean;
  disabled: boolean;
  players: { playerId: string; name: string; confirmed: boolean }[];
  onSelect: () => void;
  getInitials: (name: string) => string;
  color: 'gray' | 'gold' | 'purple';
}

function OptionTile({
  label,
  choice,
  selected,
  confirmed,
  disabled,
  players,
  onSelect,
  getInitials,
  color,
}: OptionTileProps) {
  const bgColor = {
    gray: selected ? 'bg-gray-600' : 'bg-gray-700',
    gold: selected ? 'bg-gold' : 'bg-gold/70',
    purple: selected ? 'bg-purple-600' : 'bg-purple-600/70',
  }[color];

  const textColor = color === 'gold' ? 'text-black' : 'text-white';
  const borderColor = selected ? 'border-white' : 'border-transparent';

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center p-4 rounded-lg font-semibold min-w-[100px]',
        bgColor,
        textColor,
        'border-2',
        borderColor,
        !disabled && 'hover:opacity-90 transition-all',
        disabled && 'cursor-not-allowed'
      )}
    >
      <span className="text-lg mb-2">{label}</span>

      {/* Player avatars */}
      <div className="flex gap-1 min-h-[32px]">
        {players.map(p => (
          <div
            key={p.playerId}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
              'bg-dark-bg border border-white/30',
              p.confirmed ? 'opacity-100' : 'opacity-50'
            )}
            title={`${p.name}${p.confirmed ? ' (confirmed)' : ''}`}
          >
            {getInitials(p.name)}
          </div>
        ))}
      </div>
    </button>
  );
}
