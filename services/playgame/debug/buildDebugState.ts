/**
 * DEBUG ONLY — explicit deck composition over the canonical match-state
 * initializer. Debug play intentionally has no parallel state builder.
 */

import type { Deck, Manifest } from '../engine/manifest/types';
import type { MatchState } from '../engine/types/state';
import { createInitialMatchState } from '../engine/cli/initState';
import { defaultLocationDeckFactory } from '../runtime/locationDeckFactory';

export function buildDebugMatchState(
  playerDeckList: Deck,
  oppDeckList: Deck,
  manifest: Manifest,
  seed: string,
): MatchState {
  const ruleset = manifest.rulesets.standard;
  if (!ruleset) {
    throw new Error('buildDebugMatchState: standard ruleset is required');
  }
  const locationDeck = defaultLocationDeckFactory.build({
    manifest,
    ruleset,
    seed,
  });
  return createInitialMatchState(
    seed,
    manifest,
    { P0: playerDeckList, P1: oppDeckList },
    locationDeck.entries,
  );
}
