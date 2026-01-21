'use client';

import { cn } from '@/lib/utils';

interface HouseRulesLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  shimmer?: boolean;
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl md:text-6xl',
  xl: 'text-7xl md:text-8xl',
  '2xl': 'text-8xl md:text-9xl',
};

export function HouseRulesLogo({ size = 'md', className, shimmer = true }: HouseRulesLogoProps) {
  const isLarge = size === 'xl' || size === '2xl';
  return (
    <div
      className={cn('text-center select-none', className)}
      style={{
        fontFamily: "'Great Vibes', cursive",
        letterSpacing: isLarge ? '0.05em' : undefined,
        transform: isLarge ? 'scaleX(1.1)' : undefined,
      }}
    >
      <div className={cn(
        'leading-tight',
        sizeClasses[size],
        shimmer ? 'gold-shimmer-text' : 'text-gold'
      )}>
        House
      </div>
      <div className={cn(
        'leading-tight',
        sizeClasses[size],
        shimmer ? 'gold-shimmer-text' : 'text-gold'
      )}>
        Rules
      </div>
    </div>
  );
}
