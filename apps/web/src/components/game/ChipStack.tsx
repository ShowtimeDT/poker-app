'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { cn, formatChips } from '@/lib/utils';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showAmount?: boolean;
  className?: string;
  animate?: boolean;
  animateChange?: boolean;
  slideFrom?: 'left' | 'right' | 'top' | 'center';
}

type ChipColor = 'white' | 'red' | 'blue' | 'green' | 'black' | 'purple' | 'gold';

interface ChipValue {
  color: ChipColor;
  value: number;
}

const chipValues: ChipValue[] = [
  { color: 'gold', value: 10000 },
  { color: 'purple', value: 5000 },
  { color: 'black', value: 1000 },
  { color: 'green', value: 500 },
  { color: 'blue', value: 100 },
  { color: 'red', value: 25 },
  { color: 'white', value: 5 },
];

const chipColorClasses: Record<ChipColor, string> = {
  white: 'bg-gray-100 border-gray-300',
  red: 'bg-red-600 border-red-400',
  blue: 'bg-blue-600 border-blue-400',
  green: 'bg-green-600 border-green-400',
  black: 'bg-gray-800 border-gray-600',
  purple: 'bg-purple-600 border-purple-400',
  gold: 'bg-gradient-to-br from-gold to-gold-dark border-gold-light',
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

// Slide animation variants
const slideVariants = {
  left: { initial: { x: -100, y: -30, opacity: 0, scale: 0.5 }, animate: { x: 0, y: 0, opacity: 1, scale: 1 } },
  right: { initial: { x: 100, y: -30, opacity: 0, scale: 0.5 }, animate: { x: 0, y: 0, opacity: 1, scale: 1 } },
  top: { initial: { y: -80, opacity: 0, scale: 0.5 }, animate: { y: 0, opacity: 1, scale: 1 } },
  center: { initial: { y: -30, opacity: 0, scale: 0.8 }, animate: { y: 0, opacity: 1, scale: 1 } },
};

function breakdownChips(amount: number): ChipValue[] {
  const result: ChipValue[] = [];
  let remaining = amount;

  for (const chip of chipValues) {
    const count = Math.floor(remaining / chip.value);
    for (let i = 0; i < Math.min(count, 5); i++) { // Max 5 of each chip shown
      result.push(chip);
    }
    remaining = remaining % chip.value;
    if (result.length >= 8) break; // Max 8 chips in stack visual
  }

  return result;
}

export function ChipStack({
  amount,
  size = 'md',
  showAmount = true,
  className,
  animate = true,
  animateChange = false,
  slideFrom = 'center',
}: ChipStackProps) {
  const chips = breakdownChips(amount);
  const prevAmount = useRef(amount);
  const [isChanging, setIsChanging] = useState(false);

  // Detect amount changes for animation
  useEffect(() => {
    if (animateChange && amount !== prevAmount.current) {
      setIsChanging(true);
      const timer = setTimeout(() => setIsChanging(false), 400);
      prevAmount.current = amount;
      return () => clearTimeout(timer);
    }
  }, [amount, animateChange]);

  const variant = slideVariants[slideFrom];

  return (
    <motion.div
      className={cn('relative flex flex-col items-center', className)}
      initial={animate ? variant.initial : false}
      animate={variant.animate}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {/* Chip stack */}
      <div className="relative">
        {chips.map((chip, index) => (
          <motion.div
            key={index}
            initial={animate ? { y: -30, opacity: 0, scale: 1.2 } : false}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
              delay: index * 0.05,
              type: 'spring',
              stiffness: 400,
              damping: 15,
            }}
            className={cn(
              'absolute rounded-full border-4 border-dashed shadow-chip-stack',
              chipColorClasses[chip.color],
              sizeClasses[size]
            )}
            style={{
              bottom: index * 4,
              zIndex: index,
            }}
          >
            {/* Chip shine effect */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                }}
              />
            </div>
          </motion.div>
        ))}
        {/* Base chip placeholder if no chips */}
        {chips.length === 0 && (
          <div className={cn(
            'rounded-full border-4 border-dashed',
            chipColorClasses.white,
            sizeClasses[size]
          )} />
        )}
      </div>

      {/* Amount label with change animation */}
      {showAmount && amount > 0 && (
        <motion.div
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{
            opacity: 1,
            y: 0,
            scale: isChanging ? 1.1 : 1,
          }}
          transition={{ delay: animate ? 0.3 : 0, duration: 0.2 }}
          className={cn(
            'mt-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm',
            'text-gold font-mono text-sm font-bold',
            'border border-gold/30',
            isChanging && 'chip-count-change'
          )}
        >
          {formatChips(amount)}
        </motion.div>
      )}
    </motion.div>
  );
}

interface PotDisplayProps {
  amount: number;
  label?: string;
  className?: string;
  animateValue?: boolean;
}

export function PotDisplay({ amount, label = 'Pot', className, animateValue = true }: PotDisplayProps) {
  const [displayAmount, setDisplayAmount] = useState(amount);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevAmount = useRef(amount);

  // Animate the pot amount counting up
  useEffect(() => {
    if (!animateValue || amount === prevAmount.current) return;

    const startAmount = prevAmount.current;
    const diff = amount - startAmount;
    const duration = Math.min(800, Math.abs(diff) * 2); // Cap at 800ms
    const startTime = Date.now();

    setIsAnimating(true);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startAmount + diff * eased);

      setDisplayAmount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevAmount.current = amount;
      }
    };

    requestAnimationFrame(animate);
  }, [amount, animateValue]);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: isAnimating ? 1.05 : 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 border border-gold/40',
        'shadow-glow-gold',
        isAnimating && 'border-gold/60',
        className
      )}
    >
      <span className="text-gray-400 text-sm mr-1.5">{label}:</span>
      <motion.span
        className={cn(
          'text-gold font-bold font-mono text-base',
          isAnimating && 'text-gold-light'
        )}
        animate={{ scale: isAnimating ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 0.3, repeat: isAnimating ? Infinity : 0 }}
      >
        {formatChips(displayAmount)}
      </motion.span>
    </motion.div>
  );
}

interface BetDisplayProps {
  amount: number;
  className?: string;
}

export function BetDisplay({ amount, className }: BetDisplayProps) {
  if (amount <= 0) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className={cn(
        'flex items-center gap-2 bg-purple-950/80 backdrop-blur-sm',
        'rounded-full px-3 py-1 border border-gold/20',
        className
      )}
    >
      <div className="w-4 h-4 rounded-full bg-gold border border-gold-light" />
      <span className="text-gold font-mono font-bold text-sm">
        {formatChips(amount)}
      </span>
    </motion.div>
  );
}
