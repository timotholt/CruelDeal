import { describe, expect, it } from 'vitest';
import { mkCardId } from '../types/ids';
import type { ChangeStoredPowerCommand, KernelWork } from './types';
import type { CanonicalEntityRef } from '../types/effectTrace';
import {
  assertKernelSuccess,
  kernelStepSuccess,
  resolveKernelTransaction,
  type KernelHandlers,
} from './kernel';

interface TestState {
  readonly total: number;
  readonly log: readonly string[];
}

interface TestEvent {
  readonly type: 'ADD';
  readonly amount: number;
  readonly label: string;
}

interface TestEffect {
  readonly type: 'EXPAND';
  readonly label: string;
  readonly work: readonly TestWork[];
}

interface TestSemantics {
  readonly eventType: 'ADD';
  readonly label: string;
}

type TestWork = KernelWork<
  ChangeStoredPowerCommand,
  TestEffect,
  Readonly<Record<string, never>>,
  TestEvent
>;

const cause = {
  sourceId: mkCardId('kernel-test-source'),
  effectKind: 'SYSTEM' as const,
  reason: 'KERNEL_FOUNDATION_TEST',
};

const commit = (label: string, amount = 1): TestWork => ({
  kind: 'COMMIT',
  event: { type: 'ADD', amount, label },
});

const resolvedCommit = (label: string, amount = 1): TestWork => ({
  kind: 'COMMIT',
  event: { type: 'ADD', amount, label },
  reactionPolicy: 'ALREADY_RESOLVED',
});

const effect = (label: string, work: readonly TestWork[]): TestWork => ({
  kind: 'EFFECT',
  effect: { type: 'EXPAND', label, work },
  context: {},
  depth: 0,
});

const command = (cardId: string, delta = 1): TestWork => ({
  kind: 'COMMAND',
  command: {
    type: 'CHANGE_STORED_POWER',
    cardId: mkCardId(cardId),
    mutation: { kind: 'ADD', delta },
    cause,
  },
});

function handlers(
  reactionFor: (
    transition: {
      readonly event: TestEvent;
      readonly semantics: TestSemantics;
    },
  ) => readonly {
    readonly source: Readonly<Record<string, unknown>>;
    readonly rule: Readonly<Record<string, unknown>>;
    readonly event: {
      readonly event: TestEvent;
      readonly semantics: TestSemantics;
    };
    readonly context: Readonly<Record<string, unknown>>;
    readonly order: {
      readonly timingBand: number;
      readonly prioritySeatRank: number;
      readonly laneOrdinal: number;
      readonly cardOrdinal: number;
      readonly ruleIndex: number;
      readonly sourceInstanceId: string;
    };
    readonly work: readonly TestWork[];
  }[] = () => [],
): KernelHandlers<
  TestState,
  TestWork,
  ChangeStoredPowerCommand,
  TestEffect,
  Readonly<Record<string, never>>,
  TestEvent,
  TestSemantics
> {
  return {
    executeCommand: (_state, item) =>
      kernelStepSuccess({
        work: [
          commit(
            `command:${item.command.cardId}`,
            item.command.mutation.kind === 'ADD'
              ? item.command.mutation.delta
              : 0,
          ),
        ],
      }),
    interpretEffect: (_state, item) =>
      kernelStepSuccess({ work: item.effect.work }),
    applyCandidate: (state, event) =>
      kernelStepSuccess({
        total: state.total + event.amount,
        log: [...state.log, event.label],
      }),
    captureSemantics: (_before, event, _after) =>
      kernelStepSuccess({ eventType: event.type, label: event.label }),
    collectReactions: (_before, _after, transition) =>
      kernelStepSuccess(reactionFor(transition)),
  };
}

const order = (timingBand: number, sourceInstanceId: string) => ({
  timingBand,
  prioritySeatRank: 0,
  laneOrdinal: 0,
  cardOrdinal: 0,
  ruleIndex: 0,
  sourceInstanceId,
});

const reaction = (
  transition: {
    readonly event: TestEvent;
    readonly semantics: TestSemantics;
  },
  timingBand: number,
  sourceInstanceId: string,
  work: readonly TestWork[],
) => ({
  source: { id: sourceInstanceId },
  rule: { index: 0 },
  event: transition,
  context: {},
  order: order(timingBand, sourceInstanceId),
  work,
});

describe('transactional rules kernel foundation', () => {
  it('records one ordered transcript for affected, blocked, and nested work', () => {
    const base = handlers();
    const entity = (id: string): CanonicalEntityRef => ({
      kind: 'CARD',
      cardId: mkCardId(id),
    });
    const traced: ReturnType<typeof handlers> = {
      ...base,
      interpretEffect: (_state, item) => kernelStepSuccess({
        work: item.effect.work,
        resolution: {
          kind: 'EFFECT_INVOCATION',
          source: entity(item.effect.label),
          ability: {
            kind: 'ON_REVEAL',
            ruleId: `rule:${item.effect.label}`,
            ruleIndex: 0,
          },
          invocationReason: item.effect.label === 'root'
            ? 'NATURAL'
            : 'REACTION',
          candidates: item.effect.work
            .filter(work => work.kind === 'COMMAND')
            .map(work => entity(String(work.command.cardId))),
        },
      }),
      executeCommand: (_state, item) => {
        const blocked = String(item.command.cardId) === 'blocked';
        return kernelStepSuccess({
          work: blocked
            ? []
            : [commit(`command:${item.command.cardId}`)],
          resolution: {
            kind: 'TARGET_ATTEMPT',
            operation: 'CHANGE_STORED_POWER',
            target: entity(String(item.command.cardId)),
            result: blocked ? 'BLOCKED' : 'AFFECTED',
            blockedBy: blocked ? [entity('blocker')] : [],
            reason: blocked ? 'CANNOT_GAIN_POWER' : null,
          },
        });
      },
    };
    const result = resolveKernelTransaction(
      {
        initialState: { total: 0, log: [] },
        initialWork: [
          effect('root', [
            command('affected'),
            command('blocked'),
            effect('child', [command('nested')]),
          ]),
        ],
      },
      traced,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.log).toEqual([
      'command:affected',
      'command:nested',
    ]);
    expect(result.value.resolutionSteps).toEqual([
      expect.objectContaining({
        transitionIndex: null,
        effect: expect.objectContaining({
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationOrdinal: 0,
          parentInvocationOrdinal: null,
        }),
      }),
      expect.objectContaining({
        transitionIndex: 0,
        effect: expect.objectContaining({
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 0,
          attemptOrdinal: 0,
          result: 'AFFECTED',
        }),
      }),
      expect.objectContaining({
        transitionIndex: null,
        effect: expect.objectContaining({
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 0,
          attemptOrdinal: 1,
          result: 'BLOCKED',
          reason: 'CANNOT_GAIN_POWER',
        }),
      }),
      expect.objectContaining({
        effect: expect.objectContaining({
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationOrdinal: 1,
          parentInvocationOrdinal: 0,
        }),
      }),
      expect.objectContaining({
        transitionIndex: 1,
        effect: expect.objectContaining({
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 1,
          attemptOrdinal: 0,
          result: 'AFFECTED',
        }),
      }),
      expect.objectContaining({
        effect: {
          kind: 'EFFECT_INVOCATION_COMPLETED',
          invocationOrdinal: 1,
          attempted: 1,
          affected: 1,
          blocked: 0,
          invalidated: 0,
          unchanged: 0,
        },
      }),
      expect.objectContaining({
        effect: {
          kind: 'EFFECT_INVOCATION_COMPLETED',
          invocationOrdinal: 0,
          attempted: 2,
          affected: 1,
          blocked: 1,
          invalidated: 0,
          unchanged: 0,
        },
      }),
    ]);
  });

  it('prepends nested work in declared depth-first order', () => {
    const initialWork = [
      effect('root', [
        effect('branch', [commit('branch-1'), commit('branch-2')]),
        commit('root-sibling'),
      ]),
    ];

    const result = resolveKernelTransaction(
      { initialState: { total: 0, log: [] }, initialWork },
      handlers((transition) =>
        transition.event.label === 'branch-1'
          ? [
              reaction(transition, 100, 'nested', [
                effect('reaction', [commit('nested-reaction')]),
              ]),
            ]
          : [],
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.log).toEqual([
      'branch-1',
      'nested-reaction',
      'branch-2',
      'root-sibling',
    ]);
    expect(result.value.transitions.map(({ event }) => event.label)).toEqual(
      result.value.state.log,
    );
  });

  it('discovers one smoke reaction once and schedules it by canonical order', () => {
    let smokeDiscoveryCount = 0;
    const result = resolveKernelTransaction(
      {
        initialState: { total: 0, log: [] },
        initialWork: [commit('parent')],
      },
      handlers((transition) => {
        if (transition.event.label !== 'parent') return [];
        smokeDiscoveryCount += 1;
        return [
          reaction(transition, 200, 'later', [commit('later')]),
          reaction(transition, 100, 'smoke', [commit('smoke')]),
        ];
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(smokeDiscoveryCount).toBe(1);
    expect(result.value.state.log).toEqual(['parent', 'smoke', 'later']);
    expect(result.value.usage.reactionsScheduled).toBe(2);
  });

  it('replays an already-resolved evaluator batch without double dispatch', () => {
    let discoveries = 0;
    const result = resolveKernelTransaction(
      {
        initialState: { total: 0, log: [] },
        initialWork: [resolvedCommit('nested-lifecycle')],
      },
      handlers((transition) => {
        discoveries += 1;
        return [
          reaction(transition, 100, 'must-not-run', [
            commit('duplicate-reaction'),
          ]),
        ];
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(discoveries).toBe(0);
    expect(result.value.state.log).toEqual(['nested-lifecycle']);
    expect(result.value.usage.reactionsScheduled).toBe(0);
  });

  it('executes a closed stored-power command through the same work loop', () => {
    const cardId = mkCardId('pilot-card');
    const command: TestWork = {
      kind: 'COMMAND',
      command: {
        type: 'CHANGE_STORED_POWER',
        cardId,
        mutation: { kind: 'ADD', delta: 3 },
        cause,
      },
    };
    const result = resolveKernelTransaction(
      { initialState: { total: 0, log: [] }, initialWork: [command] },
      handlers(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.total).toBe(3);
    expect(result.value.state.log).toEqual([`command:${cardId}`]);
  });

  it('returns a typed budget failure without exposing a partial transaction', () => {
    const initialState: TestState = { total: 0, log: [] };
    const result = resolveKernelTransaction(
      {
        initialState,
        initialWork: [commit('committed-privately')],
        budget: {
          maxWorkItems: 1,
          maxEvents: 10,
          maxReactions: 10,
          maxEffectDepth: 10,
          maxCreatedEntities: 10,
        },
      },
      handlers((transition) =>
        transition.event.label === 'committed-privately'
          ? [
              reaction(transition, 100, 'loop', [
                commit('must-not-publish'),
              ]),
            ]
          : [],
      ),
    );

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'KERNEL_FAILURE',
        code: 'BUDGET_EXCEEDED',
        message: 'Kernel work-item budget exceeded (1).',
        workItemsConsumed: 1,
        eventsProduced: 1,
        reactionsScheduled: 1,
      },
    });
    expect('value' in result).toBe(false);
    expect(initialState).toEqual({ total: 0, log: [] });
  });

  it('returns candidate state, transitions, transcript, and usage—not Frame or RNG authority', () => {
    const result = resolveKernelTransaction(
      {
        initialState: { total: 0, log: [] },
        initialWork: [commit('one')],
      },
      handlers(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual([
      'resolutionSteps',
      'state',
      'transitions',
      'usage',
    ]);
    expect(result.value.resolutionSteps).toEqual([
      { transitionIndex: 0, effect: null },
    ]);
    expect(Object.keys(result.value.usage).sort()).toEqual([
      'createdEntities',
      'eventsProduced',
      'maximumEffectDepth',
      'reactionsScheduled',
      'workItemsConsumed',
    ]);
  });

  it('throws the canonical typed invariant error at publication boundaries', () => {
    const failure = {
      ok: false as const,
      failure: {
        kind: 'KERNEL_FAILURE' as const,
        code: 'REDUCER_INVARIANT' as const,
        message: 'publication failed',
        workItemsConsumed: 1,
        eventsProduced: 0,
        reactionsScheduled: 0,
      },
    };
    expect(() => assertKernelSuccess(failure)).toThrowError(
      expect.objectContaining({
        name: 'KernelInvariantError',
        failure: failure.failure,
      }),
    );
  });
});
