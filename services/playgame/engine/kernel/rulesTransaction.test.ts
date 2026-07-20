import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { getLocationState } from '../projections/locationRuntime';
import {
  buildRuntimeFixture,
  emptyTestMatchState,
  testCardDef,
  testLocationDef,
  testManifest,
  withTestLocation,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardDef } from '../manifest/types';
import type {
  CardId,
  LocationCardInstanceId,
  PendingEffectId,
} from '../types/ids';
import type { MatchState } from '../types/state';
import { KernelInvariantError } from './failure';
import { kernelStepFailure, kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type CanonicalRulesWork,
  type RulesTransactionOptions,
} from './rulesTransaction';
import type { LaneTopologyCommand } from './operations/laneTopology';

const CAUSE: EffectRef = {
  sourceId: 'system:topology' as LocationCardInstanceId,
  effectKind: 'SYSTEM',
  reason: 'TOPOLOGY_TEST',
};
const manifest = testManifest([], [
  testLocationDef('alpha'),
  testLocationDef('beta'),
  testLocationDef('gamma'),
  testLocationDef('ruin'),
]);
const revealManifest = testManifest([], [
  testLocationDef('reactive', [
    {
      kind: 'ADD_POWER',
      target: { kind: 'ALL_CARDS' },
      delta: { kind: 'LIT', n: 1 },
    },
    {
      kind: 'ADD_POWER',
      target: { kind: 'ALL_CARDS' },
      delta: { kind: 'LIT', n: 2 },
    },
  ]),
  testLocationDef('ruin'),
]);

function locatedState() {
  return withTestLocation(
    withTestLocation(
      withTestLocation(emptyTestMatchState(), 0, 'alpha'),
      1,
      'beta',
    ),
    2,
    'gamma',
  );
}

const options: RulesTransactionOptions = {
  manifest,
  baseDepth: 0,
  expandEffect: () => kernelStepFailure({
    code: 'INVALID_OPERATION_OUTPUT',
    message: 'This fixture expects no authored effect.',
  }),
};

function run(
  state: ReturnType<typeof emptyTestMatchState>,
  commands: readonly LaneTopologyCommand[],
  overrides: Partial<RulesTransactionOptions> = {},
) {
  return resolveRulesTransaction(state, commands, {
    ...options,
    ...overrides,
  });
}

describe('governed lane topology', () => {
  it('destroys one lane in the mandated atomic order and cancels only exact lane pending work', () => {
    const pendingEffects: MatchState['pendingEffects'] = [
      {
        id: 'pending:0' as PendingEffectId,
        kind: 'SCHEDULED',
        when: 'END_OF_NEXT_TURN',
        sourceId: 'location-beta' as LocationCardInstanceId,
        sourceOwner: null,
        sourceLane: 1,
        fireTurn: 2,
        effect: {
          kind: 'ADD_POWER',
          target: { kind: 'ALL_CARDS' },
          delta: { kind: 'LIT', n: 1 },
        },
        scheduledBy: CAUSE,
      },
      {
        id: 'pending:1' as PendingEffectId,
        kind: 'SCHEDULED',
        when: 'END_OF_NEXT_TURN',
        sourceId: 'location-alpha' as LocationCardInstanceId,
        sourceOwner: null,
        sourceLane: 0,
        fireTurn: 2,
        effect: {
          kind: 'ADD_POWER',
          target: { kind: 'ALL_CARDS' },
          delta: { kind: 'LIT', n: 1 },
        },
        scheduledBy: CAUSE,
      },
    ];
    const state = {
      ...locatedState(),
      nextPendingEffectSequence: 2,
      pendingEffects,
    };
    const result = run(state, [{
      type: 'DESTROY_LANE',
      lane: 1,
      cause: CAUSE,
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'LANE_DESTRUCTION_STARTED',
      'LOCATION_REMOVED_FROM_LANE',
      'PENDING_EFFECT_CONSUMED',
      'LANE_DESTROYED',
    ]);
    expect(result.state.activeLaneOrder).toEqual([0, 2]);
    expect(result.state.lanesById[1].status).toBe('DESTROYED');
    expect(result.state.pendingEffects.map(effect => effect.id))
      .toEqual(['pending:1']);
    expect(getLocationState(
      result.state,
      'test-location-1' as LocationCardInstanceId,
    )?.zone).toBe('DESTROYED');
  });

  it('destroys all other lanes in canonical topology order as one transaction', () => {
    const result = run(locatedState(), [{
      type: 'DESTROY_OTHER_LANES',
      survivor: 1,
      cause: CAUSE,
    }]);
    expect(
      result.events
        .filter(event => event.type === 'LANE_DESTRUCTION_STARTED')
        .map(event => event.lane),
    ).toEqual([0, 2]);
    expect(result.state.activeLaneOrder).toEqual([1]);
  });

  it('destroys occupants through governed destruction and drains their hooks before finalizing', () => {
    const onDestroyed = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'ALL_CARDS' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const martyr: CardDef = {
      ...testCardDef('martyr'),
      abilities: { onDestroyed: [onDestroyed] },
    };
    const occupantManifest = testManifest([martyr], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'lane-destroy-hook',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [{ id: 'martyr-1', defId: 'martyr', revealed: true }], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;
    let hookCalls = 0;
    const result = resolveRulesTransaction(state, [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }], {
      manifest: occupantManifest,
      baseDepth: 0,
      expandEffect: () => {
        hookCalls += 1;
        return kernelStepSuccess({ work: [] });
      },
    });

    expect(hookCalls).toBe(1);
    expect(result.events.map(event => event.type)).toEqual([
      'LANE_DESTRUCTION_STARTED',
      'CARD_DESTROYED',
      'LOCATION_REMOVED_FROM_LANE',
      'LANE_DESTROYED',
    ]);
    expect(result.state.lanesById[0].status).toBe('DESTROYED');
  });

  it('rolls back when a destroy-immune occupant survives governed destruction', () => {
    const immuneManifest = testManifest([testCardDef('immune')], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'lane-destroy-immune',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{
            id: 'immune-1',
            defId: 'immune',
            revealed: true,
            tags: [{ kind: 'DESTROY_IMMUNE' }],
          }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;

    expect(() => resolveRulesTransaction(state, [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }], {
      manifest: immuneManifest,
      baseDepth: 0,
      expandEffect: () => kernelStepSuccess({ work: [] }),
    })).toThrow(KernelInvariantError);
    expect(state.lanesById[0].status).toBe('ACTIVE');
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
  });

  it('rolls back when an occupant reaction creates a new survivor in the destroying lane', () => {
    const reaction = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'ALL_CARDS' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const martyr: CardDef = {
      ...testCardDef('martyr'),
      abilities: { onDestroyed: [reaction] },
    };
    const reactionManifest = testManifest(
      [martyr, testCardDef('spawn')],
      [
        testLocationDef('alpha'),
        testLocationDef('beta'),
        testLocationDef('gamma'),
        testLocationDef('ruin'),
      ],
    );
    const state = buildRuntimeFixture({
      seed: 'lane-destroy-create-survivor',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [{ id: 'martyr-1', defId: 'martyr', revealed: true }], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;

    expect(() => resolveRulesTransaction(state, [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }], {
      manifest: reactionManifest,
      baseDepth: 0,
      expandEffect: (_candidate, _effect, context) => {
        const work: CanonicalRulesWork[] = [{
            kind: 'COMMAND',
            command: {
              type: 'CREATE_CARD',
              cardId: 'reaction-spawn' as CardId,
              defId: 'spawn',
              owner: 'P0',
              depth: 0,
              destination: {
                kind: 'LANE',
                lane: 0,
                revealed: false,
              },
              spawnSource: { kind: 'SYSTEM' },
              cause: context.source,
            },
        }];
        return kernelStepSuccess({ work });
      },
    })).toThrow(KernelInvariantError);
    expect(state.lanesById[0].status).toBe('ACTIVE');
  });

  it('cancels pending work scheduled during destruction but preserves unrelated pending work', () => {
    const reaction = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'ALL_CARDS' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const martyr: CardDef = {
      ...testCardDef('martyr'),
      abilities: { onDestroyed: [reaction] },
    };
    const reactionManifest = testManifest([martyr], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const unrelated = {
      id: 'pending:0' as PendingEffectId,
      kind: 'SCHEDULED' as const,
      when: 'END_OF_NEXT_TURN' as const,
      sourceId: 'loc-b' as LocationCardInstanceId,
      sourceOwner: null,
      sourceLane: 1,
      fireTurn: 3,
      effect: reaction,
      scheduledBy: CAUSE,
    };
    const base = buildRuntimeFixture({
      seed: 'lane-destroy-pending',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [{ id: 'martyr-1', defId: 'martyr', revealed: true }], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
      pendingEffects: [unrelated],
    }).state;
    const state = {
      ...base,
      nextPendingEffectSequence: 1,
    };
    const result = resolveRulesTransaction(state, [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }], {
      manifest: reactionManifest,
      baseDepth: 0,
      expandEffect: (_candidate, effect, context) => {
        const authored = effect.kind === 'AUTHORED'
          ? effect.effect
          : effect;
        if (context.self === null) {
          throw new Error('Reaction source must be frozen');
        }
        const work: CanonicalRulesWork[] = [{
            kind: 'COMMAND',
            command: {
              type: 'SCHEDULE_PENDING_EFFECT',
              effect: {
                kind: 'SCHEDULED',
                when: 'END_OF_NEXT_TURN',
                sourceId: context.self,
                sourceOwner: null,
                sourceLane: 0,
                fireTurn: 3,
                effect: authored,
              },
              cause: context.source,
            },
        }];
        return kernelStepSuccess({ work });
      },
    });

    expect(result.events.map(event => event.type)).toEqual([
      'LANE_DESTRUCTION_STARTED',
      'CARD_DESTROYED',
      'PENDING_EFFECT_SCHEDULED',
      'LOCATION_REMOVED_FROM_LANE',
      'PENDING_EFFECT_CONSUMED',
      'LANE_DESTROYED',
    ]);
    expect(result.state.pendingEffects).toEqual([unrelated]);
  });

  it('rolls back when the shared effect interpreter fails', () => {
    const reaction = {
      kind: 'ADD_POWER' as const,
      target: { kind: 'ALL_CARDS' as const },
      delta: { kind: 'LIT' as const, n: 1 },
    };
    const martyr: CardDef = {
      ...testCardDef('martyr'),
      abilities: { onDestroyed: [reaction] },
    };
    const reactionManifest = testManifest([martyr], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'lane-destroy-interpreter-fail',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [{ id: 'martyr-1', defId: 'martyr', revealed: true }], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;

    expect(() => resolveRulesTransaction(state, [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }], {
      manifest: reactionManifest,
      baseDepth: 0,
      expandEffect: () => kernelStepFailure({
        code: 'INVALID_OPERATION_OUTPUT',
        message: 'injected interpreter failure',
      }),
    })).toThrow(KernelInvariantError);
    expect(state.lanesById[0].status).toBe('ACTIVE');
  });

  it('creates from the top location deck with a monotonic identity and schedule', () => {
    const genesis = emptyTestMatchState();
    const withDeck = apply({
      ...genesis,
      lanesById: {
        0: genesis.lanesById[0],
        1: genesis.lanesById[1],
      },
      activeLaneOrder: [0, 1],
    }, {
      type: 'LOCATION_DECK_INITIALIZED',
      locations: [{
        id: 'drawn-alpha' as LocationCardInstanceId,
        defId: 'alpha',
        sourceDeckEntry: 0,
      }],
      cause: CAUSE,
    }, manifest);
    const result = run(withDeck, [{
      type: 'CREATE_LANE',
      position: 1,
      location: { kind: 'DRAW_TOP' },
      reveal: { kind: 'SCHEDULE', turn: 4 },
      cause: CAUSE,
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'LANE_CREATION_STARTED',
      'LOCATION_CARD_DRAWN',
      'LOCATION_CARD_PLAYED',
      'LOCATION_SLOT_REVEAL_SCHEDULED',
      'LANE_CREATED',
    ]);
    expect(result.state.activeLaneOrder).toEqual([0, 3, 1]);
    expect(result.state.nextLaneId).toBe(4);
    expect(result.state.lanesById[3].locationSlot.revealAtTurn).toBe(4);
  });

  it('creates and immediately reveals Ruin, resolving the reveal inside the same queue', () => {
    const afterDestroy = run(locatedState(), [{
      type: 'DESTROY_LANE',
      lane: 0,
      cause: CAUSE,
    }]).state;
    const result = run(afterDestroy, [{
      type: 'CREATE_LANE',
      position: 2,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'IMMEDIATE' },
      cause: CAUSE,
    }]);

    expect(result.events.map(event => event.type)).toEqual([
      'LANE_CREATION_STARTED',
      'LOCATION_CARD_CREATED',
      'LOCATION_CARD_PLAYED',
      'LANE_CREATED',
      'LOCATION_REVEALED',
    ]);
    expect(result.state.activeLaneOrder).toEqual([1, 2, 3]);
    expect(getLocationState(
      result.state,
      'ruin@lane-3' as LocationCardInstanceId,
    )?.face).toBe('FACE_UP');
    expect(result.usage.createdEntities).toBe(2);
  });

  it('accepts standalone reveal once and runs its frozen post-commit rules exactly once', () => {
    const reactiveId = 'reactive-location' as LocationCardInstanceId;
    const state = withTestLocation(
      emptyTestMatchState(),
      1,
      'reactive',
      false,
      reactiveId,
    );
    let calls = 0;
    const result = resolveRulesTransaction(state, [{
      type: 'REVEAL_LOCATION',
      lane: 1,
      locationId: reactiveId,
      cause: CAUSE,
    }], {
      manifest: revealManifest,
      baseDepth: 0,
      expandEffect: (_candidate, _effect, context) => {
        calls += 1;
        return calls === 1
          ? kernelStepSuccess({
              work: [{
                kind: 'COMMAND',
                command: {
                  type: 'REPLACE_LOCATION',
                  lane: 1,
                  oldId: reactiveId,
                  newId: 'replacement-ruin' as LocationCardInstanceId,
                  newDefId: 'ruin',
                  oldDestination: 'DESTROYED',
                  revealPolicy: 'REVEAL_IMMEDIATELY',
                  cause: context.source,
                },
              }],
            })
          : kernelStepSuccess({ work: [] });
      },
    });

    expect(calls).toBe(2);
    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_REVEALED',
      'LOCATION_REPLACED',
    ]);
    expect(getLocationState(result.state, reactiveId)?.zone).toBe('DESTROYED');
    expect(getLocationState(
      result.state,
      'replacement-ruin' as LocationCardInstanceId,
    )?.face).toBe('FACE_UP');
  });

  it('treats an immediately revealed replacement as one exact reveal reaction source', () => {
    const oldId = 'old-location' as LocationCardInstanceId;
    const newId = 'new-reactive-location' as LocationCardInstanceId;
    const state = withTestLocation(
      emptyTestMatchState(),
      0,
      'ruin',
      true,
      oldId,
    );
    let calls = 0;
    const result = resolveRulesTransaction(state, [{
      type: 'REPLACE_LOCATION',
      lane: 0,
      oldId,
      newId,
      newDefId: 'reactive',
      oldDestination: 'DESTROYED',
      revealPolicy: 'REVEAL_IMMEDIATELY',
      cause: CAUSE,
    }], {
      manifest: revealManifest,
      baseDepth: 0,
      expandEffect: () => {
        calls += 1;
        return kernelStepSuccess({ work: [] });
      },
    });

    expect(calls).toBe(2);
    expect(result.events.map(event => event.type)).toEqual([
      'LOCATION_REPLACED',
    ]);
    expect(getLocationState(result.state, newId)?.revealCount).toBe(1);
  });

  it('rolls back every earlier target if the shared budget fails', () => {
    const initial = locatedState();
    expect(() => run(initial, [{
      type: 'DESTROY_OTHER_LANES',
      survivor: 1,
      cause: CAUSE,
    }], {
      budget: {
        maxWorkItems: 100,
        maxEvents: 4,
        maxReactions: 100,
        maxEffectDepth: 20,
        maxCreatedEntities: 20,
      },
    })).toThrow(KernelInvariantError);
    expect(initial.activeLaneOrder).toEqual([0, 1, 2]);
    expect(initial.lanesById[0].status).toBe('ACTIVE');
  });

  it('rolls back the first destroyed target when a later destroy-other target has an immune survivor', () => {
    const immuneManifest = testManifest([testCardDef('immune')], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
      testLocationDef('ruin'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'destroy-other-second-fails',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        {
          P0: [{
            id: 'immune-2',
            defId: 'immune',
            revealed: true,
            tags: [{ kind: 'DESTROY_IMMUNE' }],
          }],
          P1: [],
        },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;

    expect(() => resolveRulesTransaction(state, [{
      type: 'DESTROY_OTHER_LANES',
      survivor: 1,
      cause: CAUSE,
    }], {
      manifest: immuneManifest,
      baseDepth: 0,
      expandEffect: () => kernelStepSuccess({ work: [] }),
    })).toThrow(KernelInvariantError);
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(state.lanesById[0].status).toBe('ACTIVE');
    expect(state.lanesById[2].status).toBe('ACTIVE');
  });

  it('enforces the one-lane minimum and three-lane maximum', () => {
    const state = locatedState();
    const oneLane = {
      ...state,
      activeLaneOrder: [1],
    };
    expect(() => run(oneLane, [{
      type: 'DESTROY_LANE',
      lane: 1,
      cause: CAUSE,
    }])).toThrow(KernelInvariantError);
    expect(() => run(state, [{
      type: 'CREATE_LANE',
      position: 1,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'FACE_DOWN' },
      cause: CAUSE,
    }])).toThrow(KernelInvariantError);
  });

  it('never reuses tombstones across destroy-create-destroy-create topology changes', () => {
    const afterFirstDestroy = run(locatedState(), [{
      type: 'DESTROY_LANE',
      lane: 2,
      cause: CAUSE,
    }]).state;
    const firstCreate = run(afterFirstDestroy, [{
      type: 'CREATE_LANE',
      position: 0,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'FACE_DOWN' },
      cause: CAUSE,
    }]).state;
    const secondDestroy = run(firstCreate, [{
      type: 'DESTROY_LANE',
      lane: 3,
      cause: CAUSE,
    }]).state;
    const secondCreate = run(secondDestroy, [{
      type: 'CREATE_LANE',
      position: 2,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'FACE_DOWN' },
      cause: CAUSE,
    }]).state;

    expect(secondCreate.activeLaneOrder).toEqual([0, 1, 4]);
    expect(secondCreate.nextLaneId).toBe(5);
    expect(secondCreate.lanesById[2].status).toBe('DESTROYED');
    expect(secondCreate.lanesById[3].status).toBe('DESTROYED');
    expect(secondCreate.lanesById[4].status).toBe('ACTIVE');
    expect(getLocationState(
      secondCreate,
      'ruin@lane-3' as LocationCardInstanceId,
    )?.zone).toBe('DESTROYED');
    expect(getLocationState(
      secondCreate,
      'ruin@lane-4' as LocationCardInstanceId,
    )?.zone).toBe('LANE');
  });

  it('rejects invalid topology and exhausted lane allocation without a partial publication', () => {
    expect(() => run(locatedState(), [{
      type: 'CREATE_LANE',
      position: 0,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'FACE_DOWN' },
      cause: CAUSE,
    }])).toThrow(KernelInvariantError);

    const twoLanes = run(locatedState(), [{
      type: 'DESTROY_LANE',
      lane: 2,
      cause: CAUSE,
    }]).state;
    expect(() => run({
      ...twoLanes,
      nextLaneId: Number.MAX_SAFE_INTEGER,
    }, [{
      type: 'CREATE_LANE',
      position: 2,
      location: { kind: 'CREATE_RUIN' },
      reveal: { kind: 'FACE_DOWN' },
      cause: CAUSE,
    }])).toThrow(KernelInvariantError);
  });
});

describe('canonical reveal timing command', () => {
  it('sets future timing through the governed command and closed semantics path', () => {
    const cardId = 'scheduled-card' as CardId;
    const scheduleManifest = testManifest([
      testCardDef('scheduled'),
    ], [
      testLocationDef('alpha'),
      testLocationDef('beta'),
      testLocationDef('gamma'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'canonical-reveal-timing',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: {
        P0: [{ id: cardId, defId: 'scheduled' }],
        P1: [],
      },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'loc-a', defId: 'alpha', revealed: true },
        { id: 'loc-b', defId: 'beta', revealed: true },
        { id: 'loc-c', defId: 'gamma', revealed: true },
      ],
    }).state;

    const result = resolveRulesTransaction(state, [{
      type: 'SET_CARD_REVEAL_TIMING',
      cardId,
      timing: { kind: 'TURN', turn: 3 },
      cause: CAUSE,
    }], {
      ...options,
      manifest: scheduleManifest,
    });

    expect(result.events).toEqual([{
      type: 'CARD_REVEAL_SCHEDULED',
      cardId,
      timing: { kind: 'TURN', turn: 3 },
      cause: CAUSE,
    }]);
    expect(result.transitions[0].semantics).toMatchObject({
      transitionKind: 'REVEAL_TIMING_SET',
      entityId: cardId,
      prior: null,
      result: { kind: 'TURN', turn: 3 },
    });
  });
});
