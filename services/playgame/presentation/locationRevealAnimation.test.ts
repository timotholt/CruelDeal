import { describe, expect, it } from 'vitest';

import type { LaneId } from '../engine/types/ids';
import type { Frame } from '../engine/types/timeline';
import type { SeatTransactionFrame } from '../runtime/projection';
import { compileStoryboard } from './storyboard/compiler';
import {
  createLocationRevealStoryboard,
  LOCATION_REVEAL_DURATION_MS,
} from './locationRevealAnimation';

const budget = {
  maximumPrimitiveSteps: 1,
  maximumVisualTracks: 2,
  maximumTimedCues: 1,
  maximumAuthoredRoutineDepth: 16 as const,
  maximumCardActors: 0,
  maximumEffectActors: 0,
};

const frame = {
  transactionId: 'location:test',
  index: 7,
  frame: 31 as Frame,
} as SeatTransactionFrame;

describe('compiled location reveal', () => {
  it('starts and finishes the map, two-sided flip, and audio on one clock', () => {
    const timeline = compileStoryboard(
      createLocationRevealStoryboard(frame, 1 as LaneId),
      budget,
    );

    expect(timeline.totalDurationMs).toBe(LOCATION_REVEAL_DURATION_MS);
    expect(timeline.tracks.map(track => track.targetKey).sort()).toEqual([
      'LOCATION_ACTOR:1',
      'LOCATION_MAP:1',
    ]);
    expect(timeline.cues).toMatchObject([{
      absoluteTimeMs: 0,
      cue: { kind: 'AUDIO', sound: 'reveal' },
    }]);
    const flip = timeline.tracks.find(track => track.targetKey === 'LOCATION_ACTOR:1');
    expect(flip?.keyframes.map(keyframe => [keyframe.atMs, keyframe.value]))
      .toEqual([
        [0, 'rotateY(0deg)'],
        [250, 'rotateY(90deg)'],
        [500, 'rotateY(180deg)'],
      ]);
    expect(flip?.keyframes.map(keyframe => keyframe.easing)).toEqual([
      'cubic-bezier(.4,0,.7,1)',
      'cubic-bezier(.3,0,.2,1)',
      undefined,
    ]);
    const map = timeline.tracks.find(track => track.targetKey === 'LOCATION_MAP:1');
    expect(map?.keyframes.map(keyframe => [keyframe.atMs, keyframe.value]))
      .toEqual([
        [0, 0],
        [500, 1],
      ]);
    expect(map?.keyframes.map(keyframe => keyframe.easing)).toEqual(['ease', undefined]);
  });
});
