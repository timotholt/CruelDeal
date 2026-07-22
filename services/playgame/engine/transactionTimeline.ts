import { applyCanonicalFrame } from './apply';
import type { Manifest } from './manifest/types';
import {
  assertCanonicalFrameSequence,
  frameEventSequence,
  frameResolutionSequence,
  type FrameEventSequenceOptions,
} from './timeline';
import type { MatchEvent } from './types/events';
import type { MatchState } from './types/state';
import type { Frame, CanonicalFrame, TemporalScope } from './types/timeline';
import type { KernelResolutionStep } from './kernel/resolutionTrace';

export type CanonicalFrameReducer = (
  state: MatchState,
  canonicalFrame: CanonicalFrame,
  manifest: Manifest,
) => MatchState;

/**
 * A materialized state transition for one canonical CanonicalFrame.
 *
 * `index` is only a transaction-local playback position. `frame` is the
 * gameplay identity and is never derived from the playback cursor.
 */
export interface CanonicalFrameTransition {
  readonly index: number;
  readonly transactionId: string;
  readonly canonicalFrame: CanonicalFrame;
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: MatchEvent | null;
  readonly effect: CanonicalFrame['effect'];
  readonly before: MatchState;
  readonly after: MatchState;
}

export interface CanonicalTransactionFold {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly frames: readonly CanonicalFrame[];
  readonly transitions: readonly CanonicalFrameTransition[];
  readonly finalState: MatchState;
}

export interface FoldCanonicalFramesOptions {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly frames: readonly CanonicalFrame[];
  readonly manifest: Manifest;
  /**
   * Runtime instrumentation seam. The engine supplies no clock, and callers
   * must preserve applyCanonicalFrame semantics.
   */
  readonly reduceCanonicalFrame?: CanonicalFrameReducer;
}

export interface FrameAndFoldEventsOptions {
  readonly transactionId: string;
  readonly initialState: MatchState;
  readonly events: readonly MatchEvent[];
  readonly manifest: Manifest;
  readonly initialPhase?: FrameEventSequenceOptions['initialPhase'];
  readonly reduceCanonicalFrame?: CanonicalFrameReducer;
}

export interface FrameAndFoldResolutionOptions
  extends FrameAndFoldEventsOptions {
  readonly resolutionSteps: readonly KernelResolutionStep[];
}

/**
 * Canonical live/replay transaction fold. Every event is reduced once and
 * each frame retains the reducer's structurally shared before/after states.
 */
export function foldCanonicalFrames(
  options: FoldCanonicalFramesOptions,
): CanonicalTransactionFold {
  const inputFrames = assertCanonicalFrameSequence(
    options.initialState,
    options.frames,
  );
  const frames: CanonicalFrame[] = [];
  const transitions: CanonicalFrameTransition[] = [];
  const reduceCanonicalFrame = options.reduceCanonicalFrame ?? applyCanonicalFrame;
  let state = options.initialState;

  inputFrames.forEach((inputFrame, eventIndex) => {
    const before = state;
    const canonicalInput = structuredClone(inputFrame);
    const canonicalFrame: CanonicalFrame = Object.freeze({
      frame: canonicalInput.frame,
      scope: Object.freeze({ ...canonicalInput.scope }),
      event: canonicalInput.event,
      effect: canonicalInput.effect,
    });
    const after = reduceCanonicalFrame(before, canonicalFrame, options.manifest);
    if (
      after.timeline.frame !== canonicalFrame.frame
      || after.timeline.scope?.turn !== canonicalFrame.scope.turn
      || after.timeline.scope.phase !== canonicalFrame.scope.phase
    ) {
      throw new Error(`reducer did not adopt canonical frame ${canonicalFrame.frame}`);
    }
    frames.push(canonicalFrame);
    transitions.push(Object.freeze({
      index: eventIndex,
      transactionId: options.transactionId,
      canonicalFrame,
      frame: canonicalFrame.frame,
      scope: canonicalFrame.scope,
      event: canonicalFrame.event,
      effect: canonicalFrame.effect,
      before,
      after,
    }));
    state = after;
  });

  return Object.freeze({
    transactionId: options.transactionId,
    initialState: options.initialState,
    frames: Object.freeze(frames),
    transitions: Object.freeze(transitions),
    finalState: state,
  });
}

/** Frame one accepted raw resolver batch, then fold the canonical result. */
export function frameAndFoldEvents(
  options: FrameAndFoldEventsOptions,
): CanonicalTransactionFold {
  const frames = frameEventSequence(options.initialState, options.events, {
    initialPhase: options.initialPhase,
  });
  return foldCanonicalFrames({
    transactionId: options.transactionId,
    initialState: options.initialState,
    frames,
    manifest: options.manifest,
    reduceCanonicalFrame: options.reduceCanonicalFrame,
  });
}

/** Frame and fold one complete successful kernel resolution transcript. */
export function frameAndFoldResolution(
  options: FrameAndFoldResolutionOptions,
): CanonicalTransactionFold {
  const frames = frameResolutionSequence(
    options.initialState,
    options.events,
    options.resolutionSteps,
    {
      transactionId: options.transactionId,
      initialPhase: options.initialPhase,
    },
  );
  return foldCanonicalFrames({
    transactionId: options.transactionId,
    initialState: options.initialState,
    frames,
    manifest: options.manifest,
    reduceCanonicalFrame: options.reduceCanonicalFrame,
  });
}
