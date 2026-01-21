import { evaluateHand, compareHands, findBestHand, evaluateOmahaHand } from './index';
import type { Card, Suit, Rank } from '@poker/shared';

// Helper to create a card
function card(rank: Rank, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit[0]}` };
}

describe('Hand Evaluator', () => {
  describe('evaluateHand()', () => {
    describe('Royal Flush', () => {
      it('should identify a royal flush', () => {
        const cards: Card[] = [
          card('A', 'spades'),
          card('K', 'spades'),
          card('Q', 'spades'),
          card('J', 'spades'),
          card('10', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('royal-flush');
        expect(result.description).toBe('Royal Flush');
      });
    });

    describe('Straight Flush', () => {
      it('should identify a straight flush', () => {
        const cards: Card[] = [
          card('9', 'hearts'),
          card('8', 'hearts'),
          card('7', 'hearts'),
          card('6', 'hearts'),
          card('5', 'hearts'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('straight-flush');
        expect(result.description).toContain('Straight Flush');
      });

      it('should identify wheel straight flush (A-2-3-4-5)', () => {
        const cards: Card[] = [
          card('A', 'clubs'),
          card('2', 'clubs'),
          card('3', 'clubs'),
          card('4', 'clubs'),
          card('5', 'clubs'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('straight-flush');
      });
    });

    describe('Four of a Kind', () => {
      it('should identify four of a kind', () => {
        const cards: Card[] = [
          card('K', 'spades'),
          card('K', 'hearts'),
          card('K', 'diamonds'),
          card('K', 'clubs'),
          card('A', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('four-of-a-kind');
        expect(result.description).toContain('Four of a Kind');
      });
    });

    describe('Full House', () => {
      it('should identify a full house', () => {
        const cards: Card[] = [
          card('Q', 'spades'),
          card('Q', 'hearts'),
          card('Q', 'diamonds'),
          card('7', 'clubs'),
          card('7', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('full-house');
        expect(result.description).toContain('Full House');
      });
    });

    describe('Flush', () => {
      it('should identify a flush', () => {
        const cards: Card[] = [
          card('A', 'diamonds'),
          card('J', 'diamonds'),
          card('8', 'diamonds'),
          card('4', 'diamonds'),
          card('2', 'diamonds'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('flush');
        expect(result.description).toContain('Flush');
      });
    });

    describe('Straight', () => {
      it('should identify a straight', () => {
        const cards: Card[] = [
          card('9', 'spades'),
          card('8', 'hearts'),
          card('7', 'diamonds'),
          card('6', 'clubs'),
          card('5', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('straight');
        expect(result.description).toContain('Straight');
      });

      it('should identify a wheel (A-2-3-4-5)', () => {
        const cards: Card[] = [
          card('A', 'spades'),
          card('2', 'hearts'),
          card('3', 'diamonds'),
          card('4', 'clubs'),
          card('5', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('straight');
      });

      it('should identify broadway (10-J-Q-K-A)', () => {
        const cards: Card[] = [
          card('A', 'spades'),
          card('K', 'hearts'),
          card('Q', 'diamonds'),
          card('J', 'clubs'),
          card('10', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('straight');
      });
    });

    describe('Three of a Kind', () => {
      it('should identify three of a kind', () => {
        const cards: Card[] = [
          card('8', 'spades'),
          card('8', 'hearts'),
          card('8', 'diamonds'),
          card('K', 'clubs'),
          card('3', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('three-of-a-kind');
        expect(result.description).toContain('Three of a Kind');
      });
    });

    describe('Two Pair', () => {
      it('should identify two pair', () => {
        const cards: Card[] = [
          card('J', 'spades'),
          card('J', 'hearts'),
          card('4', 'diamonds'),
          card('4', 'clubs'),
          card('A', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('two-pair');
        expect(result.description).toContain('Two Pair');
      });
    });

    describe('Pair', () => {
      it('should identify a pair', () => {
        const cards: Card[] = [
          card('10', 'spades'),
          card('10', 'hearts'),
          card('A', 'diamonds'),
          card('8', 'clubs'),
          card('3', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('pair');
        expect(result.description).toContain('Pair');
      });
    });

    describe('High Card', () => {
      it('should identify high card', () => {
        const cards: Card[] = [
          card('A', 'spades'),
          card('J', 'hearts'),
          card('8', 'diamonds'),
          card('4', 'clubs'),
          card('2', 'spades'),
        ];

        const result = evaluateHand(cards);
        expect(result.rank).toBe('high-card');
        expect(result.description).toContain('High Card');
      });
    });
  });

  describe('compareHands()', () => {
    it('should rank royal flush higher than straight flush', () => {
      const royalFlush = evaluateHand([
        card('A', 'spades'),
        card('K', 'spades'),
        card('Q', 'spades'),
        card('J', 'spades'),
        card('10', 'spades'),
      ]);

      const straightFlush = evaluateHand([
        card('9', 'hearts'),
        card('8', 'hearts'),
        card('7', 'hearts'),
        card('6', 'hearts'),
        card('5', 'hearts'),
      ]);

      expect(compareHands(royalFlush, straightFlush)).toBeGreaterThan(0);
    });

    it('should rank four of a kind higher than full house', () => {
      const quads = evaluateHand([
        card('K', 'spades'),
        card('K', 'hearts'),
        card('K', 'diamonds'),
        card('K', 'clubs'),
        card('A', 'spades'),
      ]);

      const fullHouse = evaluateHand([
        card('A', 'spades'),
        card('A', 'hearts'),
        card('A', 'diamonds'),
        card('K', 'clubs'),
        card('K', 'spades'),
      ]);

      expect(compareHands(quads, fullHouse)).toBeGreaterThan(0);
    });

    it('should rank flush higher than straight', () => {
      const flush = evaluateHand([
        card('A', 'diamonds'),
        card('J', 'diamonds'),
        card('8', 'diamonds'),
        card('4', 'diamonds'),
        card('2', 'diamonds'),
      ]);

      const straight = evaluateHand([
        card('A', 'spades'),
        card('K', 'hearts'),
        card('Q', 'diamonds'),
        card('J', 'clubs'),
        card('10', 'spades'),
      ]);

      expect(compareHands(flush, straight)).toBeGreaterThan(0);
    });

    it('should compare kickers for same hand type', () => {
      const pairAcesKingKicker = evaluateHand([
        card('A', 'spades'),
        card('A', 'hearts'),
        card('K', 'diamonds'),
        card('8', 'clubs'),
        card('3', 'spades'),
      ]);

      const pairAcesQueenKicker = evaluateHand([
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('Q', 'diamonds'),
        card('8', 'hearts'),
        card('3', 'hearts'),
      ]);

      expect(compareHands(pairAcesKingKicker, pairAcesQueenKicker)).toBeGreaterThan(0);
    });

    it('should detect split pot (equal hands)', () => {
      const hand1 = evaluateHand([
        card('A', 'spades'),
        card('K', 'hearts'),
        card('Q', 'diamonds'),
        card('J', 'clubs'),
        card('10', 'spades'),
      ]);

      const hand2 = evaluateHand([
        card('A', 'hearts'),
        card('K', 'diamonds'),
        card('Q', 'clubs'),
        card('J', 'spades'),
        card('10', 'hearts'),
      ]);

      expect(compareHands(hand1, hand2)).toBe(0);
    });

    it('should compare two pair by higher pair first', () => {
      const acesAndKings = evaluateHand([
        card('A', 'spades'),
        card('A', 'hearts'),
        card('K', 'diamonds'),
        card('K', 'clubs'),
        card('2', 'spades'),
      ]);

      const acesAndQueens = evaluateHand([
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('Q', 'spades'),
        card('Q', 'hearts'),
        card('3', 'spades'),
      ]);

      expect(compareHands(acesAndKings, acesAndQueens)).toBeGreaterThan(0);
    });
  });

  describe('findBestHand()', () => {
    it('should find best 5-card hand from 7 cards', () => {
      const holeCards: Card[] = [
        card('A', 'spades'),
        card('K', 'spades'),
      ];

      const communityCards: Card[] = [
        card('Q', 'spades'),
        card('J', 'spades'),
        card('10', 'spades'),
        card('2', 'hearts'),
        card('3', 'diamonds'),
      ];

      const result = findBestHand(holeCards, communityCards);
      expect(result.rank).toBe('royal-flush');
    });

    it('should find best hand when multiple hands are possible', () => {
      const holeCards: Card[] = [
        card('A', 'hearts'),
        card('A', 'spades'),
      ];

      const communityCards: Card[] = [
        card('A', 'diamonds'),
        card('K', 'hearts'),
        card('K', 'spades'),
        card('Q', 'clubs'),
        card('J', 'hearts'),
      ];

      const result = findBestHand(holeCards, communityCards);
      expect(result.rank).toBe('full-house');
    });

    it('should handle 6-card hand', () => {
      const holeCards: Card[] = [
        card('A', 'hearts'),
        card('K', 'hearts'),
      ];

      const communityCards: Card[] = [
        card('Q', 'hearts'),
        card('J', 'hearts'),
        card('10', 'hearts'),
        card('2', 'spades'),
      ];

      const result = findBestHand(holeCards, communityCards);
      expect(result.rank).toBe('royal-flush');
    });
  });

  describe('evaluateOmahaHand()', () => {
    it('should use exactly 2 hole cards and 3 community cards', () => {
      // Set up a hand where using 2 hole cards + 3 community gives a clear result
      const holeCards: Card[] = [
        card('A', 'hearts'),
        card('A', 'spades'),
        card('2', 'clubs'),
        card('3', 'clubs'),
      ];

      const communityCards: Card[] = [
        card('A', 'diamonds'),
        card('K', 'diamonds'),
        card('K', 'clubs'),
        card('7', 'hearts'),
        card('8', 'spades'),
      ];

      const result = evaluateOmahaHand(holeCards, communityCards);
      // Best hand uses AA from hole + AKK from community = Full House (Aces full of Kings)
      expect(result.rank).toBe('full-house');
    });

    it('should not use 3 hole cards even if it makes a better hand', () => {
      // In Omaha, you MUST use exactly 2 hole cards
      const holeCards: Card[] = [
        card('A', 'spades'),
        card('K', 'spades'),
        card('Q', 'spades'),
        card('2', 'hearts'),
      ];

      const communityCards: Card[] = [
        card('J', 'spades'),
        card('10', 'spades'),
        card('3', 'hearts'),
        card('4', 'clubs'),
        card('5', 'diamonds'),
      ];

      const result = evaluateOmahaHand(holeCards, communityCards);
      // Can use A-K from hole + J-10-3 spades from community for flush
      // OR K-Q from hole + J-10-x from community for straight
      // Best is flush (A-K from hole + J-10-3 spades)
      expect(['flush', 'straight']).toContain(result.rank);
    });

    it('should throw error with wrong number of hole cards', () => {
      const holeCards: Card[] = [
        card('A', 'hearts'),
        card('K', 'hearts'),
      ];

      const communityCards: Card[] = [
        card('Q', 'hearts'),
        card('J', 'hearts'),
        card('10', 'hearts'),
        card('2', 'spades'),
        card('3', 'clubs'),
      ];

      expect(() => evaluateOmahaHand(holeCards, communityCards)).toThrow();
    });
  });

  describe('Hand ranking order', () => {
    // Test the complete ranking order
    const hands = {
      royalFlush: [
        card('A', 'spades'), card('K', 'spades'), card('Q', 'spades'),
        card('J', 'spades'), card('10', 'spades'),
      ],
      straightFlush: [
        card('9', 'hearts'), card('8', 'hearts'), card('7', 'hearts'),
        card('6', 'hearts'), card('5', 'hearts'),
      ],
      fourOfAKind: [
        card('K', 'spades'), card('K', 'hearts'), card('K', 'diamonds'),
        card('K', 'clubs'), card('A', 'spades'),
      ],
      fullHouse: [
        card('Q', 'spades'), card('Q', 'hearts'), card('Q', 'diamonds'),
        card('7', 'clubs'), card('7', 'spades'),
      ],
      flush: [
        card('A', 'diamonds'), card('J', 'diamonds'), card('8', 'diamonds'),
        card('4', 'diamonds'), card('2', 'diamonds'),
      ],
      straight: [
        card('9', 'spades'), card('8', 'hearts'), card('7', 'diamonds'),
        card('6', 'clubs'), card('5', 'spades'),
      ],
      threeOfAKind: [
        card('8', 'spades'), card('8', 'hearts'), card('8', 'diamonds'),
        card('K', 'clubs'), card('3', 'spades'),
      ],
      twoPair: [
        card('J', 'spades'), card('J', 'hearts'), card('4', 'diamonds'),
        card('4', 'clubs'), card('A', 'spades'),
      ],
      pair: [
        card('10', 'spades'), card('10', 'hearts'), card('A', 'diamonds'),
        card('8', 'clubs'), card('3', 'spades'),
      ],
      highCard: [
        card('A', 'spades'), card('J', 'hearts'), card('8', 'diamonds'),
        card('4', 'clubs'), card('2', 'spades'),
      ],
    };

    it('should rank all hand types in correct order', () => {
      const evaluatedHands = {
        royalFlush: evaluateHand(hands.royalFlush),
        straightFlush: evaluateHand(hands.straightFlush),
        fourOfAKind: evaluateHand(hands.fourOfAKind),
        fullHouse: evaluateHand(hands.fullHouse),
        flush: evaluateHand(hands.flush),
        straight: evaluateHand(hands.straight),
        threeOfAKind: evaluateHand(hands.threeOfAKind),
        twoPair: evaluateHand(hands.twoPair),
        pair: evaluateHand(hands.pair),
        highCard: evaluateHand(hands.highCard),
      };

      expect(compareHands(evaluatedHands.royalFlush, evaluatedHands.straightFlush)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.straightFlush, evaluatedHands.fourOfAKind)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.fourOfAKind, evaluatedHands.fullHouse)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.fullHouse, evaluatedHands.flush)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.flush, evaluatedHands.straight)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.straight, evaluatedHands.threeOfAKind)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.threeOfAKind, evaluatedHands.twoPair)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.twoPair, evaluatedHands.pair)).toBeGreaterThan(0);
      expect(compareHands(evaluatedHands.pair, evaluatedHands.highCard)).toBeGreaterThan(0);
    });
  });
});
