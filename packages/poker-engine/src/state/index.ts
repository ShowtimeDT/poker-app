import type {
  Card,
  GameState,
  GamePhase,
  GameVariant,
  RoomPlayer,
  PlayerAction,
  ActionType,
  SidePot,
  WinnerInfo,
  CustomRules,
  SevenDeuceBonusInfo,
  Straddle,
  StraddlePrompt,
  RunItChoice,
  RunItPrompt,
  Board,
  HandResult,
} from '@poker/shared';
import { Deck } from '../deck';
import { createVariant, PokerVariant } from '../variants';
import { compareHands } from '../evaluator';

/**
 * Check if hole cards are 7-2 (suited or offsuit)
 */
function hasSevenDeuce(holeCards: Card[]): boolean {
  if (holeCards.length !== 2) return false;
  const ranks = holeCards.map(c => c.rank).sort();
  return ranks[0] === '2' && ranks[1] === '7';
}

/**
 * Game State Machine
 * Manages the state of a poker hand
 */
export class PokerGameState {
  private roomId: string;
  private handNumber: number = 0;
  private phase: GamePhase = 'waiting';
  private players: RoomPlayer[] = [];
  private communityCards: Card[] = [];
  private communityCards2: Card[] = [];  // Second board for dual-board bomb pots
  private pot: number = 0;
  private sidePots: SidePot[] = [];
  private currentBet: number = 0;
  private minRaise: number = 0;
  private dealerSeat: number = 0;
  private currentPlayerSeat: number = 0;
  private deck: Deck;
  private variant: PokerVariant;
  private stakes: { smallBlind: number; bigBlind: number; ante?: number };
  private customRules: CustomRules;
  private holeCards: Map<string, Card[]> = new Map();
  private lastAction?: PlayerAction & { playerId: string };
  private handHistory: (PlayerAction & { playerId: string })[] = [];
  private isBombPot: boolean = false;
  private isDualBoard: boolean = false;  // True when using dual boards
  private lastWinners: WinnerInfo[] = [];
  private isRunout: boolean = false;
  private runoutStartPhase: GamePhase | null = null;
  private ghostCards: Card[] = [];  // Cards that "would have come" on run out on fold
  private sevenDeuceBonus: SevenDeuceBonusInfo | null = null;  // 7-2 game bonus info
  private straddles: Straddle[] = [];  // Active straddles for this hand
  private straddlePrompt: StraddlePrompt | null = null;  // Current straddle prompt
  private lastStraddleSeat: number | null = null;  // Seat of last straddler (acts last preflop)
  private runItPrompt: RunItPrompt | null = null;  // Run it decision prompt
  private runItBoards: Board[] = [];  // Multiple boards when running it multiple times

  constructor(
    roomId: string,
    variant: GameVariant,
    stakes: { smallBlind: number; bigBlind: number; ante?: number },
    customRules: CustomRules
  ) {
    this.roomId = roomId;
    this.variant = createVariant(variant);
    this.stakes = stakes;
    this.customRules = customRules;
    this.deck = new Deck();
    // Use big blind for min raise, or ante if no blinds, or default to 1
    this.minRaise = stakes.bigBlind || stakes.ante || 1;
  }

  /**
   * Update stakes (takes effect next hand)
   */
  updateStakes(stakes: { smallBlind: number; bigBlind: number; ante?: number }): void {
    this.stakes = stakes;
  }

  /**
   * Get current game state (sanitized for broadcast)
   */
  getState(forPlayerId?: string): GameState {
    // Debug logging
    if (forPlayerId) {
      console.log(`[GameState] getState for player: ${forPlayerId}`);
      console.log(`[GameState] holeCards map keys:`, Array.from(this.holeCards.keys()));
      const hasCards = this.holeCards.has(forPlayerId);
      console.log(`[GameState] Player ${forPlayerId} has cards in map: ${hasCards}`);
    }

    // Only reveal cards at actual showdown (multiple players remaining)
    // Don't reveal if hand was won by fold (muck by default)
    const isShowdown = this.phase === 'showdown' || this.phase === 'complete';
    const wonByFold = this.lastWinners.length > 0 && this.lastWinners.some(w => w.wonByFold);
    const shouldRevealCards = isShowdown && !wonByFold;

    const players = this.players.map(p => ({
      ...p,
      holeCards: (forPlayerId === p.oderId || (shouldRevealCards && !p.isFolded))
        ? this.holeCards.get(p.oderId)
        : undefined,
    }));

    // Include valid actions for the requesting player if it's their turn and game is active
    const isGameActive = this.phase !== 'waiting' && this.phase !== 'complete' && this.phase !== 'showdown';
    const requestingPlayer = forPlayerId ? this.players.find(p => p.oderId === forPlayerId) : undefined;
    const isMyTurn = requestingPlayer && requestingPlayer.seat === this.currentPlayerSeat && isGameActive;
    const validActions = isMyTurn ? this.getValidActions() : undefined;

    return {
      roomId: this.roomId,
      handNumber: this.handNumber,
      phase: this.phase,
      players,
      communityCards: this.communityCards,
      communityCards2: this.isDualBoard ? this.communityCards2 : undefined,
      ghostCards: this.ghostCards.length > 0 ? this.ghostCards : undefined,
      pot: this.pot + this.sidePots.reduce((sum, sp) => sum + sp.amount, 0),
      sidePots: this.sidePots,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerSeat: this.dealerSeat,
      smallBlindSeat: this.getSmallBlindSeat(),
      bigBlindSeat: this.getBigBlindSeat(),
      currentPlayerSeat: this.currentPlayerSeat,
      lastAction: this.lastAction,
      validActions,
      isRunout: this.isRunout,
      runoutStartPhase: this.runoutStartPhase ?? undefined,
      isBombPot: this.isBombPot,
      isDualBoard: this.isDualBoard,
      sevenDeuceBonus: this.sevenDeuceBonus ?? undefined,
      straddles: this.straddles.length > 0 ? this.straddles : undefined,
      straddlePrompt: this.straddlePrompt ?? undefined,
      runItPrompt: this.runItPrompt ?? undefined,
      runItBoards: this.runItBoards.length > 0 ? this.runItBoards : undefined,
    };
  }

  /**
   * Add a player to the table
   */
  addPlayer(player: RoomPlayer): boolean {
    if (this.players.find(p => p.seat === player.seat)) {
      return false; // Seat taken
    }
    this.players.push(player);
    return true;
  }

  /**
   * Remove a player from the table
   */
  removePlayer(oderId: string): void {
    this.players = this.players.filter(p => p.oderId !== oderId);
    this.holeCards.delete(oderId);
  }

  /**
   * Get active (non-folded, non-all-in, with chips) players
   */
  private getActivePlayers(): RoomPlayer[] {
    return this.players.filter(p => !p.isFolded && !p.isAllIn && p.status === 'active' && p.chips > 0);
  }

  /**
   * Get players still in the hand
   */
  private getPlayersInHand(): RoomPlayer[] {
    return this.players.filter(p => !p.isFolded && p.status === 'active');
  }

  /**
   * Start a new hand
   * @param bombPotAmount - If provided, everyone antes this amount (bomb pot)
   * @param dualBoard - If true and bomb pot, deal two separate boards
   */
  startHand(bombPotAmount?: number, dualBoard?: boolean): void {
    console.log('[GameState] startHand called');
    console.log('[GameState] this.players count:', this.players.length);
    console.log('[GameState] this.players:', this.players.map(p => ({ oderId: p.oderId, status: p.status, seat: p.seat, chips: p.chips })));

    // IMPORTANT: Reset player states FIRST before checking active players
    // This ensures folded players from previous hand can participate
    for (const player of this.players) {
      player.bet = 0;
      player.totalBetThisRound = 0;
      player.hasActed = false;
      player.isAllIn = false;
      player.isFolded = false;
      player.lastAction = undefined;
    }

    console.log('[GameState] getActivePlayers count after reset:', this.getActivePlayers().length);

    if (this.getActivePlayers().length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    this.handNumber++;
    this.phase = 'starting';
    this.communityCards = [];
    this.communityCards2 = [];  // Reset second board
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.holeCards.clear();
    this.handHistory = [];
    this.isBombPot = !!bombPotAmount;
    this.isDualBoard = !!(dualBoard && bombPotAmount);  // Only dual board if bomb pot
    this.lastWinners = [];
    this.isRunout = false;
    this.runoutStartPhase = null;
    this.ghostCards = [];
    this.sevenDeuceBonus = null;
    this.straddles = [];
    this.straddlePrompt = null;
    this.lastStraddleSeat = null;
    this.runItPrompt = null;
    this.runItBoards = [];

    // Move dealer button
    this.dealerSeat = this.getNextActiveSeat(this.dealerSeat);

    // Shuffle and deal
    this.deck.reset();

    if (this.isBombPot && bombPotAmount) {
      // Everyone antes the bomb pot amount
      for (const player of this.getActivePlayers()) {
        const amount = Math.min(bombPotAmount, player.chips);
        player.chips -= amount;
        this.pot += amount;
      }
      this.phase = 'flop';
      this.dealCommunityCards();
      // Deal second board if dual board
      if (this.isDualBoard) {
        this.dealCommunityCards2();
      }
    } else {
      // Normal blinds
      this.postBlinds();
      this.phase = 'preflop';
    }

    // Deal hole cards
    const hands = this.variant.dealHoleCards(this.deck, this.getActivePlayers().length);
    const activePlayers = this.getActivePlayers().sort((a, b) => a.seat - b.seat);

    console.log('[GameState] Dealing cards to', activePlayers.length, 'players');
    activePlayers.forEach((player, idx) => {
      this.holeCards.set(player.oderId, hands[idx]);
      console.log('[GameState] Dealt cards to', player.oderId, ':', hands[idx]);
    });
    console.log('[GameState] holeCards map size:', this.holeCards.size);
    console.log('[GameState] holeCards map keys:', Array.from(this.holeCards.keys()));

    // Set first to act
    this.setFirstToAct();
  }

  /**
   * Post blinds and collect antes
   */
  private postBlinds(): void {
    // First, collect antes from all active players (if ante is set)
    if (this.stakes.ante && this.stakes.ante > 0) {
      for (const player of this.getActivePlayers()) {
        const anteAmount = Math.min(this.stakes.ante, player.chips);
        player.chips -= anteAmount;
        this.pot += anteAmount;
        // Note: antes don't count toward totalBetThisRound for betting purposes
      }
    }

    // Then post blinds (if set)
    const sbSeat = this.getSmallBlindSeat();
    const bbSeat = this.getBigBlindSeat();

    const sbPlayer = this.players.find(p => p.seat === sbSeat);
    const bbPlayer = this.players.find(p => p.seat === bbSeat);

    if (sbPlayer && this.stakes.smallBlind > 0) {
      const sbAmount = Math.min(this.stakes.smallBlind, sbPlayer.chips);
      sbPlayer.chips -= sbAmount;
      sbPlayer.bet = sbAmount;
      sbPlayer.totalBetThisRound = sbAmount;
      this.pot += sbAmount;
    }

    if (bbPlayer && this.stakes.bigBlind > 0) {
      const bbAmount = Math.min(this.stakes.bigBlind, bbPlayer.chips);
      bbPlayer.chips -= bbAmount;
      bbPlayer.bet = bbAmount;
      bbPlayer.totalBetThisRound = bbAmount;
      this.pot += bbAmount;
      this.currentBet = bbAmount;
    }
  }

  /**
   * Get small blind seat
   */
  private getSmallBlindSeat(): number {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 2) {
      // Heads up: dealer is SB
      return this.dealerSeat;
    }
    return this.getNextActiveSeat(this.dealerSeat);
  }

  /**
   * Get big blind seat
   */
  private getBigBlindSeat(): number {
    return this.getNextActiveSeat(this.getSmallBlindSeat());
  }

  /**
   * Get next active seat
   */
  private getNextActiveSeat(fromSeat: number): number {
    const activePlayers = this.getActivePlayers().map(p => p.seat).sort((a, b) => a - b);
    if (activePlayers.length === 0) return fromSeat;

    for (const seat of activePlayers) {
      if (seat > fromSeat) return seat;
    }
    return activePlayers[0];
  }

  /**
   * Set first player to act
   */
  private setFirstToAct(): void {
    const activePlayers = this.getActivePlayers();

    if (this.phase === 'preflop') {
      // Pre-flop: UTG (after big blind) for 3+ players, or small blind (dealer) for heads-up
      if (activePlayers.length === 2) {
        // Heads-up: dealer/SB acts first pre-flop
        this.currentPlayerSeat = this.dealerSeat;
      } else {
        // If there are straddles, first to act is after the last straddler
        // Last straddler acts last in the preflop round
        const lastStraddleSeat = this.straddles.length > 0
          ? this.straddles[this.straddles.length - 1].seat
          : this.getBigBlindSeat();
        this.currentPlayerSeat = this.getNextActiveSeat(lastStraddleSeat);
      }
    } else {
      // Post-flop: first active player after dealer (starts at small blind position)
      this.currentPlayerSeat = this.getNextActiveSeat(this.dealerSeat);
    }
  }

  /**
   * Get the seat that can post the next straddle (if straddles enabled)
   * Returns null if no more straddles allowed
   */
  getNextStraddleSeat(): number | null {
    if (!this.customRules.straddleEnabled) return null;
    if (this.phase !== 'preflop') return null;
    if (this.isBombPot) return null; // No straddles during bomb pots

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 2) return null; // No straddles heads-up

    // First straddle is UTG (after big blind)
    if (this.straddles.length === 0) {
      const bbSeat = this.getBigBlindSeat();
      return this.getNextActiveSeat(bbSeat);
    }

    // Next straddle is after the last straddler
    const lastStraddle = this.straddles[this.straddles.length - 1];
    const nextSeat = this.getNextActiveSeat(lastStraddle.seat);

    // Don't allow straddle if it would reach the dealer
    if (nextSeat === this.dealerSeat) return null;

    return nextSeat;
  }

  /**
   * Get the amount for the next straddle
   */
  getNextStraddleAmount(): number {
    if (this.straddles.length === 0) {
      return this.stakes.bigBlind * 2;
    }
    return this.straddles[this.straddles.length - 1].amount * 2;
  }

  /**
   * Start the straddle prompt phase
   * Returns info about the straddle: prompt for player decision, or auto-straddle if preference is enabled
   * Note: Auto-straddle (via checkbox) only applies to UTG position (first straddle).
   * Double straddles (UTG+1 and beyond) ALWAYS show a popup prompt.
   */
  startStraddlePrompt(): { prompt: StraddlePrompt | null; autoStraddle: boolean } {
    const nextSeat = this.getNextStraddleSeat();
    if (nextSeat === null) return { prompt: null, autoStraddle: false };

    const player = this.players.find(p => p.seat === nextSeat);
    if (!player) return { prompt: null, autoStraddle: false };

    const amount = this.getNextStraddleAmount();

    // Check if player can afford the straddle
    if (player.chips < amount) return { prompt: null, autoStraddle: false };

    // Get previous straddler info for the prompt message
    const lastStraddle = this.straddles[this.straddles.length - 1];
    const previousStraddler = lastStraddle
      ? this.players.find(p => p.oderId === lastStraddle.playerId)
      : null;

    const isDoubleStraddle = this.straddles.length > 0;

    this.straddlePrompt = {
      seat: nextSeat,
      playerId: player.oderId,
      amount,
      timeoutSeconds: 5,  // 5 seconds to decide (starts after hand-end delay)
      previousStraddlerName: previousStraddler?.odername,
      isDoubleStraddle,
    };

    // Auto-straddle preference ONLY applies to UTG (first straddle position)
    // Double straddles (UTG+1 and beyond) always require manual confirmation via popup
    const hasAutoStraddle = !isDoubleStraddle && player.straddleNextHand === true;

    return { prompt: this.straddlePrompt, autoStraddle: hasAutoStraddle };
  }

  /**
   * Process a straddle decision
   * Returns the next straddle info or null if straddle phase is complete
   */
  processStraddle(playerId: string, accepted: boolean): { success: boolean; next: { prompt: StraddlePrompt | null; autoStraddle: boolean } | null } {
    if (!this.straddlePrompt || this.straddlePrompt.playerId !== playerId) {
      return { success: false, next: null };
    }

    const player = this.players.find(p => p.oderId === playerId);
    if (!player) {
      return { success: false, next: null };
    }

    if (accepted) {
      const amount = this.straddlePrompt.amount;

      // Post the straddle
      player.chips -= amount;
      player.bet = amount;
      player.totalBetThisRound = amount;
      this.pot += amount;
      this.currentBet = amount;

      this.straddles.push({
        playerId: player.oderId,
        amount,
        seat: player.seat,
      });

      this.lastStraddleSeat = player.seat;
      // Note: straddleNextHand preference is NOT cleared - it persists until user manually unchecks it
    }

    // Clear current prompt
    this.straddlePrompt = null;

    // If accepted, check for next straddler
    // If declined, straddle phase ends
    if (accepted) {
      const next = this.startStraddlePrompt();
      return { success: true, next };
    }

    return { success: true, next: null };
  }

  /**
   * End the straddle phase and set up preflop action
   * Called after straddle prompts are done
   */
  endStraddlePhase(): void {
    this.straddlePrompt = null;
    this.setFirstToAct();
  }

  // ===========================================================================
  // RUN IT TWICE/THRICE
  // ===========================================================================

  /**
   * Check if we can run it multiple times (all-in with cards to come)
   */
  canRunItMultiple(): boolean {
    if (!this.customRules.runItTwice) return false;
    if (this.communityCards.length >= 5) return false; // Already at river
    if (this.isBombPot) return false; // Skip for bomb pots
    if (this.isDualBoard) return false; // Already multi-board

    // Need at least 2 players all-in
    const activePlayers = this.getActivePlayers();
    const allInPlayers = activePlayers.filter(p => p.isAllIn);
    return allInPlayers.length >= 2;
  }

  /**
   * Start the run-it prompt phase
   * Returns the prompt or null if can't run multiple
   */
  startRunItPrompt(): RunItPrompt | null {
    if (!this.canRunItMultiple()) return null;

    const eligiblePlayers = this.getPlayersInHand().filter(p => p.isAllIn);
    if (eligiblePlayers.length < 2) return null;

    this.runItPrompt = {
      eligiblePlayerIds: eligiblePlayers.map(p => p.oderId),
      timeoutSeconds: 5,
      choices: eligiblePlayers.map(p => ({ playerId: p.oderId, choice: null })),
    };

    return this.runItPrompt;
  }

  /**
   * Process a run-it choice from a player
   */
  processRunItChoice(playerId: string, choice: RunItChoice): boolean {
    if (!this.runItPrompt) return false;

    const playerChoice = this.runItPrompt.choices.find(c => c.playerId === playerId);
    if (!playerChoice) return false;

    // Validate choice
    if (choice === 3 && !this.customRules.runItThrice) {
      choice = 2; // Downgrade to twice if thrice not enabled
    }
    if (choice === 2 && !this.customRules.runItTwice) {
      choice = 1; // Downgrade to once if twice not enabled
    }

    playerChoice.choice = choice;
    return true;
  }

  /**
   * Check if all run-it choices have been made
   */
  allRunItChoicesMade(): boolean {
    if (!this.runItPrompt) return false;
    return this.runItPrompt.choices.every(c => c.choice !== null);
  }

  /**
   * Get the final run-it choice (minimum of all choices)
   */
  getFinalRunItChoice(): RunItChoice {
    if (!this.runItPrompt) return 1;

    const choices = this.runItPrompt.choices
      .map(c => c.choice)
      .filter((c): c is RunItChoice => c !== null);

    if (choices.length === 0) return 1;
    return Math.min(...choices) as RunItChoice;
  }

  /**
   * Execute run-it multiple times
   * Deals the remaining cards for each board and resolves
   */
  executeRunIt(times: RunItChoice): Board[] {
    this.runItPrompt = null;
    this.isRunout = true;
    this.runoutStartPhase = this.phase;

    const remaining = 5 - this.communityCards.length;
    const existingCards = [...this.communityCards];

    this.runItBoards = [];

    for (let i = 0; i < times; i++) {
      // Start from existing community cards
      const boardCards = [...existingCards];

      // Deal remaining cards for this board
      for (let j = 0; j < remaining; j++) {
        const card = this.deck.deal();
        if (card) boardCards.push(card);
      }

      // Calculate pot share (divide evenly, give remainder to first board)
      const potShare = Math.floor(this.pot / times) + (i === 0 ? this.pot % times : 0);

      this.runItBoards.push({
        index: i,
        communityCards: boardCards,
        winners: [],
        potShare,
      });
    }

    // Resolve each board
    this.resolveMultipleBoards();

    return this.runItBoards;
  }

  /**
   * Resolve multiple boards and distribute pot shares
   */
  private resolveMultipleBoards(): void {
    const playersInHand = this.getPlayersInHand();
    const winners: WinnerInfo[] = [];

    for (const board of this.runItBoards) {
      // Evaluate hands for this board
      const playerResults = playersInHand.map(player => {
        const holeCards = this.holeCards.get(player.oderId) || [];
        const result = this.variant.evaluatePlayerHand(holeCards, board.communityCards);
        return { player, result };
      });

      // Find best hand(s)
      const sorted = playerResults.sort((a, b) => compareHands(b.result, a.result));
      const bestValue = sorted[0].result.value;
      const boardWinners = sorted.filter(r => r.result.value === bestValue);

      // Split pot share among winners
      const splitAmount = Math.floor(board.potShare / boardWinners.length);
      let remainder = board.potShare % boardWinners.length;

      for (const { player, result } of boardWinners) {
        const amount = splitAmount + (remainder > 0 ? 1 : 0);
        remainder--;
        player.chips += amount;

        board.winners.push(player.oderId);

        winners.push({
          playerId: player.oderId,
          amount,
          hand: result,
          potType: 'main',
          boardIndex: board.index,
        });
      }
    }

    this.phase = 'complete';
    this.lastWinners = winners;
    this.pot = 0;
    this.communityCards = this.runItBoards[0]?.communityCards || this.communityCards;
  }

  /**
   * Check if we're in run-it prompt phase
   */
  isInRunItPrompt(): boolean {
    return this.runItPrompt !== null;
  }

  /**
   * Skip run-it and do normal runout
   */
  skipRunIt(): void {
    this.runItPrompt = null;
    this.runOutToShowdown();
  }

  /**
   * Process a player action
   */
  processAction(oderId: string, action: PlayerAction): { valid: boolean; error?: string } {
    const player = this.players.find(p => p.oderId === oderId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    if (player.seat !== this.currentPlayerSeat) {
      return { valid: false, error: 'Not your turn' };
    }

    if (player.isFolded || player.isAllIn) {
      return { valid: false, error: 'Cannot act' };
    }

    const result = this.executeAction(player, action);
    if (!result.valid) return result;

    // Record action
    this.lastAction = { ...action, playerId: oderId };
    this.handHistory.push(this.lastAction);
    player.lastAction = action;
    player.hasActed = true;

    // Move to next player or phase
    this.advanceGame();

    return { valid: true };
  }

  /**
   * Execute the action
   */
  private executeAction(player: RoomPlayer, action: PlayerAction): { valid: boolean; error?: string } {
    const toCall = this.currentBet - player.totalBetThisRound;

    switch (action.type) {
      case 'fold':
        player.isFolded = true;
        return { valid: true };

      case 'check':
        if (toCall > 0) {
          return { valid: false, error: 'Cannot check, must call or fold' };
        }
        return { valid: true };

      case 'call':
        if (toCall <= 0) {
          return { valid: false, error: 'Nothing to call' };
        }
        const callAmount = Math.min(toCall, player.chips);
        player.chips -= callAmount;
        player.bet += callAmount;
        player.totalBetThisRound += callAmount;
        this.pot += callAmount;
        if (player.chips === 0) player.isAllIn = true;
        return { valid: true };

      case 'bet':
      case 'raise':
        const amount = action.amount || 0;
        const totalBet = action.type === 'bet' ? amount : this.currentBet + amount;

        if (totalBet < this.currentBet + this.minRaise && player.chips > totalBet - player.totalBetThisRound) {
          return { valid: false, error: `Minimum raise is ${this.minRaise}` };
        }

        const betAmount = Math.min(totalBet - player.totalBetThisRound, player.chips);
        player.chips -= betAmount;
        player.bet += betAmount;
        player.totalBetThisRound += betAmount;
        this.pot += betAmount;

        if (player.totalBetThisRound > this.currentBet) {
          this.minRaise = player.totalBetThisRound - this.currentBet;
          this.currentBet = player.totalBetThisRound;

          // Reset hasActed for other players
          for (const p of this.getActivePlayers()) {
            if (p.oderId !== player.oderId) {
              p.hasActed = false;
            }
          }
        }

        if (player.chips === 0) player.isAllIn = true;
        return { valid: true };

      case 'all-in':
        const allInAmount = player.chips;
        player.chips = 0;
        player.bet += allInAmount;
        player.totalBetThisRound += allInAmount;
        this.pot += allInAmount;
        player.isAllIn = true;

        if (player.totalBetThisRound > this.currentBet) {
          this.minRaise = Math.max(this.minRaise, player.totalBetThisRound - this.currentBet);
          this.currentBet = player.totalBetThisRound;

          for (const p of this.getActivePlayers()) {
            if (p.oderId !== player.oderId) {
              p.hasActed = false;
            }
          }
        }
        return { valid: true };

      default:
        return { valid: false, error: 'Invalid action' };
    }
  }

  /**
   * Advance the game state
   */
  private advanceGame(): void {
    const activePlayers = this.getActivePlayers();
    const playersInHand = this.getPlayersInHand();

    // Check for hand over (everyone folded except one)
    if (playersInHand.length === 1) {
      this.phase = 'showdown';
      this.resolveHand();
      return;
    }

    // Check if betting round is complete
    const allActed = activePlayers.every(p => p.hasActed);
    const allMatched = activePlayers.every(p => p.totalBetThisRound === this.currentBet || p.isAllIn);

    if (allActed && allMatched) {
      // Move to next phase
      this.advancePhase();
    } else {
      // Move to next player
      this.currentPlayerSeat = this.getNextActiveSeat(this.currentPlayerSeat);
    }
  }

  /**
   * Advance to next phase
   */
  private advancePhase(): void {
    const nextPhase = this.variant.getNextPhase(this.phase);

    // If next phase is showdown, complete, or null - resolve the hand
    if (!nextPhase || nextPhase === 'complete' || nextPhase === 'showdown') {
      this.phase = 'showdown';
      this.resolveHand();
      return;
    }

    // Reset for new betting round
    this.phase = nextPhase;
    this.currentBet = 0;
    this.minRaise = this.stakes.bigBlind || this.stakes.ante || 1;

    for (const player of this.players) {
      player.bet = 0;
      player.totalBetThisRound = 0;
      player.hasActed = false;
    }

    // Deal community cards if applicable
    if (['flop', 'turn', 'river'].includes(nextPhase)) {
      this.dealCommunityCards();
      // Deal to second board if dual board
      if (this.isDualBoard) {
        this.dealCommunityCards2();
      }
    }

    // Check if we need to run to showdown (all-in)
    if (this.getActivePlayers().length <= 1) {
      this.runOutToShowdown();
    } else {
      this.setFirstToAct();
    }
  }

  /**
   * Deal community cards for current phase (board 1)
   */
  private dealCommunityCards(): void {
    const newCards = this.variant.dealCommunityCards(this.deck, this.phase);
    this.communityCards.push(...newCards);
  }

  /**
   * Deal community cards for board 2 (dual-board bomb pots)
   */
  private dealCommunityCards2(): void {
    const newCards = this.variant.dealCommunityCards(this.deck, this.phase);
    this.communityCards2.push(...newCards);
  }

  /**
   * Run out remaining cards when all players are all-in
   */
  private runOutToShowdown(): void {
    // Mark this as a runout and remember where we started
    this.isRunout = true;
    this.runoutStartPhase = this.phase;

    while (this.phase !== 'showdown' && this.phase !== 'complete') {
      const nextPhase = this.variant.getNextPhase(this.phase);
      if (!nextPhase || nextPhase === 'complete') {
        this.phase = 'showdown';
        break;
      }
      this.phase = nextPhase;
      this.dealCommunityCards();
      // Deal to second board if dual board
      if (this.isDualBoard) {
        this.dealCommunityCards2();
      }
    }
    this.resolveHand();
  }

  /**
   * Resolve the hand and distribute pot
   */
  resolveHand(): WinnerInfo[] {
    // If already resolved (phase is complete), return cached winners
    if (this.phase === 'complete' && this.lastWinners.length > 0) {
      return this.lastWinners;
    }

    const playersInHand = this.getPlayersInHand();
    const winners: WinnerInfo[] = [];

    if (playersInHand.length === 1) {
      // Everyone else folded
      const winner = playersInHand[0];
      winner.chips += this.pot;
      winners.push({
        playerId: winner.oderId,
        amount: this.pot,
        potType: 'main',
        wonByFold: true,
      });

      // Generate ghost cards if runOutOnFold is enabled
      if (this.customRules.runOutOnFold && this.communityCards.length < 5) {
        const cardsNeeded = 5 - this.communityCards.length;
        this.ghostCards = this.deck.dealMultiple(cardsNeeded);
      }
    } else if (this.isDualBoard) {
      // Dual-board bomb pot - split pot 50/50 between boards
      winners.push(...this.resolveDualBoardHand(playersInHand));
    } else {
      // Showdown - evaluate hands
      const handResults: { player: RoomPlayer; result: HandResult }[] = [];

      for (const player of playersInHand) {
        const holeCards = this.holeCards.get(player.oderId) || [];
        const result = this.variant.evaluatePlayerHand(holeCards, this.communityCards);
        handResults.push({ player, result });
      }

      // Sort by hand value (highest first)
      handResults.sort((a, b) => compareHands(b.result, a.result));

      // Find winner(s) - handle ties
      const bestValue = handResults[0].result.value;
      const winningPlayers = handResults.filter(h => h.result.value === bestValue);

      const splitAmount = Math.floor(this.pot / winningPlayers.length);
      let remainder = this.pot % winningPlayers.length;

      for (const { player, result } of winningPlayers) {
        const amount = splitAmount + (remainder > 0 ? 1 : 0);
        remainder--;
        player.chips += amount;
        winners.push({
          playerId: player.oderId,
          amount,
          hand: result,
          potType: 'main',
        });
      }

      // Check for 7-2 bonus (only on showdown, single winner, with 7-2 enabled)
      if (this.customRules.sevenDeuce && winningPlayers.length === 1) {
        const winner = winningPlayers[0].player;
        const winnerCards = this.holeCards.get(winner.oderId);

        if (winnerCards && hasSevenDeuce(winnerCards)) {
          const bonusPerPlayer = this.customRules.sevenDeuceBonus || 0;
          const contributions: { playerId: string; amount: number }[] = [];
          let totalBonus = 0;

          // Collect bonus from each player that was dealt in (not folded before showdown)
          // Note: We collect from everyone who had cards, not just players still in hand
          for (const player of this.players) {
            // Skip the winner and players who weren't dealt in
            if (player.oderId === winner.oderId) continue;
            if (!this.holeCards.has(player.oderId)) continue;

            // Collect the bonus (minimum of their chips or the bonus amount)
            const contribution = Math.min(bonusPerPlayer, player.chips);
            if (contribution > 0) {
              player.chips -= contribution;
              totalBonus += contribution;
              contributions.push({ playerId: player.oderId, amount: contribution });
            }
          }

          if (totalBonus > 0) {
            winner.chips += totalBonus;
            this.sevenDeuceBonus = {
              winnerId: winner.oderId,
              totalBonus,
              contributions,
            };
          }
        }
      }
    }

    this.phase = 'complete';
    this.lastWinners = winners;
    return winners;
  }

  /**
   * Resolve a dual-board bomb pot hand
   * Each board awards 50% of the pot
   */
  private resolveDualBoardHand(playersInHand: RoomPlayer[]): WinnerInfo[] {
    const winners: WinnerInfo[] = [];
    const halfPot = Math.floor(this.pot / 2);
    const potRemainder = this.pot % 2;  // Give extra chip to board 1 winner if odd pot

    // Evaluate Board 1
    const board1Results: { player: RoomPlayer; result: HandResult }[] = [];
    for (const player of playersInHand) {
      const holeCards = this.holeCards.get(player.oderId) || [];
      const result = this.variant.evaluatePlayerHand(holeCards, this.communityCards);
      board1Results.push({ player, result });
    }
    board1Results.sort((a, b) => compareHands(b.result, a.result));
    const board1BestValue = board1Results[0].result.value;
    const board1Winners = board1Results.filter(h => h.result.value === board1BestValue);

    // Evaluate Board 2
    const board2Results: { player: RoomPlayer; result: HandResult }[] = [];
    for (const player of playersInHand) {
      const holeCards = this.holeCards.get(player.oderId) || [];
      const result = this.variant.evaluatePlayerHand(holeCards, this.communityCards2);
      board2Results.push({ player, result });
    }
    board2Results.sort((a, b) => compareHands(b.result, a.result));
    const board2BestValue = board2Results[0].result.value;
    const board2Winners = board2Results.filter(h => h.result.value === board2BestValue);

    // Track total winnings per player (to aggregate chips award)
    const playerWinnings = new Map<string, number>();

    // Distribute Board 1 (50% of pot + any odd chip)
    const board1Pot = halfPot + potRemainder;
    const board1Split = Math.floor(board1Pot / board1Winners.length);
    let board1Remainder = board1Pot % board1Winners.length;

    for (const { player, result } of board1Winners) {
      const amount = board1Split + (board1Remainder > 0 ? 1 : 0);
      board1Remainder--;
      playerWinnings.set(player.oderId, (playerWinnings.get(player.oderId) || 0) + amount);
      winners.push({
        playerId: player.oderId,
        amount,
        hand: result,
        potType: 'main',
        boardIndex: 0,
      });
    }

    // Distribute Board 2 (50% of pot)
    const board2Pot = halfPot;
    const board2Split = Math.floor(board2Pot / board2Winners.length);
    let board2Remainder = board2Pot % board2Winners.length;

    for (const { player, result } of board2Winners) {
      const amount = board2Split + (board2Remainder > 0 ? 1 : 0);
      board2Remainder--;
      playerWinnings.set(player.oderId, (playerWinnings.get(player.oderId) || 0) + amount);
      winners.push({
        playerId: player.oderId,
        amount,
        hand: result,
        potType: 'main',
        boardIndex: 1,
      });
    }

    // Add chips to players
    for (const [playerId, amount] of playerWinnings) {
      const player = playersInHand.find(p => p.oderId === playerId);
      if (player) {
        player.chips += amount;
      }
    }

    return winners;
  }

  /**
   * Get the winners from the last resolved hand
   */
  getLastWinners(): WinnerInfo[] {
    return this.lastWinners;
  }

  /**
   * Get a player's hole cards
   */
  getPlayerHoleCards(playerId: string): Card[] | undefined {
    return this.holeCards.get(playerId);
  }

  /**
   * Get valid actions for current player
   */
  getValidActions(): ActionType[] {
    const player = this.players.find(p => p.seat === this.currentPlayerSeat);
    if (!player) return [];

    const actions: ActionType[] = ['fold'];
    const toCall = this.currentBet - player.totalBetThisRound;

    if (toCall <= 0) {
      actions.push('check');
    } else {
      actions.push('call');
    }

    if (player.chips > toCall) {
      if (this.currentBet === 0) {
        actions.push('bet');
      } else {
        actions.push('raise');
      }
    }

    actions.push('all-in');

    return actions;
  }

  /**
   * Get run-out boards for run-it-twice/thrice
   */
  runItOut(times: 2 | 3): Card[][] {
    if (!this.customRules.runItTwice && !this.customRules.runItThrice) {
      return [this.communityCards];
    }

    // Calculate remaining cards needed
    const cardsNeeded = 5 - this.communityCards.length;
    if (cardsNeeded <= 0) return [this.communityCards];

    return this.deck.dealRunOut(cardsNeeded, times);
  }

  /**
   * Update custom rules
   */
  updateRules(rules: Partial<CustomRules>): void {
    this.customRules = { ...this.customRules, ...rules };
  }

  /**
   * Switch variant (between hands only)
   */
  switchVariant(newVariant: GameVariant): void {
    if (this.phase !== 'waiting' && this.phase !== 'complete') {
      throw new Error('Cannot switch variant during a hand');
    }
    this.variant = createVariant(newVariant);
  }
}
