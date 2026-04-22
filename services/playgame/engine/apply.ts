/**
 * apply(state, event, manifest) → state
 *
 * The pure reducer. Every `MatchEvent` variant maps to exactly one case.
 * See spec §4.
 *
 * Step 1: stub. Step 5 implements every variant.
 */

import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { Manifest } from './manifest/types';

export function apply(_state: MatchState, _event: MatchEvent, _manifest: Manifest): MatchState {
  throw new Error('apply: not implemented (Step 5 of spec 0.2 migration)');
}
