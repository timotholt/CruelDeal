import { apply } from './apply';
import type { Manifest } from './manifest/types';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';

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
 * Canonical live/replay transaction fold. Every event is reduced once and
 * each frame retains the reducer's structurally shared before/after states.
 */
export function buildEventTransactionFrames(
  options: BuildEventTransactionFramesOptions,
): EventTransactionFrames {
  const frames: TransactionFrame[] = [];
  let state = options.initialState;

  options.events.forEach((event, eventIndex) => {
    const before = state;
    const after = apply(before, event, options.manifest);
    frames.push(Object.freeze({
      index: eventIndex,
      transactionId: options.transactionId,
      event,
      before,
      after,
    }));
    state = after;
  });

  return Object.freeze({
    transactionId: options.transactionId,
    initialState: options.initialState,
    events: options.events,
    frames: Object.freeze(frames),
    finalState: state,
  });
}
