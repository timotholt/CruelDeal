import { describe, expect, it } from 'vitest';

import type { LocationCardDef, Manifest } from '../../manifest/types';
import {
  buildRuntimeFixture,
  testCardDef,
  testLocationDef,
  testManifest,
} from '../../testkit/runtimeFixture';
import type { EffectRef } from '../../types/ability';
import type { CardId, LocationCardInstanceId } from '../../types/ids';
import type { MatchState } from '../../types/state';
import { KernelInvariantError } from '../failure';
import { kernelStepFailure } from '../kernel';
import {
  resolveRulesTransaction,
  type RulesTransactionOptions,
} from '../rulesTransaction';
import type { StagePlayCommand } from '../types';

const CARD_ID = 'card:staged' as CardId;
const CAUSE: EffectRef = {
  sourceId: CARD_ID,
  effectKind: 'SYSTEM',
  reason: 'PLAYER_STAGE_INTENT',
};

function cryobank(): LocationCardDef {
  return {
    ...testLocationDef('cryobank'),
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
      onCardEnteredHere: [{
        kind: 'ADD_POWER',
        target: { kind: 'EVENT_CARD' },
        delta: { kind: 'LIT', n: 99 },
      }],
    },
  };
}

function fixture(options: {
  readonly cost?: number;
  readonly energy?: number;
  readonly delayed?: boolean;
  readonly laneCards?: number;
  readonly phase?: MatchState['phase'];
} = {}) {
  const delayed = options.delayed ?? false;
  const location = cryobank();
  const card = testCardDef('staged-card', { cost: options.cost ?? 2 });
  const fillers = Array.from(
    { length: options.laneCards ?? 0 },
    (_, index) => ({
      id: `card:filler:${index}`,
      defId: 'filler',
      revealed: true,
    }),
  );
  const manifest = testManifest(
    [card, testCardDef('filler')],
    delayed ? [location] : [],
  );
  const state = buildRuntimeFixture({
    seed: 'governed-staged-play',
    localSeat: 'P0',
    turn: 3,
    phase: options.phase ?? 'AWAITING_INTENT',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: {
      P0: [{ id: CARD_ID, defId: card.defId }],
      P1: [],
    },
    lanes: [
      { P0: fillers, P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: delayed
      ? [{
          id: 'location:cryobank',
          defId: location.defId,
          revealed: true,
        }, null, null]
      : [null, null, null],
    energy: { P0: options.energy ?? 3, P1: 3 },
  }).state;
  return { manifest, state };
}

function command(
  overrides: Partial<StagePlayCommand> = {},
): StagePlayCommand {
  return {
    type: 'STAGE_PLAY',
    intentId: 'intent:stage',
    owner: 'P0',
    cardId: CARD_ID,
    lane: 0,
    cause: CAUSE,
    ...overrides,
  };
}

function run(
  state: MatchState,
  manifest: Manifest,
  stage: StagePlayCommand = command(),
  overrides: Partial<RulesTransactionOptions> = {},
) {
  return resolveRulesTransaction(state, [stage], {
    manifest,
    baseDepth: 0,
    expandEffect: () => kernelStepFailure({
      code: 'INVALID_OPERATION_OUTPUT',
      message: 'Staged-play fixture expects no authored effect.',
    }),
    ...overrides,
  });
}

describe('governed staged play', () => {
  it('commits the exact stage, payment, and default timing trace', () => {
    const { manifest, state } = fixture();
    const result = run(state, manifest);

    expect(result.events).toEqual([
      {
        type: 'CARD_STAGED',
        intentId: 'intent:stage',
        owner: 'P0',
        cardId: CARD_ID,
        lane: 0,
        energyPaid: 2,
        cause: CAUSE,
      },
      {
        type: 'ENERGY_CHANGED',
        owner: 'P0',
        delta: -2,
        reason: 'CARD_PLAYED',
        cause: {
          sourceId: CARD_ID,
          effectKind: 'SYSTEM',
          reason: 'CARD_STAGE_ENERGY_SPEND',
        },
      },
      {
        type: 'CARD_REVEAL_SCHEDULED',
        cardId: CARD_ID,
        timing: { kind: 'TURN', turn: 3 },
        cause: {
          sourceId: CARD_ID,
          effectKind: 'SYSTEM',
          reason: 'CARD_STAGE_DEFAULT_REVEAL_TIMING',
        },
      },
    ]);
    expect(result.state.energy.P0).toBe(1);
    expect(result.state.hand.P0).toEqual([]);
    expect(result.state.lanesById[0]?.cards.P0).toEqual([CARD_ID]);
    expect(result.state.stagedPlays).toEqual([{
      cardId: CARD_ID,
      energyPaid: 2,
    }]);
    expect(result.transitions[0]?.semantics).toMatchObject({
      transitionKind: 'CARD_STAGED_FROM_HAND',
      cause: CAUSE,
    });
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: 'CARD_POWER_CHANGED' }),
    );
  });

  it('resolves a lane-scoped timing policy only after candidate placement', () => {
    const { manifest, state } = fixture({ delayed: true });
    const result = run(state, manifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(result.events[2]).toEqual({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: CARD_ID,
      timing: { kind: 'END_OF_GAME' },
      cause: {
        sourceId: 'location:cryobank' as LocationCardInstanceId,
        effectKind: 'LOCATION',
        reason: 'REVEAL_TIMING_OVERRIDE',
      },
    });
    expect(result.state.stagedPlays).toHaveLength(1);
  });

  it('records a zero-cost play as the same exact three-event trace', () => {
    const { manifest, state } = fixture({ cost: 0, energy: 0 });
    const result = run(state, manifest);

    expect(result.events.map(event => event.type)).toEqual([
      'CARD_STAGED',
      'ENERGY_CHANGED',
      'CARD_REVEAL_SCHEDULED',
    ]);
    expect(result.events[0]).toMatchObject({ energyPaid: 0 });
    expect(result.events[1]).toMatchObject({ delta: 0 });
    expect(result.transitions[1]?.semantics).toMatchObject({
      transitionKind: 'CURRENT_ENERGY_PAYMENT_RECORDED',
      signedChange: 0,
    });
  });

  it('rejects invalid phase, ownership, placement, capacity, Energy, and play policy', () => {
    const blocked = fixture({ delayed: true });
    const blockedLocation = blocked.manifest.locations.cryobank!;
    const blockedManifest: Manifest = {
      ...blocked.manifest,
      locations: {
        cryobank: {
          ...blockedLocation,
          abilities: {
            ongoing: [{
              kind: 'BLOCK_PLAY',
              ownerFilter: 'ANY_OWNER',
              laneOf: { kind: 'SELF' },
              stack: 'SINGLE',
            }],
          },
        },
      },
    };
    const cases: readonly {
      readonly state: MatchState;
      readonly manifest: Manifest;
      readonly command?: StagePlayCommand;
    }[] = [
      { ...fixture({ phase: 'RESOLVING' }) },
      {
        ...fixture(),
        command: command({ owner: 'P1' }),
      },
      {
        ...fixture(),
        command: command({ lane: 9 }),
      },
      { ...fixture({ laneCards: 4 }) },
      { ...fixture({ cost: 2, energy: 1 }) },
      {
        state: blocked.state,
        manifest: blockedManifest,
      },
    ];

    for (const candidate of cases) {
      const snapshot = structuredClone(candidate.state);
      expect(() => run(
        candidate.state,
        candidate.manifest,
        candidate.command ?? command(),
      )).toThrow(KernelInvariantError);
      expect(candidate.state).toEqual(snapshot);
    }
  });

  it('rolls back the whole transaction under tight event and work budgets', () => {
    for (const budget of [
      {
        maxWorkItems: 100,
        maxEvents: 2,
        maxReactions: 100,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
      {
        maxWorkItems: 6,
        maxEvents: 10,
        maxReactions: 100,
        maxEffectDepth: 10,
        maxCreatedEntities: 10,
      },
    ]) {
      const { manifest, state } = fixture();
      const snapshot = structuredClone(state);
      expect(() => run(state, manifest, command(), { budget }))
        .toThrow(KernelInvariantError);
      expect(state).toEqual(snapshot);
      expect(state.hand.P0).toEqual([CARD_ID]);
      expect(state.energy.P0).toBe(3);
    }
  });

  it('copies caller payloads into immutable event and semantic snapshots', () => {
    const { manifest, state } = fixture();
    const mutableCause = {
      sourceId: CARD_ID,
      effectKind: 'SYSTEM',
      reason: 'ORIGINAL_STAGE_CAUSE',
    } as EffectRef;
    const stage = command({ cause: mutableCause });
    const result = run(state, manifest, stage);
    (mutableCause as { reason: string }).reason = 'MUTATED_AFTER_RESOLUTION';

    expect(result.events[0]).toMatchObject({
      cause: { reason: 'ORIGINAL_STAGE_CAUSE' },
    });
    expect(result.transitions[0]?.semantics).toMatchObject({
      cause: { reason: 'ORIGINAL_STAGE_CAUSE' },
    });
  });
});
