import { PokerGameState } from './index';
import type { RoomPlayer, CustomRules } from '@poker/shared';

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

// Custom rules with run-it-twice enabled
const runItTwiceRules: CustomRules = {
  runItTwice: true,
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

// Custom rules with run-it-thrice enabled
const runItThriceRules: CustomRules = {
  ...runItTwiceRules,
  runItThrice: true,
};

// Custom rules with run-it disabled
const noRunItRules: CustomRules = {
  ...runItTwiceRules,
  runItTwice: false,
  runItThrice: false,
};

describe('Run It Twice/Thrice', () => {
  describe('canRunItMultiple()', () => {
    it('should return false when runItTwice is disabled', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        noRunItRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 1000));
      game.addPlayer(createMockPlayer('p2', 1, 1000));

      game.startHand();

      // Both go all-in
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });

      // Run-it should not be possible
      expect(game.canRunItMultiple()).toBe(false);
    });

    it('should return false when only 1 player is all-in', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 10000));

      game.startHand();

      // Only p1 goes all-in, p2 just calls (not all-in)
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'call', timestamp: Date.now() });

      // Only 1 player is all-in, so can't run it multiple
      expect(game.canRunItMultiple()).toBe(false);
    });

    it('should return false at river (no cards remaining)', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 1000));
      game.addPlayer(createMockPlayer('p2', 1, 1000));

      game.startHand();

      // Play through to river
      // Preflop: both check/call
      game.processAction('p1', { type: 'call', timestamp: Date.now() });
      game.processAction('p2', { type: 'check', timestamp: Date.now() });

      // Flop: both check
      game.processAction('p2', { type: 'check', timestamp: Date.now() });
      game.processAction('p1', { type: 'check', timestamp: Date.now() });

      // Turn: both check
      game.processAction('p2', { type: 'check', timestamp: Date.now() });
      game.processAction('p1', { type: 'check', timestamp: Date.now() });

      // River: both check
      game.processAction('p2', { type: 'check', timestamp: Date.now() });
      game.processAction('p1', { type: 'check', timestamp: Date.now() });

      // At showdown, can't run it multiple
      expect(game.canRunItMultiple()).toBe(false);
    });

    it('should return true when 2+ players all-in with cards remaining', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      // Use 3 players for clearer action order
      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      // In 3-handed: dealer at seat 1, SB at seat 2, BB at seat 0
      // First to act is seat 1 (dealer/UTG)

      // p2 (dealer) goes all-in
      const r1 = game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      expect(r1.valid).toBe(true);

      // p3 (SB) goes all-in
      const r2 = game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      expect(r2.valid).toBe(true);

      // p1 (BB) goes all-in
      const r3 = game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      expect(r3.valid).toBe(true);

      // Should be able to run it multiple
      expect(game.canRunItMultiple()).toBe(true);
    });
  });

  describe('processRunItChoice()', () => {
    it('should record player selection correctly', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      // Use 3 players for clearer action order
      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      // All go all-in in correct order
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      // Verify run-it prompt should be shown
      expect(game.shouldPromptRunIt()).toBe(true);

      // Start run-it prompt
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        expect(prompt.eligiblePlayerIds.length).toBeGreaterThanOrEqual(2);

        // Player 1 selects "twice"
        const result = game.processRunItChoice('p1', 2);
        expect(result).toBe(true);

        // Verify the choice was recorded
        const state = game.getState();
        const p1Choice = state.runItPrompt?.choices.find(c => c.playerId === 'p1');
        expect(p1Choice?.choice).toBe(2);
        expect(p1Choice?.confirmed).toBe(false);
      }
    });

    it('should downgrade run-it-thrice to twice when thrice is disabled', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules // Only twice enabled
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // Try to select "thrice" when only "twice" is enabled
        game.processRunItChoice('p1', 3);

        const state = game.getState();
        const p1Choice = state.runItPrompt?.choices.find(c => c.playerId === 'p1');
        // Should be downgraded to 2
        expect(p1Choice?.choice).toBe(2);
      }
    });
  });

  describe('confirmRunItChoice()', () => {
    it('should lock in player choice and prevent changes', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // Player 1 selects and confirms "twice"
        game.processRunItChoice('p1', 2);
        const confirmResult = game.confirmRunItChoice('p1');
        expect(confirmResult).toBe(true);

        // Verify choice is confirmed
        const state = game.getState();
        const p1Choice = state.runItPrompt?.choices.find(c => c.playerId === 'p1');
        expect(p1Choice?.confirmed).toBe(true);

        // Try to change after confirming - should fail
        const changeResult = game.processRunItChoice('p1', 1);
        expect(changeResult).toBe(false);
      }
    });

    it('should fail if player has not made a selection', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // Try to confirm without selecting first
        const result = game.confirmRunItChoice('p1');
        expect(result).toBe(false);
      }
    });
  });

  describe('getFinalRunItChoice()', () => {
    it('should return the choice when all players select the same', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // All select "twice"
        for (const choice of prompt.choices) {
          game.processRunItChoice(choice.playerId, 2);
          game.confirmRunItChoice(choice.playerId);
        }

        const finalChoice = game.getFinalRunItChoice();
        expect(finalChoice).toBe(2);
      }
    });

    it('should return 1 (run once) when players disagree', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // First player selects "twice", second selects "once"
        game.processRunItChoice(prompt.choices[0].playerId, 2);
        game.processRunItChoice(prompt.choices[1].playerId, 1);
        game.confirmRunItChoice(prompt.choices[0].playerId);
        game.confirmRunItChoice(prompt.choices[1].playerId);

        const finalChoice = game.getFinalRunItChoice();
        expect(finalChoice).toBe(1); // Disagreement = run once
      }
    });

    it('should default to 1 when no selection made', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // No selections made
        const finalChoice = game.getFinalRunItChoice();
        expect(finalChoice).toBe(1); // Default to run once
      }
    });
  });

  describe('allRunItChoicesConfirmed()', () => {
    it('should return true when all players have confirmed', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      expect(game.shouldPromptRunIt()).toBe(true);
      const prompt = game.startRunItPrompt();
      expect(prompt).not.toBeNull();

      if (prompt) {
        // All select
        for (const choice of prompt.choices) {
          game.processRunItChoice(choice.playerId, 2);
        }

        // Confirm all but one
        for (let i = 0; i < prompt.choices.length - 1; i++) {
          game.confirmRunItChoice(prompt.choices[i].playerId);
        }

        expect(game.allRunItChoicesConfirmed()).toBe(false);

        // Confirm the last one
        game.confirmRunItChoice(prompt.choices[prompt.choices.length - 1].playerId);

        expect(game.allRunItChoicesConfirmed()).toBe(true);
      }
    });
  });

  describe('executeRunIt()', () => {
    it('should deal correct number of boards when running twice', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));

      game.startHand();

      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });

      game.startRunItPrompt();

      // Execute run-it twice
      const boards = game.executeRunIt(2);

      expect(boards.length).toBe(2);
      expect(boards[0].communityCards.length).toBe(5);
      expect(boards[1].communityCards.length).toBe(5);
    });

    it('should deal correct number of boards when running thrice', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItThriceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));

      game.startHand();

      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });

      game.startRunItPrompt();

      // Execute run-it thrice
      const boards = game.executeRunIt(3);

      expect(boards.length).toBe(3);
      expect(boards[0].communityCards.length).toBe(5);
      expect(boards[1].communityCards.length).toBe(5);
      expect(boards[2].communityCards.length).toBe(5);
    });

    it('should deal remaining cards from current phase', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 1000));
      game.addPlayer(createMockPlayer('p2', 1, 1000));

      game.startHand();

      // Play to flop
      game.processAction('p1', { type: 'call', timestamp: Date.now() });
      game.processAction('p2', { type: 'check', timestamp: Date.now() });

      // On flop, both go all-in
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });

      // At this point, we should have 3 community cards (flop)
      // Run-it should deal turn + river for each board

      if (game.canRunItMultiple()) {
        game.startRunItPrompt();
        const boards = game.executeRunIt(2);

        expect(boards.length).toBe(2);
        // Each board should have 5 cards (3 from flop + 2 more)
        expect(boards[0].communityCards.length).toBe(5);
        expect(boards[1].communityCards.length).toBe(5);
      }
    });
  });

  describe('resolveMultipleBoards() - pot distribution', () => {
    it('should distribute pot proportionally across boards', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      // Use 3 players to simplify action order (UTG acts first)
      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));
      game.addPlayer(createMockPlayer('p3', 2, 100));

      game.startHand();

      // p1 is UTG (dealer), p2 is SB, p3 is BB
      // UTG acts first in 3-handed preflop
      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });

      if (game.shouldPromptRunIt()) {
        const prompt = game.startRunItPrompt();
        expect(prompt).not.toBeNull();

        if (prompt) {
          const boards = game.executeRunIt(2);

          // Total pot should be around 300 (100 + 100 + 100)
          // Each board should have half the total pot
          const totalDistributed = boards.reduce((sum, b) => sum + b.potShare, 0);
          expect(totalDistributed).toBe(300);
          expect(boards[0].potShare + boards[1].potShare).toBe(300);
        }
      }
    });

    it('should handle odd pot amounts (remainder goes to first board)', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      // Use 3 players with odd chips to create odd pot
      game.addPlayer(createMockPlayer('p1', 0, 101));
      game.addPlayer(createMockPlayer('p2', 1, 101));
      game.addPlayer(createMockPlayer('p3', 2, 101));

      game.startHand();

      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p3', { type: 'all-in', timestamp: Date.now() });

      if (game.shouldPromptRunIt()) {
        const prompt = game.startRunItPrompt();
        expect(prompt).not.toBeNull();

        if (prompt) {
          const boards = game.executeRunIt(2);

          // Total pot: 303 (101 * 3)
          // First board gets remainder
          const totalDistributed = boards.reduce((sum, b) => sum + b.potShare, 0);
          expect(totalDistributed).toBe(303);
        }
      }
    });
  });

  describe('Side pots with run-it-twice', () => {
    it('should handle side pots correctly when running multiple boards', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      // Different stack sizes
      game.addPlayer(createMockPlayer('short', 0, 50));
      game.addPlayer(createMockPlayer('medium', 1, 100));
      game.addPlayer(createMockPlayer('big', 2, 200));

      game.startHand();

      // All go all-in
      game.processAction('short', { type: 'all-in', timestamp: Date.now() });
      game.processAction('medium', { type: 'all-in', timestamp: Date.now() });
      game.processAction('big', { type: 'call', timestamp: Date.now() });

      // Main pot: 50 * 3 = 150 (all 3 eligible)
      // Side pot: 50 * 2 = 100 (medium and big eligible)
      // Total: 250

      if (game.canRunItMultiple()) {
        game.startRunItPrompt();
        const boards = game.executeRunIt(2);

        // Each board should handle side pots correctly
        // Total pot across all boards should equal total pot
        const totalPotShare = boards.reduce((sum, b) => sum + b.potShare, 0);
        expect(totalPotShare).toBe(250);
      }
    });
  });

  describe('skipRunIt()', () => {
    it('should run out to showdown normally when skipping run-it', () => {
      const game = new PokerGameState(
        'test-room',
        'texas-holdem',
        { smallBlind: 5, bigBlind: 10 },
        runItTwiceRules
      );

      game.addPlayer(createMockPlayer('p1', 0, 100));
      game.addPlayer(createMockPlayer('p2', 1, 100));

      game.startHand();

      game.processAction('p1', { type: 'all-in', timestamp: Date.now() });
      game.processAction('p2', { type: 'all-in', timestamp: Date.now() });

      // Skip run-it
      game.skipRunIt();

      const state = game.getState();

      // Should be at complete phase with single board
      expect(state.phase).toBe('complete');
      expect(state.communityCards.length).toBe(5);
      expect(state.runItBoards?.length || 0).toBe(0);
    });
  });
});
