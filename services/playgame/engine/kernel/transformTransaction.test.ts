import { describe, expect, it } from 'vitest';
import { getCardState } from '../projections/cardRuntime';
import { getStoredCardPowerDelta } from '../powerLedger';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { CardId } from '../types/ids';
import { KernelInvariantError } from './failure';
import { resolveTransformTransaction } from './transformTransaction';

const CARD_ID = 'transform-transaction-card' as CardId;
const SOURCE_ID = 'transform-transaction-source' as CardId;
const CAUSE = {
  sourceId: SOURCE_ID,
  effectKind: 'SYSTEM',
  reason: 'TRANSFORM_TRANSACTION_TEST',
} as const;
const manifest = testManifest([
  testCardDef('transform-transaction-old', { power: 3, cost: 1 }),
  testCardDef('transform-transaction-a', { power: 5, cost: 2 }),
  testCardDef('transform-transaction-b', { power: 6, cost: 3 }),
]);

function initialState() {
  return buildRuntimeFixture({
    seed: 'transform-transaction',
    localSeat: 'P0',
    turn: 3,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      {
        P0: [{
          id: CARD_ID,
          defId: 'transform-transaction-old',
          revealed: true,
          powerMutations: [{ kind: 'ADD', delta: 4 }],
          costDelta: -1,
        }],
        P1: [],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function transform(
  state: ReturnType<typeof initialState>,
  metadataPolicy: 'PRESERVE' | 'RESET_TO_DEFINITION',
  maxEvents?: number,
) {
  return resolveTransformTransaction(state, [{
    type: 'TRANSFORM_CARD',
    cardId: CARD_ID,
    newDefId: 'transform-transaction-b',
    metadataPolicy,
    cause: CAUSE,
  }], {
    manifest,
    baseDepth: 0,
    interpretEffect: candidate => ({ state: candidate, events: [] }),
    ...(maxEvents === undefined
      ? {}
      : {
          budget: {
            maxWorkItems: 100,
            maxEvents,
            maxReactions: 100,
            maxEffectDepth: 20,
            maxCreatedEntities: 20,
          },
        }),
  });
}

describe('transform kernel transaction', () => {
  it('freezes caller selection before reset then commits transform', () => {
    const first = transform(initialState(), 'RESET_TO_DEFINITION');
    const second = transform(initialState(), 'RESET_TO_DEFINITION');

    expect(first.events).toEqual(second.events);
    expect(first.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_TRANSFORMED',
    ]);
    expect(first.events[0]).toMatchObject({
      type: 'CARD_POWER_CHANGED',
      cardId: CARD_ID,
      mutation: { kind: 'RESET' },
    });
    expect(first.events[1]).toMatchObject({
      type: 'CARD_TRANSFORMED',
      cardId: CARD_ID,
      oldDefId: 'transform-transaction-old',
      metadataPolicy: 'RESET_TO_DEFINITION',
    });
    expect(getStoredCardPowerDelta(first.state, CARD_ID, manifest)).toBe(0);
  });

  it('preserves stored Power and metadata when policy is PRESERVE', () => {
    const result = transform(initialState(), 'PRESERVE');

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_TRANSFORMED',
    ]);
    expect(getStoredCardPowerDelta(result.state, CARD_ID, manifest)).toBe(4);
    expect(getCardState(result.state, CARD_ID)?.costDelta).toBe(-1);
  });

  it('does not publish transform when the reset sequence exceeds budget', () => {
    const state = initialState();

    expect(() => transform(state, 'RESET_TO_DEFINITION', 1))
      .toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)).toMatchObject({
      defId: 'transform-transaction-old',
      costDelta: -1,
    });
    expect(getStoredCardPowerDelta(state, CARD_ID, manifest)).toBe(4);
  });

  it('rolls back when Power policy blocks the required reset', () => {
    const blockedManifest = testManifest(
      [
        testCardDef('transform-transaction-old', { power: 3, cost: 1 }),
        testCardDef('transform-transaction-a', { power: 5, cost: 2 }),
      ],
      [{
        ...testLocationDef('transform-reset-courthouse'),
        abilities: {
          ongoing: [{
            kind: 'BLOCK_POWER_INCREASE',
            target: {
              kind: 'SAME_LANE',
              of: { kind: 'SELF' },
              ownerFilter: 'ANY_OWNER',
            },
            stack: 'SINGLE',
          }],
        },
      }],
    );
    const state = buildRuntimeFixture({
      seed: 'transform-blocked-reset',
      localSeat: 'P0',
      turn: 3,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{
            id: CARD_ID,
            defId: 'transform-transaction-old',
            revealed: true,
            powerMutations: [{ kind: 'ADD', delta: -2 }],
          }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [{
        id: 'transform-reset-courthouse@0',
        defId: 'transform-reset-courthouse',
        revealed: true,
      }, null, null],
    }).state;

    expect(() => resolveTransformTransaction(state, [{
      type: 'TRANSFORM_CARD',
      cardId: CARD_ID,
      newDefId: 'transform-transaction-a',
      metadataPolicy: 'RESET_TO_DEFINITION',
      cause: CAUSE,
    }], {
      manifest: blockedManifest,
      baseDepth: 0,
      interpretEffect: candidate => ({ state: candidate, events: [] }),
    })).toThrow(KernelInvariantError);
    expect(getCardState(state, CARD_ID)?.defId)
      .toBe('transform-transaction-old');
    expect(getStoredCardPowerDelta(state, CARD_ID, blockedManifest)).toBe(-2);
  });
});
