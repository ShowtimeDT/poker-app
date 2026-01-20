'use client';

import { cn } from '@/lib/utils';

interface HouseRulesLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  shimmer?: boolean;
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl md:text-6xl',
  xl: 'text-6xl md:text-7xl',
};

export function HouseRulesLogo({ size = 'md', className, shimmer = true }: HouseRulesLogoProps) {
  return (
    <div
      className={cn('text-center select-none', className)}
      style={{ fontFamily: "'Great Vibes', cursive" }}
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
