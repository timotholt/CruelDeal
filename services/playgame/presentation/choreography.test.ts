import { describe, expect, it } from 'vitest';
import type { SeatAnimationEvent } from '../runtime/projection';
import {
  describeEventChoreography,
  EVENT_CHOREOGRAPHY_DISPOSITIONS,
} from './choreography';

const event = (
  type: SeatAnimationEvent['type'],
  data: SeatAnimationEvent['data'],
): SeatAnimationEvent => ({ type, data });

const STABILIZED_EVENT_FIXTURES = {
  GAMEPLAY_RNG_ADVANCED: {},
  CARD_STAGED: { card: 'c1', owner: 'P0', lane: 0 },
  ENERGY_CHANGED: { owner: 'P0', delta: -1, reason: 'CARD_PLAYED' },
  MAX_ENERGY_CHANGED: { owner: 'P0', delta: 1, reason: 'TURN_START' },
  NEXT_TURN_ENERGY_BONUS_CHANGED: { owner: 'P0', delta: 1 },
  CARD_REVEAL_SCHEDULED: { card: 'c1', timing: 'PRIORITY' },
  CARD_REVEALED: { card: 'c1' },
  CARD_PLAY_COMPLETED: { card: 'c1', owner: 'P0', lane: 0 },
  OR_WINDOW_OPEN: {},
  OR_WINDOW_CLOSE: {},
  CARD_POWER_CHANGED: { card: 'c1', mutation: { kind: 'ADD', delta: 1 } },
  CARD_COST_CHANGED: { card: 'c1', delta: -1 },
  CARD_DESTROYED: { card: 'c1' },
  CARD_DISCARDED: { card: 'c1', reason: 'FORCED_EFFECT' },
  CARD_BANISHED: { card: 'c1' },
  CARD_MOVED: { card: 'c1', fromLane: 0, toLane: 1 },
  CARD_RETURNED_TO_LANE: { card: 'c1', lane: 0, revealed: true },
  CARD_TRANSFORMED: { card: 'c1', defId: 'new-card' },
  CARD_TAG_ADDED: { card: 'c1', tag: 'TEST' },
  CARD_TAG_REMOVED: { card: 'c1', tag: 'TEST' },
  CARD_TEXT_OVERRIDDEN: { card: 'c1' },
  CARD_COUNTER_CHANGED: { card: 'c1', name: 'test', delta: 1 },
  CARD_DRAWN: { card: 'c1', owner: 'P0' },
  CARD_CREATED: {
    card: 'c1',
    owner: 'P0',
    destination: { kind: 'HAND' },
  },
  CARD_ZONE_CHANGED: { card: 'c1', destination: { kind: 'HAND' } },
  DECK_SHUFFLED: { owner: 'P0' },
  PENDING_EFFECT_SCHEDULED: {},
  PENDING_EFFECT_CONSUMED: {},
  LOCATION_DECK_INITIALIZED: { count: 3 },
  LOCATION_CARD_CREATED: {},
  LOCATION_CARD_DRAWN: {},
  LOCATION_CARD_PLAYED: { location: 'l1', lane: 0 },
  LOCATION_SLOT_REVEAL_SCHEDULED: { lane: 0, revealAtTurn: 1 },
  LOCATION_REVEALED: { location: 'l1', lane: 0 },
  LOCATION_TURNED_FACE_DOWN: { location: 'l1', lane: 0 },
  LOCATION_SHOWN_TO_SEATS: { location: 'l1', lane: 0, defId: 'loc' },
  LOCATION_REPLACED: { lane: 0, oldLocation: 'l1', newLocation: 'l2' },
  LOCATIONS_SWAPPED: {},
  LOCATION_MOVED: { location: 'l1', fromLane: 0, toLane: 1 },
  LOCATION_REMOVED_FROM_LANE: { location: 'l1', lane: 0 },
  LOCATION_RETURNED_TO_DECK: { location: 'l1', from: 'STAGING' },
  LOCATION_TAG_ADDED: { location: 'l1', tag: 'TEST' },
  LOCATION_TAG_REMOVED: { location: 'l1', tag: 'TEST' },
  LOCATION_COUNTER_CHANGED: { location: 'l1', name: 'test', delta: 1 },
  LANE_DESTRUCTION_STARTED: { lane: 0, position: 0 },
  LANE_DESTROYED: { lane: 0, position: 0 },
  LANE_CREATION_STARTED: { lane: 0, position: 0 },
  LANE_CREATED: { lane: 0, position: 0 },
  MATCH_SETUP_COMPLETED: {},
  TURN_RESOLUTION_STARTED: { turn: 1 },
  TURN_STARTED: { turn: 1, priority: 'P0', priorityReason: 'COIN_FLIP' },
  TURN_ENDED: { turn: 1 },
  MATCH_ENDED: { result: { winner: 'P0' } },
  RECURSION_LIMIT_HIT: {},
  INTENT_REJECTED: {},
} as const satisfies Record<
  SeatAnimationEvent['type'],
  SeatAnimationEvent['data']
>;

describe('projected event choreography', () => {
  it('has an explicit stable disposition for every event in the closed alphabet', () => {
    expect(Object.keys(EVENT_CHOREOGRAPHY_DISPOSITIONS).sort()).toEqual(
      Object.keys(STABILIZED_EVENT_FIXTURES).sort(),
    );
    for (const [type, data] of Object.entries(STABILIZED_EVENT_FIXTURES)) {
      expect(() => describeEventChoreography(event(
        type as SeatAnimationEvent['type'],
        data,
      ))).not.toThrow();
    }
  });

  it('maps movement without canonical cause identities', () => {
    expect(describeEventChoreography(event('CARD_MOVED', {
      card: 'c1',
      fromLane: 0,
      toLane: 2,
    }))).toEqual({
      structural: { kind: 'card-move', cardId: 'c1', durationMs: 360 },
      vfx: [{
        kind: 'move-trail',
        cardId: 'c1',
        effectKind: 'SYSTEM',
        reason: 'CARD_MOVED',
        sourceId: 'c1',
      }],
      sfx: [{ name: 'move', timing: 'on-dispatch' }],
    });
  });

  it('maps deck and generated hand entry', () => {
    expect(describeEventChoreography(event('CARD_DRAWN', {
      card: 'c1',
      owner: 'P0',
    })).structural).toEqual({
      kind: 'card-enter-hand',
      cardId: 'c1',
      owner: 'P0',
      origin: 'deck',
      popDurationMs: 320,
    });
    expect(describeEventChoreography(event('CARD_CREATED', {
      card: 'c2',
      owner: 'P0',
      destination: { kind: 'HAND' },
    })).structural).toEqual({
      kind: 'card-enter-hand',
      cardId: 'c2',
      owner: 'P0',
      origin: 'generated',
      popDurationMs: 320,
    });
  });

  it('maps projected power, destruction, and transform cues', () => {
    expect(describeEventChoreography(event('CARD_POWER_CHANGED', {
      card: 'c1',
      mutation: { kind: 'ADD', delta: 2 },
    }))).toMatchObject({
      vfx: [{ kind: 'power-flash', cardId: 'c1', delta: 2 }],
      sfx: [{ name: 'buff', timing: 'after-dispatch' }],
    });
    expect(describeEventChoreography(event('CARD_POWER_CHANGED', {
      card: 'c1',
      mutation: { kind: 'ADD', delta: -1 },
    }))).toMatchObject({
      vfx: [{ kind: 'power-flash', cardId: 'c1', delta: -1 }],
      sfx: [{ name: 'debuff', timing: 'after-dispatch' }],
    });
    expect(describeEventChoreography(event('CARD_DESTROYED', {
      card: 'c1',
    })).vfx).toEqual([
      { kind: 'destroy-burst', cardId: 'c1' },
    ]);
    expect(describeEventChoreography(event('CARD_TRANSFORMED', {
      card: 'c1',
      defId: 'new-card',
    })).vfx).toEqual([
      { kind: 'glitch-flash', cardId: 'c1' },
    ]);
  });

  it('makes non-additive and zero power-mutation policy explicit', () => {
    for (const mutation of [
      { kind: 'ADD', delta: 0 },
      { kind: 'SET', value: 9 },
      { kind: 'RESET' },
    ]) {
      expect(describeEventChoreography(event('CARD_POWER_CHANGED', {
        card: 'c1',
        mutation,
      }))).toMatchObject({
        vfx: [{ kind: 'power-flash', cardId: 'c1', delta: 0 }],
        sfx: [],
      });
    }
  });

  it('declares reveal semantics and non-hand creation without implicit fallback', () => {
    expect(describeEventChoreography(event('CARD_REVEALED', {
      card: 'c1',
    })).structural).toEqual({ kind: 'card-flip', cardId: 'c1' });
    expect(describeEventChoreography(event('LOCATION_REVEALED', {
      lane: 2,
      location: 'l1',
    })).structural).toEqual({ kind: 'location-reveal', lane: 2 });
    expect(describeEventChoreography(event('CARD_CREATED', {
      card: 'c2',
      owner: 'P0',
      destination: { kind: 'LANE', lane: 1, revealed: false },
    }))).toEqual({
      structural: { kind: 'dispatch-only' },
      vfx: [],
      sfx: [],
    });
  });

  it('dispatches explicitly passive and redacted events without cues', () => {
    expect(describeEventChoreography(event('TURN_ENDED', {
      turn: 3,
    }))).toEqual({
      structural: { kind: 'dispatch-only' },
      vfx: [],
      sfx: [],
    });
  });
});
