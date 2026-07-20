import { describe, expect, it } from 'vitest';

import { locationCardAtLane } from '../laneTopology';
import type { CardDef } from '../manifest/types';
import { getCardRuntime } from '../projections/cardRuntime';
import { getLocationState } from '../projections/locationRuntime';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import { KernelInvariantError } from './failure';
import { kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type CanonicalRulesWork,
} from './rulesTransaction';

const CAUSE: EffectRef = {
  sourceId: 'system:c5a4-exit-matrix' as LocationCardInstanceId,
  effectKind: 'SYSTEM',
  reason: 'C5A4_EXIT_MATRIX',
};
const ALPHA = 'location:exit-alpha' as LocationCardInstanceId;
const BETA = 'location:exit-beta' as LocationCardInstanceId;
const MARTYR = 'card:exit-martyr' as CardId;

describe('C5A-4 remaining exit matrix', () => {
  it('rolls back the entire lane teardown when the reducer invariant fails', () => {
    const reaction = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'ALL_CARDS' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const martyr: CardDef = {
      ...testCardDef('exit-martyr'),
      abilities: { onDestroyed: [reaction] },
    };
    const manifest = testManifest([martyr], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'lane-teardown-reducer-invariant',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{ id: MARTYR, defId: 'exit-martyr', revealed: true }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: ALPHA, defId: 'alpha', revealed: true },
        { id: BETA, defId: 'beta', revealed: true },
        { id: 'location:exit-gamma', defId: 'gamma', revealed: true },
      ],
    }).state;
    const original = structuredClone(state);

    try {
      resolveRulesTransaction(state, [{
        type: 'DESTROY_LANE',
        lane: 0,
        cause: CAUSE,
      }], {
        manifest,
        baseDepth: 0,
        expandEffect: (_candidate, _effect, context) =>
          kernelStepSuccess({
            work: [{
              kind: 'COMMIT',
              event: {
                type: 'CARD_COUNTER_CHANGED',
                cardId: MARTYR,
                name: '',
                delta: 1,
                cause: { ...context.source },
              },
            }] satisfies readonly CanonicalRulesWork[],
          }),
      });
      throw new Error('Expected the injected reducer invariant to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(KernelInvariantError);
      expect((error as KernelInvariantError).failure).toMatchObject({
        code: 'REDUCER_INVARIANT',
        message: 'CARD_COUNTER_CHANGED name must be non-empty',
      });
    }

    expect(state).toEqual(original);
    expect(state.lanesById[0].status).toBe('ACTIVE');
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(locationCardAtLane(state, 0)?.id).toBe(ALPHA);
    expect(getCardRuntime(state, MARTYR, manifest)).toMatchObject({
      zone: 'LANE',
      lane: 0,
      revealed: true,
    });
  });

  it('keeps reveal schedules on lane slots while locations swap and move', () => {
    const manifest = testManifest([], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'location-slot-schedule-move-swap',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: ALPHA, defId: 'alpha', revealed: false },
        { id: BETA, defId: 'beta', revealed: false },
        null,
      ],
    }).state;

    const result = resolveRulesTransaction(state, [
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 0,
        locationId: ALPHA,
        revealAtTurn: 7,
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_LOCATION_REVEAL',
        lane: 1,
        locationId: BETA,
        revealAtTurn: 8,
        cause: CAUSE,
      },
      {
        type: 'SWAP_LOCATIONS',
        leftLane: 0,
        leftLocationId: ALPHA,
        rightLane: 1,
        rightLocationId: BETA,
        cause: CAUSE,
      },
      {
        type: 'MOVE_LOCATION',
        locationId: BETA,
        fromLane: 0,
        toLane: 2,
        cause: CAUSE,
      },
    ], {
      manifest,
      baseDepth: 0,
      expandEffect: () => kernelStepSuccess({ work: [] }),
    });

    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LOCATIONS_SWAPPED',
      'LOCATION_MOVED',
    ]);
    expect(result.state.lanesById[0].locationSlot).toMatchObject({
      locationCardId: null,
      revealAtTurn: 7,
    });
    expect(result.state.lanesById[1].locationSlot).toMatchObject({
      locationCardId: ALPHA,
      revealAtTurn: 8,
    });
    expect(result.state.lanesById[2].locationSlot).toMatchObject({
      locationCardId: BETA,
      revealAtTurn: 3,
    });
    expect(getLocationState(result.state, ALPHA)).toMatchObject({
      zone: 'LANE',
      laneId: 1,
      face: 'FACE_DOWN',
    });
    expect(getLocationState(result.state, BETA)).toMatchObject({
      zone: 'LANE',
      laneId: 2,
      face: 'FACE_DOWN',
    });
  });
});
