import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';
import type { Rng } from '.';
import type { KernelResolutionStep } from '../kernel/resolutionTrace';

const TERMINAL_BATCH_EVENTS = new Set<MatchEvent['type']>([
  'MATCH_SETUP_COMPLETED',
  'MATCH_ENDED',
]);

/**
 * Append the sole canonical RNG bookkeeping event for a transaction.
 *
 * The event records only how many draws were consumed. The reducer advances
 * from its own current serialized state, so an event cannot inject a forged
 * generator state or change the match seed. Terminal boundary events remain
 * last in their batch.
 */
export function appendGameplayRngAdvance(
  state: MatchState,
  rng: Rng,
  events: readonly MatchEvent[],
): readonly MatchEvent[] {
  const draws = rng.draws - state.rng.draws;
  if (draws < 0) {
    throw new Error('Gameplay RNG transaction cannot rewind the draw cursor');
  }
  if (draws === 0) return events;
  if (!Number.isSafeInteger(draws)) {
    throw new Error(`Gameplay RNG transaction produced an invalid draw count: ${draws}`);
  }

  const advanced: MatchEvent = Object.freeze({
    type: 'GAMEPLAY_RNG_ADVANCED',
    draws,
  });
  const last = events.at(-1);
  if (last && TERMINAL_BATCH_EVENTS.has(last.type)) {
    return Object.freeze([...events.slice(0, -1), advanced, last]);
  }
  return Object.freeze([...events, advanced]);
}

export interface ResolutionWithRngAdvance {
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
}

/**
 * Add RNG bookkeeping to both the mechanical event list and its ordered
 * kernel transcript. This is the only supported publication path for a
 * resolved batch that consumed gameplay RNG.
 */
export function appendGameplayRngResolution(
  state: MatchState,
  rng: Rng,
  resolution: ResolutionWithRngAdvance,
): ResolutionWithRngAdvance {
  const events = appendGameplayRngAdvance(state, rng, resolution.events);
  if (events.length === resolution.events.length) return resolution;

  const terminal = resolution.events.at(-1);
  const insertionIndex = terminal && TERMINAL_BATCH_EVENTS.has(terminal.type)
    ? resolution.events.length - 1
    : resolution.events.length;
  const resolutionSteps: KernelResolutionStep[] = [];
  let inserted = false;
  for (const step of resolution.resolutionSteps) {
    if (!inserted && step.transitionIndex === insertionIndex) {
      resolutionSteps.push({ transitionIndex: insertionIndex, effect: null });
      inserted = true;
    }
    resolutionSteps.push({
      transitionIndex: step.transitionIndex === null
        ? null
        : step.transitionIndex >= insertionIndex
          ? step.transitionIndex + 1
          : step.transitionIndex,
      effect: step.effect,
    });
  }
  if (!inserted) {
    resolutionSteps.push({ transitionIndex: insertionIndex, effect: null });
  }
  return {
    events,
    resolutionSteps: Object.freeze(resolutionSteps),
  };
}
