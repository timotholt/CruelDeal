import { describe, expect, it } from 'vitest';
import type { LocationCardDef } from '../manifest/types';
import { getCardState } from '../projections/cardRuntime';
import { getCardPower } from '../projections/power';
import { getStoredCardPowerDelta } from '../powerLedger';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import { foldFramedEvents, frameAndFoldEvents } from '../transactionTimeline';
import type { CardId } from '../types/ids';
import { KernelInvariantError } from './failure';
import { changeStoredPower } from './powerTransaction';

const CARD_ID = 'kernel-power-card' as CardId;
const SOURCE_ID = 'kernel-power-source' as CardId;
const CAUSE = {
  sourceId: SOURCE_ID,
  effectKind: 'SYSTEM',
  reason: 'KERNEL_POWER_TEST',
} as const;
const SELF = { kind: 'SELF' } as const;

function courthouse(): LocationCardDef {
  return {
    ...testLocationDef('kernel-courthouse'),
    abilities: {
      ongoing: [{
        kind: 'BLOCK_POWER_INCREASE',
        target: {
          kind: 'SAME_LANE',
          of: SELF,
          ownerFilter: 'ANY_OWNER',
        },
        stack: 'SINGLE',
      }],
    },
  };
}

function fixture(
  mutations: readonly (
    | { readonly kind: 'ADD'; readonly delta: number }
    | { readonly kind: 'SET'; readonly value: number }
    | { readonly kind: 'RESET' }
  )[] = [],
  blocked = false,
) {
  const manifest = testManifest(
    [testCardDef('kernel-power-def', { power: 3 })],
    blocked ? [courthouse()] : [],
  );
  const state = buildRuntimeFixture({
    seed: 'kernel-power-transaction',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      {
        P0: [{
          id: CARD_ID,
          defId: 'kernel-power-def',
          revealed: true,
          powerMutations: mutations,
        }],
        P1: [],
      },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [
      blocked
        ? {
            id: 'kernel-courthouse@0',
            defId: 'kernel-courthouse',
            revealed: true,
          }
        : null,
      null,
      null,
    ],
  }).state;
  return { manifest, state };
}

describe('stored-power kernel transaction', () => {
  it('captures closed ADD, SET, and RESET semantics from before/after state', () => {
    const { manifest, state } = fixture();
    const added = changeStoredPower(
      state,
      CARD_ID,
      { kind: 'ADD', delta: 4 },
      CAUSE,
      manifest,
    );
    expect(added.transitions[0]?.semantics).toMatchObject({
      eventType: 'CARD_POWER_CHANGED',
      transitionKind: 'POWER_GAIN',
      entityId: CARD_ID,
      signedStoredChange: 4,
      prior: {
        owner: 'P0',
        zone: 'LANE',
        lane: 0,
        storedDelta: 0,
        effectivePower: 3,
      },
      result: {
        owner: 'P0',
        zone: 'LANE',
        lane: 0,
        storedDelta: 4,
        effectivePower: 7,
      },
    });

    const set = changeStoredPower(
      added.state,
      CARD_ID,
      { kind: 'SET', value: 2 },
      CAUSE,
      manifest,
    );
    expect(set.transitions[0]?.semantics).toMatchObject({
      transitionKind: 'POWER_LOSS',
      signedStoredChange: -5,
      prior: { storedDelta: 4, effectivePower: 7 },
      result: { storedDelta: -1, effectivePower: 2 },
    });

    const reset = changeStoredPower(
      set.state,
      CARD_ID,
      { kind: 'RESET' },
      CAUSE,
      manifest,
    );
    expect(reset.transitions[0]?.semantics).toMatchObject({
      transitionKind: 'POWER_GAIN',
      signedStoredChange: 1,
      prior: { storedDelta: -1, effectivePower: 2 },
      result: { storedDelta: 0, effectivePower: 3 },
    });
  });

  it('denies Courthouse increases before commit and retains prior history', () => {
    const { manifest, state } = fixture(
      [
        { kind: 'ADD', delta: 4 },
        { kind: 'ADD', delta: -2 },
      ],
      true,
    );
    const priorLedger = getCardState(state, CARD_ID)!.powerLedger;
    expect(getCardPower(state, CARD_ID, manifest)).toBe(1);

    for (const mutation of [
      { kind: 'ADD', delta: 2 },
      { kind: 'SET', value: 5 },
      { kind: 'RESET' },
    ] as const) {
      const denied = changeStoredPower(
        state,
        CARD_ID,
        mutation,
        CAUSE,
        manifest,
      );
      expect(denied.events).toEqual([]);
      expect(denied.state).toBe(state);
      expect(denied.usage.reactionsScheduled).toBe(0);
      expect(getCardState(denied.state, CARD_ID)!.powerLedger)
        .toBe(priorLedger);
    }

    const reduction = changeStoredPower(
      state,
      CARD_ID,
      { kind: 'ADD', delta: -1 },
      CAUSE,
      manifest,
    );
    expect(reduction.events).toHaveLength(1);
    expect(getStoredCardPowerDelta(reduction.state, CARD_ID, manifest)).toBe(1);
    expect(getCardPower(reduction.state, CARD_ID, manifest)).toBe(0);
  });

  it('preserves cause and canonical Frame through live fold and replay', () => {
    const { manifest, state } = fixture();
    const transaction = changeStoredPower(
      state,
      CARD_ID,
      { kind: 'ADD', delta: 2 },
      CAUSE,
      manifest,
    );
    const live = frameAndFoldEvents({
      transactionId: 'kernel-power:live',
      initialState: state,
      events: transaction.events,
      manifest,
    });
    const replay = foldFramedEvents({
      transactionId: 'kernel-power:replay',
      initialState: state,
      framedEvents: live.framedEvents,
      manifest,
    });
    const entry = getCardState(live.finalState, CARD_ID)!.powerLedger.at(-1);

    expect(entry).toMatchObject({
      frame: live.framedEvents[0]?.frame,
      turn: 4,
      mutation: { kind: 'ADD', delta: 2 },
      cause: CAUSE,
    });
    expect(replay.finalState).toEqual(live.finalState);
    expect(getCardState(replay.finalState, CARD_ID)!.powerLedger)
      .toEqual(getCardState(live.finalState, CARD_ID)!.powerLedger);
  });

  it('exposes no partial candidate when the work budget is exhausted', () => {
    const { manifest, state } = fixture();
    let thrown: unknown;
    try {
      changeStoredPower(
        state,
        CARD_ID,
        { kind: 'ADD', delta: 2 },
        CAUSE,
        manifest,
        {
          maxWorkItems: 1,
          maxEvents: 10,
          maxReactions: 10,
          maxEffectDepth: 10,
          maxCreatedEntities: 10,
        },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(KernelInvariantError);
    expect(thrown).toMatchObject({
      failure: {
        code: 'BUDGET_EXCEEDED',
        eventsProduced: 0,
        reactionsScheduled: 0,
      },
    });
    expect(getStoredCardPowerDelta(state, CARD_ID, manifest)).toBe(0);
    expect(getCardState(state, CARD_ID)!.powerLedger).toEqual([]);
  });
});
