import type { ReplayStepDescription } from './replayPresentation';
import type { EffectTraceEntry } from '../engine/types/effectTrace';
import type { MatchEvent } from '../engine/types/events';
import type { Frame, TemporalScope } from '../engine/types/timeline';
import type { SeatVisibleMatchState } from '../runtime/projection';

/**
 * Debug-authorized replay payload.
 *
 * Normal player transactions remain redacted. This capability deliberately
 * carries canonical events, including authority IDs and causes, plus a
 * seat-safe state snapshot used only to render the board at that frame.
 * Remote clients must obtain it from an authenticated developer endpoint.
 */
export interface DebugReplayStep {
  readonly cursor: number;
  readonly transactionId?: string;
  readonly frame: Frame;
  readonly scope: TemporalScope | null;
  readonly event: MatchEvent | null;
  readonly effect: EffectTraceEntry | null;
  readonly state: SeatVisibleMatchState;
  readonly description: ReplayStepDescription;
  readonly effectDescription: string | null;
  /** Display-only JSON with authority-resolved card/location name comments. */
  readonly annotatedEventJson: string;
  /** Display-only JSON with authority-resolved effect entity comments. */
  readonly annotatedEffectJson: string;
}

export interface DebugReplayTimeline {
  readonly steps: readonly DebugReplayStep[];
  readonly finalState: SeatVisibleMatchState;
}
