/**
 * DEBUG ONLY — explicit deck composition over the canonical match-state
 * initializer. Debug play intentionally has no parallel state builder.
 */

import type { Deck, Manifest } from '../engine/manifest/types';
import type { MatchState } from '../engine/types/state';
import { createInitialMatchState } from '../engine/cli/initState';

export function buildDebugMatchState(
  playerDeckList: Deck,
  oppDeckList: Deck,
  manifest: Manifest,
  seed: string,
): MatchState {
  return createInitialMatchState(
    seed,
    manifest,
    { P0: playerDeckList, P1: oppDeckList },
  );
}
