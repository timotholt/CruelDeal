import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { evalEffect, type EffectCtx } from '../effects/evaluator';
import { BOOTSTRAP_MANIFEST } from '../manifest';
import type { CardDef, LocationDef, Manifest } from '../manifest/types';
import { getCardPower, getLanePower } from '../projections/power';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
  type RuntimeCardSpec,
} from '../testkit/runtimeFixture';
import type { EffectExpr } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId, LaneIdx } from '../types/ids';
import type { MatchState } from '../types/state';

const SELF = { kind: 'SELF' } as const;
const COURTHOUSE_ID = 'courthouse';

function courthouseDef(): LocationDef {
  return {
    ...testLocationDef(COURTHOUSE_ID),
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

function globalBoosterDef(): CardDef {
  return {
    ...testCardDef('global-booster', { power: 1 }),
    abilities: {
      ongoing: [{
        kind: 'POWER_ADD',
        target: {
          kind: 'ALL_CARDS',
          ownerFilter: 'SELF_OWNER',
          zoneFilter: 'LANE',
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  };
}

function laneBoosterDef(): CardDef {
  return {
    ...testCardDef('lane-booster', { power: 1 }),
    abilities: {
      ongoing: [{
        kind: 'LANE_POWER_ADD',
        laneScope: {
          laneOf: SELF,
          ownerFilter: 'SELF_OWNER',
        },
        delta: { kind: 'LIT', n: 2 },
        stack: 'ADDITIVE',
      }],
    },
  };
}

function manifestWithCourthouse(extraCards: readonly CardDef[] = []): Manifest {
  return testManifest(
    [
      testCardDef('subject', { power: 3 }),
      ...extraCards,
    ],
    [courthouseDef()],
  );
}

function fixtureState(
  options: {
    readonly hand?: readonly RuntimeCardSpec[];
    readonly lane0?: readonly RuntimeCardSpec[];
    readonly lane1?: readonly RuntimeCardSpec[];
    readonly lane2?: readonly RuntimeCardSpec[];
    readonly courthouseLane?: LaneIdx;
  },
): MatchState {
  const courthouseLane = options.courthouseLane ?? 0;
  return buildRuntimeFixture({
    seed: 'courthouse-contract',
    localSeat: 'P0',
    turn: 3,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: options.hand ?? [], P1: [] },
    lanes: [
      { P0: options.lane0 ?? [], P1: [] },
      { P0: options.lane1 ?? [], P1: [] },
      { P0: options.lane2 ?? [], P1: [] },
    ],
    locations: [
      courthouseLane === 0
        ? { id: 'courthouse@0', defId: COURTHOUSE_ID, revealed: true }
        : null,
      courthouseLane === 1
        ? { id: 'courthouse@1', defId: COURTHOUSE_ID, revealed: true }
        : null,
      courthouseLane === 2
        ? { id: 'courthouse@2', defId: COURTHOUSE_ID, revealed: true }
        : null,
    ],
  }).state;
}

function effectCtx(
  state: MatchState,
  manifest: Manifest,
  self: CardId,
  lane: LaneIdx,
): EffectCtx {
  return {
    state,
    manifest,
    self,
    selfKind: 'card',
    selfLane: lane,
    selfOwner: 'P0',
    rng: createRng('courthouse-effect'),
    source: { sourceId: self, effectKind: 'ON_REVEAL' },
    depth: 0,
  };
}

describe('Courthouse Power contract', () => {
  it('suppresses a hand buff on play without erasing it, then restores it after movement', () => {
    const manifest = manifestWithCourthouse();
    const initial = fixtureState({
      hand: [{ id: 'subject', defId: 'subject', powerDelta: 4 }],
    });
    const stagedEvent: MatchEvent = {
      type: 'CARD_STAGED',
      intentId: 'stage-subject',
      cardId: 'subject' as CardId,
      lane: 0,
      owner: 'P0',
      cost: 1,
    };
    const atCourthouse = apply(initial, stagedEvent, manifest);

    expect(atCourthouse.cards['subject' as CardId]?.powerDelta).toBe(4);
    expect(getCardPower(atCourthouse, 'subject' as CardId, manifest)).toBe(3);

    const moved = apply(atCourthouse, {
      type: 'CARD_MOVED',
      cardId: 'subject' as CardId,
      fromLane: 0,
      toLane: 1,
      cause: { sourceId: 'subject' as CardId, effectKind: 'SYSTEM' },
    }, manifest);

    expect(moved.cards['subject' as CardId]?.powerDelta).toBe(4);
    expect(getCardPower(moved, 'subject' as CardId, manifest)).toBe(7);
  });

  it('rejects new positive On Reveal Power without storing it', () => {
    const manifest = manifestWithCourthouse();
    const state = fixtureState({
      lane0: [{ id: 'subject', defId: 'subject', revealed: true }],
    });
    const effect: EffectExpr = {
      kind: 'ADD_POWER',
      target: SELF,
      delta: { kind: 'LIT', n: 4 },
    };
    const result = evalEffect(
      state,
      effect,
      effectCtx(state, manifest, 'subject' as CardId, 0),
      manifest,
    );

    expect(result.events).not.toContainEqual(expect.objectContaining({ type: 'CARD_POWER_CHANGED' }));
    expect(result.state.cards['subject' as CardId]?.powerDelta).toBe(0);
    expect(getCardPower(result.state, 'subject' as CardId, manifest)).toBe(3);
  });

  it('blocks an upward SET_POWER even when a larger stored buff is hidden', () => {
    const manifest = manifestWithCourthouse();
    const state = fixtureState({
      lane0: [{ id: 'subject', defId: 'subject', revealed: true, powerDelta: 4 }],
    });
    const effect: EffectExpr = {
      kind: 'SET_POWER',
      target: SELF,
      value: { kind: 'LIT', n: 5 },
    };
    const result = evalEffect(
      state,
      effect,
      effectCtx(state, manifest, 'subject' as CardId, 0),
      manifest,
    );

    expect(result.events).not.toContainEqual(expect.objectContaining({ type: 'CARD_POWER_CHANGED' }));
    expect(result.state.cards['subject' as CardId]?.powerDelta).toBe(4);
    expect(getCardPower(result.state, 'subject' as CardId, manifest)).toBe(3);
  });

  it('allows reductions while suppressing positive stored Power', () => {
    const manifest = manifestWithCourthouse();
    const state = fixtureState({
      lane0: [{ id: 'subject', defId: 'subject', revealed: true }],
    });
    const effect: EffectExpr = {
      kind: 'ADD_POWER',
      target: SELF,
      delta: { kind: 'LIT', n: -2 },
    };
    const result = evalEffect(
      state,
      effect,
      effectCtx(state, manifest, 'subject' as CardId, 0),
      manifest,
    );

    expect(result.state.cards['subject' as CardId]?.powerDelta).toBe(-2);
    expect(getCardPower(result.state, 'subject' as CardId, manifest)).toBe(1);
  });

  it('suppresses positive per-card and lane-level Ongoings while they are active there', () => {
    const globalBooster = globalBoosterDef();
    const laneBooster = laneBoosterDef();
    const manifest = manifestWithCourthouse([globalBooster, laneBooster]);
    const state = fixtureState({
      lane0: [
        { id: 'subject', defId: 'subject', revealed: true },
        { id: 'lane-booster', defId: 'lane-booster', revealed: true },
      ],
      lane1: [{ id: 'global-booster', defId: 'global-booster', revealed: true }],
    });

    expect(getCardPower(state, 'subject' as CardId, manifest)).toBe(3);
    expect(getLanePower(state, 0, 'P0', manifest)).toBe(4);

    const moved = apply(state, {
      type: 'CARD_MOVED',
      cardId: 'subject' as CardId,
      fromLane: 0,
      toLane: 2,
      cause: { sourceId: 'subject' as CardId, effectKind: 'SYSTEM' },
    }, manifest);
    expect(getCardPower(moved, 'subject' as CardId, manifest)).toBe(5);
  });

  it('lets Corporate Climber destroy its victims but blocks the resulting gain', () => {
    const state = fixtureState({
      lane0: [
        { id: 'climber', defId: 'corporate-climber', revealed: true },
        { id: 'victim', defId: 'guard', revealed: true },
      ],
    });
    const effect: EffectExpr = {
      kind: 'CALL_BUILTIN',
      fn: 'CORPORATE_CLIMBER',
      args: {},
    };
    const result = evalEffect(
      state,
      effect,
      effectCtx(state, BOOTSTRAP_MANIFEST, 'climber' as CardId, 0),
      BOOTSTRAP_MANIFEST,
    );

    expect(result.state.cards['victim' as CardId]?.zone).toBe('DESTROYED');
    expect(result.state.cards['climber' as CardId]?.powerDelta).toBe(0);
    expect(result.events).not.toContainEqual(expect.objectContaining({
      type: 'CARD_POWER_CHANGED',
      cardId: 'climber',
    }));
  });
});
