import {
  milliseconds,
  visualTargetKey,
  type AnimatableStyleProperty,
  type BeatStoryboard,
  type CompiledStyleKeyframe,
  type CompiledTimeline,
  type CompiledVisualTrack,
  type PresentationExpansionBudget,
  type VisualChannel,
  type VisualTargetRef,
} from './contracts';
import { easingForCompiledSegment } from './easing';
import { calculateSchedule } from './schedule';

interface PropertyFragment {
  readonly trackId: string;
  readonly target: VisualTargetRef;
  readonly targetKey: string;
  readonly channel: VisualChannel;
  readonly property: AnimatableStyleProperty;
  readonly stepStartMs: number;
  readonly stepEndMs: number;
  readonly values: readonly {
    readonly atMs: number;
    readonly value: string | number;
    readonly easing?: string;
  }[];
}

export function compileStoryboard(
  storyboard: BeatStoryboard,
  budget: PresentationExpansionBudget,
): CompiledTimeline {
  const schedule = calculateSchedule(storyboard);
  if (storyboard.steps.length > budget.maximumPrimitiveSteps) {
    throw new Error('Storyboard exceeds primitive-step expansion budget');
  }
  const authoredTrackCount = storyboard.steps.reduce(
    (count, step) => count + step.tracks.length,
    0,
  );
  const cueCount = storyboard.steps.reduce(
    (count, step) => count + step.cues.length,
    0,
  );
  if (authoredTrackCount > budget.maximumVisualTracks) {
    throw new Error('Storyboard exceeds visual-track expansion budget');
  }
  if (cueCount > budget.maximumTimedCues) {
    throw new Error('Storyboard exceeds timed-cue expansion budget');
  }

  const groups = new Map<string, PropertyFragment[]>();
  for (const scheduled of schedule.steps) {
    for (const track of scheduled.step.tracks) {
      const targetKey = visualTargetKey(track.target);
      const properties = new Set<AnimatableStyleProperty>();
      for (const keyframe of track.keyframes) {
        for (const property of Object.keys(keyframe.styles) as AnimatableStyleProperty[]) {
          properties.add(property);
          const value = keyframe.styles[property];
          if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new Error(`Track ${track.id} has non-finite ${property}`);
          }
        }
      }
      for (const property of properties) {
        const values = track.keyframes.flatMap(keyframe => {
          const value = keyframe.styles[property];
          return value === undefined ? [] : [{
            atMs: scheduled.startMs + keyframe.atMs,
            value,
            ...(keyframe.easing === undefined ? {} : { easing: keyframe.easing }),
          }];
        });
        if (values.length === 0) continue;
        const key = `${targetKey}|${track.channel}|${property}`;
        const fragment: PropertyFragment = {
          trackId: track.id,
          target: track.target,
          targetKey,
          channel: track.channel,
          property,
          stepStartMs: scheduled.startMs,
          stepEndMs: scheduled.endMs,
          values,
        };
        const existing = groups.get(key);
        if (existing) existing.push(fragment);
        else groups.set(key, [fragment]);
      }
    }
  }

  const tracks = [...groups.values()].map(fragments => (
    normalizeFragments(fragments, schedule.totalDurationMs)
  ));
  tracks.sort((left, right) => left.id.localeCompare(right.id));
  return {
    storyboardId: storyboard.id,
    source: storyboard.source,
    totalDurationMs: schedule.totalDurationMs,
    steps: schedule.steps,
    tracks,
    cues: schedule.cues,
  };
}

function normalizeFragments(
  unordered: readonly PropertyFragment[],
  totalDurationMs: number,
): CompiledVisualTrack {
  const fragments = [...unordered].sort((left, right) => (
    left.stepStartMs - right.stepStartMs || left.trackId.localeCompare(right.trackId)
  ));
  for (let index = 1; index < fragments.length; index += 1) {
    const prior = fragments[index - 1];
    const current = fragments[index];
    if (prior && current && current.stepStartMs < prior.stepEndMs) {
      throw new Error(
        `Conflicting ${current.targetKey}/${current.channel}/${current.property} `
        + `ownership in ${prior.trackId} and ${current.trackId}`,
      );
    }
  }

  const authored: Array<{
    atMs: number;
    value: string | number;
    easing?: string;
    trackId: string;
  }> = [];
  for (const fragment of fragments) {
    const ordered = [...fragment.values].sort((left, right) => left.atMs - right.atMs);
    const first = ordered[0];
    const last = ordered.at(-1);
    if (!first || !last) throw new Error(`Track ${fragment.trackId} has no property values`);
    if (first.atMs > fragment.stepStartMs) {
      authored.push({ atMs: fragment.stepStartMs, value: first.value, trackId: fragment.trackId });
    }
    authored.push(...ordered.map(value => ({ ...value, trackId: fragment.trackId })));
    if (last.atMs < fragment.stepEndMs) {
      authored.push({ atMs: fragment.stepEndMs, value: last.value, trackId: fragment.trackId });
    }
  }
  authored.sort((left, right) => left.atMs - right.atMs);

  const normalized: typeof authored = [];
  for (const keyframe of authored) {
    const prior = normalized.at(-1);
    if (prior?.atMs === keyframe.atMs) {
      if (prior.value !== keyframe.value) {
        throw new Error(
          `Uncued discontinuity at ${keyframe.atMs}ms between `
          + `${prior.trackId} and ${keyframe.trackId}`,
        );
      }
      if (keyframe.easing !== undefined) normalized[normalized.length - 1] = keyframe;
      continue;
    }
    normalized.push(keyframe);
  }
  const first = normalized[0];
  const last = normalized.at(-1);
  if (!first || !last) throw new Error('Compiled property timeline is empty');
  if (first.atMs > 0) normalized.unshift({ ...first, atMs: 0, easing: undefined });
  if (last.atMs < totalDurationMs) {
    normalized.push({ ...last, atMs: totalDurationMs, easing: undefined });
  }

  const compiledKeyframes: CompiledStyleKeyframe[] = normalized.map((keyframe, index) => {
    const next = normalized[index + 1];
    return {
      atMs: milliseconds(keyframe.atMs),
      offset: totalDurationMs === 0 ? 0 : keyframe.atMs / totalDurationMs,
      value: keyframe.value,
      ...(next === undefined ? {} : {
        easing: easingForCompiledSegment(keyframe.value, next.value, next.easing),
      }),
    };
  });
  for (const keyframe of compiledKeyframes) {
    if (!Number.isFinite(keyframe.offset) || keyframe.offset < 0 || keyframe.offset > 1) {
      throw new Error(`Invalid compiled keyframe offset ${String(keyframe.offset)}`);
    }
  }
  const exemplar = fragments[0];
  if (!exemplar) throw new Error('Compiled fragment group is empty');
  return {
    id: fragments.map(fragment => fragment.trackId).join('+')
      + `:${exemplar.property}`,
    target: exemplar.target,
    targetKey: exemplar.targetKey,
    channel: exemplar.channel,
    property: exemplar.property,
    keyframes: compiledKeyframes,
    totalDurationMs: milliseconds(totalDurationMs),
  };
}
