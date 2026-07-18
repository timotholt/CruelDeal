import assert from 'node:assert/strict';
import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';

export interface TransactionFrame {
  /** Zero-based position of this event inside the transaction. */
  readonly index: number;
  readonly transactionId: string;
  readonly event: MatchEvent;
  readonly before: MatchState;
  readonly after: MatchState;
}

export interface EventTransactionFrames {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly frames: readonly TransactionFrame[];
  readonly finalState: MatchState;
}

export interface BuildEventTransactionFramesOptions {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly manifest: Manifest;
}

/**
 * The canonical headless transaction fold. Its frame shape intentionally has
 * no replay-only fields so the live director can consume the same frames.
 */
export function buildEventTransactionFrames(
  options: BuildEventTransactionFramesOptions,
): EventTransactionFrames {
  const frames: TransactionFrame[] = [];
  let state = options.initialState;

  options.events.forEach((event, eventIndex) => {
    const before = state;
    const after = apply(before, event, options.manifest);
    frames.push({
      index: eventIndex,
      transactionId: options.transactionId,
      event,
      before,
      after,
    });
    state = after;
  });

  return {
    transactionId: options.transactionId,
    initialState: options.initialState,
    events: options.events,
    frames,
    finalState: state,
  };
}

export interface RuntimeParitySubject {
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
}

function parityProjection(subject: RuntimeParitySubject) {
  const state = subject.finalState;
  return {
    finalState: state,
    orderedLog: state.log.map((entry) => entry.event),
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
  folded: EventTransactionFrames,
): void {
  assert.deepStrictEqual(
    parityProjection(authoritative),
    parityProjection({ finalState: folded.finalState, events: folded.events }),
  );
}
