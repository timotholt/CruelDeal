import assert from 'node:assert/strict';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import type { EventTransactionFold } from '../transactionTimeline';

export {
  foldFramedEvents,
  frameAndFoldEvents,
} from '../transactionTimeline';
export type {
  FoldFramedEventsOptions,
  EventTransition,
  EventTransactionFold,
  FrameAndFoldEventsOptions,
} from '../transactionTimeline';

export interface RuntimeParitySubject {
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
}

function parityProjection(subject: RuntimeParitySubject) {
  const state = subject.finalState;
  return {
    finalState: state,
    transactionEvents: subject.events,
    turn: state.turn,
    phase: state.phase,
    priority: state.priority,
    energy: state.energy,
    result: state.result,
  };
}

/** Exact live/headless parity required by the Phase 0 guardrail. */
export function assertRuntimeParity(
  authoritative: RuntimeParitySubject,
  folded: EventTransactionFold,
): void {
  assert.deepStrictEqual(
    parityProjection(authoritative),
    parityProjection({
      finalState: folded.finalState,
      events: folded.framedEvents.map(({ event }) => event),
    }),
  );
}
