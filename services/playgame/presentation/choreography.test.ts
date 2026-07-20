import { describe, expect, it } from 'vitest';
import type { SeatAnimationEvent } from '../runtime/projection';
import { describeEventChoreography } from './choreography';

const event = (
  type: SeatAnimationEvent['type'],
  data: SeatAnimationEvent['data'],
): SeatAnimationEvent => ({ type, data });

describe('projected event choreography', () => {
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

  it('dispatches redacted and unmapped events without cues', () => {
    expect(describeEventChoreography(event('TURN_ENDED', {
      turn: 3,
    }))).toEqual({
      structural: { kind: 'dispatch-only' },
      vfx: [],
      sfx: [],
    });
  });
});
