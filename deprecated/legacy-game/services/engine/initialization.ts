import { CARDS, LOCATION_DEFS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../../constants';
import { MAX_TURNS } from '../../config';
import { GameState, CardInstance, Lane, PlayerState } from '../../types';
import { createCardInstance, createEmptyLane } from '../factories';
import { applyContinuousEffects } from '../statSystem';

export const createInitialGameState = (): GameState => {
  // 1. Setup Decks
  const p1Deck: CardInstance[] = PLAYER_DECK_IDS.map(id => {
    const def = CARDS.find(c => c.id === id)!;
    return createCardInstance(def, 'p1', 'DECK');
  }).sort(() => Math.random() - 0.5);

  const p2Deck: CardInstance[] = OPPONENT_DECK_IDS.map(id => {
    const def = CARDS.find(c => c.id === id)!;
    return createCardInstance(def, 'p2', 'DECK');
  }).sort(() => Math.random() - 0.5);

  // 2. Draw Hand (3 cards pre-game + 1 for turn 1 = 4 cards)
  const p1Hand = p1Deck.splice(0, 4);
  const p2Hand = p2Deck.splice(0, 4);
  
  p1Hand.forEach(c => c.zone = 'HAND');
  p2Hand.forEach(c => c.zone = 'HAND');

  // 3. Setup Lanes
  const selectedLocs = [...LOCATION_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);
  const lanes: [Lane, Lane, Lane] = [
      createEmptyLane(selectedLocs[0]), 
      createEmptyLane(selectedLocs[1]), 
      createEmptyLane(selectedLocs[2])
  ];

  // 4. Initial State Assembly
  const p1State: PlayerState = {
    energy: 1,
    stats: { destroyedCount: 0, destroyedPower: 0 },
    hand: p1Hand,
    deck: p1Deck,
    discardPile: [],
    destroyedPile: [],
    banishedPile: [],
  };

  const p2State: PlayerState = {
    energy: 1,
    stats: { destroyedCount: 0, destroyedPower: 0 },
    hand: p2Hand,
    deck: p2Deck,
    discardPile: [],
    destroyedPile: [],
    banishedPile: [],
  };

  const state: GameState = {
    turn: 1,
    maxTurns: MAX_TURNS,
    nextPlayOrder: 1,
    priority: 'p1',
    players: {
      p1: p1State,
      p2: p2State,
    },
    lanes,
    winner: null,
    phase: 'planning',
    history: ['Match started.'],
    eventQueue: [],
    executionQueue: [],
  };

  return applyContinuousEffects(state);
};