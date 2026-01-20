import type { Card, GameVariant, GamePhase, HandResult } from '@poker/shared';
import { VARIANT_CONFIG } from '@poker/shared';
import { evaluateHand, findBestHand, evaluateOmahaHand } from '../evaluator';
import { Deck } from '../deck';

/**
 * Base variant interface
 */
export interface PokerVariant {
  name: GameVariant;
  config: typeof VARIANT_CONFIG[GameVariant];

  // Dealing
  dealHoleCards(deck: Deck, playerCount: number): Card[][];
  dealCommunityCards(deck: Deck, phase: GamePhase): Card[];

  // Evaluation
  evaluatePlayerHand(holeCards: Card[], communityCards: Card[]): HandResult;

  // Phases
  getPhases(): GamePhase[];
  getNextPhase(current: GamePhase): GamePhase | null;

  // Betting
  getFirstToAct(phase: GamePhase, dealerPosition: number, playerCount: number): number;
}

/**
 * Texas Hold'em implementation
 */
export class TexasHoldem implements PokerVariant {
  name: GameVariant = 'texas-holdem';
  config = VARIANT_CONFIG['texas-holdem'];

  dealHoleCards(deck: Deck, playerCount: number): Card[][] {
    const hands: Card[][] = [];

    // Deal one card at a time, round-robin style
    for (let round = 0; round < 2; round++) {
      for (let player = 0; player < playerCount; player++) {
        if (round === 0) {
          hands[player] = [];
        }
        const card = deck.deal();
        if (card) hands[player].push(card);
      }
    }

    return hands;
  }

  dealCommunityCards(deck: Deck, phase: GamePhase): Card[] {
    switch (phase) {
      case 'flop':
        deck.burn();
        return deck.dealMultiple(3);
      case 'turn':
      case 'river':
        deck.burn();
        return deck.dealMultiple(1);
      default:
        return [];
    }
  }

  evaluatePlayerHand(holeCards: Card[], communityCards: Card[]): HandResult {
    return findBestHand(holeCards, communityCards);
  }

  getPhases(): GamePhase[] {
    return ['waiting', 'starting', 'preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];
  }

  getNextPhase(current: GamePhase): GamePhase | null {
    const phases = this.getPhases();
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  }

  getFirstToAct(phase: GamePhase, dealerPosition: number, playerCount: number): number {
    if (phase === 'preflop') {
      // UTG (3 after dealer: SB, BB, UTG)
      return (dealerPosition + 3) % playerCount;
    }
    // Post-flop: first active player after dealer
    return (dealerPosition + 1) % playerCount;
  }
}

/**
 * Omaha implementation
 */
export class Omaha implements PokerVariant {
  name: GameVariant = 'omaha';
  config = VARIANT_CONFIG['omaha'];

  dealHoleCards(deck: Deck, playerCount: number): Card[][] {
    const hands: Card[][] = [];

    // Deal 4 cards per player, one at a time
    for (let round = 0; round < 4; round++) {
      for (let player = 0; player < playerCount; player++) {
        if (round === 0) {
          hands[player] = [];
        }
        const card = deck.deal();
        if (card) hands[player].push(card);
      }
    }

    return hands;
  }

  dealCommunityCards(deck: Deck, phase: GamePhase): Card[] {
    switch (phase) {
      case 'flop':
        deck.burn();
        return deck.dealMultiple(3);
      case 'turn':
      case 'river':
        deck.burn();
        return deck.dealMultiple(1);
      default:
        return [];
    }
  }

  evaluatePlayerHand(holeCards: Card[], communityCards: Card[]): HandResult {
    return evaluateOmahaHand(holeCards, communityCards);
  }

  getPhases(): GamePhase[] {
    return ['waiting', 'starting', 'preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];
  }

  getNextPhase(current: GamePhase): GamePhase | null {
    const phases = this.getPhases();
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  }

  getFirstToAct(phase: GamePhase, dealerPosition: number, playerCount: number): number {
    if (phase === 'preflop') {
      return (dealerPosition + 3) % playerCount;
    }
    return (dealerPosition + 1) % playerCount;
  }
}

/**
 * Five Card Draw implementation
 */
export class FiveCardDraw implements PokerVariant {
  name: GameVariant = 'five-card-draw';
  config = VARIANT_CONFIG['five-card-draw'];

  dealHoleCards(deck: Deck, playerCount: number): Card[][] {
    const hands: Card[][] = [];

    for (let round = 0; round < 5; round++) {
      for (let player = 0; player < playerCount; player++) {
        if (round === 0) {
          hands[player] = [];
        }
        const card = deck.deal();
        if (card) hands[player].push(card);
      }
    }

    return hands;
  }

  dealCommunityCards(_deck: Deck, _phase: GamePhase): Card[] {
    return []; // No community cards in draw
  }

  evaluatePlayerHand(holeCards: Card[], _communityCards: Card[]): HandResult {
    return evaluateHand(holeCards);
  }

  getPhases(): GamePhase[] {
    return ['waiting', 'starting', 'preflop', 'flop', 'showdown', 'complete'];
    // Note: 'flop' phase is used for the draw round
  }

  getNextPhase(current: GamePhase): GamePhase | null {
    const phases = this.getPhases();
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  }

  getFirstToAct(phase: GamePhase, dealerPosition: number, playerCount: number): number {
    return (dealerPosition + 1) % playerCount;
  }

  /**
   * Draw cards for a player
   */
  drawCards(deck: Deck, discardCount: number): Card[] {
    return deck.dealMultiple(discardCount);
  }
}

/**
 * Seven Card Stud implementation
 */
export class SevenCardStud implements PokerVariant {
  name: GameVariant = 'seven-card-stud';
  config = VARIANT_CONFIG['seven-card-stud'];

  dealHoleCards(deck: Deck, playerCount: number): Card[][] {
    const hands: Card[][] = [];

    // Deal 2 down, 1 up initially
    for (let round = 0; round < 3; round++) {
      for (let player = 0; player < playerCount; player++) {
        if (round === 0) {
          hands[player] = [];
        }
        const card = deck.deal();
        if (card) hands[player].push(card);
      }
    }

    return hands;
  }

  dealCommunityCards(_deck: Deck, _phase: GamePhase): Card[] {
    return []; // No community cards in stud
  }

  /**
   * Deal street cards (4th, 5th, 6th, 7th)
   */
  dealStreetCard(deck: Deck): Card | undefined {
    return deck.deal();
  }

  evaluatePlayerHand(holeCards: Card[], _communityCards: Card[]): HandResult {
    return findBestHand(holeCards, []);
  }

  getPhases(): GamePhase[] {
    // Using poker phases loosely - 7 card stud has unique streets
    return ['waiting', 'starting', 'preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];
  }

  getNextPhase(current: GamePhase): GamePhase | null {
    const phases = this.getPhases();
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  }

  getFirstToAct(_phase: GamePhase, _dealerPosition: number, _playerCount: number): number {
    // In stud, the bring-in/high card determines action
    // This would be determined by the visible cards
    return 0;
  }
}

/**
 * Factory function to create variant instances
 */
export function createVariant(variant: GameVariant): PokerVariant {
  switch (variant) {
    case 'texas-holdem':
      return new TexasHoldem();
    case 'omaha':
    case 'omaha-hi-lo':
      return new Omaha();
    case 'five-card-draw':
      return new FiveCardDraw();
    case 'seven-card-stud':
      return new SevenCardStud();
    default:
      return new TexasHoldem();
  }
}

/**
 * Get variant info
 */
export function getVariantInfo(variant: GameVariant) {
  return VARIANT_CONFIG[variant];
}
