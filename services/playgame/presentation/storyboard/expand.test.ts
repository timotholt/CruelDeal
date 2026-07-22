import { describe, expect, it } from 'vitest';
import { StoryboardBuilder } from './builder';
import { milliseconds } from './contracts';
import { expandStoryboard } from './expand';
import { AnimationRoutineRegistry, schema } from './routineRegistry';
import { step } from './__tests__/fixtures';

interface TestRoutines {
  readonly pulse: { readonly id: string };
  readonly double: { readonly id: string };
}

const builder = new StoryboardBuilder<TestRoutines>();

describe('animation AST expansion', () => {
  it('fully flattens calls, sequences, parallels, stagger, and finite maps', () => {
    const registry = new AnimationRoutineRegistry<TestRoutines>([
      {
        id: 'pulse',
        calls: [],
        params: schema(value => {
          if (!isIdParams(value)) throw new Error('invalid pulse params');
          return value;
        }),
        expand: ({ builder: routineBuilder }, params) => (
          routineBuilder.step(step(`pulse-${params.id}`, 100))
        ),
      },
      {
        id: 'double',
        calls: ['pulse'],
        params: schema(value => {
          if (!isIdParams(value)) throw new Error('invalid double params');
          return value;
        }),
        expand: ({ builder: routineBuilder }, params) => routineBuilder.parallel(
          routineBuilder.call('pulse', { id: `${params.id}-a` }),
          routineBuilder.call('pulse', { id: `${params.id}-b` }),
        ),
      },
    ]);
    const targets = ['1', '2', '3'] as const;
    const root = builder.sequence(
      builder.call('double', { id: 'source' }),
      builder.stagger(milliseconds(25), builder.forEachTarget(
        targets,
        target => builder.call('pulse', { id: target }),
      )),
    );
    const result = expandStoryboard({
      id: 'expanded',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'expand' },
      root,
      routines: registry,
      maximumPrimitiveSteps: 5,
    });
    expect(result.steps.map(item => item.id)).toEqual([
      'pulse-source-a', 'pulse-source-b', 'pulse-1', 'pulse-2', 'pulse-3',
    ]);
    expect(result.steps.map(item => item.nextStepAfterMs)).toEqual([0, 100, 25, 25, 100]);
    expect(JSON.stringify(result)).not.toContain('CALL');
  });

  it('rejects duplicate IDs, unknown calls, cycles, bad schemas, and budgets', () => {
    expect(() => new AnimationRoutineRegistry<TestRoutines>([
      routine('pulse', []), routine('pulse', []),
    ])).toThrow(/Duplicate/u);
    expect(() => new AnimationRoutineRegistry<TestRoutines>([
      routine('pulse', ['double']), routine('double', ['pulse']),
    ])).toThrow(/cycle/u);

    const registry = new AnimationRoutineRegistry<TestRoutines>([
      routine('pulse', []), routine('double', []),
    ]);
    expect(() => expandStoryboard({
      id: 'bad-schema',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'bad' },
      root: builder.call('pulse', { id: '' }),
      routines: registry,
      maximumPrimitiveSteps: 1,
    })).toThrow(/params/u);
    expect(() => expandStoryboard({
      id: 'over-budget',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'budget' },
      root: builder.sequence(builder.step(step('a', 1)), builder.step(step('b', 1))),
      routines: registry,
      maximumPrimitiveSteps: 1,
    })).toThrow(/budget/u);

    const undeclared = new AnimationRoutineRegistry<TestRoutines>([
      routine('pulse', []),
      {
        ...routine('double', []),
        expand: () => builder.call('pulse', { id: 'hidden-edge' }),
      },
    ]);
    expect(() => expandStoryboard({
      id: 'undeclared-edge',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'edge' },
      root: builder.call('double', { id: 'edge' }),
      routines: undeclared,
      maximumPrimitiveSteps: 1,
    })).toThrow(/undeclared call/u);
  });
});

function isIdParams(value: unknown): value is { readonly id: string } {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string' && value.id !== '';
}

function routine(
  id: 'pulse' | 'double',
  calls: readonly ('pulse' | 'double')[],
) {
  return {
    id,
    calls,
    params: schema((value: unknown) => {
      if (!isIdParams(value)) throw new Error('invalid params');
      return value;
    }),
    expand: () => builder.step(step(id, 1)),
  };
}
