import type { MatchEvent } from './events';
import type { EffectTraceEntry } from './effectTrace';

declare const frameBrand: unique symbol;

/**
 * Deterministic gameplay chronology within one match.
 *
 * A Frame is not wall-clock time, a render frame, or a transaction-local
 * array index. Genesis is frame 0; every canonical mechanical or semantic
 * resolution step advances the match by exactly one frame.
 */
export type Frame = number & { readonly [frameBrand]: true };

export const GENESIS_FRAME = 0 as Frame;

export function asFrame(value: number): Frame {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Frame must be a non-negative safe integer; received ${value}`);
  }
  return value as Frame;
}

export function nextFrame(frame: Frame): Frame {
  if (frame === Number.MAX_SAFE_INTEGER) {
    throw new Error('Frame overflow');
  }
  return asFrame(frame + 1);
}

/**
 * Coarse deterministic phase ownership for a frame. Fine-grained reaction
 * provenance belongs in the semantic event envelope introduced by Phase 1.5.
 */
export type TimelinePhase =
  | 'SETUP'
  | 'ACTION'
  | 'RESOLUTION'
  | 'END'
  | 'START'
  | 'MATCH_END';

/**
 * Turns are semantic scopes over contiguous frames. A scope is stored on the
 * event rather than inferred later from mutable state or event names.
 */
export interface TemporalScope {
  readonly turn: number;
  readonly phase: TimelinePhase;
}

/** One canonical mechanical and/or semantic fact at one unique frame. */
export interface CanonicalFrame<TEvent extends MatchEvent = MatchEvent> {
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: TEvent | null;
  readonly effect: EffectTraceEntry | null;
}

/** External references must pair the match identity with its local frame. */
export interface MatchFrameRef {
  readonly matchId: string;
  readonly frame: Frame;
}

export interface TurnFrameSpan {
  readonly turn: number;
  readonly startFrame: Frame;
  readonly endFrame: Frame;
}
