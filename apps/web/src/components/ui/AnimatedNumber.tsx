'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
  highlightOnChange?: boolean;
  highlightColor?: string;
  prefix?: string;
  suffix?: string;
  showDelta?: boolean; // Show +/- indicator
}

export function AnimatedNumber({
  value,
  duration = 800,
  format = (v) => v.toLocaleString(),
  className,
  highlightOnChange = true,
  highlightColor = 'text-gold-light',
  prefix = '',
  suffix = '',
  showDelta = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [delta, setDelta] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    const startValue = prevValue.current;
    const diff = value - startValue;
    setDelta(diff);

    // Adjust duration based on the change magnitude
    const adjustedDuration = Math.min(duration, Math.max(300, Math.abs(diff) * 0.5));
    const startTime = Date.now();

    setIsAnimating(true);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / adjustedDuration, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * eased);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevValue.current = value;
        // Clear delta after a delay
        setTimeout(() => setDelta(0), 1500);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={cn('relative inline-block', className)}>
      <motion.span
        animate={{
          scale: isAnimating && highlightOnChange ? [1, 1.1, 1] : 1,
        }}
        transition={{ duration: 0.3 }}
        className={cn(
          'transition-colors duration-200',
          isAnimating && highlightOnChange && highlightColor
        )}
      >
        {prefix}
        {format(displayValue)}
        {suffix}
      </motion.span>

      {/* Delta indicator */}
      {showDelta && delta !== 0 && (
        <motion.span
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap',
            delta > 0 ? 'text-emerald' : 'text-ruby'
          )}
        >
          {delta > 0 ? '+' : ''}{format(delta)}
        </motion.span>
      )}
    </span>
  );
}

// =============================================================================
// ANIMATED CHIP COUNT - Specialized for chip displays
// =============================================================================

interface AnimatedChipCountProps {
  value: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDelta?: boolean;
}

export function AnimatedChipCount({
  value,
  className,
  size = 'md',
  showDelta = false,
}: AnimatedChipCountProps) {
  const formatChips = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <AnimatedNumber
      value={value}
      format={formatChips}
      className={cn(
        'font-mono font-bold text-gold',
        sizeClasses[size],
        className
      )}
      highlightColor="text-gold-shimmer"
      showDelta={showDelta}
      duration={600}
    />
  );
}

// =============================================================================
// ANIMATED WINNER AMOUNT - For dramatic winner displays
// =============================================================================

interface AnimatedWinnerAmountProps {
  value: number;
  className?: string;
}

export function AnimatedWinnerAmount({ value, className }: AnimatedWinnerAmountProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Start from 0 and count up dramatically
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out exponential for dramatic effect
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(value * eased);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const formatChips = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString();
  };

  return (
    <motion.span
      animate={{
        scale: isComplete ? [1, 1.1, 1] : 1,
      }}
      transition={{ duration: 0.3 }}
      className={cn(
        'font-mono font-bold',
        isComplete ? 'gold-shimmer-text' : 'text-gold',
        className
      )}
    >
      +{formatChips(displayValue)}
    </motion.span>
  );
}

// =============================================================================
// TIMER DISPLAY - For turn timer with urgency effects
// =============================================================================

interface TimerDisplayProps {
  seconds: number;
  total: number;
  warning?: boolean;
  className?: string;
}

export function TimerDisplay({ seconds, total, warning = false, className }: TimerDisplayProps) {
  const progress = (seconds / total) * 100;
  const isUrgent = progress < 20;
  const isWarning = progress < 40;

  return (
    <motion.div
      animate={{
        scale: isUrgent ? [1, 1.1, 1] : 1,
      }}
      transition={{
        duration: 0.3,
        repeat: isUrgent ? Infinity : 0,
        repeatType: 'reverse',
      }}
      className={cn(
        'px-3 py-1.5 rounded-lg font-bold text-lg',
        isUrgent
          ? 'bg-ruby text-white animate-timer-urgent'
          : isWarning
          ? 'bg-yellow-600 text-white'
          : 'bg-emerald text-white',
        className
      )}
    >
      {seconds}s
    </motion.div>
  );
}
