import {
  milliseconds,
  type BeatStoryboard,
  type CompiledStoryboardCue,
  type Milliseconds,
  type ScheduledStep,
} from './contracts';

export interface StoryboardSchedule {
  readonly steps: readonly ScheduledStep[];
  readonly cues: readonly CompiledStoryboardCue[];
  readonly totalDurationMs: Milliseconds;
}

export function calculateSchedule(storyboard: BeatStoryboard): StoryboardSchedule {
  assertNonemptyId(storyboard.id, 'storyboard');
  const stepIds = new Set<string>();
  const trackIds = new Set<string>();
  const cueIds = new Set<string>();
  const steps: ScheduledStep[] = [];
  const cues: CompiledStoryboardCue[] = [];
  let cursor = 0;
  let total = 0;

  storyboard.steps.forEach((step, stepOrdinal) => {
    assertUnique(stepIds, step.id, 'step');
    const start = milliseconds(cursor);
    const end = milliseconds(cursor + step.durationMs);
    steps.push({ step, ordinal: stepOrdinal, startMs: start, endMs: end });
    total = Math.max(total, end);
    step.tracks.forEach(track => {
      assertUnique(trackIds, track.id, 'track');
      if (track.keyframes.length === 0) {
        throw new Error(`Track ${track.id} has no keyframes`);
      }
      track.keyframes.forEach(keyframe => {
        if (keyframe.atMs > step.durationMs) {
          throw new Error(`Track ${track.id} has a keyframe outside step ${step.id}`);
        }
        if (Object.keys(keyframe.styles).length === 0) {
          throw new Error(`Track ${track.id} has an empty keyframe`);
        }
        if (keyframe.easing !== undefined) assertValidEasing(keyframe.easing);
      });
    });
    step.cues.forEach((cue, cueOrdinal) => {
      assertUnique(cueIds, cue.id, 'cue');
      if (cue.atMs > step.durationMs) {
        throw new Error(`Cue ${cue.id} lies outside step ${step.id}`);
      }
      const absoluteTimeMs = milliseconds(cursor + cue.atMs);
      cues.push({ cue, absoluteTimeMs, stepOrdinal, cueOrdinal });
      total = Math.max(total, absoluteTimeMs);
    });
    cursor += step.nextStepAfterMs;
  });

  cues.sort((left, right) => (
    left.absoluteTimeMs - right.absoluteTimeMs
    || left.stepOrdinal - right.stepOrdinal
    || left.cueOrdinal - right.cueOrdinal
  ));
  return { steps, cues, totalDurationMs: milliseconds(total) };
}

function assertNonemptyId(id: string, kind: string): void {
  if (id.trim() === '') throw new Error(`${kind} ID cannot be empty`);
}

function assertUnique(ids: Set<string>, id: string, kind: string): void {
  assertNonemptyId(id, kind);
  if (ids.has(id)) throw new Error(`Duplicate ${kind} ID: ${id}`);
  ids.add(id);
}

export function assertValidEasing(easing: string): void {
  const named = new Set([
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'step-start', 'step-end',
  ]);
  const functional = /^(?:cubic-bezier|steps)\([^)]*\)$/u;
  if (!named.has(easing) && !functional.test(easing)) {
    throw new Error(`Invalid animation easing: ${easing}`);
  }
}
