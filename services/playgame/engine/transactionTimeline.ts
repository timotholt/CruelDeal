import { applyFramed } from './apply';
import type { Manifest } from './manifest/types';
import {
  assertFramedEventSequence,
  frameEventSequence,
  type FrameEventSequenceOptions,
} from './timeline';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { Frame, FramedEvent, TemporalScope } from './types/timeline';

/**
 * A materialized state transition for one canonical FramedEvent.
 *
 * `index` is only a transaction-local playback position. `frame` is the
 * gameplay identity and is never derived from the playback cursor.
 */
export interface EventTransition {
  readonly index: number;
  readonly transactionId: string;
  readonly framedEvent: FramedEvent;
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: MatchEvent;
  readonly before: MatchState;
  readonly after: MatchState;
}

export interface EventTransactionFold {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly framedEvents: readonly FramedEvent[];
  readonly transitions: readonly EventTransition[];
  readonly finalState: MatchState;
}

export interface FoldFramedEventsOptions {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly framedEvents: readonly FramedEvent[];
  readonly manifest: Manifest;
}

export interface FrameAndFoldEventsOptions {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly manifest: Manifest;
  readonly initialPhase?: FrameEventSequenceOptions['initialPhase'];
}

/**
 * Canonical live/replay transaction fold. Every event is reduced once and
 * each frame retains the reducer's structurally shared before/after states.
 */
export function foldFramedEvents(
  options: FoldFramedEventsOptions,
): EventTransactionFold {
  const framedEvents = assertFramedEventSequence(options.initialState, options.framedEvents);
  const transitions: EventTransition[] = [];
  let state = options.initialState;

  framedEvents.forEach((framedEvent, eventIndex) => {
    const before = state;
    const after = applyFramed(before, framedEvent, options.manifest);
    transitions.push(Object.freeze({
      index: eventIndex,
      transactionId: options.transactionId,
      framedEvent,
      frame: framedEvent.frame,
      scope: framedEvent.scope,
      event: framedEvent.event,
      before,
      after,
    }));
    state = after;
  });

  return Object.freeze({
    transactionId: options.transactionId,
    initialState: options.initialState,
    framedEvents,
    transitions: Object.freeze(transitions),
    finalState: state,
  });
}

/** Frame one accepted raw resolver batch, then fold the canonical result. */
export function frameAndFoldEvents(
  options: FrameAndFoldEventsOptions,
): EventTransactionFold {
  const framedEvents = frameEventSequence(options.initialState, options.events, {
    initialPhase: options.initialPhase,
  });
  return foldFramedEvents({
    transactionId: options.transactionId,
    initialState: options.initialState,
    framedEvents,
    manifest: options.manifest,
  });
}
