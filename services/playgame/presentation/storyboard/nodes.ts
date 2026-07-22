import type { Milliseconds, StoryboardStep } from './contracts';

export type RoutineParameterMap = object;
export type RoutineId<M extends RoutineParameterMap> = Extract<keyof M, string>;

export type AnimationNode<M extends RoutineParameterMap> =
  | PrimitiveStepNode
  | SequenceNode<M>
  | ParallelNode<M>
  | StaggerNode<M>
  | RoutineCallNode<M>;

export interface PrimitiveStepNode {
  readonly kind: 'STEP';
  readonly step: StoryboardStep;
}

export interface SequenceNode<M extends RoutineParameterMap> {
  readonly kind: 'SEQUENCE';
  readonly children: readonly AnimationNode<M>[];
}

export interface ParallelNode<M extends RoutineParameterMap> {
  readonly kind: 'PARALLEL';
  readonly children: readonly AnimationNode<M>[];
}

export interface StaggerNode<M extends RoutineParameterMap> {
  readonly kind: 'STAGGER';
  readonly intervalMs: Milliseconds;
  readonly children: readonly AnimationNode<M>[];
}

export interface RoutineCallNode<M extends RoutineParameterMap> {
  readonly kind: 'CALL';
  readonly routine: RoutineId<M>;
  readonly params: M[RoutineId<M>];
}
