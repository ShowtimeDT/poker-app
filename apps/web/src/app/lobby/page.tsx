'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { UsersIcon, RefreshIcon, PlusIcon } from '@/components/ui/Icons';
import { HouseRulesLogo } from '@/components/ui/HouseRulesLogo';
import { cn, formatChips } from '@/lib/utils';
import type { Room, Stakes, GameVariant } from '@poker/shared';
import { VARIANT_CONFIG, STAKES_PRESETS } from '@poker/shared';

// =============================================================================
// TYPES
// =============================================================================

interface RoomSummary {
  id: string;
  code: string;
  name: string;
  variant: GameVariant;
  stakes: Stakes;
  maxPlayers: number;
  playerCount: number;
  status: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LobbyPage() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GameVariant | 'all'>('all');
  const [joinCode, setJoinCode] = useState('');

  // Fetch rooms
  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms`);
      const data = await res.json();
      if (data.success) {
        setRooms(data.data.rooms);
      }
    } catch (err) {
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    // Poll for updates
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter rooms
  const filteredRooms = filter === 'all'
    ? rooms
    : rooms.filter(r => r.variant === filter);

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Game Lobby</h1>
          <p className="text-gray-400 mt-1">Find a table or create your own room</p>
        </div>
        <div className="flex gap-3">
          <Link href="/create" className="btn btn-primary flex items-center gap-2">
            <PlusIcon size={18} />
            Create Room
          </Link>
          <button
            onClick={fetchRooms}
            className="btn btn-ghost flex items-center gap-2"
          >
            <RefreshIcon size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Join */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-6 mb-8"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Quick Join</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter room code"
            maxLength={6}
            className="input flex-1 max-w-xs font-mono text-lg tracking-widest"
          />
          <Link
            href={`/room/${joinCode}`}
            className={cn(
              'btn btn-primary',
              joinCode.length !== 6 && 'opacity-50 pointer-events-none'
            )}
          >
            Join
          </Link>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <FilterTab
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All Games
        </FilterTab>
        {Object.entries(VARIANT_CONFIG).map(([key, config]) => (
          <FilterTab
            key={key}
            active={filter === key}
            onClick={() => setFilter(key as GameVariant)}
          >
            {config.name}
          </FilterTab>
        ))}
      </div>

      {/* Room List */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchRooms} />
      ) : filteredRooms.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredRooms.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} />
          ))}
        </motion.div>
      )}
    </main>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-purple-600 text-white'
          : 'bg-purple-900/30 text-gray-400 hover:bg-purple-800/40 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

function RoomCard({ room, index }: { room: RoomSummary; index: number }) {
  const variant = VARIANT_CONFIG[room.variant];
  const isFull = room.playerCount >= room.maxPlayers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="surface-card p-5 hover:border-purple-600/50 transition-colors"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-white">{room.name}</h3>
          <p className="text-sm text-purple-400">{variant?.name || room.variant}</p>
        </div>
        <span className={cn(
          'px-2 py-1 rounded text-xs font-medium',
          room.status === 'playing'
            ? 'bg-accent-green/20 text-accent-green'
            : 'bg-purple-600/20 text-purple-400'
        )}>
          {room.status === 'playing' ? 'In Progress' : 'Waiting'}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
        <div className="flex items-center gap-1">
          <UsersIcon size={16} />
          <span>{room.playerCount}/{room.maxPlayers}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gold font-mono">
            {formatChips(room.stakes.smallBlind)}/{formatChips(room.stakes.bigBlind)}
          </span>
        </div>
      </div>

      <Link
        href={`/room/${room.code}`}
        className={cn(
          'btn btn-secondary w-full',
          isFull && 'opacity-50 pointer-events-none'
        )}
      >
        {isFull ? 'Full' : 'Join Table'}
      </Link>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="surface-card p-5 animate-pulse">
          <div className="h-6 bg-purple-800/30 rounded w-2/3 mb-2" />
          <div className="h-4 bg-purple-800/30 rounded w-1/3 mb-4" />
          <div className="h-4 bg-purple-800/30 rounded w-1/2 mb-4" />
          <div className="h-10 bg-purple-800/30 rounded" />
        </div>
      ))}
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-accent-red mb-4">{message}</p>
      <button onClick={onRetry} className="btn btn-ghost">
        Try Again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="mb-4 opacity-50">
        <HouseRulesLogo size="md" shimmer={false} />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">No Active Tables</h3>
      <p className="text-gray-400 mb-6">Be the first to create a room!</p>
      <Link href="/create" className="btn btn-primary">
        Create Room
      </Link>
    </div>
  );
}
