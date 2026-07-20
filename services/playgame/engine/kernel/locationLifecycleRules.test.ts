import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { locationCardAtLane } from '../laneTopology';
import { getLocationState } from '../projections/locationRuntime';
import {
  emptyTestMatchState,
  testLocationDef,
  testManifest,
  withTestLocation,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { LocationCardInstanceId } from '../types/ids';
import { KernelInvariantError } from './failure';
import { kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type RulesCommand,
  type RulesTransactionOptions,
} from './rulesTransaction';

const CAUSE: EffectRef = {
  sourceId: 'system:location-kernel' as LocationCardInstanceId,
  effectKind: 'SYSTEM',
  reason: 'LOCATION_KERNEL_TEST',
};
const ALPHA = 'location-alpha' as LocationCardInstanceId;
const BETA = 'location-beta' as LocationCardInstanceId;
const GAMMA = 'location-gamma' as LocationCardInstanceId;
const manifest = testManifest([], [
  testLocationDef('alpha'),
  testLocationDef('beta'),
  testLocationDef('ruin'),
]);

function run(
  state: ReturnType<typeof emptyTestMatchState>,
  commands: readonly RulesCommand[],
  overrides: Partial<RulesTransactionOptions> = {},
) {
  return resolveRulesTransaction(state, commands, {
    manifest,
    baseDepth: 0,
    expandEffect: () => kernelStepSuccess({ work: [] }),
    ...overrides,
  });
}

describe('location-card lifecycle through the canonical rules transaction', () => {
  it('initializes, draws, plays, and schedules one exact stable identity in candidate order', () => {
    const genesis = emptyTestMatchState({
      phase: 'SETUP',
      lanesById: {},
      activeLaneOrder: [],
      nextLaneId: 0,
    });
    const creating = apply(genesis, {
      type: 'LANE_CREATION_STARTED',
      lane: 0,
      position: 0,
      cause: CAUSE,
    }, manifest);
    const result = run(creating, [
      {
        type: 'INITIALIZE_LOCATION_DECK',
        locations: [
          { id: ALPHA, defId: 'alpha', sourceDeckEntry: 0 },
          { id: BETA, defId: 'beta', sourceDeckEntry: 1 },
        ],
        cause: CAUSE,
      },
      {
        type: 'DRAW_LOCATION_CARD',
        locationId: BETA,
        pendingLane: 0,
        cause: CAUSE,
      },
      {
        type: 'DRAW_LOCATION_CARD',
        locationId: ALPHA,
        pendingLane: 0,
        cause: CAUSE,
      },
      {
        type: 'PLAY_LOCATION_CARD',
        locationId: ALPHA,
        lane: 0,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA,
        revealAtTurn: 2,
        cause: CAUSE,
      },
    ]);

    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_DECK_INITIALIZED',
      'LOCATION_CARD_DRAWN',
      'LOCATION_CARD_PLAYED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
    ]);
    expect(result.transitions.map(({ semantics }) => semantics.transitionKind))
      .toEqual([
        'DECK_INITIALIZED',
        'LOCATION_DRAWN',
        'LOCATION_PLAYED',
        'REVEAL_SCHEDULE_CHANGED',
      ]);
    expect(locationCardAtLane(result.state, 0)?.id).toBe(ALPHA);
    expect(result.state.locationDeck.drawPile).toEqual([BETA]);
    expect(result.state.lanesById[0].locationSlot.revealAtTurn).toBe(2);
    expect(result.usage.createdEntities).toBe(2);
  });

  it('creates a non-deck location only into an allocated creating lane', () => {
    const genesis = emptyTestMatchState({
      phase: 'SETUP',
      lanesById: {},
      activeLaneOrder: [],
      nextLaneId: 0,
    });
    const creating = apply(genesis, {
      type: 'LANE_CREATION_STARTED',
      lane: 0,
      position: 0,
      cause: CAUSE,
    }, manifest);
    const result = run(creating, [
      {
        type: 'CREATE_LOCATION_CARD',
        locationId: GAMMA,
        defId: 'ruin',
        pendingLane: 0,
        cause: CAUSE,
      },
      {
        type: 'PLAY_LOCATION_CARD',
        locationId: GAMMA,
        lane: 0,
        cause: CAUSE,
      },
    ]);
    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_CARD_CREATED',
      'LOCATION_CARD_PLAYED',
    ]);
    expect(locationCardAtLane(result.state, 0)?.defId).toBe('ruin');
  });

  it('reveals, conceals, and privately discloses the exact lane identity', () => {
    const hidden = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      false,
      ALPHA,
    );
    const disclosed = run(hidden, [{
      type: 'SHOW_LOCATION_TO_SEATS',
      lane: 0,
      locationId: ALPHA,
      seats: ['P0'],
      cause: CAUSE,
    }]);
    expect(getLocationState(disclosed.state, ALPHA)?.identityKnownTo)
      .toEqual(['P0']);

    const revealed = run(disclosed.state, [{
      type: 'REVEAL_LOCATION',
      lane: 0,
      locationId: ALPHA,
      cause: CAUSE,
    }]);
    expect(getLocationState(revealed.state, ALPHA)?.face).toBe('FACE_UP');
    expect(getLocationState(revealed.state, ALPHA)?.revealCount).toBe(1);

    const concealed = run(revealed.state, [{
      type: 'TURN_LOCATION_FACE_DOWN',
      lane: 0,
      locationId: ALPHA,
      cause: CAUSE,
    }]);
    expect(getLocationState(concealed.state, ALPHA)?.face).toBe('FACE_DOWN');
  });

  it('moves and swaps identities atomically without an intermediate empty swap slot', () => {
    const one = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      true,
      ALPHA,
    );
    const moved = run(one, [{
      type: 'MOVE_LOCATION',
      locationId: ALPHA,
      fromLane: 0,
      toLane: 1,
      cause: CAUSE,
    }]);
    expect(locationCardAtLane(moved.state, 0)).toBeNull();
    expect(locationCardAtLane(moved.state, 1)?.id).toBe(ALPHA);

    const two = withTestLocation(moved.state, 2, 'beta', true, BETA);
    const swapped = run(two, [{
      type: 'SWAP_LOCATIONS',
      leftLane: 1,
      leftLocationId: ALPHA,
      rightLane: 2,
      rightLocationId: BETA,
      cause: CAUSE,
    }]);
    expect(locationCardAtLane(swapped.state, 1)?.id).toBe(BETA);
    expect(locationCardAtLane(swapped.state, 2)?.id).toBe(ALPHA);
    expect(swapped.events).toHaveLength(1);
  });

  it('replaces in one event and stale scheduled work cannot retarget the replacement', () => {
    const state = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      false,
      ALPHA,
    );
    const result = run(state, [
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA,
        newId: BETA,
        newDefId: 'beta',
        oldDestination: 'DESTROYED',
        revealPolicy: 'FACE_DOWN_UNSCHEDULED',
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA,
        revealAtTurn: 6,
        cause: CAUSE,
      },
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('LOCATION_REPLACED');
    expect(locationCardAtLane(result.state, 0)?.id).toBe(BETA);
    expect(result.state.lanesById[0].locationSlot.revealAtTurn).toBeNull();
  });

  it('removes and returns exact identities while preserving requested deck order', () => {
    const state = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      true,
      ALPHA,
    );
    const result = run(state, [
      {
        type: 'REMOVE_LOCATION',
        lane: 0,
        locationId: ALPHA,
        destination: 'DISCARD',
        cause: CAUSE,
      },
      {
        type: 'RETURN_LOCATION_TO_DECK',
        locationId: ALPHA,
        placement: 'TOP',
        cause: CAUSE,
      },
    ]);
    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_REMOVED_FROM_LANE',
      'LOCATION_RETURNED_TO_DECK',
    ]);
    expect(getLocationState(result.state, ALPHA)?.zone).toBe('DECK');
    expect(result.state.locationDeck.drawPile[0]).toBe(ALPHA);
  });

  it('snapshots caller payloads and folds redundant commands as deterministic no-ops', () => {
    const state = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      false,
      ALPHA,
    );
    const mutableCause = { ...CAUSE };
    const mutableSeats: ('P0' | 'P1')[] = ['P0'];
    const result = run(state, [
      {
        type: 'SHOW_LOCATION_TO_SEATS',
        lane: 0,
        locationId: ALPHA,
        seats: mutableSeats,
        cause: mutableCause,
      },
      {
        type: 'SHOW_LOCATION_TO_SEATS',
        lane: 0,
        locationId: ALPHA,
        seats: ['P0'],
        cause: CAUSE,
      },
    ]);
    mutableCause.reason = 'MUTATED_AFTER_RESOLUTION';
    mutableSeats.push('P1');

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'LOCATION_SHOWN_TO_SEATS',
      seats: ['P0'],
      cause: { reason: 'LOCATION_KERNEL_TEST' },
    });
    expect(getLocationState(result.state, ALPHA)?.identityKnownTo)
      .toEqual(['P0']);
  });

  it('rejects invalid payloads and rolls back a budget-exhausted candidate', () => {
    const state = withTestLocation(
      emptyTestMatchState(),
      0,
      'alpha',
      false,
      ALPHA,
    );
    expect(() => run(state, [{
      type: 'SCHEDULE_LOCATION_REVEAL',
      lane: 0,
      locationId: ALPHA,
      revealAtTurn: 0,
      cause: CAUSE,
    }])).toThrow(KernelInvariantError);

    expect(() => run(state, [
      {
        type: 'SHOW_LOCATION_TO_SEATS',
        lane: 0,
        locationId: ALPHA,
        seats: ['P0'],
        cause: CAUSE,
      },
      {
        type: 'REVEAL_LOCATION',
        lane: 0,
        locationId: ALPHA,
        cause: CAUSE,
      },
    ], {
      budget: {
        maxWorkItems: 100,
        maxEvents: 1,
        maxReactions: 100,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    })).toThrow(KernelInvariantError);
    expect(getLocationState(state, ALPHA)?.face).toBe('FACE_DOWN');
  });
});
