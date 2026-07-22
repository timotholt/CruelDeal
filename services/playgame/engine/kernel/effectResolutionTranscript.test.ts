import { describe, expect, it } from 'vitest';

import type { EffectCtx } from '../effects/rulesInterpreter';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import { executeEffectForTest } from '../testkit/rulesExecution';
import type { EffectExpr } from '../types/ability';
import type { CardId, LaneId } from '../types/ids';
import type { MatchState } from '../types/state';

const SELF = { kind: 'SELF' } as const;

function effectContext(
  state: MatchState,
  manifest: ReturnType<typeof testManifest>,
  sourceId: CardId,
  lane: LaneId,
): EffectCtx {
  return {
    state,
    manifest,
    self: sourceId,
    selfKind: 'card',
    selfLane: lane,
    selfOwner: 'P0',
    rng: createRng('effect-resolution-transcript'),
    source: {
      sourceId,
      effectKind: 'ON_REVEAL',
      reason: 'NATURAL_REVEAL',
      exprIdx: 0,
    },
    depth: 0,
  };
}

describe('authored effect resolution transcript', () => {
  it('records mixed destroy outcomes and the actual blocking card', () => {
    const armor = {
      ...testCardDef('armor'),
      abilities: {
        ongoing: [{
          kind: 'BLOCK_DESTROY' as const,
          target: {
            kind: 'SAME_LANE' as const,
            of: SELF,
            ownerFilter: 'ANY_OWNER' as const,
          },
          stack: 'SINGLE' as const,
        }],
      },
    };
    const manifest = testManifest([
      testCardDef('destroyer'),
      armor,
      testCardDef('victim'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'mixed-destroy-resolution',
      localSeat: 'P0',
      turn: 3,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [{ id: 'armor', defId: 'armor', revealed: true }],
          P1: [{ id: 'protected', defId: 'victim', revealed: true }],
        },
        {
          P0: [],
          P1: [{ id: 'exposed', defId: 'victim', revealed: true }],
        },
        {
          P0: [{ id: 'destroyer', defId: 'destroyer', revealed: true }],
          P1: [],
        },
      ],
      locations: [null, null, null],
    }).state;
    const effect: EffectExpr = {
      kind: 'DESTROY',
      target: {
        kind: 'ALL_CARDS',
        ownerFilter: 'OPP_OWNER',
        zoneFilter: 'LANE',
      },
    };

    const result = executeEffectForTest(
      state,
      effect,
      effectContext(state, manifest, 'destroyer' as CardId, 2),
      manifest,
    );

    expect(result.resolutionSteps).toEqual([
      {
        transitionIndex: null,
        effect: {
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationOrdinal: 0,
          parentInvocationOrdinal: null,
          source: { kind: 'CARD', cardId: 'destroyer' },
          ability: { kind: 'ON_REVEAL', ruleId: 'ON_REVEAL:0', ruleIndex: 0 },
          invocationReason: 'NATURAL',
          depth: 0,
          candidates: [
            { kind: 'CARD', cardId: 'protected' },
            { kind: 'CARD', cardId: 'exposed' },
          ],
        },
      },
      {
        transitionIndex: null,
        effect: {
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 0,
          attemptOrdinal: 0,
          operation: 'DESTROY_CARD',
          target: { kind: 'CARD', cardId: 'protected' },
          result: 'BLOCKED',
          blockedBy: [{ kind: 'CARD', cardId: 'armor' }],
          reason: 'CANNOT_BE_DESTROYED',
        },
      },
      {
        transitionIndex: 0,
        effect: {
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 0,
          attemptOrdinal: 1,
          operation: 'DESTROY_CARD',
          target: { kind: 'CARD', cardId: 'exposed' },
          result: 'AFFECTED',
          blockedBy: [],
          reason: null,
        },
      },
      {
        transitionIndex: null,
        effect: {
          kind: 'EFFECT_INVOCATION_COMPLETED',
          invocationOrdinal: 0,
          attempted: 2,
          affected: 1,
          blocked: 1,
          invalidated: 0,
          unchanged: 0,
        },
      },
    ]);
    expect(result.events.map(event => event.type)).toEqual(['CARD_DESTROYED']);
  });

  it('preserves a zero-candidate invocation as start and completion evidence', () => {
    const manifest = testManifest([testCardDef('destroyer')]);
    const state = buildRuntimeFixture({
      seed: 'empty-effect-resolution',
      localSeat: 'P0',
      turn: 3,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        {
          P0: [{ id: 'destroyer', defId: 'destroyer', revealed: true }],
          P1: [],
        },
      ],
      locations: [null, null, null],
    }).state;

    const result = executeEffectForTest(
      state,
      {
        kind: 'DESTROY',
        target: {
          kind: 'ALL_CARDS',
          ownerFilter: 'OPP_OWNER',
          zoneFilter: 'LANE',
        },
      },
      effectContext(state, manifest, 'destroyer' as CardId, 2),
      manifest,
    );

    expect(result.resolutionSteps.map(step => step.effect?.kind)).toEqual([
      'EFFECT_INVOCATION_STARTED',
      'EFFECT_INVOCATION_COMPLETED',
    ]);
    expect(result.resolutionSteps[0]?.effect).toEqual(expect.objectContaining({
      candidates: [],
    }));
    expect(result.resolutionSteps[1]?.effect).toEqual(expect.objectContaining({
      attempted: 0,
      affected: 0,
      blocked: 0,
      invalidated: 0,
      unchanged: 0,
    }));
  });
});
