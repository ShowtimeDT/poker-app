'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatChips } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface ActionFeedbackData {
  playerId: string;
  action: string;
  amount?: number;
  timestamp: number;
}

interface ActionFeedbackProps {
  action: ActionFeedbackData | null;
  position?: { x: number; y: number };
  onComplete?: () => void;
  className?: string;
}

// =============================================================================
// ACTION STYLES
// =============================================================================

const ACTION_STYLES: Record<string, {
  bg: string;
  text: string;
  border: string;
  glow: string;
  icon?: string;
}> = {
  fold: {
    bg: 'bg-gray-700',
    text: 'text-gray-200',
    border: 'border-gray-500/50',
    glow: 'shadow-none',
    icon: '🃏',
  },
  check: {
    bg: 'bg-purple-700',
    text: 'text-white',
    border: 'border-purple-500/50',
    glow: 'shadow-glow-purple',
    icon: '✓',
  },
  call: {
    bg: 'bg-emerald',
    text: 'text-white',
    border: 'border-emerald-light/50',
    glow: 'shadow-glow-emerald',
    icon: '📞',
  },
  bet: {
    bg: 'bg-gold',
    text: 'text-dark',
    border: 'border-gold-light/50',
    glow: 'shadow-glow-gold',
    icon: '💰',
  },
  raise: {
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-orange-400/50',
    glow: 'shadow-glow-fire',
    icon: '⬆️',
  },
  'all-in': {
    bg: 'bg-ruby',
    text: 'text-white',
    border: 'border-ruby-light/50',
    glow: 'shadow-glow-ruby',
    icon: '🚀',
  },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ActionFeedback({
  action,
  position,
  onComplete,
  className,
}: ActionFeedbackProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (action) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [action, onComplete]);

  if (!action) return null;

  const style = ACTION_STYLES[action.action.toLowerCase()] || ACTION_STYLES.check;
  const displayAction = action.action.toUpperCase().replace('-', ' ');

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 20,
          }}
          className={cn(
            'absolute z-30 pointer-events-none',
            className
          )}
          style={position ? { left: position.x, top: position.y } : undefined}
        >
          <div
            className={cn(
              'px-5 py-2.5 rounded-full font-bold text-base uppercase tracking-wider',
              'shadow-lg border-2 whitespace-nowrap',
              'flex items-center gap-2',
              style.bg,
              style.text,
              style.border,
              style.glow
            )}
          >
            {style.icon && <span className="text-lg">{style.icon}</span>}
            <span>{displayAction}</span>
            {action.amount !== undefined && action.amount > 0 && (
              <span className="font-mono ml-1">${formatChips(action.amount)}</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// TABLE ACTION FLASH - Brief flash on the table when action is taken
// =============================================================================

interface TableActionFlashProps {
  action: string | null;
  className?: string;
}

export function TableActionFlash({ action, className }: TableActionFlashProps) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (action) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [action]);

  const style = action ? ACTION_STYLES[action.toLowerCase()] || ACTION_STYLES.check : null;

  return (
    <AnimatePresence>
      {isFlashing && style && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute inset-0 rounded-[40%] pointer-events-none',
            style.bg,
            className
          )}
        />
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// ACTION HISTORY FEED - Shows recent actions in a feed
// =============================================================================

interface ActionHistoryProps {
  actions: ActionFeedbackData[];
  maxItems?: number;
  className?: string;
}

export function ActionHistory({
  actions,
  maxItems = 5,
  className,
}: ActionHistoryProps) {
  const recentActions = actions.slice(-maxItems);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <AnimatePresence mode="popLayout">
        {recentActions.map((action) => {
          const style = ACTION_STYLES[action.action.toLowerCase()] || ACTION_STYLES.check;
          return (
            <motion.div
              key={action.timestamp}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium',
                'flex items-center justify-between gap-2',
                'bg-black/40 border border-white/10'
              )}
            >
              <span className={cn('uppercase text-xs font-bold', style.text)}>
                {action.action}
              </span>
              {action.amount !== undefined && action.amount > 0 && (
                <span className="text-gold font-mono text-xs">
                  ${formatChips(action.amount)}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
