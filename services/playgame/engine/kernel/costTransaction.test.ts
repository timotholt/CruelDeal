import { describe, expect, it } from 'vitest';

import { executeRulesCommands } from '../effects/rulesInterpreter';
import type { CardDef, Manifest } from '../manifest/types';
import { getCardCost } from '../projections/cost';
import { getCardState } from '../projections/cardRuntime';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import type { ResolutionBudget } from './contracts';
import { KernelInvariantError } from './failure';
import type { ChangeCostCommand } from './types';

const CARD_ID = 'kernel-cost-card' as CardId;
const SOURCE_ID = 'kernel-cost-source' as CardId;
const CAUSE: EffectRef = {
  sourceId: SOURCE_ID,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_COST_TEST',
};

function fixture(options: {
  readonly costDelta?: number;
  readonly ongoingDiscount?: boolean;
} = {}) {
  const target = testCardDef('kernel-cost-def', { cost: 3 });
  const cards: CardDef[] = [target];
  const laneCards: {
    P0: {
      id: CardId;
      defId: string;
      revealed: boolean;
      costDelta?: number;
    }[];
    P1: never[];
  } = {
    P0: [{
      id: CARD_ID,
      defId: target.defId,
      revealed: true,
      ...(options.costDelta === undefined
        ? {}
        : { costDelta: options.costDelta }),
    }],
    P1: [],
  };

  if (options.ongoingDiscount) {
    const reducer: CardDef = {
      ...testCardDef('kernel-cost-reducer', { cost: 2 }),
      abilities: {
        ongoing: [{
          kind: 'COST_ADD',
          target: {
            kind: 'SAME_LANE',
            of: { kind: 'SELF' },
            ownerFilter: 'SELF_OWNER',
          },
          delta: { kind: 'LIT', n: -1 },
          stack: 'ADDITIVE',
        }],
      },
    };
    cards.push(reducer);
    laneCards.P0.push({
      id: 'kernel-cost-reducer-card' as CardId,
      defId: reducer.defId,
      revealed: true,
    });
  }

  const manifest = testManifest(cards);
  const state = buildRuntimeFixture({
    seed: 'kernel-cost-transaction',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      laneCards,
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
  return { manifest, state };
}

function command(
  mutation: ChangeCostCommand['mutation'],
  cause: EffectRef = CAUSE,
  cardId: CardId = CARD_ID,
): ChangeCostCommand {
  return {
    type: 'CHANGE_COST',
    cardId,
    mutation,
    cause,
  };
}

function run(
  state: MatchState,
  manifest: Manifest,
  commands: readonly ChangeCostCommand[],
  budget?: ResolutionBudget,
) {
  return executeRulesCommands(
    state,
    commands,
    {
      rng: createRng('cost-transaction-test'),
      ...(budget === undefined ? {} : { budget }),
    },
    manifest,
  );
}

describe('cost kernel transaction', () => {
  it('commits ordered ADD mutations and captures closed semantics', () => {
    const { manifest, state } = fixture();
    const result = run(state, manifest, [
      command({ kind: 'ADD', delta: -2 }),
      command({ kind: 'ADD', delta: 1 }),
    ]);

    expect(result.events).toEqual([
      {
        type: 'CARD_COST_CHANGED',
        cardId: CARD_ID,
        delta: -2,
        cause: CAUSE,
      },
      {
        type: 'CARD_COST_CHANGED',
        cardId: CARD_ID,
        delta: 1,
        cause: CAUSE,
      },
    ]);
    expect(result.transitions.map(({ semantics }) => semantics))
      .toMatchObject([
        {
          eventType: 'CARD_COST_CHANGED',
          transitionKind: 'COST_DECREASE',
          entityId: CARD_ID,
          reason: 'KERNEL_COST_TEST',
          signedPermanentChange: -2,
          prior: { permanentDelta: 0, effectiveCost: 3 },
          result: { permanentDelta: -2, effectiveCost: 1 },
        },
        {
          transitionKind: 'COST_INCREASE',
          signedPermanentChange: 1,
          prior: { permanentDelta: -2, effectiveCost: 1 },
          result: { permanentDelta: -1, effectiveCost: 2 },
        },
      ]);
    expect(getCardState(result.state, CARD_ID)?.costDelta).toBe(-1);
    expect(getCardState(result.state, CARD_ID)?.costLog).toHaveLength(2);
  });

  it('preserves SET against effective cost, including ongoing modifiers', () => {
    const { manifest, state } = fixture({ ongoingDiscount: true });
    expect(getCardCost(state, CARD_ID, manifest)).toBe(2);

    const result = run(state, manifest, [
      command({ kind: 'SET', value: 0 }),
    ]);

    expect(result.events).toMatchObject([{
      type: 'CARD_COST_CHANGED',
      cardId: CARD_ID,
      delta: -2,
    }]);
    expect(getCardState(result.state, CARD_ID)?.costDelta).toBe(-2);
    expect(getCardCost(result.state, CARD_ID, manifest)).toBe(0);
    expect(result.transitions[0]?.semantics).toMatchObject({
      prior: { baseCost: 3, permanentDelta: 0, effectiveCost: 2 },
      result: { baseCost: 3, permanentDelta: -2, effectiveCost: 0 },
    });
  });

  it('restores SET above zero when clamping hid excess permanent reduction', () => {
    const { manifest, state } = fixture({ costDelta: -5 });
    expect(getCardCost(state, CARD_ID, manifest)).toBe(0);

    const result = run(state, manifest, [
      command({ kind: 'SET', value: 2 }),
    ]);

    expect(result.events).toMatchObject([{
      type: 'CARD_COST_CHANGED',
      cardId: CARD_ID,
      delta: 4,
    }]);
    expect(getCardState(result.state, CARD_ID)?.costDelta).toBe(-1);
    expect(getCardCost(result.state, CARD_ID, manifest)).toBe(2);
  });

  it('clamps SET below zero and keeps zero, idempotent, and missing writes as no-ops', () => {
    const { manifest, state } = fixture({ costDelta: -3 });
    expect(getCardCost(state, CARD_ID, manifest)).toBe(0);

    for (const candidate of [
      command({ kind: 'ADD', delta: 0 }),
      command({ kind: 'SET', value: 0 }),
      command({ kind: 'SET', value: -10 }),
      command(
        { kind: 'ADD', delta: 1 },
        CAUSE,
        'missing-cost-card' as CardId,
      ),
    ]) {
      const result = run(state, manifest, [candidate]);
      expect(result.events).toEqual([]);
      expect(result.state).toBe(state);
    }
  });

  it('rejects missing provenance and non-finite or fractional values', () => {
    const { manifest, state } = fixture();
    const invalidCommands = [
      command(
        { kind: 'ADD', delta: 1 },
        { ...CAUSE, sourceId: '' as CardId },
      ),
      command(
        { kind: 'ADD', delta: 1 },
        { ...CAUSE, reason: '' },
      ),
      command({ kind: 'ADD', delta: Number.NaN }),
      command({ kind: 'SET', value: Number.POSITIVE_INFINITY }),
      command({ kind: 'ADD', delta: 0.5 }),
      command({ kind: 'SET', value: Number.MAX_SAFE_INTEGER + 1 }),
    ];

    for (const invalid of invalidCommands) {
      expect(() => run(state, manifest, [invalid]))
        .toThrow(KernelInvariantError);
      expect(getCardState(state, CARD_ID)?.costDelta).toBe(0);
      expect(getCardState(state, CARD_ID)?.costLog).toEqual([]);
    }
  });

  it('rejects a safe delta when it would overflow permanent Cost state', () => {
    const { manifest, state } = fixture({
      costDelta: Number.MAX_SAFE_INTEGER,
    });
    expect(() => run(state, manifest, [
      command({ kind: 'ADD', delta: 1 }),
    ])).toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)?.costDelta)
      .toBe(Number.MAX_SAFE_INTEGER);
  });

  it('publishes no partial candidate when a later command fails', () => {
    const { manifest, state } = fixture();
    let thrown: unknown;
    try {
      run(state, manifest, [
        command({ kind: 'ADD', delta: -1 }),
        command({ kind: 'ADD', delta: Number.NaN }),
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(KernelInvariantError);
    expect(thrown).toMatchObject({
      failure: {
        code: 'INVALID_OPERATION_OUTPUT',
        eventsProduced: 1,
      },
    });
    expect(getCardState(state, CARD_ID)?.costDelta).toBe(0);
    expect(getCardState(state, CARD_ID)?.costLog).toEqual([]);
  });

  it('enforces the transaction work budget without exposing its candidate', () => {
    const { manifest, state } = fixture();
    expect(() => run(
      state,
      manifest,
      [command({ kind: 'ADD', delta: -1 })],
      {
        maxWorkItems: 1,
        maxEvents: 10,
        maxReactions: 10,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    )).toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)?.costDelta).toBe(0);
    expect(getCardState(state, CARD_ID)?.costLog).toEqual([]);
  });
});
