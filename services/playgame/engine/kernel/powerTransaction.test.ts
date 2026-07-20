import { describe, expect, it } from 'vitest';
import { executePowerCommands } from '../effects/evaluator';
import type { CardDef, LocationCardDef, Manifest } from '../manifest/types';
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
import type { EffectRef } from '../types/ability';
import type { MatchState, PowerMutation } from '../types/state';
import { KernelInvariantError } from './failure';
import { resolveStoredPowerTransaction } from './powerTransaction';
import type { ResolutionBudget } from './contracts';
import { createRng } from '../rng';

const changeStoredPower = (
  state: MatchState,
  cardId: CardId,
  mutation: PowerMutation,
  cause: EffectRef,
  manifest: Manifest,
  budget?: ResolutionBudget,
) => resolveStoredPowerTransaction(state, [{
  type: 'CHANGE_STORED_POWER',
  cardId,
  mutation,
  cause,
}], {
  manifest,
  baseDepth: 0,
  interpretEffect: (candidate) => ({ events: [], state: candidate }),
  ...(budget === undefined ? {} : { budget }),
});

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
  it('fires onGainedPower immediately only for a committed gain on an active card', () => {
    const gainDefinition: CardDef = {
      ...testCardDef('gain-reactor', { power: 3 }),
      abilities: {
        onGainedPower: [{
          kind: 'DRAW',
          owner: 'SELF_OWNER',
          count: { kind: 'LIT', n: 1 },
        }],
      },
    };
    const drawnDefinition = testCardDef('drawn');
    const gameManifest = testManifest([gainDefinition, drawnDefinition]);
    const build = (revealed: boolean) => buildRuntimeFixture({
      seed: `gain-reaction:${revealed}`,
      localSeat: 'P0',
      turn: 3,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: {
        P0: [{ id: 'drawn-card', defId: 'drawn' }],
        P1: [],
      },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{
            id: CARD_ID,
            defId: 'gain-reactor',
            revealed,
          }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
    }).state;
    const run = (
      state: MatchState,
      delta: number,
      manifest: Manifest = gameManifest,
    ) => executePowerCommands(state, [{
      type: 'CHANGE_STORED_POWER',
      cardId: CARD_ID,
      mutation: { kind: 'ADD', delta },
      cause: CAUSE,
    }], {
      rng: createRng(`gain-reaction:${delta}`),
    }, manifest);

    const gain = run(build(true), 1);
    expect(gain.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_DRAWN',
    ]);
    expect(gain.state.hand.P0).toEqual(['drawn-card']);

    const loss = run(build(true), -1);
    expect(loss.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
    ]);
    expect(loss.state.hand.P0).toEqual([]);

    const unrevealed = run(build(false), 1);
    expect(unrevealed.events.map(event => event.type)).toEqual([
      'CARD_POWER_CHANGED',
    ]);
    expect(unrevealed.state.hand.P0).toEqual([]);

    const blockedManifest = testManifest(
      [gainDefinition, drawnDefinition],
      [courthouse()],
    );
    const blockedState = buildRuntimeFixture({
      seed: 'gain-reaction:blocked',
      localSeat: 'P0',
      turn: 3,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: {
        P0: [{ id: 'drawn-card', defId: 'drawn' }],
        P1: [],
      },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{
            id: CARD_ID,
            defId: 'gain-reactor',
            revealed: true,
          }],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [{
        id: 'kernel-courthouse@0',
        defId: 'kernel-courthouse',
        revealed: true,
      }, null, null],
    }).state;
    const blocked = run(blockedState, 1, blockedManifest);
    expect(blocked.events).toEqual([]);
    expect(blocked.state).toBe(blockedState);
  });

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
