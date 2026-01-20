import type { Card, HandRank, HandResult, Rank } from '@poker/shared';
import { RANK_VALUES, HAND_RANK_VALUES, HAND_RANK_NAMES } from '@poker/shared';

/**
 * Hand Evaluator using optimized lookup tables
 * Based on Cactus Kev's algorithm with modifications
 */

// Prime numbers for each rank (for unique product calculation)
const RANK_PRIMES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 5,
  '5': 7,
  '6': 11,
  '7': 13,
  '8': 17,
  '9': 19,
  '10': 23,
  'J': 29,
  'Q': 31,
  'K': 37,
  'A': 41,
};

/**
 * Convert card to numeric representation for fast evaluation
 * Bits: xxxAKQJT98765432 (suits in higher bits)
 */
function cardToNumber(card: Card): number {
  const rankBit = 1 << (RANK_VALUES[card.rank] - 2);
  const suitBit = ['clubs', 'diamonds', 'hearts', 'spades'].indexOf(card.suit);
  return (suitBit << 13) | rankBit;
}

/**
 * Get rank bit pattern from cards
 */
function getRankBits(cards: Card[]): number {
  let bits = 0;
  for (const card of cards) {
    bits |= (1 << (RANK_VALUES[card.rank] - 2));
  }
  return bits;
}

/**
 * Count occurrences of each rank
 */
function getRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

/**
 * Check if cards form a flush
 */
function getFlushSuit(cards: Card[]): string | null {
  const suitCounts = new Map<string, number>();
  for (const card of cards) {
    const count = (suitCounts.get(card.suit) || 0) + 1;
    suitCounts.set(card.suit, count);
    if (count >= 5) return card.suit;
  }
  return null;
}

/**
 * Check for straight and return high card
 */
function getStraightHigh(rankBits: number): number | null {
  // Check for A-high straight (AKQJT)
  if ((rankBits & 0b1111100000000) === 0b1111100000000) return 14;

  // Check for other straights
  for (let high = 13; high >= 5; high--) {
    const mask = 0b11111 << (high - 5);
    if ((rankBits & mask) === mask) return high;
  }

  // Check for wheel (A2345)
  if ((rankBits & 0b1000000001111) === 0b1000000001111) return 5;

  return null;
}

/**
 * Get best 5 cards for a hand rank
 */
function getBestFiveCards(
  cards: Card[],
  rank: HandRank,
  rankCounts: Map<Rank, number>
): Card[] {
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);

  switch (rank) {
    case 'four-of-a-kind': {
      const quadRank = [...rankCounts.entries()].find(([_, count]) => count === 4)?.[0];
      const quads = sorted.filter(c => c.rank === quadRank);
      const kicker = sorted.find(c => c.rank !== quadRank)!;
      return [...quads, kicker];
    }

    case 'full-house': {
      const tripRank = [...rankCounts.entries()]
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => RANK_VALUES[b[0]] - RANK_VALUES[a[0]])[0]?.[0];
      const pairRank = [...rankCounts.entries()]
        .filter(([r, count]) => count >= 2 && r !== tripRank)
        .sort((a, b) => RANK_VALUES[b[0]] - RANK_VALUES[a[0]])[0]?.[0];

      const trips = sorted.filter(c => c.rank === tripRank).slice(0, 3);
      const pair = sorted.filter(c => c.rank === pairRank).slice(0, 2);
      return [...trips, ...pair];
    }

    case 'three-of-a-kind': {
      const tripRank = [...rankCounts.entries()].find(([_, count]) => count === 3)?.[0];
      const trips = sorted.filter(c => c.rank === tripRank);
      const kickers = sorted.filter(c => c.rank !== tripRank).slice(0, 2);
      return [...trips, ...kickers];
    }

    case 'two-pair': {
      const pairs = [...rankCounts.entries()]
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => RANK_VALUES[b[0]] - RANK_VALUES[a[0]])
        .slice(0, 2)
        .map(([rank]) => rank);

      const pairCards = sorted.filter(c => pairs.includes(c.rank));
      const kicker = sorted.find(c => !pairs.includes(c.rank))!;
      return [...pairCards.slice(0, 4), kicker];
    }

    case 'pair': {
      const pairRank = [...rankCounts.entries()].find(([_, count]) => count === 2)?.[0];
      const pair = sorted.filter(c => c.rank === pairRank);
      const kickers = sorted.filter(c => c.rank !== pairRank).slice(0, 3);
      return [...pair, ...kickers];
    }

    default:
      return sorted.slice(0, 5);
  }
}

/**
 * Calculate numeric hand value for comparison
 */
function calculateHandValue(rank: HandRank, bestFive: Card[]): number {
  const baseValue = HAND_RANK_VALUES[rank] * 10000000000;

  // Add kicker values
  let kickerValue = 0;
  for (let i = 0; i < bestFive.length; i++) {
    kickerValue += RANK_VALUES[bestFive[i].rank] * Math.pow(15, 4 - i);
  }

  return baseValue + kickerValue;
}

/**
 * Generate human-readable hand description
 */
function getHandDescription(rank: HandRank, bestFive: Card[]): string {
  const rankCounts = getRankCounts(bestFive);

  switch (rank) {
    case 'royal-flush':
      return 'Royal Flush';
    case 'straight-flush':
      return `Straight Flush, ${bestFive[0].rank} high`;
    case 'four-of-a-kind': {
      const quadRank = [...rankCounts.entries()].find(([_, c]) => c === 4)?.[0];
      return `Four of a Kind, ${quadRank}s`;
    }
    case 'full-house': {
      const tripRank = [...rankCounts.entries()].find(([_, c]) => c === 3)?.[0];
      const pairRank = [...rankCounts.entries()].find(([_, c]) => c === 2)?.[0];
      return `Full House, ${tripRank}s full of ${pairRank}s`;
    }
    case 'flush':
      return `Flush, ${bestFive[0].rank} high`;
    case 'straight':
      return `Straight, ${bestFive[0].rank} high`;
    case 'three-of-a-kind': {
      const tripRank = [...rankCounts.entries()].find(([_, c]) => c === 3)?.[0];
      return `Three of a Kind, ${tripRank}s`;
    }
    case 'two-pair': {
      const pairs = [...rankCounts.entries()]
        .filter(([_, c]) => c === 2)
        .sort((a, b) => RANK_VALUES[b[0]] - RANK_VALUES[a[0]]);
      return `Two Pair, ${pairs[0][0]}s and ${pairs[1][0]}s`;
    }
    case 'pair': {
      const pairRank = [...rankCounts.entries()].find(([_, c]) => c === 2)?.[0];
      return `Pair of ${pairRank}s`;
    }
    case 'high-card':
      return `High Card, ${bestFive[0].rank}`;
    default:
      return HAND_RANK_NAMES[rank];
  }
}

/**
 * Evaluate a poker hand (5-7 cards)
 */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate a hand');
  }

  const rankCounts = getRankCounts(cards);
  const rankBits = getRankBits(cards);
  const flushSuit = getFlushSuit(cards);

  let rank: HandRank = 'high-card';
  let bestFive: Card[] = [];

  // Check for flush-based hands
  if (flushSuit) {
    const flushCards = cards
      .filter(c => c.suit === flushSuit)
      .sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);

    const flushRankBits = getRankBits(flushCards);
    const straightHigh = getStraightHigh(flushRankBits);

    if (straightHigh) {
      if (straightHigh === 14) {
        rank = 'royal-flush';
      } else {
        rank = 'straight-flush';
      }

      // Get the straight flush cards
      if (straightHigh === 5) {
        // Wheel straight flush (A2345)
        bestFive = flushCards.filter(c =>
          ['A', '2', '3', '4', '5'].includes(c.rank)
        ).slice(0, 5);
      } else {
        const straightRanks = new Set<Rank>();
        for (let i = 0; i < 5; i++) {
          const rankVal = straightHigh - i;
          const rankKey = Object.entries(RANK_VALUES).find(([_, v]) => v === rankVal)?.[0] as Rank;
          if (rankKey) straightRanks.add(rankKey);
        }
        bestFive = flushCards.filter(c => straightRanks.has(c.rank)).slice(0, 5);
      }
    } else {
      rank = 'flush';
      bestFive = flushCards.slice(0, 5);
    }
  }

  // Check for non-flush hands (only if not already flush or better)
  if (rank === 'high-card') {
    // Four of a kind
    const hasQuads = [...rankCounts.values()].some(c => c === 4);
    if (hasQuads) {
      rank = 'four-of-a-kind';
      bestFive = getBestFiveCards(cards, rank, rankCounts);
    }
  }

  if (rank === 'high-card') {
    // Full house
    const hasTrips = [...rankCounts.values()].some(c => c >= 3);
    const hasPair = [...rankCounts.values()].filter(c => c >= 2).length >= 2;

    if (hasTrips && hasPair) {
      rank = 'full-house';
      bestFive = getBestFiveCards(cards, rank, rankCounts);
    }
  }

  // Continue with straight check (already handled flush above)
  if (rank === 'high-card') {
    const straightHigh = getStraightHigh(rankBits);
    if (straightHigh) {
      rank = 'straight';
      const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);

      if (straightHigh === 5) {
        // Wheel (A2345)
        const wheelRanks = new Set(['A', '2', '3', '4', '5']);
        const seen = new Set<Rank>();
        bestFive = sorted.filter(c => {
          if (wheelRanks.has(c.rank) && !seen.has(c.rank)) {
            seen.add(c.rank);
            return true;
          }
          return false;
        }).slice(0, 5);
        // Reorder for wheel (5 high)
        bestFive.sort((a, b) => {
          const aVal = a.rank === 'A' ? 1 : RANK_VALUES[a.rank];
          const bVal = b.rank === 'A' ? 1 : RANK_VALUES[b.rank];
          return bVal - aVal;
        });
      } else {
        const straightRanks = new Set<Rank>();
        for (let i = 0; i < 5; i++) {
          const rankVal = straightHigh - i;
          const rankKey = Object.entries(RANK_VALUES).find(([_, v]) => v === rankVal)?.[0] as Rank;
          if (rankKey) straightRanks.add(rankKey);
        }
        const seen = new Set<Rank>();
        bestFive = sorted.filter(c => {
          if (straightRanks.has(c.rank) && !seen.has(c.rank)) {
            seen.add(c.rank);
            return true;
          }
          return false;
        }).slice(0, 5);
      }
    }
  }

  if (rank === 'high-card') {
    // Three of a kind
    const hasTrips = [...rankCounts.values()].some(c => c === 3);
    if (hasTrips) {
      rank = 'three-of-a-kind';
      bestFive = getBestFiveCards(cards, rank, rankCounts);
    }
  }

  if (rank === 'high-card') {
    // Two pair
    const pairCount = [...rankCounts.values()].filter(c => c >= 2).length;
    if (pairCount >= 2) {
      rank = 'two-pair';
      bestFive = getBestFiveCards(cards, rank, rankCounts);
    }
  }

  if (rank === 'high-card') {
    // Pair
    const hasPair = [...rankCounts.values()].some(c => c === 2);
    if (hasPair) {
      rank = 'pair';
      bestFive = getBestFiveCards(cards, rank, rankCounts);
    }
  }

  // High card
  if (rank === 'high-card') {
    bestFive = getBestFiveCards(cards, rank, rankCounts);
  }

  return {
    rank,
    value: calculateHandValue(rank, bestFive),
    cards: bestFive,
    description: getHandDescription(rank, bestFive),
  };
}

/**
 * Compare two hands, returns positive if hand1 wins, negative if hand2 wins, 0 for tie
 */
export function compareHands(hand1: HandResult, hand2: HandResult): number {
  return hand1.value - hand2.value;
}

/**
 * Find the best hand from hole cards + community cards
 * Checks all combinations for 7-card hands
 */
export function findBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length === 5) {
    return evaluateHand(allCards);
  }

  if (allCards.length === 6) {
    // Try all 6 combinations of 5 cards
    let best: HandResult | null = null;
    for (let skip = 0; skip < 6; skip++) {
      const cards = allCards.filter((_, i) => i !== skip);
      const result = evaluateHand(cards);
      if (!best || result.value > best.value) {
        best = result;
      }
    }
    return best!;
  }

  if (allCards.length === 7) {
    // Try all 21 combinations of 5 cards
    let best: HandResult | null = null;
    for (let skip1 = 0; skip1 < 7; skip1++) {
      for (let skip2 = skip1 + 1; skip2 < 7; skip2++) {
        const cards = allCards.filter((_, i) => i !== skip1 && i !== skip2);
        const result = evaluateHand(cards);
        if (!best || result.value > best.value) {
          best = result;
        }
      }
    }
    return best!;
  }

  // For more cards, use a more efficient algorithm
  return evaluateHand(allCards);
}

/**
 * Evaluate Omaha hand (must use exactly 2 hole cards and 3 community cards)
 */
export function evaluateOmahaHand(holeCards: Card[], communityCards: Card[]): HandResult {
  if (holeCards.length !== 4 || communityCards.length !== 5) {
    throw new Error('Omaha requires 4 hole cards and 5 community cards');
  }

  let best: HandResult | null = null;

  // All combinations of 2 hole cards
  for (let h1 = 0; h1 < 4; h1++) {
    for (let h2 = h1 + 1; h2 < 4; h2++) {
      const selectedHole = [holeCards[h1], holeCards[h2]];

      // All combinations of 3 community cards
      for (let c1 = 0; c1 < 5; c1++) {
        for (let c2 = c1 + 1; c2 < 5; c2++) {
          for (let c3 = c2 + 1; c3 < 5; c3++) {
            const selectedCommunity = [
              communityCards[c1],
              communityCards[c2],
              communityCards[c3],
            ];

            const hand = [...selectedHole, ...selectedCommunity];
            const result = evaluateHand(hand);

            if (!best || result.value > best.value) {
              best = result;
            }
          }
        }
      }
    }
  }

  return best!;
}

/**
 * Calculate blackjack hand value
 */
export function calculateBlackjackValue(cards: Card[]): { value: number; soft: boolean } {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }

  // Adjust for aces
  let soft = aces > 0;
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
    if (aces === 0) soft = false;
  }

  return { value, soft };
}

/**
 * Check if blackjack hand is a natural (21 with 2 cards)
 */
export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const { value } = calculateBlackjackValue(cards);
  return value === 21;
}
