import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { evalEffect, type EffectCtx } from '../effects/evaluator';
import { getCardState } from '../projections/cardRuntime';
import { getStoredCardPowerDelta } from '../powerLedger';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { CardId } from '../types/ids';

const CARD_ID = 'transform-subject' as CardId;
const SOURCE_ID = 'transform-source' as CardId;
const CAUSE = {
  sourceId: SOURCE_ID,
  effectKind: 'ON_REVEAL',
  reason: 'TRANSFORM_POWER_BOUNDARY_TEST',
} as const;
const manifest = testManifest([
  testCardDef('transform-old', { power: 3, cost: 1 }),
  testCardDef('transform-new', { power: 5, cost: 2 }),
]);

function initialState() {
  return buildRuntimeFixture({
    seed: 'transform-power-boundary',
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
          defId: 'transform-old',
          revealed: true,
          powerMutations: [{ kind: 'ADD', delta: 4 }],
        }],
        P1: [],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function context(
  state: ReturnType<typeof initialState>,
  self: CardId = CARD_ID,
): EffectCtx {
  return {
    state,
    manifest,
    self,
    selfKind: 'card',
    selfLane: 0,
    selfOwner: 'P0',
    rng: createRng('transform-power-boundary'),
    source: CAUSE,
    depth: 0,
  };
}

describe('transform stored-power boundary', () => {
  it('routes resetStats through CHANGE_STORED_POWER before transformation', () => {
    const state = initialState();
    const result = evalEffect(
      state,
      {
        kind: 'TRANSFORM_CARD',
        target: { kind: 'SELF' },
        pool: { kind: 'DEF_ID_LIST', ids: ['transform-new'] },
        resetStats: true,
      },
      context(state),
      manifest,
    );

    expect(result.events.map(({ type }) => type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_TRANSFORMED',
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'CARD_POWER_CHANGED',
      cardId: CARD_ID,
      mutation: { kind: 'RESET' },
      cause: CAUSE,
    });
    expect(getCardState(result.state, CARD_ID)).toMatchObject({
      defId: 'transform-new',
    });
    expect(getStoredCardPowerDelta(result.state, CARD_ID, manifest)).toBe(0);
    expect(getCardState(result.state, CARD_ID)!.powerLedger.at(-1))
      .toMatchObject({ mutation: { kind: 'RESET' }, cause: CAUSE });
  });

  it('does not let CARD_TRANSFORMED write the power ledger directly', () => {
    const state = initialState();
    const priorLedger = getCardState(state, CARD_ID)!.powerLedger;
    const transformed = apply(state, {
      type: 'CARD_TRANSFORMED',
      cardId: CARD_ID,
      oldDefId: 'transform-old',
      newDefId: 'transform-new',
      cause: CAUSE,
      resetStats: true,
    }, manifest);

    expect(getCardState(transformed, CARD_ID)!.powerLedger).toBe(priorLedger);
  });

  it('routes the Social Worker builtin reset through the same kernel command', () => {
    const state = initialState();
    const result = evalEffect(
      state,
      { kind: 'CALL_BUILTIN', fn: 'SOCIAL_WORKER', args: {} },
      context(state, SOURCE_ID),
      manifest,
    );

    expect(result.events.map(({ type }) => type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_TRANSFORMED',
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'CARD_POWER_CHANGED',
      cardId: CARD_ID,
      mutation: { kind: 'RESET' },
    });
    expect(getStoredCardPowerDelta(result.state, CARD_ID, manifest)).toBe(0);
  });
});
