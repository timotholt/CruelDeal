import { describe, expect, it } from 'vitest';
import { mkCardId } from '../types/ids';
import type { ChangeStoredPowerCommand, KernelWork } from './types';
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

  it('returns only candidate state, transitions, and usage—not Frame or RNG authority', () => {
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
      'state',
      'transitions',
      'usage',
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
