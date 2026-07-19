import { describe, expect, it } from 'vitest';

import {
  assertFramedEventSequence,
  cardLifecycleFrames,
  currentFrame,
  frameEventSequence,
  scopeAtFrame,
  turnAtFrame,
  turnSpans,
} from '../timeline';
import { foldFramedEvents, frameAndFoldEvents } from '../transactionTimeline';
import {
  GENESIS_FRAME,
  asFrame,
  nextFrame,
  type Frame,
  type FramedEvent,
} from '../types/timeline';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import { buildRuntimeFixture, testCardDef, testManifest } from '../testkit/runtimeFixture';

const cardDef = testCardDef('frame-edge-card');
const manifest = testManifest([cardDef]);
const cardId = 'frame-edge-instance' as CardId;
const otherCardId = 'frame-edge-other' as CardId;
const systemCause = { sourceId: cardId, effectKind: 'SYSTEM' as const };

function fixtureState(
  overrides: Partial<Pick<MatchState, 'turn' | 'phase'>> = {},
): MatchState {
  return buildRuntimeFixture({
    seed: 'phase1.1-frame-edge-cases',
    localSeat: 'P0',
    turn: overrides.turn ?? 3,
    phase: overrides.phase ?? 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function addToHand(id: CardId): MatchEvent {
  return {
    type: 'CARD_ADDED_TO_HAND',
    owner: 'P0',
    cardId: id,
    defId: cardDef.defId,
    spawnSource: { kind: 'SYSTEM' },
  };
}

function tamper(
  framed: FramedEvent,
  changes: Partial<FramedEvent>,
): FramedEvent {
  return { ...framed, ...changes };
}

describe('Frame value edge cases', () => {
  it('uses frame zero exclusively as the genesis coordinate', () => {
    expect(GENESIS_FRAME).toBe(0);
    expect(asFrame(0)).toBe(GENESIS_FRAME);
  });

  it('accepts the largest safe frame value', () => {
    expect(asFrame(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects negative frame values', () => {
    expect(() => asFrame(-1)).toThrow(/non-negative safe integer/);
  });

  it('rejects fractional frame values', () => {
    expect(() => asFrame(1.5)).toThrow(/non-negative safe integer/);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-finite frame value %s',
    (value) => {
      expect(() => asFrame(value)).toThrow(/non-negative safe integer/);
    },
  );

  it('advances a valid frame by exactly one', () => {
    expect(nextFrame(asFrame(41))).toBe(asFrame(42));
  });

  it('rejects frame overflow', () => {
    expect(() => nextFrame(asFrame(Number.MAX_SAFE_INTEGER))).toThrow(/overflow/);
  });
});

describe('Canonical framing edge cases', () => {
  it('reports genesis for a state with no committed events', () => {
    expect(currentFrame(fixtureState())).toBe(GENESIS_FRAME);
  });

  it('treats an empty raw batch as a frozen no-op sequence', () => {
    const framed = frameEventSequence(fixtureState(), []);
    expect(framed).toEqual([]);
    expect(Object.isFrozen(framed)).toBe(true);
  });

  it('continues match-global frames across transaction boundaries', () => {
    const first = frameAndFoldEvents({
      transactionId: 'edge:tx:1',
      initialState: fixtureState(),
      events: [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
      manifest,
    });
    const second = frameAndFoldEvents({
      transactionId: 'edge:tx:2',
      initialState: first.finalState,
      events: [{ type: 'TURN_ENDED', turn: 3 }],
      manifest,
    });

    expect(first.framedEvents[0].frame).toBe(asFrame(1));
    expect(second.framedEvents[0].frame).toBe(asFrame(2));
  });

  it('resets transaction-local indexes without resetting gameplay frames', () => {
    const first = frameAndFoldEvents({
      transactionId: 'edge:index:1',
      initialState: fixtureState(),
      events: [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
      manifest,
    });
    const second = frameAndFoldEvents({
      transactionId: 'edge:index:2',
      initialState: first.finalState,
      events: [{ type: 'TURN_ENDED', turn: 3 }],
      manifest,
    });

    expect(first.transitions[0]).toMatchObject({ index: 0, frame: 1 });
    expect(second.transitions[0]).toMatchObject({ index: 0, frame: 2 });
  });

  it('does not mutate the input state or raw event array while framing', () => {
    const state = fixtureState();
    const events: MatchEvent[] = [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }];
    const stateSnapshot = structuredClone(state);
    const eventsSnapshot = structuredClone(events);

    frameEventSequence(state, events);

    expect(state).toEqual(stateSnapshot);
    expect(events).toEqual(eventsSnapshot);
  });

  it('freezes the sequence, framed envelopes, and temporal scopes', () => {
    const framed = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );

    expect(Object.isFrozen(framed)).toBe(true);
    expect(Object.isFrozen(framed[0])).toBe(true);
    expect(Object.isFrozen(framed[0].scope)).toBe(true);
  });

  it('infers SETUP for the opening draw batch', () => {
    const framed = frameEventSequence(
      fixtureState({ turn: 1 }),
      [{ type: 'CARD_DRAWN', owner: 'P0', cardId, toHand: true }],
    );

    expect(framed[0].scope).toEqual({ turn: 1, phase: 'SETUP' });
  });

  it('honors an explicit genesis SETUP phase for non-draw opening events', () => {
    const framed = frameEventSequence(
      fixtureState({ turn: 1 }),
      [{
        type: 'LOCATION_REVEALED',
        lane: 0,
        locationId: 'opening-location' as LocationCardInstanceId,
        cause: systemCause,
      }],
      { initialPhase: 'SETUP' },
    );

    expect(framed[0].scope).toEqual({ turn: 1, phase: 'SETUP' });
  });

  it('moves from START into ACTION on the first staged card', () => {
    const initial = frameAndFoldEvents({
      transactionId: 'edge:start',
      initialState: fixtureState(),
      events: [
        { type: 'TURN_RESOLUTION_STARTED', turn: 3 },
        { type: 'TURN_ENDED', turn: 3 },
        { type: 'TURN_STARTED', turn: 4, priority: 'P0', priorityReason: 'RETAINED' },
        addToHand(cardId),
      ],
      manifest,
    });
    const framed = frameEventSequence(initial.finalState, [{
      type: 'CARD_STAGED',
      intentId: 'edge-stage',
      owner: 'P0',
      cardId,
      lane: 0,
      cost: 1,
    }]);

    expect(framed[0].scope).toEqual({ turn: 4, phase: 'ACTION' });
  });

  it('moves directly into MATCH_END when a match-ending event commits', () => {
    const framed = frameEventSequence(fixtureState(), [{
      type: 'MATCH_ENDED',
      result: {
        winner: 'DRAW',
        lanesWon: { P0: 0, P1: 0 },
        totalPower: { P0: 0, P1: 0 },
      },
    }]);

    expect(framed[0].scope).toEqual({ turn: 3, phase: 'MATCH_END' });
  });

  it('preserves one envelope identity through framing, folding, and logging', () => {
    const framedEvents = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    const folded = foldFramedEvents({
      transactionId: 'edge:identity',
      initialState: fixtureState(),
      framedEvents,
      manifest,
    });

    expect(folded.framedEvents[0]).toBe(framedEvents[0]);
    expect(folded.transitions[0].framedEvent).toBe(framedEvents[0]);
    expect(folded.finalState.log[0]).toMatchObject({
      frame: framedEvents[0].frame,
      scope: framedEvents[0].scope,
      event: framedEvents[0].event,
    });
  });

  it('folds an empty canonical batch without manufacturing a frame', () => {
    const state = fixtureState();
    const folded = foldFramedEvents({
      transactionId: 'edge:empty',
      initialState: state,
      framedEvents: [],
      manifest,
    });

    expect(folded.finalState).toBe(state);
    expect(folded.transitions).toEqual([]);
    expect(currentFrame(folded.finalState)).toBe(GENESIS_FRAME);
  });
});

describe('Canonical scope validation edge cases', () => {
  it('rejects scope turn zero', () => {
    const [framed] = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    expect(() => assertFramedEventSequence(fixtureState(), [
      tamper(framed, { scope: { turn: 0, phase: 'RESOLUTION' } }),
    ])).toThrow(/positive safe integer/);
  });

  it('rejects a fractional scope turn', () => {
    const [framed] = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    expect(() => assertFramedEventSequence(fixtureState(), [
      tamper(framed, { scope: { turn: 3.5, phase: 'RESOLUTION' } }),
    ])).toThrow(/positive safe integer/);
  });

  it('rejects a scope turn that disagrees with its event', () => {
    const [framed] = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    expect(() => assertFramedEventSequence(fixtureState(), [
      tamper(framed, { scope: { turn: 4, phase: 'RESOLUTION' } }),
    ])).toThrow(/scope mismatch/);
  });

  it('rejects a scope phase that disagrees with its event', () => {
    const [framed] = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    expect(() => assertFramedEventSequence(fixtureState(), [
      tamper(framed, { scope: { turn: 3, phase: 'ACTION' } }),
    ])).toThrow(/scope mismatch/);
  });

  it('rejects a TURN_STARTED event that skips a turn', () => {
    expect(() => frameEventSequence(fixtureState(), [{
      type: 'TURN_STARTED',
      turn: 5,
      priority: 'P0',
      priorityReason: 'RETAINED',
    }])).toThrow(/expected turn 4, received 5/);
  });

  it('rejects a stale turn number on TURN_RESOLUTION_STARTED', () => {
    expect(() => frameEventSequence(fixtureState(), [{
      type: 'TURN_RESOLUTION_STARTED',
      turn: 2,
    }])).toThrow(/expected turn 3, received 2/);
  });

  it('rejects a stale turn number on TURN_ENDED', () => {
    expect(() => frameEventSequence(fixtureState({ phase: 'RESOLVING' }), [{
      type: 'TURN_ENDED',
      turn: 2,
    }])).toThrow(/expected turn 3, received 2/);
  });

  it('rejects TURN_ENDED when resolution never started', () => {
    expect(() => frameEventSequence(fixtureState(), [{
      type: 'TURN_ENDED',
      turn: 3,
    }])).toThrow(/invalid timeline phase ACTION/);
  });

  it('rejects TURN_STARTED before the previous turn reaches END', () => {
    expect(() => frameEventSequence(fixtureState(), [{
      type: 'TURN_STARTED',
      turn: 4,
      priority: 'P0',
      priorityReason: 'RETAINED',
    }])).toThrow(/invalid timeline phase ACTION/);
  });

  it('rejects mechanical events after MATCH_ENDED', () => {
    expect(() => frameEventSequence(fixtureState(), [
      {
        type: 'MATCH_ENDED',
        result: {
          winner: 'DRAW',
          lanesWon: { P0: 0, P1: 0 },
          totalPower: { P0: 0, P1: 0 },
        },
      },
      { type: 'ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'EFFECT' },
    ])).toThrow(/after MATCH_ENDED/);
  });

  it('keeps post-match diagnostics inside MATCH_END scope', () => {
    const framed = frameEventSequence(fixtureState(), [
      {
        type: 'MATCH_ENDED',
        result: {
          winner: 'DRAW',
          lanesWon: { P0: 0, P1: 0 },
          totalPower: { P0: 0, P1: 0 },
        },
      },
      { type: 'INTENT_REJECTED', intentId: 'late', reason: 'match ended' },
    ]);

    expect(framed.map(({ scope }) => scope)).toEqual([
      { turn: 3, phase: 'MATCH_END' },
      { turn: 3, phase: 'MATCH_END' },
    ]);
  });
});

describe('Timeline query and lifecycle edge cases', () => {
  it('returns no scope or turn for genesis and unknown frames', () => {
    const state = fixtureState();
    expect(scopeAtFrame(state.log, GENESIS_FRAME)).toBeNull();
    expect(turnAtFrame(state.log, GENESIS_FRAME)).toBeNull();
    expect(scopeAtFrame(state.log, asFrame(99))).toBeNull();
    expect(turnAtFrame(state.log, asFrame(99))).toBeNull();
  });

  it('builds exact spans across three consecutive turns', () => {
    const folded = frameAndFoldEvents({
      transactionId: 'edge:three-turns',
      initialState: fixtureState(),
      events: [
        { type: 'TURN_RESOLUTION_STARTED', turn: 3 },
        { type: 'TURN_ENDED', turn: 3 },
        { type: 'TURN_STARTED', turn: 4, priority: 'P0', priorityReason: 'RETAINED' },
        { type: 'TURN_RESOLUTION_STARTED', turn: 4 },
        { type: 'TURN_ENDED', turn: 4 },
        { type: 'TURN_STARTED', turn: 5, priority: 'P1', priorityReason: 'MORE_POWER' },
      ],
      manifest,
    });

    expect(turnSpans(folded.finalState.log)).toEqual([
      { turn: 3, startFrame: asFrame(1), endFrame: asFrame(2) },
      { turn: 4, startFrame: asFrame(3), endFrame: asFrame(5) },
      { turn: 5, startFrame: asFrame(6), endFrame: asFrame(6) },
    ]);
  });

  it('ignores lifecycle events belonging to another card', () => {
    const folded = frameAndFoldEvents({
      transactionId: 'edge:other-card',
      initialState: fixtureState(),
      events: [addToHand(cardId), addToHand(otherCardId)],
      manifest,
    });

    expect(cardLifecycleFrames(folded.finalState.log, cardId).created)
      .toEqual([asFrame(1)]);
  });

  it('preserves repeated play and reveal occurrences for the same card', () => {
    const folded = frameAndFoldEvents({
      transactionId: 'edge:repeated-lifecycle',
      initialState: fixtureState(),
      events: [
        addToHand(cardId),
        { type: 'CARD_STAGED', intentId: 'first', owner: 'P0', cardId, lane: 0, cost: 1 },
        { type: 'CARD_FLIPPED', cardId },
        {
          type: 'CARD_MOVED_TO_ZONE',
          cardId,
          destination: { kind: 'HAND' },
          cause: systemCause,
        },
        { type: 'CARD_STAGED', intentId: 'second', owner: 'P0', cardId, lane: 1, cost: 1 },
        { type: 'CARD_FLIPPED', cardId },
        { type: 'CARD_BANISHED', cardId, cause: systemCause },
      ],
      manifest,
    });
    const lifecycle = cardLifecycleFrames(folded.finalState.log, cardId);

    expect(lifecycle.played).toEqual([asFrame(2), asFrame(5)]);
    expect(lifecycle.revealed).toEqual([asFrame(3), asFrame(6)]);
    expect(lifecycle.moved).toEqual([asFrame(4)]);
    expect(lifecycle.banished).toEqual([asFrame(7)]);
  });

  it('records return-to-lane and repeated destruction as distinct occurrences', () => {
    const folded = frameAndFoldEvents({
      transactionId: 'edge:return-lifecycle',
      initialState: fixtureState(),
      events: [
        {
          type: 'CARD_ADDED_TO_LANE',
          owner: 'P0',
          cardId,
          lane: 0,
          defId: cardDef.defId,
          spawnSource: { kind: 'SYSTEM' },
        },
        { type: 'CARD_DESTROYED', cardId, cause: systemCause },
        {
          type: 'CARD_RETURNED_TO_LANE',
          cardId,
          lane: 2,
          revealed: true,
          cause: systemCause,
        },
        { type: 'CARD_DESTROYED', cardId, cause: systemCause },
      ],
      manifest,
    });

    expect(cardLifecycleFrames(folded.finalState.log, cardId)).toMatchObject({
      created: [asFrame(1)],
      moved: [asFrame(3)],
      destroyed: [asFrame(2), asFrame(4)],
    });
  });

  it('returns an empty lifecycle for an unknown card', () => {
    expect(cardLifecycleFrames(fixtureState().log, cardId)).toEqual({
      created: [],
      played: [],
      revealed: [],
      moved: [],
      destroyed: [],
      banished: [],
    });
  });

  it('rejects a canonical batch whose first frame is negative even if cast', () => {
    const [framed] = frameEventSequence(
      fixtureState(),
      [{ type: 'TURN_RESOLUTION_STARTED', turn: 3 }],
    );
    expect(() => assertFramedEventSequence(fixtureState(), [
      tamper(framed, { frame: -1 as Frame }),
    ])).toThrow(/expected 1, received -1/);
  });
});
