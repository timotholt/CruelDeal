import {
  milliseconds,
  type BeatStoryboard,
  type PresentationExpansionBudget,
  type StoryboardStep,
} from '../contracts';

export const FOUNDATION_TEST_BUDGET: PresentationExpansionBudget = Object.freeze({
  maximumPrimitiveSteps: 64,
  maximumVisualTracks: 64,
  maximumTimedCues: 64,
  maximumAuthoredRoutineDepth: 16,
  maximumCardActors: 16,
  maximumEffectActors: 16,
});

export function step(
  id: string,
  durationMs: number,
  nextStepAfterMs = durationMs,
  options: Pick<StoryboardStep, 'tracks' | 'cues'> = { tracks: [], cues: [] },
): StoryboardStep {
  return {
    id,
    durationMs: milliseconds(durationMs),
    nextStepAfterMs: milliseconds(nextStepAfterMs),
    tracks: options.tracks,
    cues: options.cues,
  };
}

export function storyboard(steps: readonly StoryboardStep[]): BeatStoryboard {
  return {
    id: 'foundation-test',
    source: { kind: 'FOUNDATION_PROOF', proofId: 'vitest' },
    steps,
  };
}
