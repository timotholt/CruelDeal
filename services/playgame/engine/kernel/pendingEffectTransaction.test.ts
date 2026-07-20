import { describe, expect, it } from 'vitest';

import { executeRulesCommands } from '../effects/rulesInterpreter';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { createRng } from '../rng';
import { frameAndFoldEvents, foldFramedEvents } from '../transactionTimeline';
import { buildRuntimeFixture } from '../testkit/runtimeFixture';
import type { EffectRef } from '../types/ability';
import type { CardId, PendingEffectId } from '../types/ids';
import type {
  MatchState,
  PendingEffectPayload,
} from '../types/state';
import {
  DEFAULT_RESOLUTION_BUDGET,
  type ResolutionBudget,
} from './contracts';
import { KernelInvariantError } from './failure';
import {
  type PendingEffectCommand,
} from './pendingEffectTransaction';

const CAUSE: EffectRef = {
  sourceId: 'pending-source' as CardId,
  effectKind: 'ON_REVEAL',
  reason: 'PENDING_TRANSACTION_TEST',
};

function payload(
  overrides: Partial<PendingEffectPayload> = {},
): PendingEffectPayload {
  return {
    kind: 'SCHEDULED',
    when: 'START_OF_NEXT_TURN',
    sourceId: 'pending-source' as CardId,
    sourceOwner: 'P0',
    sourceLane: 0,
    fireTurn: 5,
    effect: { kind: 'SEQUENCE', items: [] },
    ...overrides,
  };
}

function fixture(): MatchState {
  return buildRuntimeFixture({
    seed: 'pending-effect-transaction',
    localSeat: 'P0',
    turn: 4,
    phase: 'RESOLVING',
    priority: 'P0',
    decks: { P0: [], P1: [] },
    hands: { P0: [], P1: [] },
    lanes: [
      { P0: [], P1: [] },
      { P0: [], P1: [] },
      { P0: [], P1: [] },
    ],
    locations: [null, null, null],
  }).state;
}

function executePendingCommands(
  state: MatchState,
  commands: readonly PendingEffectCommand[],
  budget?: ResolutionBudget,
) {
  return executeRulesCommands(
    state,
    commands,
    {
      rng: createRng('pending-effect-transaction-test'),
      ...(budget === undefined ? {} : { budget }),
    },
    BOOTSTRAP_MANIFEST,
  );
}

function schedule(effect = payload(), state = fixture()) {
  return executePendingCommands(state, [{
    type: 'SCHEDULE_PENDING_EFFECT',
    effect,
    cause: CAUSE,
  }]);
}

function consume(
  state: MatchState,
  pendingEffectId: PendingEffectId,
  mode: 'EXECUTE' | 'CANCEL' = 'CANCEL',
) {
  return executePendingCommands(state, [{
    type: 'CONSUME_PENDING_EFFECT',
    pendingEffectId,
    mode,
    cause: CAUSE,
  }]);
}

describe('pending-effect kernel transaction', () => {
  it('allocates deterministic distinct IDs for identical payloads and folds the candidate sequence', () => {
    const effect = payload();
    const result = executePendingCommands(fixture(), [
      { type: 'SCHEDULE_PENDING_EFFECT', effect, cause: CAUSE },
      { type: 'SCHEDULE_PENDING_EFFECT', effect, cause: CAUSE },
    ]);

    expect(result.events.map(event =>
      event.type === 'PENDING_EFFECT_SCHEDULED' ? event.effect.id : null))
      .toEqual(['pending:0', 'pending:1']);
    expect(result.state.pendingEffects.map(item => item.id))
      .toEqual(['pending:0', 'pending:1']);
    expect(result.state.nextPendingEffectSequence).toBe(2);
    expect(result.transitions.map(({ semantics }) => semantics))
      .toMatchObject([
        {
          transitionKind: 'PENDING_SCHEDULED',
          priorSequence: 0,
          resultSequence: 1,
        },
        {
          transitionKind: 'PENDING_SCHEDULED',
          priorSequence: 1,
          resultSequence: 2,
        },
      ]);

    const repeated = executePendingCommands(fixture(), [
      { type: 'SCHEDULE_PENDING_EFFECT', effect, cause: CAUSE },
      { type: 'SCHEDULE_PENDING_EFFECT', effect, cause: CAUSE },
    ]);
    expect(repeated.events).toEqual(result.events);
    expect(repeated.state).toEqual(result.state);
  });

  it('snapshots caller-owned payload and provenance objects', () => {
    const mutableItems: PendingEffectPayload['effect'][] = [];
    const mutableEffect = {
      kind: 'SCHEDULED' as const,
      when: 'START_OF_NEXT_TURN' as const,
      sourceId: 'pending-source' as CardId,
      sourceOwner: 'P0' as const,
      sourceLane: 0,
      fireTurn: 5,
      effect: { kind: 'SEQUENCE' as const, items: mutableItems },
    };
    const mutableCause = { ...CAUSE };
    const result = executePendingCommands(fixture(), [{
      type: 'SCHEDULE_PENDING_EFFECT',
      effect: mutableEffect,
      cause: mutableCause,
    }]);

    mutableItems.push({ kind: 'SEQUENCE', items: [] });
    mutableCause.reason = 'MUTATED_AFTER_SCHEDULE';

    expect(result.state.pendingEffects[0]).toMatchObject({
      id: 'pending:0',
      effect: { kind: 'SEQUENCE', items: [] },
      scheduledBy: { reason: 'PENDING_TRANSACTION_TEST' },
    });
    expect(result.events[0]).toMatchObject({
      cause: { reason: 'PENDING_TRANSACTION_TEST' },
    });
  });

  it('consumes only the exact ID and makes missing or repeated consumption an exact no-op', () => {
    const scheduled = executePendingCommands(fixture(), [
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload(),
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload(),
        cause: CAUSE,
      },
    ]);
    const firstId = scheduled.state.pendingEffects[0]!.id;
    const secondId = scheduled.state.pendingEffects[1]!.id;
    const consumed = consume(scheduled.state, firstId);

    expect(consumed.events).toEqual([{
      type: 'PENDING_EFFECT_CONSUMED',
      pendingEffectId: firstId,
      cause: CAUSE,
    }]);
    expect(consumed.state.pendingEffects.map(effect => effect.id))
      .toEqual([secondId]);
    expect(consumed.state.nextPendingEffectSequence).toBe(2);

    const repeated = consume(consumed.state, firstId);
    expect(repeated.events).toEqual([]);
    expect(repeated.state).toBe(consumed.state);

    const missing = consume(
      consumed.state,
      'pending:999' as PendingEffectId,
    );
    expect(missing.events).toEqual([]);
    expect(missing.state).toBe(consumed.state);
  });

  it('can schedule and consume the newly allocated ID in one candidate transaction', () => {
    const result = executePendingCommands(fixture(), [
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload(),
        cause: CAUSE,
      },
      {
        type: 'CONSUME_PENDING_EFFECT',
        pendingEffectId: 'pending:0' as PendingEffectId,
        mode: 'CANCEL',
        cause: CAUSE,
      },
    ]);

    expect(result.events.map(event => event.type)).toEqual([
      'PENDING_EFFECT_SCHEDULED',
      'PENDING_EFFECT_CONSUMED',
    ]);
    expect(result.state.pendingEffects).toEqual([]);
    expect(result.state.nextPendingEffectSequence).toBe(1);
  });

  it('commits consumption before executing the frozen authored effect', () => {
    const scheduled = schedule(payload({
      effect: {
        kind: 'ADJUST_ENERGY',
        owner: 'P0',
        delta: { kind: 'LIT', n: 2 },
      },
    }));
    const id = scheduled.state.pendingEffects[0]!.id;
    const result = consume(scheduled.state, id, 'EXECUTE');

    expect(result.events.map(event => event.type))
      .toEqual(['PENDING_EFFECT_CONSUMED', 'ENERGY_CHANGED']);
    expect(result.state.pendingEffects).toEqual([]);
    expect(result.state.energy.P0).toBe(scheduled.state.energy.P0 + 2);
  });

  it('does not execute the frozen authored effect for cancellation', () => {
    const scheduled = schedule(payload({
      effect: {
        kind: 'ADJUST_ENERGY',
        owner: 'P0',
        delta: { kind: 'LIT', n: 2 },
      },
    }));
    const result = consume(
      scheduled.state,
      scheduled.state.pendingEffects[0]!.id,
      'CANCEL',
    );
    expect(result.events.map(event => event.type))
      .toEqual(['PENDING_EFFECT_CONSUMED']);
    expect(result.state.pendingEffects).toEqual([]);
    expect(result.state.energy).toEqual(scheduled.state.energy);
  });

  it('rejects duplicate allocation and unsafe sequence exhaustion atomically', () => {
    const first = schedule();
    const duplicateAllocator = {
      ...first.state,
      nextPendingEffectSequence: 0,
    };
    expect(() => schedule(payload(), duplicateAllocator))
      .toThrow(KernelInvariantError);
    expect(duplicateAllocator.pendingEffects).toEqual(first.state.pendingEffects);
    expect(duplicateAllocator.nextPendingEffectSequence).toBe(0);

    const exhausted = {
      ...fixture(),
      nextPendingEffectSequence: Number.MAX_SAFE_INTEGER,
    };
    expect(() => schedule(payload(), exhausted)).toThrow(KernelInvariantError);
    expect(exhausted.pendingEffects).toEqual([]);
    expect(exhausted.nextPendingEffectSequence)
      .toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rolls back private consumption on work-budget failure', () => {
    const scheduled = schedule();
    const id = scheduled.state.pendingEffects[0]!.id;
    expect(() => executePendingCommands(scheduled.state, [{
      type: 'CONSUME_PENDING_EFFECT',
      pendingEffectId: id,
      mode: 'EXECUTE',
      cause: CAUSE,
    }], {
        ...DEFAULT_RESOLUTION_BUDGET,
        maxWorkItems: 1,
      })).toThrow(KernelInvariantError);
    expect(scheduled.state.pendingEffects.map(item => item.id)).toEqual([id]);
  });

  it('preserves stable IDs, payload, cause, and allocator through framed replay', () => {
    const state = fixture();
    const transaction = executePendingCommands(state, [
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload(),
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload({ when: 'END_OF_NEXT_TURN' }),
        cause: CAUSE,
      },
      {
        type: 'CONSUME_PENDING_EFFECT',
        pendingEffectId: 'pending:0' as PendingEffectId,
        mode: 'CANCEL',
        cause: CAUSE,
      },
    ]);
    const live = frameAndFoldEvents({
      transactionId: 'pending:live',
      initialState: state,
      events: transaction.events,
      manifest: BOOTSTRAP_MANIFEST,
    });
    const replay = foldFramedEvents({
      transactionId: 'pending:replay',
      initialState: state,
      framedEvents: live.framedEvents,
      manifest: BOOTSTRAP_MANIFEST,
    });

    expect(live.finalState).toEqual(transaction.state);
    expect(replay.finalState).toEqual(live.finalState);
    expect(replay.finalState.pendingEffects.map(effect => effect.id))
      .toEqual(['pending:1']);
    expect(replay.finalState.nextPendingEffectSequence).toBe(2);
  });

  it('validates source context, timing, and provenance without partial publication', () => {
    const state = fixture();
    const invalidCommands: PendingEffectCommand[] = [
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload({ sourceId: '' as CardId }),
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload({ fireTurn: -1 }),
        cause: CAUSE,
      },
      {
        type: 'SCHEDULE_PENDING_EFFECT',
        effect: payload(),
        cause: { ...CAUSE, reason: '' },
      },
    ];

    for (const command of invalidCommands) {
      expect(() => executePendingCommands(state, [command]))
        .toThrow(KernelInvariantError);
      expect(state.pendingEffects).toEqual([]);
      expect(state.nextPendingEffectSequence).toBe(0);
    }
  });
});
