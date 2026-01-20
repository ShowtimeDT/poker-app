'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface StreakIndicatorProps {
  streak: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

interface StreakConfig {
  flames: number;
  label: string;
  bgGradient: string;
  glowColor: string;
  textColor: string;
}

// =============================================================================
// STREAK CONFIGURATION
// =============================================================================

function getStreakConfig(streak: number): StreakConfig {
  if (streak >= 5) {
    return {
      flames: 3,
      label: 'INFERNO',
      bgGradient: 'from-red-700 via-red-600 to-orange-500',
      glowColor: 'rgba(220, 38, 38, 0.6)',
      textColor: 'text-yellow-200',
    };
  } else if (streak >= 3) {
    return {
      flames: 2,
      label: 'ON FIRE!',
      bgGradient: 'from-orange-600 via-orange-500 to-yellow-500',
      glowColor: 'rgba(234, 88, 12, 0.5)',
      textColor: 'text-yellow-100',
    };
  } else {
    return {
      flames: 1,
      label: 'HOT',
      bgGradient: 'from-orange-500 to-yellow-500',
      glowColor: 'rgba(249, 115, 22, 0.4)',
      textColor: 'text-white',
    };
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StreakIndicator({
  streak,
  className,
  size = 'md',
  showLabel = true,
}: StreakIndicatorProps) {
  if (streak < 2) return null;

  const config = getStreakConfig(streak);

  const sizeClasses = {
    sm: { container: 'px-2 py-1', text: 'text-xs', flame: 'text-sm' },
    md: { container: 'px-3 py-1.5', text: 'text-sm', flame: 'text-lg' },
    lg: { container: 'px-4 py-2', text: 'text-base', flame: 'text-xl' },
  };

  const sizes = sizeClasses[size];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0, y: -10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className={cn('relative', className)}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full blur-lg"
          style={{ backgroundColor: config.glowColor }}
        />

        {/* Main badge */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'relative flex items-center gap-1.5 rounded-full',
            'bg-gradient-to-r shadow-lg border border-white/20',
            config.bgGradient,
            sizes.container
          )}
        >
          {/* Flames */}
          <div className="flex">
            {Array.from({ length: config.flames }).map((_, i) => (
              <motion.span
                key={i}
                animate={{
                  y: [0, -2, 0],
                  rotate: [-5, 5, -5],
                }}
                transition={{
                  duration: 0.3,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                className={sizes.flame}
              >
                🔥
              </motion.span>
            ))}
          </div>

          {/* Streak count */}
          <span className={cn('font-bold', config.textColor, sizes.text)}>
            {streak}
          </span>

          {/* Label for larger badges */}
          {showLabel && size !== 'sm' && (
            <span className={cn('font-bold uppercase tracking-wider', config.textColor, sizes.text)}>
              {config.label}
            </span>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// STREAK CELEBRATION - For when a player hits a new streak milestone
// =============================================================================

interface StreakCelebrationProps {
  streak: number;
  onComplete?: () => void;
}

export function StreakCelebration({ streak, onComplete }: StreakCelebrationProps) {
  const config = getStreakConfig(streak);
  const isMilestone = streak === 3 || streak === 5 || streak === 10;

  if (!isMilestone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.5 }}
      onAnimationComplete={() => {
        setTimeout(() => onComplete?.(), 2000);
      }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
    >
      {/* Background flash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.5 }}
        className={cn(
          'absolute inset-0',
          streak >= 5 ? 'bg-red-500' : streak >= 3 ? 'bg-orange-500' : 'bg-yellow-500'
        )}
      />

      {/* Center badge */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{
          scale: [0, 1.5, 1.2],
          rotate: [-20, 10, 0],
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative"
      >
        {/* Fire particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
            animate={{
              scale: [0, 1, 0.5],
              opacity: [1, 1, 0],
              x: Math.cos((i * 30) * Math.PI / 180) * 150,
              y: Math.sin((i * 30) * Math.PI / 180) * 150,
            }}
            transition={{ duration: 1, delay: 0.3 }}
            className="absolute left-1/2 top-1/2 text-3xl"
          >
            🔥
          </motion.div>
        ))}

        {/* Main celebration badge */}
        <div
          className={cn(
            'px-8 py-4 rounded-2xl shadow-2xl',
            'bg-gradient-to-r border-2 border-white/30',
            config.bgGradient
          )}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.3, repeat: 3 }}
            className="text-center"
          >
            <div className="text-5xl mb-2">
              {Array.from({ length: Math.min(streak, 5) }).map((_, i) => (
                <span key={i}>🔥</span>
              ))}
            </div>
            <div className="text-3xl font-bold text-white gold-shimmer-text">
              {streak} WIN STREAK!
            </div>
            <div className={cn('text-xl font-bold mt-1', config.textColor)}>
              {config.label}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// HOT SEAT INDICATOR - Subtle glow around player on streak
// =============================================================================

interface HotSeatGlowProps {
  streak: number;
  className?: string;
}

export function HotSeatGlow({ streak, className }: HotSeatGlowProps) {
  if (streak < 2) return null;

  const config = getStreakConfig(streak);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={cn(
        'absolute inset-0 rounded-full pointer-events-none',
        className
      )}
      style={{
        background: `radial-gradient(ellipse at center, ${config.glowColor} 0%, transparent 70%)`,
        filter: 'blur(20px)',
      }}
    />
  );
}
