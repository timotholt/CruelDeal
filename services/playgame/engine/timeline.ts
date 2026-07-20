import type { MatchEvent } from './types/events';
import type { CardId, LocationCardInstanceId } from './types/ids';
import type { MatchState } from './types/state';
import {
  GENESIS_FRAME,
  nextFrame,
  type Frame,
  type FramedEvent,
  type TemporalScope,
  type TimelinePhase,
  type TurnFrameSpan,
} from './types/timeline';

export interface FrameEventSequenceOptions {
  /** Opening/bootstrap batches belong to turn 1's SETUP scope. */
  readonly initialPhase?: TimelinePhase;
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
): readonly FramedEvent[] {
  if (events.length === 0) return Object.freeze([]);

  let frame = currentFrame(initialState);
  const firstRawEvent = events[0];
  const inferredOpeningPhase = currentFrame(initialState) === GENESIS_FRAME
    && firstRawEvent.type === 'CARD_DRAWN'
    ? 'SETUP'
    : undefined;
  let scope = initialScope(initialState, options.initialPhase ?? inferredOpeningPhase);
  const framed: FramedEvent[] = [];

  for (const event of events) {
    scope = scopeForEvent(event, scope);
    frame = nextFrame(frame);
    framed.push(Object.freeze({
      frame,
      scope: Object.freeze({ ...scope }),
      event,
    }));
  }

  return Object.freeze(framed);
}

export function assertFramedEventSequence(
  initialState: MatchState,
  framedEvents: readonly FramedEvent[],
): readonly FramedEvent[] {
  let expected = nextFrame(currentFrame(initialState));
  const validationInitialPhase = currentFrame(initialState) === GENESIS_FRAME
    && framedEvents[0]?.scope.phase === 'SETUP'
    ? 'SETUP'
    : undefined;
  let expectedScope = initialScope(initialState, validationInitialPhase);

  for (const framed of framedEvents) {
    if (framed.frame !== expected) {
      throw new Error(`Non-contiguous framed event: expected ${expected}, received ${framed.frame}`);
    }
    assertScope(framed.scope);
    expectedScope = scopeForEvent(framed.event, expectedScope);
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
  return framedEvents;
}

/**
 * A single raw reducer event gets the best scope derivable from its current
 * state. Canonical multi-event commits use frameEventSequence so boundary
 * scope carries through the whole batch.
 */
export function frameSingleEvent(state: MatchState, event: MatchEvent): FramedEvent {
  return frameEventSequence(state, [event])[0];
}

export function turnSpans(framedEvents: readonly FramedEvent[]): readonly TurnFrameSpan[] {
  const spans = new Map<number, { startFrame: Frame; endFrame: Frame }>();
  for (const entry of framedEvents) {
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
  framedEvents: readonly FramedEvent[],
  frame: Frame,
): TemporalScope | null {
  if (frame === GENESIS_FRAME) return null;
  const entry = framedEvents.find((candidate) => candidate.frame === frame);
  return entry?.scope ?? null;
}

export function turnAtFrame(framedEvents: readonly FramedEvent[], frame: Frame): number | null {
  return scopeAtFrame(framedEvents, frame)?.turn ?? null;
}

/**
 * Lifecycle chronology is derived from the canonical stream, so repeated
 * create/play/reveal cycles retain every occurrence rather than collapsing
 * into an ambiguous scalar timestamp.
 */
export function cardLifecycleFrames(
  framedEvents: readonly FramedEvent[],
  cardId: CardId,
): CardLifecycleFrames {
  const created: Frame[] = [];
  const played: Frame[] = [];
  const revealed: Frame[] = [];
  const moved: Frame[] = [];
  const destroyed: Frame[] = [];
  const banished: Frame[] = [];

  for (const entry of framedEvents) {
    const event = entry.event;
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
  framedEvents: readonly FramedEvent[],
  locationId: LocationCardInstanceId,
): LocationLifecycleFrames {
  const created: Frame[] = [];
  const drawn: Frame[] = [];
  const played: Frame[] = [];
  const revealed: Frame[] = [];
  const moved: Frame[] = [];
  const removed: Frame[] = [];

  for (const entry of framedEvents) {
    const event = entry.event;
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
