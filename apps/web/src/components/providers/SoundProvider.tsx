'use client';

import { ReactNode } from 'react';
import { useSound, SoundContext } from '@/hooks/useSound';

interface SoundProviderProps {
  children: ReactNode;
  enabled?: boolean;
  masterVolume?: number;
}

export function SoundProvider({
  children,
  enabled = true,
  masterVolume = 0.7,
}: SoundProviderProps) {
  const soundControls = useSound({ enabled, masterVolume });

  return (
    <SoundContext.Provider value={soundControls}>
      {children}
    </SoundContext.Provider>
  );
}
