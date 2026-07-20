import { describe, expect, it } from 'vitest';

import { locationCardAtLane } from '../laneTopology';
import { validateLocationState } from '../locationState';
import { getLocationState } from '../projections/locationRuntime';
import {
  buildRuntimeFixture,
  emptyTestMatchState,
  testLaneState,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type {
  CardId,
  LocationCardInstanceId,
} from '../types/ids';
import { KernelInvariantError } from './failure';
import { kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type RulesCommand,
  type RulesTransactionOptions,
} from './rulesTransaction';

const ALPHA_ID = 'location:alpha' as LocationCardInstanceId;
const BETA_ID = 'location:beta' as LocationCardInstanceId;
const CAUSE: EffectRef = {
  sourceId: 'system:location-contract' as CardId,
  effectKind: 'SYSTEM',
  reason: 'LOCATION_LIFECYCLE_CONTRACT_TEST',
};

function fixture() {
  const definitions = [
    testLocationDef('alpha'),
    testLocationDef('beta'),
    testLocationDef('gamma'),
    testLocationDef('delta'),
    testLocationDef('ruin'),
  ];
  const manifest = testManifest([], definitions);
  const state = buildRuntimeFixture({
    seed: 'location-lifecycle-contract',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [
      {
        id: ALPHA_ID,
        defId: 'alpha',
        revealed: false,
        tags: [{ kind: 'FLOODED' }],
        counters: { visits: 2 },
      },
      {
        id: BETA_ID,
        defId: 'beta',
        revealed: true,
        tags: [{ kind: 'SEALED' }],
        counters: { uses: 3 },
      },
      null,
    ],
  }).state;
  return { manifest, state };
}

function run(
  commands: readonly RulesCommand[],
  input = fixture(),
) {
  return {
    ...input,
    result: resolveRulesTransaction(
      input.state,
      commands,
      rulesOptions(input.manifest),
    ),
  };
}

function rulesOptions(
  manifest: ReturnType<typeof testManifest>,
  overrides: Partial<RulesTransactionOptions> = {},
): RulesTransactionOptions {
  return {
    manifest,
    baseDepth: 0,
    expandEffect: () => kernelStepSuccess({ work: [] }),
    ...overrides,
  };
}

describe('C5A-4a governed location-card contract', () => {
  it('schedules, reschedules, and cancels the exact stable location identity', () => {
    const { result } = run([
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: 6,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: 7,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: null,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: null,
        cause: CAUSE,
      },
    ]);

    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
        locationId: ALPHA_ID,
        revealAtTurn: 6,
      }),
      expect.objectContaining({
        type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
        locationId: ALPHA_ID,
        revealAtTurn: 7,
      }),
      expect.objectContaining({
        type: 'LOCATION_SLOT_REVEAL_SCHEDULED',
        locationId: ALPHA_ID,
        revealAtTurn: null,
      }),
    ]);
    expect(result.state.lanesById[0].locationSlot).toMatchObject({
      locationCardId: ALPHA_ID,
      revealAtTurn: null,
    });
    expect(result.transitions.map(({ semantics }) => semantics.transitionKind))
      .toEqual([
        'REVEAL_SCHEDULE_CHANGED',
        'REVEAL_SCHEDULE_CHANGED',
        'REVEAL_SCHEDULE_CHANGED',
      ]);
  });

  it('does not retarget stale scheduled work after replacement', () => {
    const replacementId = 'location:replacement' as LocationCardInstanceId;
    const { result } = run([
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: replacementId,
        newDefId: 'gamma',
        oldDestination: 'DISCARD',
        revealPolicy: 'KEEP_SLOT_SCHEDULE',
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: 9,
        cause: CAUSE,
      },
    ]);

    expect(result.events.map(event => event.type))
      .toEqual(['LOCATION_REPLACED']);
    expect(result.state.lanesById[0].locationSlot).toMatchObject({
      locationCardId: replacementId,
      revealAtTurn: 1,
    });
    expect(getLocationState(result.state, ALPHA_ID)?.zone).toBe('DISCARD');
  });

  it('preserves disclosure knowledge through reveal, conceal, and re-reveal', () => {
    const disclosed = run([{
      type: 'SHOW_LOCATION_TO_SEATS',
      lane: 0,
      locationId: ALPHA_ID,
      seats: ['P0'],
      cause: CAUSE,
    }]);
    expect(getLocationState(disclosed.result.state, ALPHA_ID)).toMatchObject({
      face: 'FACE_DOWN',
      identityKnownTo: ['P0'],
      revealCount: 0,
    });

    const cycled = resolveRulesTransaction(
      disclosed.result.state,
      [
        {
          type: 'REVEAL_LOCATION',
          lane: 0,
          locationId: ALPHA_ID,
          cause: CAUSE,
        },
        {
          type: 'TURN_LOCATION_FACE_DOWN',
          lane: 0,
          locationId: ALPHA_ID,
          cause: CAUSE,
        },
        {
          type: 'SHOW_LOCATION_TO_SEATS',
          lane: 0,
          locationId: ALPHA_ID,
          seats: ['P1'],
          cause: CAUSE,
        },
        {
          type: 'REVEAL_LOCATION',
          lane: 0,
          locationId: ALPHA_ID,
          cause: CAUSE,
        },
      ],
      rulesOptions(disclosed.manifest),
    );

    expect(cycled.events.map(event => event.type)).toEqual([
      'LOCATION_REVEALED',
      'LOCATION_TURNED_FACE_DOWN',
      'LOCATION_REVEALED',
    ]);
    expect(getLocationState(cycled.state, ALPHA_ID)).toMatchObject({
      face: 'FACE_UP',
      identityKnownTo: ['P0', 'P1'],
      revealCount: 2,
    });
    expect(cycled.state.lanesById[0].locationSlot.revealAtTurn).toBeNull();
  });

  it('moves and swaps exact identities while preserving per-instance metadata', () => {
    const { result } = run([
      {
        type: 'SWAP_LOCATIONS',
        leftLane: 0,
        leftLocationId: ALPHA_ID,
        rightLane: 1,
        rightLocationId: BETA_ID,
        cause: CAUSE,
      },
      {
        type: 'MOVE_LOCATION',
        locationId: ALPHA_ID,
        fromLane: 1,
        toLane: 2,
        cause: CAUSE,
      },
      {
        type: 'MOVE_LOCATION',
        locationId: ALPHA_ID,
        fromLane: 0,
        toLane: 1,
        cause: CAUSE,
      },
    ]);

    expect(result.events.map(event => event.type)).toEqual([
      'LOCATIONS_SWAPPED',
      'LOCATION_MOVED',
    ]);
    expect(locationCardAtLane(result.state, 0)).toMatchObject({
      id: BETA_ID,
      tags: [{ kind: 'SEALED' }],
      counters: { uses: 3 },
    });
    expect(locationCardAtLane(result.state, 1)).toBeNull();
    expect(locationCardAtLane(result.state, 2)).toMatchObject({
      id: ALPHA_ID,
      tags: [{ kind: 'FLOODED' }],
      counters: { visits: 2 },
    });
    expect(validateLocationState(result.state)).toEqual([]);
  });

  it.each([
    {
      policy: 'KEEP_SLOT_SCHEDULE' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: 1,
      expectedKnowledge: [] as const,
      expectedRevealCount: 0,
    },
    {
      policy: 'FACE_DOWN_UNSCHEDULED' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: null,
      expectedKnowledge: [] as const,
      expectedRevealCount: 0,
    },
    {
      policy: 'SCHEDULE_AT_TURN' as const,
      revealAtTurn: 7,
      expectedFace: 'FACE_DOWN',
      expectedSchedule: 7,
      expectedKnowledge: [] as const,
      expectedRevealCount: 0,
    },
    {
      policy: 'REVEAL_IMMEDIATELY' as const,
      revealAtTurn: undefined,
      expectedFace: 'FACE_UP',
      expectedSchedule: null,
      expectedKnowledge: ['P0', 'P1'] as const,
      expectedRevealCount: 1,
    },
  ])(
    'commits $policy replacement as one closed transition',
    ({
      policy,
      revealAtTurn,
      expectedFace,
      expectedSchedule,
      expectedKnowledge,
      expectedRevealCount,
    }) => {
      const replacementId =
        `location:replacement:${policy}` as LocationCardInstanceId;
      const { result } = run([{
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: replacementId,
        newDefId: 'delta',
        oldDestination: 'DESTROYED',
        revealPolicy: policy,
        ...(revealAtTurn === undefined ? {} : { revealAtTurn }),
        cause: CAUSE,
      }]);

      expect(result.events).toHaveLength(1);
      expect(result.transitions[0]?.semantics).toMatchObject({
        transitionKind: 'LOCATION_REPLACED',
        entityIds: [ALPHA_ID, replacementId],
      });
      expect(getLocationState(result.state, ALPHA_ID)).toMatchObject({
        zone: 'DESTROYED',
        tags: [{ kind: 'FLOODED' }],
        counters: { visits: 2 },
      });
      expect(getLocationState(result.state, replacementId)).toMatchObject({
        defId: 'delta',
        zone: 'LANE',
        laneId: 0,
        face: expectedFace,
        identityKnownTo: expectedKnowledge,
        revealCount: expectedRevealCount,
        tags: [],
        counters: {},
      });
      expect(result.state.lanesById[0].locationSlot.revealAtTurn)
        .toBe(expectedSchedule);
      expect(validateLocationState(result.state)).toEqual([]);
    },
  );

  it('rejects invalid replacement payloads atomically', () => {
    const { manifest, state } = fixture();
    const invalid: readonly RulesCommand[] = [
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: BETA_ID,
        newDefId: 'delta',
        oldDestination: 'DISCARD',
        revealPolicy: 'KEEP_SLOT_SCHEDULE',
        cause: CAUSE,
      },
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: 'location:unknown-def' as LocationCardInstanceId,
        newDefId: 'unknown',
        oldDestination: 'DISCARD',
        revealPolicy: 'KEEP_SLOT_SCHEDULE',
        cause: CAUSE,
      },
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: 'location:invalid-turn' as LocationCardInstanceId,
        newDefId: 'delta',
        oldDestination: 'DISCARD',
        revealPolicy: 'SCHEDULE_AT_TURN',
        revealAtTurn: 0,
        cause: CAUSE,
      },
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: 'location:unexpected-turn' as LocationCardInstanceId,
        newDefId: 'delta',
        oldDestination: 'DISCARD',
        revealPolicy: 'KEEP_SLOT_SCHEDULE',
        revealAtTurn: 5,
        cause: CAUSE,
      },
    ];

    for (const command of invalid) {
      expect(() => resolveRulesTransaction(
        state,
        [command],
        rulesOptions(manifest),
      )).toThrow(KernelInvariantError);
      expect(locationCardAtLane(state, 0)?.id).toBe(ALPHA_ID);
      expect(getLocationState(state, ALPHA_ID)?.zone).toBe('LANE');
    }
  });

  it('removes and returns a location with exact zone conservation', () => {
    const { manifest, state } = fixture();
    const removed = resolveRulesTransaction(state, [{
      type: 'REMOVE_LOCATION',
      lane: 0,
      locationId: ALPHA_ID,
      destination: 'DISCARD',
      cause: CAUSE,
    }], rulesOptions(manifest));
    expect(locationCardAtLane(removed.state, 0)).toBeNull();
    expect(getLocationState(removed.state, ALPHA_ID)).toMatchObject({
      zone: 'DISCARD',
      laneId: null,
    });
    expect(removed.state.locationDeck.discardPile).toEqual([ALPHA_ID]);

    const returned = resolveRulesTransaction(removed.state, [{
      type: 'RETURN_LOCATION_TO_DECK',
      locationId: ALPHA_ID,
      placement: 'TOP',
      cause: CAUSE,
    }], rulesOptions(manifest));
    expect(returned.events.map(event => event.type))
      .toEqual(['LOCATION_RETURNED_TO_DECK']);
    expect(getLocationState(returned.state, ALPHA_ID)).toMatchObject({
      zone: 'DECK',
      laneId: null,
      pendingLaneId: null,
      face: 'FACE_DOWN',
    });
    expect(returned.state.locationDeck).toMatchObject({
      drawPile: [ALPHA_ID],
      discardPile: [],
    });
    expect(validateLocationState(returned.state)).toEqual([]);
  });

  it('draws only the current top location into a creating lane', () => {
    const definitions = [
      testLocationDef('alpha'),
      testLocationDef('beta'),
    ];
    const manifest = testManifest([], definitions);
    const lane = {
      ...testLaneState(0),
      status: 'CREATING' as const,
    };
    const state = emptyTestMatchState({
      phase: 'SETUP',
      lanesById: { 0: lane },
      activeLaneOrder: [],
      nextLaneId: 1,
    });
    const topId = 'location:deck-top' as LocationCardInstanceId;
    const nextId = 'location:deck-next' as LocationCardInstanceId;
    const result = resolveRulesTransaction(state, [
      {
        type: 'INITIALIZE_LOCATION_DECK',
        locations: [
          { id: topId, defId: 'alpha', sourceDeckEntry: 0 },
          { id: nextId, defId: 'beta', sourceDeckEntry: 1 },
        ],
        cause: CAUSE,
      },
      {
        type: 'DRAW_LOCATION_CARD',
        locationId: nextId,
        pendingLane: 0,
        cause: CAUSE,
      },
      {
        type: 'DRAW_LOCATION_CARD',
        locationId: topId,
        pendingLane: 0,
        cause: CAUSE,
      },
    ], rulesOptions(manifest));

    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_DECK_INITIALIZED',
      'LOCATION_CARD_DRAWN',
    ]);
    expect(result.state.locationDeck).toMatchObject({
      drawPile: [nextId],
      staging: [topId],
    });
    expect(getLocationState(result.state, topId)).toMatchObject({
      zone: 'STAGING',
      pendingLaneId: 0,
    });
    expect(getLocationState(result.state, nextId)?.zone).toBe('DECK');
    expect(validateLocationState(result.state)).toEqual([]);
  });

  it('snapshots caller-owned causes and initialization payloads', () => {
    const manifest = testManifest([], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
    ]);
    const state = emptyTestMatchState({
      phase: 'SETUP',
      lanesById: {},
      activeLaneOrder: [],
      nextLaneId: 0,
    });
    const mutableCause = { ...CAUSE };
    const locations = [
      {
        id: 'location:snapshot:0' as LocationCardInstanceId,
        defId: 'alpha',
        sourceDeckEntry: 0,
      },
      {
        id: 'location:snapshot:1' as LocationCardInstanceId,
        defId: 'beta',
        sourceDeckEntry: 1,
      },
    ];
    const result = resolveRulesTransaction(state, [{
      type: 'INITIALIZE_LOCATION_DECK',
      locations,
      cause: mutableCause,
    }], rulesOptions(manifest));

    mutableCause.reason = 'MUTATED_AFTER_COMMIT';
    locations[0].defId = 'beta';
    locations[0].sourceDeckEntry = 99;

    expect(result.events[0]).toMatchObject({
      type: 'LOCATION_DECK_INITIALIZED',
      cause: { reason: 'LOCATION_LIFECYCLE_CONTRACT_TEST' },
      locations: [
        { defId: 'alpha', sourceDeckEntry: 0 },
        { defId: 'beta', sourceDeckEntry: 1 },
      ],
    });
    expect(getLocationState(
      result.state,
      'location:snapshot:0' as LocationCardInstanceId,
    )).toMatchObject({
      defId: 'alpha',
      sourceDeckEntry: 0,
    });
  });

  it('folds candidate state in order, treats stale commands as no-ops, and is deterministic', () => {
    const replacementId = 'location:folded' as LocationCardInstanceId;
    const commands: readonly RulesCommand[] = [
      {
        type: 'REPLACE_LOCATION',
        lane: 0,
        oldId: ALPHA_ID,
        newId: replacementId,
        newDefId: 'gamma',
        oldDestination: 'DISCARD',
        revealPolicy: 'FACE_DOWN_UNSCHEDULED',
        cause: CAUSE,
      },
      {
        type: 'REVEAL_LOCATION',
        lane: 0,
        locationId: ALPHA_ID,
        cause: CAUSE,
      },
      {
        type: 'REVEAL_LOCATION',
        lane: 0,
        locationId: replacementId,
        cause: CAUSE,
      },
    ];
    const first = run(commands).result;
    const second = run(commands).result;

    expect(first.events.map(event => event.type)).toEqual([
      'LOCATION_REPLACED',
      'LOCATION_REVEALED',
    ]);
    expect(first.events).toEqual(second.events);
    expect(first.state).toEqual(second.state);
    expect(getLocationState(first.state, ALPHA_ID)?.zone).toBe('DISCARD');
    expect(getLocationState(first.state, replacementId)).toMatchObject({
      face: 'FACE_UP',
      revealCount: 1,
    });
  });

  it('rolls back a valid prefix on malformed work or exhausted budgets', () => {
    const { manifest, state } = fixture();
    expect(() => resolveRulesTransaction(state, [
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: 8,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA_ID,
        revealAtTurn: 0,
        cause: CAUSE,
      },
    ], rulesOptions(manifest))).toThrow(KernelInvariantError);
    expect(state.lanesById[0].locationSlot.revealAtTurn).toBe(1);

    expect(() => resolveRulesTransaction(state, [{
      type: 'SCHEDULE_LOCATION_REVEAL',
      lane: 0,
      locationId: ALPHA_ID,
      revealAtTurn: 8,
      cause: CAUSE,
    }], rulesOptions(manifest, {
      budget: {
        maxWorkItems: 1,
        maxEvents: 10,
        maxReactions: 10,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    }))).toThrow(KernelInvariantError);
    expect(state.lanesById[0].locationSlot.revealAtTurn).toBe(1);
  });
});
