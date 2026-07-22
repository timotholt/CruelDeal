import { describe, expect, it } from 'vitest';

import { applyCanonicalFrame } from '../apply';
import {
  assertCanonicalFrameSequence,
  cardLifecycleFrames,
  currentFrame,
  frameEventSequence,
  turnAtFrame,
  turnSpans,
} from '../timeline';
import { frameAndFoldEvents } from '../transactionTimeline';
import { asFrame } from '../types/timeline';
import type { CardId } from '../types/ids';
import type { MatchEvent } from '../types/events';
import { buildRuntimeFixture, testCardDef, testManifest } from '../testkit/runtimeFixture';

const manifest = testManifest([testCardDef('timeline-card')]);
const energyCause = {
  sourceId: 'system:timeline-energy' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST_ENERGY',
} as const;
const stagedCause = {
  sourceId: 'system:timeline-stage' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST_STAGE',
} as const;

function fixtureState() {
  return buildRuntimeFixture({
    seed: 'phase1.1-timeline',
    localSeat: 'P0',
    turn: 3,
    phase: 'AWAITING_INTENT',
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

describe('Phase 1.1 canonical timeline', () => {
  it('assigns one match-global frame per event and reuses it for transitions', () => {
    const initialState = fixtureState();
    const cardId = 'timeline-card-instance' as CardId;
    const events: readonly MatchEvent[] = [
      {
        type: 'CARD_CREATED',
        owner: 'P0',
        cardId,
        defId: 'timeline-card',
        spawnSource: { kind: 'SYSTEM' },
        destination: { kind: 'HAND' },
        cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST' },
      },
      {
        type: 'CARD_STAGED',
        intentId: 'play-1',
        owner: 'P0',
        cardId,
        lane: 0,
        energyPaid: 1,
        cause: stagedCause,
      },
      { type: 'CARD_REVEALED', cardId, cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST_REVEAL' } },
      { type: 'CARD_PLAY_COMPLETED', owner: 'P0', cardId, lane: 0, cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST_PLAY' } },
      {
        type: 'CARD_MOVED',
        cardId,
        fromLane: 0,
        toLane: 1,
        cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST' },
      },
      {
        type: 'CARD_DESTROYED',
        cardId,
        cause: { sourceId: cardId, effectKind: 'SYSTEM', reason: 'TEST' },
      },
    ];

    const built = frameAndFoldEvents({
      transactionId: 'timeline:tx:1',
      initialState,
      events,
      manifest,
    });

    expect(built.frames.map(({ frame }) => frame)).toEqual([
      asFrame(1),
      asFrame(2),
      asFrame(3),
      asFrame(4),
      asFrame(5),
      asFrame(6),
    ]);
    expect(built.transitions.map(({ frame }) => frame))
      .toEqual(built.frames.map(({ frame }) => frame));
    expect(built.transitions.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(currentFrame(built.finalState)).toBe(asFrame(6));
    expect(cardLifecycleFrames(built.frames, cardId)).toEqual({
      created: [asFrame(1)],
      played: [asFrame(4)],
      revealed: [asFrame(3)],
      moved: [asFrame(5)],
      destroyed: [asFrame(6)],
      banished: [],
    });
  });

  it('stores turn scopes and crosses a turn without guessing a future frame', () => {
    const built = frameAndFoldEvents({
      transactionId: 'timeline:turn-boundary',
      initialState: fixtureState(),
      events: [
        { type: 'TURN_RESOLUTION_STARTED', turn: 3 },
        { type: 'TURN_ENDED', turn: 3 },
        { type: 'TURN_STARTED', turn: 4, priority: 'P0', priorityReason: 'RETAINED' },
        { type: 'MAX_ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'TURN_START', cause: energyCause },
      ],
      manifest,
    });

    expect(built.frames.map(({ scope }) => scope)).toEqual([
      { turn: 3, phase: 'RESOLUTION' },
      { turn: 3, phase: 'END' },
      { turn: 4, phase: 'START' },
      { turn: 4, phase: 'START' },
    ]);
    expect(turnAtFrame(built.frames, asFrame(2))).toBe(3);
    expect(turnAtFrame(built.frames, asFrame(3))).toBe(4);
    expect(turnSpans(built.frames)).toEqual([
      { turn: 3, startFrame: asFrame(1), endFrame: asFrame(2) },
      { turn: 4, startFrame: asFrame(3), endFrame: asFrame(4) },
    ]);
    const turnBoundary = built.transitions[2];
    expect(turnBoundary.event.type).toBe('TURN_STARTED');
    expect(turnBoundary.before.turn).toBe(3);
    expect(turnBoundary.after.turn).toBe(4);
  });

  it('rejects gaps, duplicates, and rewinds', () => {
    const state = fixtureState();
    const event: MatchEvent = { type: 'TURN_RESOLUTION_STARTED', turn: 3 };
    const framed = frameEventSequence(state, [event])[0];

    expect(() => applyCanonicalFrame(state, { ...framed, frame: asFrame(2) }, manifest))
      .toThrow(/expected frame 1, received 2/);
    expect(() => assertCanonicalFrameSequence(
      state,
      [{ ...framed, frame: asFrame(2) }],
    )).toThrow(/expected 1, received 2/);

    const once = applyCanonicalFrame(state, framed, manifest);
    expect(() => applyCanonicalFrame(once, framed, manifest))
      .toThrow(/expected frame 2, received 1/);
  });
});
