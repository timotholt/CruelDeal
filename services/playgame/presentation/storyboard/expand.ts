import { milliseconds, type BeatStoryboard, type BeatStoryboardSource, type StoryboardStep } from './contracts';
import type { AnimationNode, RoutineId, RoutineParameterMap } from './nodes';
import { StoryboardBuilder } from './builder';
import type { AnimationRoutineRegistry } from './routineRegistry';

interface PositionedStep {
  readonly step: StoryboardStep;
  readonly startMs: number;
  readonly authoredOrder: number;
}

interface Expansion {
  readonly steps: readonly PositionedStep[];
  readonly advanceMs: number;
  readonly occupiedEndMs: number;
}

export interface ExpandStoryboardOptions<M extends RoutineParameterMap> {
  readonly id: string;
  readonly source: BeatStoryboardSource;
  readonly root: AnimationNode<M>;
  readonly routines: AnimationRoutineRegistry<M>;
  readonly maximumPrimitiveSteps: number;
  readonly maximumAuthoredRoutineDepth?: 16;
}

export function expandStoryboard<M extends RoutineParameterMap>(
  options: ExpandStoryboardOptions<M>,
): BeatStoryboard {
  let authoredOrder = 0;
  const builder = new StoryboardBuilder<M>();
  const expand = (
    node: AnimationNode<M>,
    baseMs: number,
    callStack: readonly RoutineId<M>[],
    parentRoutine: RoutineId<M> | null,
  ): Expansion => {
    switch (node.kind) {
      case 'STEP':
        authoredOrder += 1;
        return {
          steps: [{ step: node.step, startMs: baseMs, authoredOrder }],
          advanceMs: node.step.nextStepAfterMs,
          occupiedEndMs: node.step.durationMs,
        };
      case 'SEQUENCE': {
        let cursor = 0;
        let occupiedEnd = 0;
        const steps: PositionedStep[] = [];
        for (const child of node.children) {
          const childExpansion = expand(child, baseMs + cursor, callStack, parentRoutine);
          steps.push(...childExpansion.steps);
          occupiedEnd = Math.max(
            occupiedEnd,
            cursor + childExpansion.occupiedEndMs,
          );
          cursor += childExpansion.advanceMs;
        }
        return { steps, advanceMs: cursor, occupiedEndMs: occupiedEnd };
      }
      case 'PARALLEL': {
        const children = node.children.map(child => expand(child, baseMs, callStack, parentRoutine));
        const occupiedEnd = Math.max(
          0,
          ...children.map(child => Math.max(child.advanceMs, child.occupiedEndMs)),
        );
        return {
          steps: children.flatMap(child => child.steps),
          advanceMs: occupiedEnd,
          occupiedEndMs: occupiedEnd,
        };
      }
      case 'STAGGER': {
        const children = node.children.map((child, index) => {
          const offset = index * node.intervalMs;
          return { offset, expansion: expand(child, baseMs + offset, callStack, parentRoutine) };
        });
        const occupiedEnd = Math.max(
          0,
          ...children.map(({ offset, expansion }) => (
            offset + Math.max(expansion.advanceMs, expansion.occupiedEndMs)
          )),
        );
        return {
          steps: children.flatMap(child => child.expansion.steps),
          advanceMs: occupiedEnd,
          occupiedEndMs: occupiedEnd,
        };
      }
      case 'CALL': {
        if (parentRoutine !== null) {
          if (!options.routines.declaresCall(parentRoutine, node.routine)) {
            throw new Error(
              `Routine ${parentRoutine} emitted undeclared call ${node.routine}`,
            );
          }
        }
        if (callStack.length >= 16) {
          throw new Error(`Animation routine expansion depth exceeds 16: ${callStack.join(' -> ')}`);
        }
        if (callStack.includes(node.routine)) {
          throw new Error(`Animation routine expansion cycle: ${[...callStack, node.routine].join(' -> ')}`);
        }
        const definition = options.routines.definition(node.routine);
        const params = definition.params.parse(node.params);
        const expanded = definition.expand({ builder }, params);
        if (isPromiseLike(expanded)) {
          throw new Error(`Animation routine ${node.routine} expanded asynchronously`);
        }
        return expand(expanded, baseMs, [...callStack, node.routine], node.routine);
      }
    }
  };

  const result = expand(options.root, 0, [], null);
  if (result.steps.length > options.maximumPrimitiveSteps) {
    throw new Error(
      `Animation expansion produced ${result.steps.length} steps; `
      + `budget is ${options.maximumPrimitiveSteps}`,
    );
  }
  const ordered = [...result.steps].sort((left, right) => (
    left.startMs - right.startMs || left.authoredOrder - right.authoredOrder
  ));
  const steps = ordered.map((entry, index): StoryboardStep => {
    const nextStart = ordered[index + 1]?.startMs;
    return {
      ...entry.step,
      nextStepAfterMs: milliseconds(
        nextStart === undefined ? entry.step.nextStepAfterMs : nextStart - entry.startMs,
      ),
    };
  });
  return { id: options.id, source: options.source, steps };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value;
}
