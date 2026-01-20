'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type SoundEffect =
  | 'card-deal'
  | 'card-flip'
  | 'chip-bet'
  | 'chip-collect'
  | 'chip-stack'
  | 'turn-alert'
  | 'timer-warning'
  | 'win-small'
  | 'win-big'
  | 'fold'
  | 'check'
  | 'all-in';

interface SoundOptions {
  volume?: number;
  playbackRate?: number;
  pan?: number; // -1 (left) to 1 (right) for spatial audio
}

interface UseSoundOptions {
  enabled?: boolean;
  masterVolume?: number;
}

// =============================================================================
// SOUND CONFIGURATION
// =============================================================================

const SOUND_CONFIG: Record<SoundEffect, { src: string; defaultVolume: number }> = {
  'card-deal': { src: '/sounds/card-deal.mp3', defaultVolume: 0.5 },
  'card-flip': { src: '/sounds/card-flip.mp3', defaultVolume: 0.6 },
  'chip-bet': { src: '/sounds/chip-bet.mp3', defaultVolume: 0.5 },
  'chip-collect': { src: '/sounds/chip-collect.mp3', defaultVolume: 0.6 },
  'chip-stack': { src: '/sounds/chip-stack.mp3', defaultVolume: 0.4 },
  'turn-alert': { src: '/sounds/turn-alert.mp3', defaultVolume: 0.7 },
  'timer-warning': { src: '/sounds/timer-warning.mp3', defaultVolume: 0.8 },
  'win-small': { src: '/sounds/win-small.mp3', defaultVolume: 0.6 },
  'win-big': { src: '/sounds/win-big.mp3', defaultVolume: 0.8 },
  'fold': { src: '/sounds/fold.mp3', defaultVolume: 0.4 },
  'check': { src: '/sounds/check.mp3', defaultVolume: 0.5 },
  'all-in': { src: '/sounds/all-in.mp3', defaultVolume: 0.9 },
};

// =============================================================================
// AUDIO CONTEXT SINGLETON
// =============================================================================

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSound(options: UseSoundOptions = {}) {
  const { enabled = true, masterVolume = 1 } = options;

  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const volumeRef = useRef(masterVolume);

  // Update volume ref when prop changes
  useEffect(() => {
    volumeRef.current = masterVolume;
  }, [masterVolume]);

  // Preload all sounds
  useEffect(() => {
    if (!enabled) return;

    const loadSound = async (name: SoundEffect) => {
      try {
        const config = SOUND_CONFIG[name];
        const response = await fetch(config.src);
        if (!response.ok) {
          console.warn(`[useSound] Failed to fetch ${name}: ${response.status}`);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const ctx = getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioCache.current.set(name, audioBuffer);
      } catch (error) {
        console.warn(`[useSound] Failed to load sound: ${name}`, error);
      }
    };

    // Load all sounds
    Promise.all(Object.keys(SOUND_CONFIG).map((name) => loadSound(name as SoundEffect)))
      .then(() => {
        setIsLoaded(true);
        console.log('[useSound] All sounds loaded');
      })
      .catch((error) => {
        console.warn('[useSound] Error loading sounds:', error);
      });
  }, [enabled]);

  // Play a sound effect
  const play = useCallback(
    (sound: SoundEffect, options: SoundOptions = {}) => {
      if (!enabled || isMuted) return;

      const buffer = audioCache.current.get(sound);
      if (!buffer) {
        console.warn(`[useSound] Sound not loaded: ${sound}`);
        return;
      }

      try {
        const ctx = getAudioContext();

        // Resume context if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        // Create source
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Create gain node for volume control
        const gainNode = ctx.createGain();
        const config = SOUND_CONFIG[sound];
        const volume = (options.volume ?? config.defaultVolume) * volumeRef.current;
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        // Create stereo panner for spatial audio
        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));

        // Set playback rate
        source.playbackRate.value = options.playbackRate ?? 1;

        // Connect nodes: source -> gain -> panner -> destination
        source.connect(gainNode);
        gainNode.connect(pannerNode);
        pannerNode.connect(ctx.destination);

        // Play the sound
        source.start(0);
      } catch (error) {
        console.warn(`[useSound] Error playing sound: ${sound}`, error);
      }
    },
    [enabled, isMuted]
  );

  // Play multiple sounds with delays (for card dealing, etc.)
  const playSequence = useCallback(
    (sounds: { sound: SoundEffect; delay: number; options?: SoundOptions }[]) => {
      sounds.forEach(({ sound, delay, options }) => {
        setTimeout(() => play(sound, options), delay);
      });
    },
    [play]
  );

  // Convenience methods for common sound sequences
  const playCardDeal = useCallback(
    (cardCount: number = 1, pan: number = 0) => {
      for (let i = 0; i < cardCount; i++) {
        setTimeout(() => play('card-deal', { pan }), i * 150);
      }
    },
    [play]
  );

  const playChipBet = useCallback(
    (pan: number = 0) => {
      play('chip-bet', { pan });
    },
    [play]
  );

  const playWin = useCallback(
    (isBigWin: boolean = false) => {
      play(isBigWin ? 'win-big' : 'win-small');
      // Add chip collect sound after a short delay
      setTimeout(() => play('chip-collect'), 300);
    },
    [play]
  );

  const playAction = useCallback(
    (action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in', pan: number = 0) => {
      switch (action) {
        case 'fold':
          play('fold', { pan });
          break;
        case 'check':
          play('check', { pan });
          break;
        case 'call':
        case 'bet':
        case 'raise':
          play('chip-bet', { pan });
          break;
        case 'all-in':
          play('all-in', { pan });
          setTimeout(() => play('chip-bet', { pan, volume: 0.8 }), 200);
          break;
      }
    },
    [play]
  );

  return {
    play,
    playSequence,
    playCardDeal,
    playChipBet,
    playWin,
    playAction,
    isLoaded,
    isMuted,
    setIsMuted,
    setVolume: (volume: number) => {
      volumeRef.current = volume;
    },
  };
}

// =============================================================================
// SOUND CONTEXT (for global sound state)
// =============================================================================

import { createContext, useContext } from 'react';

interface SoundContextType {
  play: (sound: SoundEffect, options?: SoundOptions) => void;
  playCardDeal: (cardCount?: number, pan?: number) => void;
  playChipBet: (pan?: number) => void;
  playWin: (isBigWin?: boolean) => void;
  playAction: (action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in', pan?: number) => void;
  isLoaded: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
}

export const SoundContext = createContext<SoundContextType | null>(null);

export function useSoundContext() {
  const context = useContext(SoundContext);
  if (!context) {
    // Return a no-op version if context is not available
    return {
      play: () => {},
      playCardDeal: () => {},
      playChipBet: () => {},
      playWin: () => {},
      playAction: () => {},
      isLoaded: false,
      isMuted: false,
      setIsMuted: () => {},
      setVolume: () => {},
    };
  }
  return context;
}
