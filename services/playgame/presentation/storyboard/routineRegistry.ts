import { StoryboardBuilder } from './builder';
import type { AnimationNode, RoutineId, RoutineParameterMap } from './nodes';

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export interface RoutineAuthoringContext<M extends RoutineParameterMap> {
  readonly builder: StoryboardBuilder<M>;
}

export interface AnimationRoutineDefinition<
  M extends RoutineParameterMap,
  I extends RoutineId<M> = RoutineId<M>,
> {
  readonly id: I;
  readonly params: RuntimeSchema<M[I]>;
  /** Closed call-graph declaration used for build-time cycle validation. */
  readonly calls: readonly RoutineId<M>[];
  expand(
    context: RoutineAuthoringContext<M>,
    params: M[I],
  ): AnimationNode<M>;
}

export class AnimationRoutineRegistry<M extends RoutineParameterMap> {
  readonly #definitions: ReadonlyMap<RoutineId<M>, AnimationRoutineDefinition<M>>;

  constructor(definitions: readonly AnimationRoutineDefinition<M>[]) {
    const map = new Map<RoutineId<M>, AnimationRoutineDefinition<M>>();
    for (const definition of definitions) {
      if (map.has(definition.id)) {
        throw new Error(`Duplicate animation routine: ${definition.id}`);
      }
      map.set(definition.id, definition);
    }
    for (const definition of definitions) {
      for (const called of definition.calls) {
        if (!map.has(called)) {
          throw new Error(`Routine ${definition.id} calls unknown routine ${called}`);
        }
      }
    }
    assertAcyclic(map);
    this.#definitions = map;
  }

  definition<I extends RoutineId<M>>(id: I): AnimationRoutineDefinition<M, I> {
    const definition = this.#definitions.get(id);
    if (!definition) throw new Error(`Unknown animation routine: ${id}`);
    return definition as AnimationRoutineDefinition<M, I>;
  }

  ids(): readonly RoutineId<M>[] {
    return [...this.#definitions.keys()];
  }

  declaresCall(caller: RoutineId<M>, called: RoutineId<M>): boolean {
    return this.definition(caller).calls.includes(called);
  }
}

function assertAcyclic<M extends RoutineParameterMap>(
  definitions: ReadonlyMap<RoutineId<M>, AnimationRoutineDefinition<M>>,
): void {
  const visiting = new Set<RoutineId<M>>();
  const visited = new Set<RoutineId<M>>();
  const visit = (id: RoutineId<M>, depth: number): void => {
    if (depth > 16) throw new Error(`Animation routine depth exceeds 16 at ${id}`);
    if (visiting.has(id)) throw new Error(`Animation routine cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const called of definitions.get(id)?.calls ?? []) visit(called, depth + 1);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of definitions.keys()) visit(id, 1);
}

export function schema<T>(parse: (value: unknown) => T): RuntimeSchema<T> {
  return { parse };
}
