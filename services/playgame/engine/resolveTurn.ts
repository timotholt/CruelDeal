/**
 * resolveTurn(state, seed, manifest) → MatchEvent[]
 *
 * Deterministic full-turn resolution. Drives the reveal phase (priority-
 * ordered, recursive OR evaluator), location at-turn-end effects, draw,
 * next-location reveal, and end-of-match check. See spec §8.
 *
 * Step 1: stub. Step 8 implements the full orchestration; Step 6 provides
 * the `revealCard` primitive it builds on.
 */

import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { Manifest } from './manifest/types';

export function resolveTurn(
  _state: MatchState,
  _turnSeed: string,
  _manifest: Manifest,
): MatchEvent[] {
  throw new Error('resolveTurn: not implemented (Step 8 of spec 0.2 migration)');
}
