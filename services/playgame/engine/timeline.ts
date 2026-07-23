import type { MatchEvent } from './types/events';
import {
  effectAttemptId,
  effectInvocationId,
  type EffectInvocationId,
  type EffectTraceEntry,
} from './types/effectTrace';
import type { CardId, LocationCardInstanceId } from './types/ids';
import type { MatchState } from './types/state';
import type {
  KernelEffectTraceEntry,
  KernelResolutionStep,
} from './kernel/resolutionTrace';
import {
  GENESIS_FRAME,
  nextFrame,
  type Frame,
  type CanonicalFrame,
  type TemporalScope,
  type TimelinePhase,
  type TurnFrameSpan,
} from './types/timeline';

export interface FrameEventSequenceOptions {
  /** Opening/bootstrap batches belong to turn 1's SETUP scope. */
  readonly initialPhase?: TimelinePhase;
}

export interface FrameResolutionSequenceOptions
  extends FrameEventSequenceOptions {
  readonly transactionId: string;
}

export interface CardLifecycleFrames {
  readonly created: readonly Frame[];
  readonly played: readonly Frame[];
  readonly revealed: readonly Frame[];
  readonly moved: readonly Frame[];
  readonly destroyed: readonly Frame[];
  readonly banished: readonly Frame[];
}

export interface LocationLifecycleFrames {
  readonly created: readonly Frame[];
  readonly drawn: readonly Frame[];
  readonly played: readonly Frame[];
  readonly revealed: readonly Frame[];
  readonly moved: readonly Frame[];
  readonly removed: readonly Frame[];
}

/** The latest committed/provisional reducer frame represented by this state. */
export function currentFrame(state: Pick<MatchState, 'timeline'>): Frame {
  return state.timeline.frame;
}

export function frameEventSequence(
  initialState: MatchState,
  events: readonly MatchEvent[],
  options: FrameEventSequenceOptions = {},
): readonly CanonicalFrame[] {
  if (events.length === 0) return Object.freeze([]);

  let frame = currentFrame(initialState);
  const firstRawEvent = events[0];
  const inferredOpeningPhase = currentFrame(initialState) === GENESIS_FRAME
    && firstRawEvent.type === 'CARD_DRAWN'
    ? 'SETUP'
    : undefined;
  let scope = initialScope(initialState, options.initialPhase ?? inferredOpeningPhase);
  const framed: CanonicalFrame[] = [];

  for (const event of events) {
    scope = scopeForEvent(event, scope);
    frame = nextFrame(frame);
    framed.push(Object.freeze({
      frame,
      scope: Object.freeze({ ...scope }),
      event,
      effect: null,
    }));
  }

  return Object.freeze(framed);
}

function canonicalEffectEntry(
  transactionId: string,
  entry: KernelEffectTraceEntry,
  invocations: Map<number, EffectInvocationId>,
): EffectTraceEntry {
  if (entry.kind === 'EFFECT_INVOCATION_STARTED') {
    if (invocations.has(entry.invocationOrdinal)) {
      throw new Error(
        `Duplicate effect invocation ordinal ${entry.invocationOrdinal}.`,
      );
    }
    const invocationId = effectInvocationId(
      transactionId,
      entry.invocationOrdinal,
    );
    const parentInvocationId = entry.parentInvocationOrdinal === null
      ? null
      : invocations.get(entry.parentInvocationOrdinal);
    if (
      entry.parentInvocationOrdinal !== null
      && parentInvocationId === undefined
    ) {
      throw new Error(
        `Effect invocation ${entry.invocationOrdinal} references an unknown parent.`,
      );
    }
    invocations.set(entry.invocationOrdinal, invocationId);
    return {
      kind: entry.kind,
      invocationId,
      parentInvocationId: parentInvocationId ?? null,
      source: structuredClone(entry.source),
      ability: structuredClone(entry.ability),
      invocationReason: entry.invocationReason,
      depth: entry.depth,
      candidates: structuredClone(entry.candidates),
    };
  }

  const invocationId = invocations.get(entry.invocationOrdinal);
  if (invocationId === undefined) {
    throw new Error(
      `Effect trace references unknown invocation ${entry.invocationOrdinal}.`,
    );
  }
  if (entry.kind === 'EFFECT_TARGET_RESOLVED') {
    return {
      kind: entry.kind,
      invocationId,
      attemptId: effectAttemptId(invocationId, entry.attemptOrdinal),
      attemptOrdinal: entry.attemptOrdinal,
      candidateOrdinal: entry.candidateOrdinal,
      operation: entry.operation,
      target: structuredClone(entry.target),
      result: entry.result,
      blockedBy: structuredClone(entry.blockedBy),
      reason: entry.reason,
    };
  }
  return {
    kind: entry.kind,
    invocationId,
    attempted: entry.attempted,
    affected: entry.affected,
    blocked: entry.blocked,
    invalidated: entry.invalidated,
    unchanged: entry.unchanged,
  };
}

/**
 * Promote a successful kernel transcript into the one canonical match
 * timeline. Kernel ordinals become deterministic transaction-scoped IDs here,
 * at the runtime chronology boundary rather than inside the rules kernel.
 */
export function frameResolutionSequence(
  initialState: MatchState,
  events: readonly MatchEvent[],
  resolutionSteps: readonly KernelResolutionStep[],
  options: FrameResolutionSequenceOptions,
): readonly CanonicalFrame[] {
  if (events.length === 0 && resolutionSteps.length === 0) {
    return Object.freeze([]);
  }
  if (resolutionSteps.length === 0) {
    throw new Error('A non-empty resolution must contain ordered kernel steps.');
  }

  let frame = currentFrame(initialState);
  const firstEvent = resolutionSteps
    .map(step => step.transitionIndex === null
      ? null
      : events[step.transitionIndex] ?? null)
    .find((event): event is MatchEvent => event !== null);
  const inferredOpeningPhase = currentFrame(initialState) === GENESIS_FRAME
    && firstEvent?.type === 'CARD_DRAWN'
    ? 'SETUP'
    : undefined;
  let scope = initialScope(
    initialState,
    options.initialPhase ?? inferredOpeningPhase,
  );
  const seenTransitions = new Set<number>();
  const invocations = new Map<number, EffectInvocationId>();
  const frames: CanonicalFrame[] = [];

  for (const step of resolutionSteps) {
    const event = step.transitionIndex === null
      ? null
      : events[step.transitionIndex] ?? null;
    if (step.transitionIndex !== null) {
      if (event === null) {
        throw new Error(
          `Resolution step references missing transition ${step.transitionIndex}.`,
        );
      }
      if (seenTransitions.has(step.transitionIndex)) {
        throw new Error(
          `Resolution transition ${step.transitionIndex} appears more than once.`,
        );
      }
      seenTransitions.add(step.transitionIndex);
      scope = scopeForEvent(event, scope);
    }
    const effect = step.effect === null
      ? null
      : canonicalEffectEntry(options.transactionId, step.effect, invocations);
    frame = nextFrame(frame);
    frames.push(Object.freeze({
      frame,
      scope: Object.freeze({ ...scope }),
      event: event === null ? null : structuredClone(event),
      effect,
    }));
  }

  if (seenTransitions.size !== events.length) {
    throw new Error(
      `Resolution transcript covered ${seenTransitions.size} of ${events.length} transitions.`,
    );
  }
  return Object.freeze(frames);
}

export function assertCanonicalFrameSequence(
  initialState: MatchState,
  frames: readonly CanonicalFrame[],
): readonly CanonicalFrame[] {
  let expected = nextFrame(currentFrame(initialState));
  const validationInitialPhase = currentFrame(initialState) === GENESIS_FRAME
    && frames[0]?.scope.phase === 'SETUP'
    ? 'SETUP'
    : undefined;
  let expectedScope = initialScope(initialState, validationInitialPhase);

  for (const framed of frames) {
    if (framed.frame !== expected) {
      throw new Error(`Non-contiguous framed event: expected ${expected}, received ${framed.frame}`);
    }
    assertScope(framed.scope);
    if (framed.event === null && framed.effect === null) {
      throw new Error(`Canonical frame ${framed.frame} contains no fact.`);
    }
    if (framed.effect?.kind === 'EFFECT_TARGET_RESOLVED') {
      if (framed.effect.result === 'AFFECTED' && framed.event === null) {
        throw new Error(
          `Affected effect target at frame ${framed.frame} has no event.`,
        );
      }
      if (framed.effect.result !== 'AFFECTED' && framed.event !== null) {
        throw new Error(
          `${framed.effect.result} effect target at frame ${framed.frame} cannot contain an event.`,
        );
      }
    }
    expectedScope = framed.event === null
      ? expectedScope
      : scopeForEvent(framed.event, expectedScope);
    if (
      framed.scope.turn !== expectedScope.turn
      || framed.scope.phase !== expectedScope.phase
    ) {
      throw new Error(
        `Framed event scope mismatch at frame ${framed.frame}: `
        + `expected turn ${expectedScope.turn} ${expectedScope.phase}, `
        + `received turn ${framed.scope.turn} ${framed.scope.phase}`,
      );
    }
    expected = nextFrame(expected);
  }
  return frames;
}

/**
 * A single raw reducer event gets the best scope derivable from its current
 * state. Canonical multi-event commits use frameEventSequence so boundary
 * scope carries through the whole batch.
 */
export function frameSingleEvent(state: MatchState, event: MatchEvent): CanonicalFrame {
  return frameEventSequence(state, [event])[0];
}

export function turnSpans(frames: readonly CanonicalFrame[]): readonly TurnFrameSpan[] {
  const spans = new Map<number, { startFrame: Frame; endFrame: Frame }>();
  for (const entry of frames) {
    const existing = spans.get(entry.scope.turn);
    if (existing) {
      existing.endFrame = entry.frame;
    } else {
      spans.set(entry.scope.turn, { startFrame: entry.frame, endFrame: entry.frame });
    }
  }
  return Object.freeze([...spans.entries()]
    .sort(([a], [b]) => a - b)
    .map(([turn, span]) => Object.freeze({ turn, ...span })));
}

export function scopeAtFrame(
  frames: readonly CanonicalFrame[],
  frame: Frame,
): TemporalScope | null {
  if (frame === GENESIS_FRAME) return null;
  const entry = frames.find((candidate) => candidate.frame === frame);
  return entry?.scope ?? null;
}

export function turnAtFrame(frames: readonly CanonicalFrame[], frame: Frame): number | null {
  return scopeAtFrame(frames, frame)?.turn ?? null;
}

/**
 * Lifecycle chronology is derived from the canonical stream, so repeated
 * create/play/reveal cycles retain every occurrence rather than collapsing
 * into an ambiguous scalar timestamp.
 */
export function cardLifecycleFrames(
  frames: readonly CanonicalFrame[],
  cardId: CardId,
): CardLifecycleFrames {
  const created: Frame[] = [];
  const played: Frame[] = [];
  const revealed: Frame[] = [];
  const moved: Frame[] = [];
  const destroyed: Frame[] = [];
  const banished: Frame[] = [];

  for (const entry of frames) {
    const event = entry.event;
    if (event === null) continue;
    if (!('cardId' in event) || event.cardId !== cardId) continue;
    switch (event.type) {
      case 'CARD_CREATED':
        created.push(entry.frame);
        break;
      case 'CARD_PLAY_COMPLETED':
        played.push(entry.frame);
        break;
      case 'CARD_REVEALED':
        revealed.push(entry.frame);
        break;
      case 'CARD_MOVED':
      case 'CARD_ZONE_CHANGED':
      case 'CARD_RETURNED_TO_LANE':
        moved.push(entry.frame);
        break;
      case 'CARD_DESTROYED':
        destroyed.push(entry.frame);
        break;
      case 'CARD_BANISHED':
        banished.push(entry.frame);
        break;
      default:
        break;
    }
  }

  return Object.freeze({
    created: Object.freeze(created),
    played: Object.freeze(played),
    revealed: Object.freeze(revealed),
    moved: Object.freeze(moved),
    destroyed: Object.freeze(destroyed),
    banished: Object.freeze(banished),
  });
}

export function locationLifecycleFrames(
  frames: readonly CanonicalFrame[],
  locationId: LocationCardInstanceId,
): LocationLifecycleFrames {
  const created: Frame[] = [];
  const drawn: Frame[] = [];
  const played: Frame[] = [];
  const revealed: Frame[] = [];
  const moved: Frame[] = [];
  const removed: Frame[] = [];

  for (const entry of frames) {
    const event = entry.event;
    if (event === null) continue;
    switch (event.type) {
      case 'LOCATION_CARD_CREATED':
        if (event.locationId === locationId) created.push(entry.frame);
        break;
      case 'LOCATION_DECK_INITIALIZED':
        if (event.locations.some((location) => location.id === locationId)) {
          created.push(entry.frame);
        }
        break;
      case 'LOCATION_CARD_DRAWN':
        if (event.locationId === locationId) drawn.push(entry.frame);
        break;
      case 'LOCATION_CARD_PLAYED':
        if (event.locationId === locationId) played.push(entry.frame);
        break;
      case 'LOCATION_REVEALED':
        if (event.locationId === locationId) revealed.push(entry.frame);
        break;
      case 'LOCATION_MOVED':
        if (event.locationId === locationId) moved.push(entry.frame);
        break;
      case 'LOCATIONS_SWAPPED':
        if (
          event.left.locationId === locationId
          || event.right.locationId === locationId
        ) {
          moved.push(entry.frame);
        }
        break;
      case 'LOCATION_REMOVED_FROM_LANE':
      case 'LOCATION_RETURNED_TO_DECK':
        if (event.locationId === locationId) removed.push(entry.frame);
        break;
      case 'LOCATION_REPLACED':
        if (event.newId === locationId) {
          created.push(entry.frame);
          played.push(entry.frame);
          if (event.revealPolicy === 'REVEAL_IMMEDIATELY') revealed.push(entry.frame);
        }
        if (event.oldId === locationId) removed.push(entry.frame);
        break;
      default:
        break;
    }
  }

  return { created, drawn, played, revealed, moved, removed };
}

function initialScope(state: MatchState, override?: TimelinePhase): TemporalScope {
  if (override) return { turn: state.turn, phase: override };
  const prior = state.timeline.scope;
  if (
    prior
    && prior.turn === state.turn
    && (prior.phase === 'START' || prior.phase === 'SETUP')
  ) {
    return prior;
  }
  switch (state.phase) {
    case 'RESOLVING':
      return { turn: state.turn, phase: 'RESOLUTION' };
    case 'BETWEEN_TURNS':
      return { turn: state.turn, phase: 'END' };
    case 'ENDED':
      return { turn: state.turn, phase: 'MATCH_END' };
    case 'AWAITING_INTENT':
    default:
      return { turn: state.turn, phase: 'ACTION' };
  }
}

function scopeForEvent(
  event: MatchEvent,
  previous: TemporalScope,
): TemporalScope {
  if (previous.phase === 'MATCH_END') {
    if (event.type === 'INTENT_REJECTED' || event.type === 'RECURSION_LIMIT_HIT') {
      return previous;
    }
    throw new Error(`Cannot frame ${event.type} after MATCH_ENDED`);
  }

  switch (event.type) {
    case 'MATCH_SETUP_COMPLETED': {
      assertPreviousPhase(event.type, previous.phase, ['SETUP']);
      return previous;
    }
    case 'TURN_RESOLUTION_STARTED': {
      assertEventTurn(event.type, event.turn, previous.turn);
      assertPreviousPhase(event.type, previous.phase, ['SETUP', 'START', 'ACTION']);
      return { turn: event.turn, phase: 'RESOLUTION' };
    }
    case 'TURN_ENDED': {
      assertEventTurn(event.type, event.turn, previous.turn);
      assertPreviousPhase(event.type, previous.phase, ['RESOLUTION']);
      return { turn: event.turn, phase: 'END' };
    }
    case 'TURN_STARTED': {
      assertEventTurn(event.type, event.turn, previous.turn + 1);
      assertPreviousPhase(event.type, previous.phase, ['END']);
      return { turn: event.turn, phase: 'START' };
    }
    case 'MATCH_ENDED':
      assertPreviousPhase(event.type, previous.phase, ['END']);
      return { turn: previous.turn, phase: 'MATCH_END' };
    case 'CARD_STAGED':
    case 'INTENT_REJECTED':
      return { turn: previous.turn, phase: 'ACTION' };
    default:
      return previous;
  }
}

function assertScope(scope: TemporalScope): void {
  if (!Number.isSafeInteger(scope.turn) || scope.turn < 1) {
    throw new Error(`Temporal scope turn must be a positive safe integer; received ${scope.turn}`);
  }
}

function assertEventTurn(type: MatchEvent['type'], actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`${type}: expected turn ${expected}, received ${actual}`);
  }
}

function assertPreviousPhase(
  type: MatchEvent['type'],
  actual: TimelinePhase,
  allowed: readonly TimelinePhase[],
): void {
  if (!allowed.includes(actual)) {
    throw new Error(
      `${type}: invalid timeline phase ${actual}; expected ${allowed.join(' or ')}`,
    );
  }
}
