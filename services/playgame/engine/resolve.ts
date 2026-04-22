/**
 * resolve(state, intent, rng, manifest) → MatchEvent[]
 *
 * Pure intent validator + event generator. Emits `INTENT_REJECTED` (and no
 * state mutation) on invalid intents. See spec §7.
 *
 * Step 1: stub. Step 7 implements staging intents; Step 8 wires END_TURN
 * to `resolveTurn`.
 */

import type { MatchEvent } from './types/events';
import type { MatchIntent } from './types/intents';
import type { MatchState } from './types/state';
import type { Manifest } from './manifest/types';
import type { Rng } from './rng';

export function resolve(
  _state: MatchState,
  _intent: MatchIntent,
  _rng: Rng,
  _manifest: Manifest,
): MatchEvent[] {
  throw new Error('resolve: not implemented (Step 7 of spec 0.2 migration)');
}
