import { NORMAL_ANIMATION_PROFILE } from '../storyboard/animationProfile';
import { compileStoryboard } from '../storyboard/compiler';
import type {
  BeatStoryboard,
  PresentationExpansionBudget,
  PresentationOutcome,
  StoryboardCue,
  StoryboardStep,
} from '../storyboard/contracts';
import { StoryboardRunner } from '../storyboard/runner';
import type { TimelineDriverFactory } from '../storyboard/waapiDriver';
import { CARD_MOTION_ACTOR_CAPACITY } from './cardMotionActorPool';

export function mergeCardMotionTargets(
  sessions: readonly { timelineTargets(): ReadonlyMap<string, Element> }[],
  additionalTargets: ReadonlyMap<string, Element> = new Map(),
): ReadonlyMap<string, Element> {
  const targets = new Map(additionalTargets);
  for (const session of sessions) {
    for (const [key, element] of session.timelineTargets()) {
      const existing = targets.get(key);
      if (existing && existing !== element) {
        throw new Error(`Timeline target ${key} is owned by multiple elements`);
      }
      targets.set(key, element);
    }
  }
  return targets;
}
export interface RunCardMotionStoryboardOptions {
  readonly id: string;
  readonly source: BeatStoryboard['source'];
  readonly targets: ReadonlyMap<string, Element>;
  readonly steps: readonly StoryboardStep[];
  readonly createTimelineDriver: TimelineDriverFactory;
  readonly dispatchCue?: (cue: StoryboardCue) => void;
  readonly maximumCardActors: number;
  readonly handoff: () => void;
  readonly signal: AbortSignal;
}

export async function runCardMotionStoryboard(
  options: RunCardMotionStoryboardOptions,
): Promise<PresentationOutcome> {
  if (
    !Number.isInteger(options.maximumCardActors)
    || options.maximumCardActors < 0
    || options.maximumCardActors > CARD_MOTION_ACTOR_CAPACITY
  ) {
    throw new Error(
      `Card motion storyboard requires ${String(options.maximumCardActors)} actors; `
      + `validated capacity is ${String(CARD_MOTION_ACTOR_CAPACITY)}`,
    );
  }
  const storyboard: BeatStoryboard = {
    id: options.id,
    source: options.source,
    steps: options.steps,
  };
  const budget: PresentationExpansionBudget = {
    maximumPrimitiveSteps: Math.max(1, options.steps.length),
    maximumVisualTracks: options.steps.reduce(
      (count, step) => count + step.tracks.length,
      0,
    ),
    maximumTimedCues: options.steps.reduce(
      (count, step) => count + step.cues.length,
      0,
    ),
    maximumAuthoredRoutineDepth: 16,
    maximumCardActors: options.maximumCardActors,
    maximumEffectActors: 0,
  };
  const timeline = compileStoryboard(storyboard, budget);
  const runner = new StoryboardRunner(
    options.createTimelineDriver(options.targets),
    { dispatch: cue => options.dispatchCue?.(cue) },
  );
  const cancel = (): void => runner.cancel();
  options.signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await runner.run(timeline, NORMAL_ANIMATION_PROFILE, {
      handoff: options.handoff,
    });
    if (result.failure) throw result.failure;
    return result.outcome;
  } finally {
    options.signal.removeEventListener('abort', cancel);
  }
}
