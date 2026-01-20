'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShowMuckButtonsProps {
  onShow: () => void;
  onMuck: () => void;
  autoMuckSeconds?: number;
}

export function ShowMuckButtons({
  onShow,
  onMuck,
  autoMuckSeconds = 5,
}: ShowMuckButtonsProps) {
  const [countdown, setCountdown] = useState(autoMuckSeconds);
  const [hasMucked, setHasMucked] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      if (!hasMucked) {
        setHasMucked(true);
        onMuck();
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, hasMucked, onMuck]);

  const handleShow = () => {
    setHasMucked(true);
    onShow();
  };

  const handleMuck = () => {
    setHasMucked(true);
    onMuck();
  };

  if (hasMucked) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="flex-shrink-0 p-4 border-t border-purple-800/30 bg-dark-surface/80 backdrop-blur"
    >
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleShow}
          className={cn(
            'px-6 py-3 rounded-lg font-semibold transition-all',
            'bg-purple-600 text-white hover:bg-purple-500',
            'shadow-lg hover:shadow-purple-500/30'
          )}
        >
          Show Hand
        </button>

        <button
          onClick={handleMuck}
          className={cn(
            'px-6 py-3 rounded-lg font-semibold transition-all',
            'bg-gray-700 text-gray-200 hover:bg-gray-600',
            'relative overflow-hidden'
          )}
        >
          <span className="relative z-10">Muck ({countdown}s)</span>
          {/* Countdown progress bar */}
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: autoMuckSeconds, ease: 'linear' }}
            className="absolute inset-0 bg-gray-600/50"
          />
        </button>

        <span className="text-gray-400 text-sm ml-2">
          Auto-muck in {countdown}s
        </span>
      </div>
    </motion.div>
  );
}
