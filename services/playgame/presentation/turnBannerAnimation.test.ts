import { describe, expect, it } from 'vitest';

import type { Frame } from '../engine/types/timeline';
import type { SeatTransactionFrame } from '../runtime/projection';
import { compileStoryboard } from './storyboard/compiler';
import {
  createTurnBannerStoryboard,
  TURN_BANNER_DURATION_MS,
} from './turnBannerAnimation';

const budget = {
  maximumPrimitiveSteps: 1,
  maximumVisualTracks: 2,
  maximumTimedCues: 0,
  maximumAuthoredRoutineDepth: 16 as const,
  maximumCardActors: 0,
  maximumEffectActors: 0,
};

const frame = {
  transactionId: 'turn:test',
  index: 4,
  frame: 22 as Frame,
} as SeatTransactionFrame;

describe('compiled turn banner', () => {
  it('owns text and background for one fade-hold-fade lifecycle', () => {
    const timeline = compileStoryboard(createTurnBannerStoryboard(frame), budget);

    expect(timeline.totalDurationMs).toBe(TURN_BANNER_DURATION_MS);
    expect(timeline.steps).toHaveLength(1);
    expect(timeline.tracks.map(track => track.targetKey).sort()).toEqual([
      'TURN_BANNER',
      'TURN_BANNER',
      'TURN_BANNER_BACKGROUND',
    ]);
    for (const track of timeline.tracks) {
      expect(track.keyframes.at(0)?.atMs).toBe(0);
      expect(track.keyframes.at(-1)?.atMs).toBe(TURN_BANNER_DURATION_MS);
    }
    const textOpacity = timeline.tracks.find(track => (
      track.targetKey === 'TURN_BANNER' && track.property === 'opacity'
    ));
    expect(textOpacity?.keyframes.map(keyframe => [keyframe.atMs, keyframe.value]))
      .toEqual([
        [0, 0],
        [252, 1],
        [1_848, 1],
        [2_100, 0],
      ]);
    expect(textOpacity?.keyframes.map(keyframe => keyframe.easing)).toEqual([
      'ease-out', 'linear', 'ease-in', undefined,
    ]);
  });
});
