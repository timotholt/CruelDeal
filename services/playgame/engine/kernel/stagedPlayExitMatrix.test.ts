import { describe, expect, it } from 'vitest';

import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
import { getCardCost } from '../projections/cost';
import { getCardState } from '../projections/cardRuntime';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import type { MatchState } from '../types/state';
import { KernelInvariantError } from './failure';
import { kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type RulesTransactionResult,
} from './rulesTransaction';
import type { StagePlayCommand } from './types';

const TARGET = 'card:c5a5-target' as CardId;
const DISCOUNT = 'card:c5a5-discount' as CardId;
const DELAY = 'location:c5a5-delay' as LocationCardInstanceId;
const CAUSE: EffectRef = {
  sourceId: TARGET,
  effectKind: 'SYSTEM',
  reason: 'C5A5_STAGE_INTENT',
};

const discountDef: CardDef = {
  ...testCardDef('discount', { cost: 1 }),
  abilities: {
    ongoing: [{
      kind: 'COST_ADD',
      target: { kind: 'HAND_OF', owner: 'P0' },
      delta: { kind: 'LIT', n: -1 },
      stack: 'ADDITIVE',
    }],
  },
};

const delayedLocation: LocationCardDef = {
  ...testLocationDef('delayed-location'),
  abilities: {
    ongoing: [{
      kind: 'REVEAL_TIMING_OVERRIDE',
      target: {
        kind: 'SAME_LANE',
        of: { kind: 'SELF' },
        ownerFilter: 'ANY_OWNER',
      },
      timing: { kind: 'END_OF_GAME' },
      stack: 'MAX',
    }],
  },
};

function manifest(
  targetCost = 3,
  targetCostDelta = 0,
): {
  readonly manifest: Manifest;
  readonly state: MatchState;
} {
  const activeManifest = testManifest([
    testCardDef('target', { cost: targetCost }),
    discountDef,
  ], [delayedLocation]);
  const state = buildRuntimeFixture({
    seed: 'c5a5-stage-exit-matrix',
    localSeat: 'P0',
    turn: 2,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    energy: { P0: 12, P1: 2 },
    decks: { P0: [], P1: [] },
    hands: {
      P0: [{
        id: TARGET,
        defId: 'target',
        costDelta: targetCostDelta,
      }],
      P1: [],
    },
    lanes: [
      { P0: [], P1: [] },
      {
        P0: [{ id: DISCOUNT, defId: 'discount', revealed: true }],
        P1: [],
      },
      { P0: [], P1: [] },
    ],
    locations: [
      { id: DELAY, defId: 'delayed-location', revealed: true },
      null,
      null,
    ],
  }).state;
  return { manifest: activeManifest, state };
}

function command(
  overrides: Partial<StagePlayCommand> = {},
): StagePlayCommand {
  return {
    type: 'STAGE_PLAY',
    intentId: 'stage-target',
    owner: 'P0',
    cardId: TARGET,
    lane: 0,
    cause: CAUSE,
    ...overrides,
  };
}

function stage(
  state: MatchState,
  activeManifest: Manifest,
  stageCommand: StagePlayCommand = command(),
  budget?: Parameters<typeof resolveRulesTransaction>[2]['budget'],
): RulesTransactionResult {
  return resolveRulesTransaction(state, [stageCommand], {
    manifest: activeManifest,
    baseDepth: 0,
    expandEffect: () => kernelStepSuccess({ work: [] }),
    ...(budget === undefined ? {} : { budget }),
  });
}

describe('C5A-5 governed staged-play exit matrix', () => {
  it('commits exact hand payment before resolving a post-placement reveal policy', () => {
    const fixture = manifest();
    expect(getCardCost(fixture.state, TARGET, fixture.manifest)).toBe(2);

    const result = stage(fixture.state, fixture.manifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'CARD_STAGED',
      cardId: TARGET,
      owner: 'P0',
      lane: 0,
      energyPaid: 2,
      cause: CAUSE,
    });
    expect(result.events[1]).toMatchObject({
      type: 'ENERGY_CHANGED',
      owner: 'P0',
      delta: -2,
      reason: 'CARD_PLAYED',
    });
    expect(result.events[2]).toMatchObject({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: TARGET,
      timing: { kind: 'END_OF_GAME' },
      cause: {
        sourceId: DELAY,
        effectKind: 'LOCATION',
        reason: 'REVEAL_TIMING_OVERRIDE',
      },
    });
    expect(result.state.energy.P0).toBe(10);
    expect(result.state.stagedPlays).toEqual([{
      cardId: TARGET,
      energyPaid: 2,
    }]);
    expect(getCardState(result.state, TARGET)).toMatchObject({
      zone: 'LANE',
      lane: 0,
      revealed: false,
      revealTiming: { kind: 'END_OF_GAME' },
    });
    // The hand-only discount is gone after placement, but exact payment
    // provenance remains the amount computed at the command boundary.
    expect(getCardCost(result.state, TARGET, fixture.manifest)).toBe(3);
  });

  it('records the explicit default current-turn timing in the same transaction', () => {
    const activeManifest = testManifest([
      testCardDef('target', { cost: 1 }),
    ]);
    const state = buildRuntimeFixture({
      seed: 'c5a5-default-timing',
      localSeat: 'P0',
      turn: 4,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      energy: { P0: 4, P1: 4 },
      decks: { P0: [], P1: [] },
      hands: { P0: [{ id: TARGET, defId: 'target' }], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    }).state;

    const result = stage(state, activeManifest);
    expect(result.events.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(result.events[2]).toMatchObject({
      type: 'CARD_REVEAL_SCHEDULED',
      timing: { kind: 'TURN', turn: 4 },
      cause: {
        sourceId: TARGET,
        effectKind: 'SYSTEM',
        reason: 'CARD_STAGE_DEFAULT_REVEAL_TIMING',
      },
    });
  });

  it('preserves the three-event trace for zero and two-digit exact payments', () => {
    const zero = manifest(3, -3);
    const zeroResult = stage(zero.state, zero.manifest);
    expect(zeroResult.events.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(zeroResult.events[0]).toMatchObject({ energyPaid: 0 });
    expect(zeroResult.events[1]).toMatchObject({
      type: 'ENERGY_CHANGED',
      delta: 0,
      reason: 'CARD_PLAYED',
    });
    expect(zeroResult.state.energy.P0).toBe(12);

    const twelve = manifest(13);
    const twelveResult = stage(twelve.state, twelve.manifest);
    expect(twelveResult.events[0]).toMatchObject({ energyPaid: 12 });
    expect(twelveResult.events[1]).toMatchObject({ delta: -12 });
    expect(twelveResult.state.energy.P0).toBe(0);
  });

  it('is deterministic for equal state and command', () => {
    const fixture = manifest();
    const left = stage(fixture.state, fixture.manifest);
    const right = stage(fixture.state, fixture.manifest);
    expect(left).toEqual(right);
  });

  it('rejects unsafe payment and exhausted budget with no partial result', () => {
    const unsafe = manifest(3, Number.MAX_SAFE_INTEGER);
    const originalUnsafe = structuredClone(unsafe.state);
    expect(() => stage(unsafe.state, unsafe.manifest)).toThrowError(
      expect.objectContaining({
        name: 'KernelInvariantError',
        failure: expect.objectContaining({
          code: 'INVALID_OPERATION_OUTPUT',
          message: 'Card cost is not a valid Energy payment.',
        }),
      }),
    );
    expect(unsafe.state).toEqual(originalUnsafe);

    const fixture = manifest();
    const originalBudget = structuredClone(fixture.state);
    try {
      stage(fixture.state, fixture.manifest, command(), {
        maxWorkItems: 32,
        maxEvents: 1,
        maxReactions: 32,
        maxEffectDepth: 8,
        maxCreatedEntities: 8,
      });
      throw new Error('Expected staged play to exhaust the event budget.');
    } catch (error) {
      expect(error).toBeInstanceOf(KernelInvariantError);
      expect((error as KernelInvariantError).failure).toMatchObject({
        code: 'BUDGET_EXCEEDED',
        eventsProduced: 1,
      });
    }
    expect(fixture.state).toEqual(originalBudget);
    expect(getCardState(fixture.state, TARGET)?.zone).toBe('HAND');
  });

  it.each([
    ['wrong owner', { owner: 'P1' as const }],
    ['missing card', { cardId: 'card:missing' as CardId }],
    ['missing lane', { lane: 99 }],
    ['empty intent', { intentId: '' }],
  ])('rejects %s without mutating its input', (_label, overrides) => {
    const fixture = manifest();
    const original = structuredClone(fixture.state);
    expect(() => stage(
      fixture.state,
      fixture.manifest,
      command(overrides),
    )).toThrow(KernelInvariantError);
    expect(fixture.state).toEqual(original);
    expect(getCardState(fixture.state, TARGET)?.zone).toBe('HAND');
  });
});
