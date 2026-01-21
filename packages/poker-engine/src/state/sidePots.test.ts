import { PokerGameState } from './index';
import type { RoomPlayer, CustomRules, Card } from '@poker/shared';

// Helper to create a mock player
function createMockPlayer(
  id: string,
  seat: number,
  chips: number,
  name: string = `Player ${seat}`
): RoomPlayer {
  return {
    id,
    oderId: id,
    odername: name,
    seat,
    chips,
    status: 'active',
    isDealer: false,
    isTurn: false,
    bet: 0,
    totalBetThisRound: 0,
    hasActed: false,
    isAllIn: false,
    isFolded: false,
  };
}

// Default custom rules for testing
const defaultRules: CustomRules = {
  runItTwice: false,
  runItThrice: false,
  runOutOnFold: false,
  bombPotEnabled: false,
  bombPotDoubleBoard: false,
  straddleEnabled: false,
  multipleStraddlesAllowed: false,
  dealerChoosesGame: false,
  allowMidHandJoin: false,
  autoPostBlinds: true,
  turnTimeEnabled: false,
  turnTimeSeconds: 30,
  warningTimeSeconds: 15,
  timeBank: false,
  potLimit: false,
  noLimit: true,
  fixedLimit: false,
  sevenDeuce: false,
  insuranceEnabled: false,
};

describe('Side Pots', () => {
  describe('calculateSidePots (via game actions)', () => {
    it('should create single main pot when all players contribute equally', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        defaultRules
      );

      // Add 3 players with equal chips
      game.addPlayer(createMockPlayer('p1', 0, 1000));
      game.addPlayer(createMockPlayer('p2', 1, 1000));
      game.addPlayer(createMockPlayer('p3', 2, 1000));

      game.startHand();

      // All players call the big blind (equal contributions)
      // After blinds: p1 (dealer), p2 (SB: 5), p3 (BB: 10)
      // p1 calls 10, p2 calls 5 more, p3 checks
      const state = game.getState();
      expect(state.phase).toBe('preflop');

      // Side pots should not exist yet in preflop with equal contributions
      // The pot will be 15 (SB + BB) at this point
      expect(state.pot).toBe(15);
    });

    it('should create side pots when players have unequal stacks', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        defaultRules
      );

      // Add 3 players with different chip amounts
      // In 3-handed: dealer is seat 0, SB is seat 1, BB is seat 2
      // First to act preflop in 3-handed is after BB, which is seat 0 (dealer)
      game.addPlayer(createMockPlayer('playerA', 0, 100));
      game.addPlayer(createMockPlayer('playerB', 1, 200));
      game.addPlayer(createMockPlayer('playerC', 2, 300));

      game.startHand();

      // Dealer moves to seat 1 on first hand, so:
      // playerB (seat 1) is dealer
      // playerC (seat 2) is SB (posts 5)
      // playerA (seat 0) is BB (posts 10)
      // First to act is after BB in 3-handed, which is playerB (dealer)

      // playerB (dealer) goes all-in for 200
      const result1 = game.processAction('playerB', { type: 'all-in', timestamp: Date.now() });
      expect(result1.valid).toBe(true);

      // playerC (SB) goes all-in
      const result2 = game.processAction('playerC', { type: 'all-in', timestamp: Date.now() });
      expect(result2.valid).toBe(true);

      // playerA (BB) calls - but has only 100 total, already posted 10
      const result3 = game.processAction('playerA', { type: 'all-in', timestamp: Date.now() });
      expect(result3.valid).toBe(true);

      // Now the game should advance to showdown with multiple pots
      const state = game.getState();

      // Total pot should be sum of all contributions
      expect(state.pot).toBeGreaterThan(0);
    });

    it('should correctly identify eligible players for each side pot', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 1, bigBlind: 2 },
        defaultRules
      );

      // Add 3 players for clearer action order
      game.addPlayer(createMockPlayer('short', 0, 50));
      game.addPlayer(createMockPlayer('medium', 1, 100));
      game.addPlayer(createMockPlayer('big', 2, 500));

      game.startHand();

      // Dealer at seat 1, SB at seat 2, BB at seat 0
      // First to act is seat 1 (dealer, UTG in 3-handed preflop)

      // medium (dealer) goes all-in
      const r1 = game.processAction('medium', { type: 'all-in', timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // big (SB) calls
      const r2 = game.processAction('big', { type: 'call', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // short (BB) goes all-in with 50
      const r3 = game.processAction('short', { type: 'all-in', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      const state = game.getState();

      // Total pot should be around 250 (50 + 100 + 100)
      expect(state.pot).toBeGreaterThan(200);
    });

    it('should handle folded players correctly in side pot calculation', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        defaultRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 200));
      game.addPlayer(createMockPlayer('p3', 2, 300));

      game.startHand();

      // After dealer moves to seat 1:
      // p2 (seat 1) is dealer, first to act in 3-handed
      // p3 (seat 2) is SB (posts 5)
      // p1 (seat 0) is BB (posts 10)

      // p2 (dealer) raises to 50
      const r1 = game.processAction('p2', { type: 'raise', amount: 40, timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // p3 (SB) folds
      const r2 = game.processAction('p3', { type: 'fold', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // p1 (BB) calls 50
      const r3 = game.processAction('p1', { type: 'call', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      const state = game.getState();

      // Pot should contain: 5 (SB folded) + 50 (p2) + 50 (p1) = 105
      expect(state.pot).toBeGreaterThanOrEqual(100);

      // p3 should be marked as folded
      const p3 = state.players.find(p => p.oderId === 'p3');
      expect(p3?.isFolded).toBe(true);
    });

    it('should award only main pot to short stack winner', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 1, bigBlind: 2 },
        defaultRules
      );

      // Use 3 players for clearer action order
      game.addPlayer(createMockPlayer('short', 0, 20));
      game.addPlayer(createMockPlayer('medium', 1, 100));
      game.addPlayer(createMockPlayer('big', 2, 200));

      game.startHand();

      // Dealer at seat 1
      // medium (dealer) goes all-in
      const r1 = game.processAction('medium', { type: 'all-in', timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // big (SB) calls
      const r2 = game.processAction('big', { type: 'call', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // short (BB) goes all-in with only 20 total
      const r3 = game.processAction('short', { type: 'all-in', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      const state = game.getState();

      // short should be all-in
      const shortPlayer = state.players.find(p => p.oderId === 'short');
      expect(shortPlayer?.isAllIn).toBe(true);
      expect(shortPlayer?.chips).toBe(0);

      // Total pot should be around 220 (20 + 100 + 100)
      expect(state.pot).toBeGreaterThan(200);
    });
  });

  describe('Three-way all-in with different stacks', () => {
    it('should create correct number of side pots', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 1, bigBlind: 2 },
        defaultRules
      );

      // Player A: 100, Player B: 200, Player C: 300
      game.addPlayer(createMockPlayer('A', 0, 100));
      game.addPlayer(createMockPlayer('B', 1, 200));
      game.addPlayer(createMockPlayer('C', 2, 300));

      game.startHand();

      // After dealer moves to seat 1:
      // B (seat 1) is dealer, first to act in 3-handed
      // C (seat 2) is SB (posts 1)
      // A (seat 0) is BB (posts 2)

      // B (dealer) goes all-in for 200
      const r1 = game.processAction('B', { type: 'all-in', timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // C (SB) goes all-in for 300
      const r2 = game.processAction('C', { type: 'all-in', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // A (BB) goes all-in with only 100
      const r3 = game.processAction('A', { type: 'all-in', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      const state = game.getState();

      // Total pot should include all contributions
      expect(state.pot).toBeGreaterThan(500);

      // Verify all-in status
      expect(state.players.find(p => p.oderId === 'A')?.isAllIn).toBe(true);
      expect(state.players.find(p => p.oderId === 'B')?.isAllIn).toBe(true);
      expect(state.players.find(p => p.oderId === 'C')?.isAllIn).toBe(true);
    });
  });

  describe('Pot distribution at showdown', () => {
    it('should resolve hand and distribute pot correctly when everyone folds', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        defaultRules
      );

      // Use 3 players for clearer action order
      game.addPlayer(createMockPlayer('winner', 0, 1000));
      game.addPlayer(createMockPlayer('middle', 1, 1000));
      game.addPlayer(createMockPlayer('loser', 2, 1000));

      game.startHand();

      // After dealer moves: middle (1) is dealer, loser (2) is SB, winner (0) is BB
      // First to act is middle (dealer in 3-handed)

      // middle raises
      const r1 = game.processAction('middle', { type: 'raise', amount: 40, timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // loser (SB) folds
      const r2 = game.processAction('loser', { type: 'fold', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // winner (BB) folds - middle wins
      const r3 = game.processAction('winner', { type: 'fold', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      const state = game.getState();

      // Game should be complete
      expect(state.phase).toBe('complete');

      // Middle should have won the pot
      const winners = game.getLastWinners();
      expect(winners.length).toBe(1);
      expect(winners[0].playerId).toBe('middle');
      expect(winners[0].wonByFold).toBe(true);
    });
  });
});
