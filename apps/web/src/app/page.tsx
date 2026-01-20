'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { SlidersIcon, ShieldIcon, GridIcon } from '@/components/ui/Icons';
import { HouseRulesLogo } from '@/components/ui/HouseRulesLogo';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-4xl mx-auto"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <HouseRulesLogo size="xl" shimmer={true} />
          <p className="text-purple-400 mt-2 text-lg">Poker Rooms</p>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto"
        >
          Create private rooms, set your own rules, and play with friends.
          <span className="text-gold"> Texas Hold'em, Omaha, Blackjack</span> and more.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <Link href="/lobby" className="btn btn-primary text-lg px-10 py-4">
            Find a Table
          </Link>
          <Link href="/create" className="btn btn-ghost text-lg px-10 py-4">
            Create Room
          </Link>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
        >
          <FeatureCard
            icon={<SlidersIcon size={36} className="text-gold" />}
            title="Custom Rules"
            description="Run it twice, bomb pots, straddles, dealer's choice - your game, your rules"
          />
          <FeatureCard
            icon={<ShieldIcon size={36} className="text-gold" />}
            title="Private Rooms"
            description="Invite-only tables with password protection for your home games"
          />
          <FeatureCard
            icon={<GridIcon size={36} className="text-gold" />}
            title="Multiple Games"
            description="Switch between Hold'em, Omaha, Blackjack and more at the same table"
          />
        </motion.div>
      </motion.div>

      {/* Floating Cards Animation */}
      <FloatingCards />
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass rounded-xl p-6 text-center"
    >
      <div className="mb-3 flex justify-center">{icon}</div>
      <h3 className="text-lg font-semibold text-gold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </motion.div>
  );
}

function FloatingCards() {
  const cards = [
    { suit: 'spades', rank: 'A', x: '10%', y: '20%', delay: 0 },
    { suit: 'hearts', rank: 'K', x: '85%', y: '30%', delay: 0.5 },
    { suit: 'diamonds', rank: 'Q', x: '5%', y: '70%', delay: 1 },
    { suit: 'clubs', rank: 'J', x: '90%', y: '75%', delay: 1.5 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {cards.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 100, rotate: -30 }}
          animate={{
            opacity: 0.1,
            y: [0, -20, 0],
            rotate: [-5, 5, -5],
          }}
          transition={{
            delay: card.delay,
            duration: 4,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="absolute playing-card playing-card-back w-20 h-28"
          style={{ left: card.x, top: card.y }}
        />
      ))}
    </div>
  );
}
