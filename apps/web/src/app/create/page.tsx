'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameVariant, Stakes, CustomRules } from '@poker/shared';
import { VARIANT_CONFIG, DEFAULT_CUSTOM_RULES } from '@poker/shared';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CreateRoomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (use strings for number inputs to allow clearing)
  const [name, setName] = useState('');
  const [variant, setVariant] = useState<GameVariant>('texas-holdem');
  const [smallBlindStr, setSmallBlindStr] = useState('5');
  const [bigBlindStr, setBigBlindStr] = useState('10');
  const [anteStr, setAnteStr] = useState('0');
  const [startingStackStr, setStartingStackStr] = useState('1000');
  const [bombPotAnteStr, setBombPotAnteStr] = useState('100');
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [isPrivate, setIsPrivate] = useState(true);
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRules>(DEFAULT_CUSTOM_RULES);

  // Parse string values to numbers (with sensible defaults)
  const smallBlind = parseInt(smallBlindStr) || 0;
  const bigBlind = parseInt(bigBlindStr) || 0;
  const ante = parseInt(anteStr) || 0;
  const startingStack = parseInt(startingStackStr) || 0;
  const bombPotAnte = parseInt(bombPotAnteStr) || 0;

  // Build stakes object from inputs (allow 0 for blinds/ante)
  const stakes: Stakes = {
    smallBlind,
    bigBlind,
    ante: ante || undefined, // Only include if > 0
    minBuyIn: Math.max(1, startingStack),
    maxBuyIn: Math.max(1, startingStack),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Use local API routes (proxied through Next.js server) to avoid CORS issues
    const API_URL = '';
    console.log('[CreateRoom] Starting room creation via local API proxy');

    try {
      // Get or create anonymous token
      let token = localStorage.getItem('poker_token');
      console.log('[CreateRoom] Existing token:', token ? 'yes' : 'no');

      if (!token) {
        console.log('[CreateRoom] Fetching anonymous token...');
        const authRes = await fetch(`${API_URL}/api/auth/anonymous`, { method: 'POST' });
        console.log('[CreateRoom] Auth response status:', authRes.status);
        const authData = await authRes.json();
        console.log('[CreateRoom] Auth data:', authData);
        if (authData.success) {
          token = authData.data.token;
          localStorage.setItem('poker_token', token!);
          console.log('[CreateRoom] Token saved');
        } else {
          throw new Error(authData.error || 'Failed to get anonymous token');
        }
      }

      console.log('[CreateRoom] Creating room with token...');
      const roomPayload = {
        name: name || 'My Poker Room',
        variant,
        stakes,
        maxPlayers,
        isPrivate,
        password: password || undefined,
        customRules: {
          ...customRules,
          bombPotAmount: bombPotAnte,
        },
      };
      console.log('[CreateRoom] Room payload:', roomPayload);

      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(roomPayload),
      });

      console.log('[CreateRoom] Room creation response status:', res.status);
      const data = await res.json();
      console.log('[CreateRoom] Room creation data:', data);

      if (data.success) {
        console.log('[CreateRoom] Success! Redirecting to room:', data.data.room.code);
        router.push(`/room/${data.data.room.code}`);
      } else {
        console.error('[CreateRoom] Failed:', data.error);
        setError(data.error || 'Failed to create room');
        setLoading(false);
      }
    } catch (err) {
      console.error('[CreateRoom] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-display font-bold gradient-text mb-2">Create Room</h1>
        <p className="text-gray-400 mb-8">Set up your private poker table</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Poker Room"
              className="input"
              maxLength={50}
            />
          </div>

          {/* Game Variant - Currently only Texas Hold'em */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Game Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(VARIANT_CONFIG)
                .filter(([key]) => key === 'texas-holdem')
                .map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVariant(key as GameVariant)}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-all',
                    variant === key
                      ? 'border-gold bg-gold/10 text-white'
                      : 'border-purple-700/30 bg-purple-900/20 text-gray-400 hover:border-purple-600/50'
                  )}
                >
                  <div className="font-medium">{config.name}</div>
                  <div className="text-xs mt-1 opacity-70">{config.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Blinds & Ante */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Blinds & Ante
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Small Blind</label>
                <input
                  type="number"
                  value={smallBlindStr}
                  onChange={(e) => setSmallBlindStr(e.target.value)}
                  min={0}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Big Blind</label>
                <input
                  type="number"
                  value={bigBlindStr}
                  onChange={(e) => setBigBlindStr(e.target.value)}
                  min={0}
                  className="input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ante</label>
                <input
                  type="number"
                  value={anteStr}
                  onChange={(e) => setAnteStr(e.target.value)}
                  min={0}
                  className="input font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Set any to 0 to disable. Ante is collected from all players each hand.
            </p>
          </div>

          {/* Starting Stack */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Starting Stack
            </label>
            <input
              type="number"
              value={startingStackStr}
              onChange={(e) => setStartingStackStr(e.target.value)}
              min={0}
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              {bigBlind > 0 ? (startingStack / bigBlind).toFixed(0) : 0} big blinds
            </p>
          </div>

          {/* Bomb Pot Ante */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bomb Pot Ante
            </label>
            <input
              type="number"
              value={bombPotAnteStr}
              onChange={(e) => setBombPotAnteStr(e.target.value)}
              min={0}
              className="input font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Amount each player antes for bomb pots ({bigBlind > 0 ? (bombPotAnte / bigBlind).toFixed(1) : 0}x big blind)
            </p>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Players: {maxPlayers}
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-gold"
            />
          </div>

          {/* Privacy */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 rounded bg-purple-900 border-purple-700 text-gold focus:ring-gold"
              />
              <span className="text-gray-300">Private Room</span>
            </label>
          </div>

          {isPrivate && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password (optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="input"
              />
            </div>
          )}

          {/* Advanced Rules Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-purple-400 text-sm hover:text-purple-300"
          >
            {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Rules
          </button>

          {/* Advanced Rules */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 surface-card"
            >
              <h3 className="font-medium text-white mb-4">Custom Rules</h3>

              <RuleToggle
                label="Run It Twice"
                description="Option to run the board twice when all-in"
                checked={customRules.runItTwice}
                onChange={(v) => setCustomRules({ ...customRules, runItTwice: v })}
              />

              <RuleToggle
                label="Run Out on Fold"
                description="Show remaining cards when everyone folds"
                checked={customRules.runOutOnFold}
                onChange={(v) => setCustomRules({ ...customRules, runOutOnFold: v })}
              />

              <RuleToggle
                label="Bomb Pots"
                description="Enable bomb pot functionality"
                checked={customRules.bombPotEnabled}
                onChange={(v) => setCustomRules({ ...customRules, bombPotEnabled: v })}
              />

              <RuleToggle
                label="Straddles"
                description="Allow straddle bets"
                checked={customRules.straddleEnabled}
                onChange={(v) => setCustomRules({ ...customRules, straddleEnabled: v })}
              />

              <RuleToggle
                label="Dealer's Choice"
                description="Dealer picks the game variant each hand"
                checked={customRules.dealerChoosesGame}
                onChange={(v) => setCustomRules({ ...customRules, dealerChoosesGame: v })}
              />

              <RuleToggle
                label="7-2 Game"
                description="Bonus for winning with 7-2"
                checked={customRules.sevenDeuce}
                onChange={(v) => setCustomRules({ ...customRules, sevenDeuce: v })}
              />
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <div className="text-accent-red text-sm">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full text-lg"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </form>
      </motion.div>
    </main>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function RuleToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded bg-purple-900 border-purple-700 text-gold focus:ring-gold"
      />
    </label>
  );
}
