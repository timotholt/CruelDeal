import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import {
  executeRulesCommands,
  type EffectCtx,
} from '../effects/rulesInterpreter';
import { executeEffectForTest } from '../testkit/rulesExecution';
import type { CardDef, Manifest } from '../manifest/types';
import { getCardState } from '../projections/cardRuntime';
import { getStoredCardPowerDelta } from '../powerLedger';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../testkit/runtimeFixture';
import {
  foldCanonicalFrames,
  frameAndFoldEvents,
} from '../transactionTimeline';
import type { EffectExpr } from '../types/ability';
import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import {
  DEFAULT_RESOLUTION_BUDGET,
  type ResolutionBudget,
} from './contracts';
import { KernelInvariantError } from './failure';
import type { TransformCardCommand } from './transformTransaction';

const CARD_ID = 'transform-subject' as CardId;
const SOURCE_ID = 'transform-source' as CardId;
const DRAWN_ID = 'transform-drawn' as CardId;
const CAUSE = {
  sourceId: SOURCE_ID,
  effectKind: 'ON_REVEAL',
  reason: 'TRANSFORM_POWER_BOUNDARY_TEST',
} as const;

function oldDefinition(withGainReaction = false): CardDef {
  return {
    ...testCardDef('transform-old', { power: 3, cost: 1 }),
    ...(withGainReaction
      ? {
          abilities: {
            onGainedPower: [{
              kind: 'DRAW',
              owner: 'SELF_OWNER',
              count: { kind: 'LIT', n: 1 },
            }],
          },
        }
      : {}),
  };
}

function manifest(
  withGainReaction = false,
  extraDefinitions: readonly CardDef[] = [],
): Manifest {
  return testManifest([
    oldDefinition(withGainReaction),
    testCardDef('transform-new-a', { power: 5, cost: 2 }),
    testCardDef('transform-new-b', { power: 6, cost: 2 }),
    testCardDef('social-worker', { power: 3, cost: 5 }),
    testCardDef('transform-drawn', { power: 1, cost: 1 }),
    ...extraDefinitions,
  ]);
}

function initialState(options: {
  readonly withGainReaction?: boolean;
  readonly powerDelta?: number;
  readonly includeSource?: boolean;
  readonly staged?: boolean;
} = {}): { readonly state: MatchState; readonly manifest: Manifest } {
  const gameManifest = manifest(options.withGainReaction);
  return {
    manifest: gameManifest,
    state: buildRuntimeFixture({
      seed: 'transform-power-boundary',
      localSeat: 'P0',
      turn: 3,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: {
        P0: [{ id: DRAWN_ID, defId: 'transform-drawn' }],
        P1: [],
      },
      hands: { P0: [], P1: [] },
      lanes: [
        {
          P0: [
            ...(options.includeSource
              ? [{
                  id: SOURCE_ID,
                  defId: 'social-worker',
                  revealed: true,
                }]
              : []),
            {
              id: CARD_ID,
              defId: 'transform-old',
              variantId: 'old-variant',
              revealed: true,
              powerMutations:
                options.powerDelta === undefined
                  ? []
                  : [{ kind: 'ADD' as const, delta: options.powerDelta }],
              tags: [{ kind: 'DESTROY_IMMUNE' as const }],
            },
          ],
          P1: [],
        },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
      stagedPlays: options.staged
        ? [{ cardId: CARD_ID, energyPaid: 2 }]
        : [],
    }).state,
  };
}

function command(
  metadataPolicy: TransformCardCommand['metadataPolicy'],
  newDefId = 'transform-new-a',
): TransformCardCommand {
  return {
    type: 'TRANSFORM_CARD',
    cardId: CARD_ID,
    newDefId,
    metadataPolicy,
    cause: CAUSE,
  };
}

function runTransform(
  state: MatchState,
  gameManifest: Manifest,
  transformCommand = command('RESET_TO_DEFINITION'),
  overrides: { readonly budget?: ResolutionBudget } = {},
) {
  return executeRulesCommands(state, [transformCommand], {
    rng: createRng('transform-power-boundary-test'),
    depth: 0,
    ...overrides,
  }, gameManifest);
}

function evaluatorContext(
  state: MatchState,
  self: CardId,
  gameManifest: Manifest,
): EffectCtx {
  return {
    state,
    manifest: gameManifest,
    self,
    selfKind: 'card',
    selfLane: 0,
    selfOwner: 'P0',
    eventOwner: 'P0',
    rng: createRng('transform-client-parity'),
    source: CAUSE,
    depth: 0,
  };
}

describe('transform transaction boundary', () => {
  it('resolves a governed stored-Power reset and its old-definition reaction before transformation', () => {
    const { state, manifest: gameManifest } = initialState({
      withGainReaction: true,
      powerDelta: -2,
    });
    const result = runTransform(
      state,
      gameManifest,
      command('RESET_TO_DEFINITION'),
    );

    expect(result.events.map(({ type }) => type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_DRAWN',
      'CARD_TRANSFORMED',
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'CARD_POWER_CHANGED',
      cardId: CARD_ID,
      mutation: { kind: 'RESET' },
      cause: {
        sourceId: SOURCE_ID,
        reason: 'TRANSFORM_POWER_BOUNDARY_TEST',
      },
    });
    expect(result.state.hand.P0).toEqual([DRAWN_ID]);
    expect(getCardState(result.state, CARD_ID)?.defId)
      .toBe('transform-new-a');
    expect(getStoredCardPowerDelta(result.state, CARD_ID, gameManifest))
      .toBe(0);
  });

  it('publishes no reset, nested reaction, or transform prefix after budget failure', () => {
    const { state, manifest: gameManifest } = initialState({
      withGainReaction: true,
      powerDelta: -2,
    });
    const before = getCardState(state, CARD_ID);

    expect(() => runTransform(
      state,
      gameManifest,
      command('RESET_TO_DEFINITION'),
      {
        budget: {
          ...DEFAULT_RESOLUTION_BUDGET,
          maxEvents: 1,
        },
      },
    )).toThrow(KernelInvariantError);

    expect(getCardState(state, CARD_ID)).toBe(before);
    expect(getCardState(state, CARD_ID)).toMatchObject({
      defId: 'transform-old',
    });
    expect(getStoredCardPowerDelta(state, CARD_ID, gameManifest)).toBe(-2);
    expect(state.deck.P0).toEqual([DRAWN_ID]);
    expect(state.hand.P0).toEqual([]);
  });

  it('preserves identity, placement, lifecycle, staged payment, and metadata when requested', () => {
    const { state, manifest: gameManifest } = initialState({
      powerDelta: 4,
      staged: true,
    });
    const prior = getCardState(state, CARD_ID)!;
    const result = runTransform(
      state,
      gameManifest,
      command('PRESERVE'),
    );
    const transformed = getCardState(result.state, CARD_ID)!;

    expect(transformed).toMatchObject({
      id: prior.id,
      defId: 'transform-new-a',
      owner: prior.owner,
      zone: prior.zone,
      lane: prior.lane,
      revealed: prior.revealed,
      revealTiming: prior.revealTiming,
      lifecycle: prior.lifecycle,
      spawnSource: prior.spawnSource,
      costDelta: prior.costDelta,
      tags: prior.tags,
      textOverride: prior.textOverride,
      counters: prior.counters,
    });
    expect(transformed.variantId).toBeUndefined();
    expect(transformed.powerLedger).toBe(prior.powerLedger);
    expect(result.state.stagedPlays).toEqual(state.stagedPlays);
    expect(result.events.map(({ type }) => type))
      .toEqual(['CARD_TRANSFORMED']);
  });

  it('resets definition-owned metadata without clearing Power history or lifecycle provenance', () => {
    const fixture = initialState({ powerDelta: 4, staged: true });
    const textOverride = {
      kind: 'BLANKED_TEXT' as const,
      abilities: {},
      rulesText: 'Blanked for transform proof.',
      copiedFrom: null,
    };
    const enriched = [
      {
        type: 'CARD_COST_CHANGED' as const,
        cardId: CARD_ID,
        delta: -1,
        cause: CAUSE,
      },
      {
        type: 'CARD_COUNTER_CHANGED' as const,
        cardId: CARD_ID,
        name: 'charges',
        delta: 2,
        cause: CAUSE,
      },
      {
        type: 'CARD_TEXT_OVERRIDDEN' as const,
        cardId: CARD_ID,
        override: textOverride,
        cause: CAUSE,
      },
    ].reduce(
      (candidate, event) => apply(candidate, event, fixture.manifest),
      fixture.state,
    );
    const prior = getCardState(enriched, CARD_ID)!;
    const result = runTransform(
      enriched,
      fixture.manifest,
      command('RESET_TO_DEFINITION'),
    );
    const transformed = getCardState(result.state, CARD_ID)!;

    expect(result.events.map(({ type }) => type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_TRANSFORMED',
    ]);
    expect(transformed).toMatchObject({
      id: prior.id,
      defId: 'transform-new-a',
      owner: prior.owner,
      zone: prior.zone,
      lane: prior.lane,
      revealed: prior.revealed,
      revealTiming: prior.revealTiming,
      lifecycle: prior.lifecycle,
      spawnSource: prior.spawnSource,
      costDelta: 0,
      costLog: [],
      tags: [],
      textOverride: null,
      textLog: [],
      counters: {},
    });
    expect(transformed.variantId).toBeUndefined();
    expect(transformed.powerLedger).not.toBe(prior.powerLedger);
    expect(transformed.powerLedger).toHaveLength(prior.powerLedger.length + 1);
    expect(transformed.powerLedger.slice(0, -1))
      .toEqual(prior.powerLedger);
    expect(result.state.stagedPlays).toEqual(enriched.stagedPlays);
  });

  it('fixes client-scoped deterministic selection before the command and replays the committed batch', () => {
    const { state, manifest: gameManifest } = initialState();
    const effect: EffectExpr = {
      kind: 'TRANSFORM_CARD',
      target: { kind: 'SELF' },
      pool: {
        kind: 'DEF_ID_LIST',
        ids: ['transform-new-a', 'transform-new-b'],
      },
      metadataPolicy: 'PRESERVE',
    };
    const first = executeEffectForTest(
      state,
      effect,
      evaluatorContext(state, CARD_ID, gameManifest),
      gameManifest,
    );
    const second = executeEffectForTest(
      state,
      effect,
      evaluatorContext(state, CARD_ID, gameManifest),
      gameManifest,
    );

    expect(second.events).toEqual(first.events);
    expect(second.state).toEqual(first.state);
    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      type: 'CARD_TRANSFORMED',
      newDefId: expect.stringMatching(/^transform-new-[ab]$/),
    });
    expect(first.state.rng).toEqual(state.rng);

    const fixed = runTransform(
      state,
      gameManifest,
      command('PRESERVE', 'transform-new-a'),
    );
    expect(fixed.events[0]).toMatchObject({
      type: 'CARD_TRANSFORMED',
      newDefId: 'transform-new-a',
    });

    const live = frameAndFoldEvents({
      transactionId: 'transform:live',
      initialState: state,
      events: first.events,
      manifest: gameManifest,
    });
    const replay = foldCanonicalFrames({
      transactionId: 'transform:replay',
      initialState: state,
      frames: live.frames,
      manifest: gameManifest,
    });
    expect(live.finalState).toEqual(first.state);
    expect(replay.finalState).toEqual(live.finalState);
  });

  it('gives evaluator-authored and built-in transform clients identical semantics', () => {
    const { state, manifest: gameManifest } = initialState({
      includeSource: true,
      powerDelta: 4,
    });
    const directEffect: EffectExpr = {
      kind: 'TRANSFORM_CARD',
      target: {
        kind: 'SAME_LANE',
        of: { kind: 'SELF' },
        ownerFilter: 'ANY_OWNER',
        exclude: { kind: 'SELF' },
      },
      pool: { kind: 'DEF_ID_LIST', ids: ['transform-new-a'] },
      metadataPolicy: 'RESET_TO_DEFINITION',
    };
    const direct = executeEffectForTest(
      state,
      directEffect,
      evaluatorContext(state, SOURCE_ID, gameManifest),
      gameManifest,
    );
    const builtin = executeEffectForTest(
      state,
      { kind: 'CALL_BUILTIN', fn: 'SOCIAL_WORKER', args: {} },
      evaluatorContext(state, SOURCE_ID, gameManifest),
      gameManifest,
    );

    expect(builtin.events).toEqual(direct.events);
    expect(builtin.events.map(({ type }) => type)).toEqual([
      'CARD_POWER_CHANGED',
      'CARD_TRANSFORMED',
    ]);
    expect(getCardState(builtin.state, CARD_ID))
      .toEqual(getCardState(direct.state, CARD_ID));
  });
});
