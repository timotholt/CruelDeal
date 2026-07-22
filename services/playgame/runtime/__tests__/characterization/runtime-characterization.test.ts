import { getLocationState } from '../../../engine/projections/locationRuntime';
import { getCardState } from '../../../engine/projections/cardRuntime';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../../engine/rng';
import { resolve, resolveTurn } from '../../../engine/resolve';
import type { MatchEvent } from '../../../engine/types/events';
import type { Owner, Seat } from '../../../engine/types/ids';
import {
  assertRuntimeParity,
  frameAndFoldEvents,
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
  type RuntimeCardSpec,
  type RuntimeFixture,
  type RuntimeFixtureOptions,
  type RuntimeLaneSpec,
} from '../../../engine/testkit';
import type { Manifest } from '../../../engine/manifest/types';
import { getStoredCardPowerDelta } from '../../../engine/powerLedger';

const emptyLanes = (): [RuntimeLaneSpec, RuntimeLaneSpec, RuntimeLaneSpec] => [
  { P0: [], P1: [] },
  { P0: [], P1: [] },
  { P0: [], P1: [] },
];
const staged = (...cardIds: string[]) =>
  cardIds.map(cardId => ({ cardId, energyPaid: 0 }));

function fixture(
  seed: string,
  overrides: Partial<Omit<RuntimeFixtureOptions, 'seed'>> = {},
): RuntimeFixture {
  return buildRuntimeFixture({
    seed,
    localSeat: 'P0',
    turn: 2,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: emptyLanes(),
    locations: [null, null, null],
    ...overrides,
  });
}

function characterizeTurn(runtimeFixture: RuntimeFixture, manifest: Manifest) {
  const rng = createRng(`${runtimeFixture.seed}:turn-resolution`);
  const authoritative = resolveTurn(runtimeFixture.state, manifest, rng);
  const folded = frameAndFoldEvents({
    transactionId: `${runtimeFixture.seed}:turn:${runtimeFixture.state.turn}`,
    initialState: runtimeFixture.state,
    events: authoritative.events,
    manifest,
  });
  assertRuntimeParity(
    { finalState: authoritative.state, events: authoritative.events },
    folded,
  );
  return { ...authoritative, transitions: folded.transitions, foldedState: folded.finalState };
}

const plain = testCardDef('plain', { power: 2, cost: 1 });
const eotBuffer = testCardDef('eot-buffer', {
  power: 2,
  cost: 1,
  onEndOfTurn: [{
    kind: 'ADD_POWER',
    target: { kind: 'SELF' },
    delta: { kind: 'LIT', n: 3 },
  }],
});
const revealCascade = testCardDef('reveal-cascade', {
  power: 1,
  cost: 1,
  onReveal: [{
    kind: 'SEQUENCE',
    items: [
      { kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 2 } },
      { kind: 'ADD_POWER', target: { kind: 'SELF' }, delta: { kind: 'LIT', n: 4 } },
    ],
  }],
});

describe('Phase 0 runtime characterization', () => {
  it('ends a turn with no staged cards and records every intermediate state', () => {
    const runtimeFixture = fixture('end-turn-empty', { phase: 'AWAITING_INTENT' });
    const manifest = testManifest([plain]);
    const intentRng = createRng(runtimeFixture.state.rng);
    const events = resolve(runtimeFixture.state, {
      type: 'END_TURN',
      intentId: 'end-turn-empty-intent',
      owner: runtimeFixture.localSeat,
    }, intentRng, manifest).events;
    expect(events[0]).toEqual({ type: 'TURN_RESOLUTION_STARTED', turn: 2 });
    const resolutionStart = frameAndFoldEvents({
      transactionId: 'end-turn-empty:resolution-start',
      initialState: runtimeFixture.state,
      events: [events[0]],
      manifest,
    }).finalState;
    const authoritative = resolveTurn(
      resolutionStart,
      manifest,
      createRng(runtimeFixture.state.rng).scope(`turn:${runtimeFixture.state.turn}`),
    );
    const folded = frameAndFoldEvents({
      transactionId: 'end-turn-empty:turn:2',
      initialState: runtimeFixture.state,
      events,
      manifest,
    });

    expect(events.slice(1)).toEqual(authoritative.events);
    assertRuntimeParity({ finalState: authoritative.state, events }, folded);
    expect(folded.transitions[0].before.phase).toBe('AWAITING_INTENT');
    expect(folded.transitions[0].after.phase).toBe('RESOLVING');
    expect(events.some((event) => event.type === 'CARD_REVEALED')).toBe(false);
    expect(events.some((event) => event.type === 'TURN_ENDED')).toBe(true);
    expect(folded.transitions).toHaveLength(events.length);
    folded.transitions.forEach((frame) => {
      expect(frame.after.timeline.frame).toBe(frame.before.timeline.frame + 1);
      expect(frame.event).toEqual(events[frame.index]);
    });
  });

  it('runs end-of-turn effects when no cards require a flip', () => {
    const lanes = emptyLanes();
    lanes[0] = {
      P0: [{ id: 'already-face-up', defId: 'eot-buffer', revealed: true }],
      P1: [],
    };
    const { events, state } = characterizeTurn(
      fixture('eot-without-flips', { lanes }),
      testManifest([eotBuffer]),
    );

    expect(events.some((event) => event.type === 'CARD_REVEALED')).toBe(false);
    const buffIndex = events.findIndex((event) => event.type === 'CARD_POWER_CHANGED');
    const endedIndex = events.findIndex((event) => event.type === 'TURN_ENDED');
    expect(buffIndex).toBeGreaterThanOrEqual(0);
    expect(buffIndex).toBeLessThan(endedIndex);
    expect(getStoredCardPowerDelta(
      state,
      'already-face-up' as never,
      testManifest([eotBuffer]),
    )).toBe(3);
  });

  it('preserves one reveal and its triggered event cascade as adjacent frames', () => {
    const lanes = emptyLanes();
    lanes[0] = {
      P0: [{ id: 'cascade-card', defId: 'reveal-cascade', revealed: false }],
      P1: [],
    };
    const { events, transitions } = characterizeTurn(
      fixture('one-reveal-cascade', {
        lanes,
        stagedPlays: staged('cascade-card'),
      }),
      testManifest([revealCascade]),
    );
    const eventTypes = events.map((event) => event.type);
    const flip = eventTypes.indexOf('CARD_REVEALED');
    const close = eventTypes.indexOf('OR_WINDOW_CLOSE');

    expect(eventTypes.slice(flip, close + 1)).toEqual([
      'CARD_REVEALED',
      'OR_WINDOW_OPEN',
      'CARD_POWER_CHANGED',
      'CARD_POWER_CHANGED',
      'OR_WINDOW_CLOSE',
    ]);
    expect(getStoredCardPowerDelta(
      transitions[close].after,
      'cascade-card' as never,
      testManifest([revealCascade]),
    )).toBe(6);
  });

  it('reveals multiple staged cards in priority-owner order', () => {
    const lanes = emptyLanes();
    lanes[0] = {
      P0: [
        { id: 'p0-first', defId: 'plain' },
        { id: 'p0-second', defId: 'plain' },
      ],
      P1: [{ id: 'p1-priority', defId: 'plain' }],
    };
    const { events } = characterizeTurn(
      fixture('multi-reveal-priority', {
        priority: 'P1',
        lanes,
        stagedPlays: staged('p0-first', 'p1-priority', 'p0-second'),
      }),
      testManifest([plain]),
    );

    expect(events
      .filter((event): event is Extract<MatchEvent, { type: 'CARD_REVEALED' }> => event.type === 'CARD_REVEALED')
      .map((event) => event.cardId))
      .toEqual(['p1-priority', 'p0-first', 'p0-second']);
  });

  it('keeps end-of-turn effects between the final flip and TURN_ENDED', () => {
    const lanes = emptyLanes();
    lanes[0] = {
      P0: [
        { id: 'final-flip', defId: 'plain', revealed: false },
        { id: 'eot-after-flip', defId: 'eot-buffer', revealed: true },
      ],
      P1: [],
    };
    const { events } = characterizeTurn(
      fixture('effects-after-final-flip', {
        lanes,
        stagedPlays: staged('final-flip'),
      }),
      testManifest([plain, eotBuffer]),
    );
    const flipIndex = events.findIndex((event) => event.type === 'CARD_REVEALED');
    const effectIndex = events.findIndex(
      (event) => event.type === 'CARD_POWER_CHANGED' && event.cardId === 'eot-after-flip',
    );
    const endedIndex = events.findIndex((event) => event.type === 'TURN_ENDED');

    expect(flipIndex).toBeLessThan(effectIndex);
    expect(effectIndex).toBeLessThan(endedIndex);
  });

  it('reveals a location and applies its effect at the turn boundary', () => {
    const rally = testLocationDef('rally', [{
      kind: 'ADD_POWER',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
      delta: { kind: 'LIT', n: 2 },
    }]);
    const lanes = emptyLanes();
    lanes[1] = {
      P0: [{ id: 'rally-target', defId: 'plain', revealed: true }],
      P1: [],
    };
    const { events, state } = characterizeTurn(
      fixture('location-turn-boundary', {
        turn: 1,
        lanes,
        locations: [null, { id: 'location-1', defId: 'rally', revealed: false }, null],
      }),
      testManifest([plain], [rally]),
    );
    const startedIndex = events.findIndex((event) => event.type === 'TURN_STARTED');
    const revealIndex = events.findIndex((event) => event.type === 'LOCATION_REVEALED');
    const effectIndex = events.findIndex((event) => event.type === 'CARD_POWER_CHANGED');

    expect(startedIndex).toBeLessThan(revealIndex);
    expect(revealIndex).toBeLessThan(effectIndex);
    const locationId = state.lanesById[1].locationSlot.locationCardId!;
    expect(getLocationState(state, locationId)!.face).toBe('FACE_UP');
    expect(getStoredCardPowerDelta(
      state,
      'rally-target' as never,
      testManifest([plain], [rally]),
    )).toBe(2);
  });

  const handCards = (owner: Owner, count: number): RuntimeCardSpec[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `${owner.toLowerCase()}-hand-${index}`,
      defId: 'plain',
    }));

  it('draws into a non-full hand', () => {
    const { events, state } = characterizeTurn(
      fixture('draw-non-full-hand', {
        decks: {
          P0: [{ id: 'p0-top-deck', defId: 'plain' }],
          P1: [],
        },
        hands: { P0: handCards('P0', 6), P1: [] },
      }),
      testManifest([plain]),
    );
    const draws = events.filter(
      (event): event is Extract<MatchEvent, { type: 'CARD_DRAWN' }> => event.type === 'CARD_DRAWN',
    );

    expect(draws.map((event) => [event.owner, event.cardId])).toEqual([['P0', 'p0-top-deck']]);
    expect(state.hand.P0).toHaveLength(7);
    expect(state.deck.P0).toHaveLength(0);
  });

  it('does not draw while the hand is full', () => {
    const { events, state } = characterizeTurn(
      fixture('draw-full-hand', {
        decks: { P0: [], P1: [{ id: 'p1-top-deck', defId: 'plain' }] },
        hands: { P0: [], P1: handCards('P1', 7) },
      }),
      testManifest([plain]),
    );

    expect(events.some((event) => event.type === 'CARD_DRAWN' && event.owner === 'P1')).toBe(false);
    expect(state.hand.P1).toHaveLength(7);
    expect(state.deck.P1).toEqual(['p1-top-deck']);
  });

  it('ends the match once and leaves the captured result stable', () => {
    const lanes = emptyLanes();
    lanes[0] = {
      P0: [
        { id: 'winner-a', defId: 'plain', revealed: true },
        { id: 'winner-b', defId: 'plain', revealed: true },
      ],
      P1: [{ id: 'loser-a', defId: 'plain', revealed: true }],
    };
    const manifest = testManifest([plain]);
    const { events, state } = characterizeTurn(
      fixture('match-end-lock', { turn: 6, lanes }),
      manifest,
    );
    const lockedResult = state.result;
    const afterDiagnostic = frameAndFoldEvents({
      transactionId: 'match-end-lock:post-result',
      initialState: state,
      events: [{ type: 'INTENT_REJECTED', intentId: 'late', reason: 'match ended' }],
      manifest,
    }).finalState;

    expect(events.filter((event) => event.type === 'MATCH_ENDED')).toHaveLength(1);
    expect(state.phase).toBe('ENDED');
    expect(lockedResult?.winner).toBe('P0');
    expect(afterDiagnostic.result).toEqual(lockedResult);
  });

  it.each<Seat>(['P0', 'P1'])('treats local seat %s as an absolute engine owner', (localSeat) => {
    const lanes = emptyLanes();
    lanes[2] = {
      P0: localSeat === 'P0' ? [{ id: 'local-card', defId: 'plain' }] : [],
      P1: localSeat === 'P1' ? [{ id: 'local-card', defId: 'plain' }] : [],
    };
    const runtimeFixture = fixture(`local-seat-${localSeat}`, {
      localSeat,
      priority: localSeat,
      lanes,
      stagedPlays: staged('local-card'),
    });
    const { events, state } = characterizeTurn(runtimeFixture, testManifest([plain]));

    expect(runtimeFixture.remoteSeat).toBe(localSeat === 'P0' ? 'P1' : 'P0');
    expect(getCardState(state, 'local-card')!.owner).toBe(localSeat);
    expect(events.find((event) => event.type === 'CARD_REVEALED')).toMatchObject({
      type: 'CARD_REVEALED',
      cardId: 'local-card',
    });
  });
});
