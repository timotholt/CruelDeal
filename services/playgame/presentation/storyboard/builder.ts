import { milliseconds, type Milliseconds, type StoryboardStep } from './contracts';
import type {
  AnimationNode,
  ParallelNode,
  PrimitiveStepNode,
  RoutineCallNode,
  RoutineId,
  RoutineParameterMap,
  SequenceNode,
  StaggerNode,
} from './nodes';

export class StoryboardBuilder<M extends RoutineParameterMap> {
  step(step: StoryboardStep): PrimitiveStepNode {
    return { kind: 'STEP', step };
  }

  hold(id: string, durationMs: Milliseconds): PrimitiveStepNode {
    return this.step({
      id,
      durationMs,
      nextStepAfterMs: durationMs,
      tracks: [],
      cues: [],
    });
  }

  sequence(...children: readonly AnimationNode<M>[]): SequenceNode<M> {
    return { kind: 'SEQUENCE', children };
  }

  parallel(...children: readonly AnimationNode<M>[]): ParallelNode<M> {
    return { kind: 'PARALLEL', children };
  }

  stagger(
    intervalMs: Milliseconds,
    children: readonly AnimationNode<M>[],
  ): StaggerNode<M> {
    return { kind: 'STAGGER', intervalMs, children };
  }

  call<I extends RoutineId<M>>(routine: I, params: M[I]): RoutineCallNode<M> {
    return { kind: 'CALL', routine, params } as RoutineCallNode<M>;
  }

  forEachTarget<T>(
    targets: readonly T[],
    author: (target: T, index: number) => AnimationNode<M>,
  ): readonly AnimationNode<M>[] {
    return targets.map(author);
  }
}

export const ZERO_MS = milliseconds(0);
