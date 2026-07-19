import { describe, expect, it } from 'vitest';

import { replayMatch } from '../replay';
import { currentFrame } from '../timeline';
import { frameAndFoldEvents } from '../transactionTimeline';
import type { MatchEvent } from '../types/events';
import { asFrame } from '../types/timeline';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';

const manifest = testManifest([testCardDef('phase15-frame-card')]);

function initialState() {
  return buildRuntimeFixture({
    seed: 'phase15-frame-continuity',
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

describe('Phase 1.5 preserves the Phase 1.1 chronology', () => {
  it('reuses the exact live FramedEvents for replay while local indexes reset', () => {
    const genesis = initialState();
    const firstEvents: readonly MatchEvent[] = [
      { type: 'TURN_RESOLUTION_STARTED', turn: 3 },
      { type: 'TURN_ENDED', turn: 3 },
      {
        type: 'TURN_STARTED',
        turn: 4,
        priority: 'P1',
        priorityReason: 'MORE_POWER',
      },
    ];
    const first = frameAndFoldEvents({
      transactionId: 'phase15:tx:1',
      initialState: genesis,
      events: firstEvents,
      manifest,
    });
    const second = frameAndFoldEvents({
      transactionId: 'phase15:tx:2',
      initialState: first.finalState,
      events: [
        { type: 'MAX_ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'TURN_START' },
        { type: 'ENERGY_CHANGED', owner: 'P0', delta: 1, reason: 'TURN_START' },
      ],
      manifest,
    });
    const framedEvents = [...first.framedEvents, ...second.framedEvents];
    const replayed = replayMatch({
      seed: genesis.seed,
      manifest,
      initialState: genesis,
      framedEvents,
    });

    expect(framedEvents.map(event => event.frame)).toEqual([
      asFrame(1),
      asFrame(2),
      asFrame(3),
      asFrame(4),
      asFrame(5),
    ]);
    expect(second.transitions.map(transition => transition.index)).toEqual([0, 1]);
    expect(second.transitions.map(transition => transition.frame)).toEqual([
      asFrame(4),
      asFrame(5),
    ]);
    expect(replayed.steps.slice(1).map(step => step.framedEvent))
      .toEqual(framedEvents);
    expect(replayed.steps.slice(1).map(step => step.frame))
      .toEqual(framedEvents.map(event => event.frame));
    expect(replayed.steps.slice(1).map(step => step.scope))
      .toEqual(framedEvents.map(event => event.scope));
    expect(replayed.finalState).toEqual(second.finalState);
    expect(currentFrame(replayed.finalState)).toBe(asFrame(5));
  });
});
