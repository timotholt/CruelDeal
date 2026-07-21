import { describe, expect, it } from 'vitest';
import { DEBUG_DECKS } from './debugDecks';
import {
  DEFAULT_DEBUG_MATCH_SEED,
  normalizeDebugMatchSeed,
  pickDebugOpponent,
} from './debugMatchSetup';

describe('debug match setup', () => {
  it('normalizes empty seeds to one explicit reproducible seed', () => {
    expect(normalizeDebugMatchSeed(undefined)).toBe(DEFAULT_DEBUG_MATCH_SEED);
    expect(normalizeDebugMatchSeed('   ')).toBe(DEFAULT_DEBUG_MATCH_SEED);
    expect(normalizeDebugMatchSeed('  replay-me  ')).toBe('replay-me');
  });

  it('repeats the same opponent sequence for the same seed and player deck', () => {
    const playerDeckId = DEBUG_DECKS[0].id;
    const sequence = (seed: string) => Array.from(
      { length: 12 },
      (_, draw) => pickDebugOpponent(DEBUG_DECKS, playerDeckId, seed, draw).id,
    );

    expect(sequence('repeatable')).toEqual(sequence('repeatable'));
    expect(sequence('repeatable')).not.toEqual(sequence('different'));
  });

  it('never selects the player deck as the opponent', () => {
    for (const playerDeck of DEBUG_DECKS) {
      for (let draw = 0; draw < 30; draw++) {
        expect(pickDebugOpponent(DEBUG_DECKS, playerDeck.id, 'exclusion', draw).id)
          .not.toBe(playerDeck.id);
      }
    }
  });

  it('rejects invalid draw cursors and an empty candidate pool', () => {
    expect(() => pickDebugOpponent(DEBUG_DECKS, DEBUG_DECKS[0].id, 'seed', -1))
      .toThrow('non-negative safe integer');
    expect(() => pickDebugOpponent([DEBUG_DECKS[0]], DEBUG_DECKS[0].id, 'seed', 0))
      .toThrow('requires a deck distinct');
  });
});
