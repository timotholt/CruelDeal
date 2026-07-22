import { describe, expect, it } from 'vitest';

import { compileStoryboard } from './storyboard/compiler';
import { createOpeningPreludeStoryboard } from './openingPreludeAnimation';

const budget = {
  maximumPrimitiveSteps: 4,
  maximumVisualTracks: 5,
  maximumTimedCues: 0,
  maximumAuthoredRoutineDepth: 16 as const,
  maximumCardActors: 0,
  maximumEffectActors: 0,
};

describe('compiled opening transaction prelude', () => {
  it('authors title, reveal, and settle on one accumulated master clock', () => {
    const timeline = compileStoryboard(
      createOpeningPreludeStoryboard('opening:test'),
      budget,
    );

    expect(timeline.source).toEqual({
      kind: 'TRANSACTION_PRELUDE',
      transactionId: 'opening:test',
    });
    expect(timeline.steps.map(step => [step.step.id, step.startMs, step.endMs]))
      .toEqual([
        ['opening-lead-in', 0, 200],
        ['opening-title', 200, 3_000],
        ['opening-playfield-reveal', 3_000, 5_000],
        ['opening-settle', 5_000, 5_150],
      ]);
    expect(timeline.totalDurationMs).toBe(5_150);
    expect(timeline.tracks.map(track => track.targetKey).sort())
      .toEqual(['PLAYFIELD', 'TURN_BANNER', 'TURN_BANNER_BACKGROUND']);

    const playfield = timeline.tracks.find(track => track.targetKey === 'PLAYFIELD');
    expect(playfield?.keyframes.map(keyframe => [keyframe.atMs, keyframe.value]))
      .toEqual([
        [0, 0],
        [3_000, 0],
        [5_000, 1],
        [5_150, 1],
      ]);
  });
});
