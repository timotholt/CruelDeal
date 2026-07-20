import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { executeRulesCommands } from '../effects/evaluator';
import { getStoredCardPowerDelta } from '../powerLedger';
import { createRng } from '../rng';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../testkit/runtimeFixture';
import type { EffectExpr } from '../types/ability';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import { getCardRuntime } from '../projections/cardRuntime';
import { getLocationState } from '../projections/locationRuntime';
import { KernelInvariantError } from './failure';
import { kernelStepSuccess } from './kernel';
import {
  resolveRulesTransaction,
  type CanonicalEffectContext,
  type CanonicalRulesWork,
} from './rulesTransaction';

const LOCATION_ID = 'location-reactor' as LocationCardInstanceId;
const SOURCE_CARD_ID = 'topology-card' as CardId;
const kernelRoot = dirname(fileURLToPath(import.meta.url));

const CREATE_EFFECT: EffectExpr = {
  kind: 'CREATE_CARD_IN_ZONE',
  pool: { kind: 'DEF_ID_LIST', ids: ['spawn'] },
  owner: 'P0',
  destination: {
    kind: 'LANE',
    lane: { kind: 'SELF' },
    revealed: true,
  },
};

const RETRIGGER_EFFECT: EffectExpr = {
  kind: 'TRIGGER_ON_REVEAL',
  target: {
    kind: 'ALL_CARDS',
    ownerFilter: 'ANY_OWNER',
    zoneFilter: 'LANE',
  },
};

const NESTED_CONTROL_FLOW_EFFECT: EffectExpr = {
  kind: 'SEQUENCE',
  items: [{
    kind: 'CONDITIONAL',
    if: { kind: 'TRUE' },
    then: [{
      kind: 'FOREACH',
      over: {
        kind: 'ALL_CARDS',
        ownerFilter: 'ANY_OWNER',
        zoneFilter: 'LANE',
      },
      do: [{
        kind: 'ADD_POWER',
        target: { kind: 'SELF' },
        delta: { kind: 'LIT', n: 1 },
      }],
    }],
  }],
};

function locationRevealState(
  locationEffect: EffectExpr,
  cardEffect?: EffectExpr,
) {
  const cards = cardEffect === undefined
    ? [testCardDef('spawn')]
    : [
        testCardDef('topology-card', { onReveal: [cardEffect] }),
        testCardDef('spawn'),
      ];
  const manifest = testManifest(cards, [
    testLocationDef('reactor', [locationEffect]),
    testLocationDef('quiet'),
    testLocationDef('ruin'),
  ]);
  const state = buildRuntimeFixture({
    seed: 'location-domain-atomicity',
    localSeat: 'P0',
    turn: 2,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      {
        P0: cardEffect === undefined
          ? []
          : [{
              id: SOURCE_CARD_ID,
              defId: 'topology-card',
              revealed: true,
            }],
        P1: [],
      },
      { P0: [], P1: [] },
    ],
    locations: [
      { id: 'quiet-left', defId: 'quiet', revealed: true },
      { id: LOCATION_ID, defId: 'reactor', revealed: false },
      { id: 'quiet-right', defId: 'quiet', revealed: true },
    ],
  }).state;
  return { manifest, state };
}

function revealLocationCommand() {
  return {
    type: 'REVEAL_LOCATION' as const,
    lane: 1,
    locationId: LOCATION_ID,
    cause: {
      sourceId: LOCATION_ID,
      effectKind: 'SYSTEM' as const,
      reason: 'ATOMICITY_TEST',
    },
  };
}

function expectKernelFailure(
  action: () => unknown,
  expected: KernelInvariantError['failure'],
): KernelInvariantError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(KernelInvariantError);
    const kernelError = error as KernelInvariantError;
    expect(kernelError.failure).toEqual(expected);
    return kernelError;
  }
  throw new Error('Expected the rules transaction to fail.');
}

describe('C5A-4 location-domain atomicity regressions', () => {
  it('rolls back the location reveal and created card when the shared entity budget is zero', () => {
    const { manifest, state } = locationRevealState(CREATE_EFFECT);
    const originalState = structuredClone(state);

    expectKernelFailure(() => resolveRulesTransaction(
        state,
        [revealLocationCommand()],
        {
          manifest,
          baseDepth: 0,
          budget: {
            maxWorkItems: 100,
            maxEvents: 100,
            maxReactions: 100,
            maxEffectDepth: 20,
            maxCreatedEntities: 0,
          },
          expandEffect: (_candidate, effect, context) => {
            const authored = effect.kind === 'AUTHORED'
              ? effect.effect
              : effect;
            if (authored.kind !== 'CREATE_CARD_IN_ZONE') {
              return kernelStepSuccess({ work: [] });
            }
            const work: CanonicalRulesWork[] = [{
              kind: 'COMMAND',
              command: {
                type: 'CREATE_CARD',
                cardId: 'spawned-by-location' as CardId,
                defId: 'spawn',
                owner: 'P0',
                depth: context.depth + 1,
                destination: {
                  kind: 'LANE',
                  lane: 1,
                  revealed: true,
                },
                spawnSource: { kind: 'SYSTEM' },
                cause: { ...context.source },
              },
            }];
            return kernelStepSuccess({ work });
          },
        },
      ),
    {
      kind: 'KERNEL_FAILURE',
      code: 'BUDGET_EXCEEDED',
      message: 'Kernel entity budget exceeded (0).',
      workItemsConsumed: 4,
      eventsProduced: 1,
      reactionsScheduled: 1,
    });

    expect(state).toEqual(originalState);
    expect(getLocationState(state, LOCATION_ID)?.face).toBe('FACE_DOWN');
    expect(getLocationState(state, LOCATION_ID)?.revealCount).toBe(0);
    expect(getCardRuntime(
      state,
      'spawned-by-location' as CardId,
      manifest,
    )).toBeNull();
    expect(state.lanesById[1].cards.P0).toEqual([]);
  });

  it('rolls back a location-to-card-retrigger-to-topology chain under one tight work budget', () => {
    const { manifest, state } = locationRevealState(
      RETRIGGER_EFFECT,
      { kind: 'DESTROY_OTHER_LANES' },
    );
    const originalState = structuredClone(state);

    expectKernelFailure(() => resolveRulesTransaction(
        state,
        [revealLocationCommand()],
        {
          manifest,
          baseDepth: 0,
          budget: {
            maxWorkItems: 4,
            maxEvents: 100,
            maxReactions: 100,
            maxEffectDepth: 20,
            maxCreatedEntities: 20,
          },
          expandEffect: (_candidate, effect, context) => {
            const authored = effect.kind === 'AUTHORED'
              ? effect.effect
              : effect;
            if (authored.kind === 'TRIGGER_ON_REVEAL') {
              const cardEffect = manifest.cards['topology-card']
                ?.abilities.onReveal?.[0];
              const cardContext: CanonicalEffectContext = {
                ...context,
                self: SOURCE_CARD_ID,
                selfKind: 'card',
                selfLane: 1,
                selfOwner: 'P0',
                eventCard: SOURCE_CARD_ID,
                eventLane: 1,
                eventOwner: 'P0',
                depth: context.depth + 1,
                scopePath: [...context.scopePath, 'retrigger:topology-card'],
              };
              return kernelStepSuccess({
                work: cardEffect === undefined
                  ? []
                  : [{
                      kind: 'EFFECT',
                      effect: cardEffect,
                      context: cardContext,
                      depth: cardContext.depth,
                    }],
              });
            }
            if (authored.kind === 'DESTROY_OTHER_LANES') {
              return kernelStepSuccess({
                work: [{
                  kind: 'COMMAND',
                  command: {
                    type: 'DESTROY_OTHER_LANES',
                    survivor: 1,
                    cause: { ...context.source },
                  },
                }],
              });
            }
            return kernelStepSuccess({ work: [] });
          },
        },
      ),
    {
      kind: 'KERNEL_FAILURE',
      code: 'BUDGET_EXCEEDED',
      message: 'Kernel work-item budget exceeded (4).',
      workItemsConsumed: 4,
      eventsProduced: 1,
      reactionsScheduled: 1,
    });

    expect(state).toEqual(originalState);
    expect(getLocationState(state, LOCATION_ID)?.face).toBe('FACE_DOWN');
    expect(getLocationState(state, LOCATION_ID)?.revealCount).toBe(0);
    expect(state.activeLaneOrder).toEqual([0, 1, 2]);
    expect(state.lanesById[0].status).toBe('ACTIVE');
    expect(state.lanesById[2].status).toBe('ACTIVE');
    expect(getCardRuntime(state, SOURCE_CARD_ID, manifest)?.zone).toBe('LANE');
  });

  it('gives location and card sources identical nested control-flow semantics', () => {
    const peerId = 'peer-card' as CardId;
    const manifest = testManifest([
      testCardDef('topology-card', {
        onReveal: [NESTED_CONTROL_FLOW_EFFECT],
      }),
      testCardDef('peer-card'),
    ], [
      testLocationDef('reactor', [NESTED_CONTROL_FLOW_EFFECT]),
      testLocationDef('quiet'),
    ]);
    const state = buildRuntimeFixture({
      seed: 'location-card-control-flow-parity',
      localSeat: 'P0',
      turn: 2,
      phase: 'AWAITING_INTENT',
      priority: 'P0',
      decks: { P0: [], P1: [] },
      hands: { P0: [], P1: [] },
      lanes: [
        { P0: [], P1: [] },
        {
          P0: [
            {
              id: SOURCE_CARD_ID,
              defId: 'topology-card',
              revealed: true,
            },
            { id: peerId, defId: 'peer-card', revealed: true },
          ],
          P1: [],
        },
        { P0: [], P1: [] },
      ],
      locations: [
        { id: 'quiet-left', defId: 'quiet', revealed: true },
        { id: LOCATION_ID, defId: 'reactor', revealed: false },
        { id: 'quiet-right', defId: 'quiet', revealed: true },
      ],
    }).state;
    const locationResult = executeRulesCommands(
      state,
      [revealLocationCommand()],
      { rng: createRng('location-control-flow') },
      manifest,
    );
    const cardResult = executeRulesCommands(
      state,
      [{
        type: 'INVOKE_ON_REVEAL',
        cardId: SOURCE_CARD_ID,
        reason: 'RETRIGGER',
        depth: 0,
        cause: {
          sourceId: SOURCE_CARD_ID,
          effectKind: 'ON_REVEAL',
          reason: 'CONTROL_FLOW_PARITY',
        },
      }],
      { rng: createRng('card-control-flow') },
      manifest,
    );
    const powerTrace = (
      events: typeof locationResult.events,
    ) => events.flatMap(event =>
      event.type === 'CARD_POWER_CHANGED'
        ? [{ cardId: event.cardId, mutation: event.mutation }]
        : [],
    );

    expect(powerTrace(locationResult.events)).toEqual([
      { cardId: SOURCE_CARD_ID, mutation: { kind: 'ADD', delta: 1 } },
      { cardId: peerId, mutation: { kind: 'ADD', delta: 1 } },
    ]);
    expect(powerTrace(cardResult.events)).toEqual(
      powerTrace(locationResult.events),
    );
    for (const cardId of [SOURCE_CARD_ID, peerId]) {
      expect(getStoredCardPowerDelta(
        locationResult.state,
        cardId,
        manifest,
      )).toBe(1);
      expect(getStoredCardPowerDelta(
        cardResult.state,
        cardId,
        manifest,
      )).toBe(1);
    }
  });
});

describe('C5A-4 location-domain authored-expansion source fence', () => {
  it('does not escape the shared queue through evaluators, command wrappers, or public transactions', () => {
    const evaluatorPath = resolve(kernelRoot, '../effects/evaluator.ts');
    const source = readFileSync(evaluatorPath, 'utf8');
    const start = source.indexOf('function expandCanonicalAuthoredEffect(');
    const end = source.indexOf(
      '\nfunction placementRng(',
      start,
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const expansionSource = source.slice(start, end);
    const forbidden = [
      {
        label: 'evalEffect',
        pattern: /\bevalEffect\s*\(/g,
      },
      {
        label: 'execute*Commands',
        pattern: /\bexecute[A-Za-z0-9_]*Commands\s*\(/g,
      },
      {
        label: 'resolve*Transaction',
        pattern: /\bresolve[A-Za-z0-9_]*Transaction\s*\(/g,
      },
    ];
    const violations = forbidden.flatMap(({ label, pattern }) =>
      [...expansionSource.matchAll(pattern)].map(match =>
        `${label} at expansion offset ${match.index ?? -1}`,
      ),
    );

    expect(violations).toEqual([]);
  });
});
