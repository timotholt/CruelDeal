import { describe, expect, it } from 'vitest';
import { compileStoryboard } from './compiler';
import { milliseconds } from './contracts';
import { calculateSchedule } from './schedule';
import { FOUNDATION_TEST_BUDGET, step, storyboard } from './__tests__/fixtures';

describe('compiled storyboard schedule', () => {
  it('accumulates next-start boundaries instead of summing durations', () => {
    const schedule = calculateSchedule(storyboard([
      step('enter', 400, 300),
      step('flip', 350, 350),
      step('hold', 500),
      step('return', 300),
    ]));
    expect(schedule.steps.map(item => [item.startMs, item.endMs])).toEqual([
      [0, 400], [300, 650], [650, 1150], [1150, 1450],
    ]);
    expect(schedule.totalDurationMs).toBe(1450);
  });

  it('supports simultaneous starts, deliberate gaps, and long overlaps', () => {
    const schedule = calculateSchedule(storyboard([
      step('long', 500, 0),
      step('same-time', 100, 700),
      step('after-gap', 50),
    ]));
    expect(schedule.steps.map(item => item.startMs)).toEqual([0, 0, 700]);
    expect(schedule.totalDurationMs).toBe(750);
  });

  it('orders same-time cues by step and authored cue order', () => {
    const schedule = calculateSchedule(storyboard([
      step('a', 100, 0, { tracks: [], cues: [
        { id: 'a1', kind: 'DIAGNOSTIC', atMs: milliseconds(50), label: 'a1' },
        { id: 'a2', kind: 'DIAGNOSTIC', atMs: milliseconds(50), label: 'a2' },
      ] }),
      step('b', 100, 100, { tracks: [], cues: [
        { id: 'b1', kind: 'DIAGNOSTIC', atMs: milliseconds(50), label: 'b1' },
      ] }),
    ]));
    expect(schedule.cues.map(cue => cue.cue.id)).toEqual(['a1', 'a2', 'b1']);
  });

  it('normalizes each property to explicit zero and one offsets with holds', () => {
    const compiled = compileStoryboard(storyboard([
      step('lead', 100),
      step('motion', 200, 200, {
        tracks: [{
          kind: 'ELEMENT',
          id: 'move',
          target: { kind: 'TURN_BANNER' },
          channel: 'banner-pose',
          keyframes: [
            { atMs: milliseconds(50), styles: { transform: 'translateY(10px)' } },
            { atMs: milliseconds(150), styles: { transform: 'translateY(0px)' } },
          ],
        }],
        cues: [],
      }),
      step('tail', 100),
    ]), FOUNDATION_TEST_BUDGET);
    expect(compiled.totalDurationMs).toBe(400);
    expect(compiled.tracks).toHaveLength(1);
    expect(compiled.tracks[0]?.keyframes.map(frame => [frame.atMs, frame.offset])).toEqual([
      [0, 0], [100, 0.25], [150, 0.375], [250, 0.625], [300, 0.75], [400, 1],
    ]);
  });

  it('rejects duplicate IDs, invalid ranges, easing, and conflicting ownership', () => {
    expect(() => calculateSchedule(storyboard([step('x', 10), step('x', 10)])))
      .toThrow(/Duplicate step ID/u);
    expect(() => calculateSchedule(storyboard([step('x', 10, 10, {
      tracks: [],
      cues: [{ id: 'late', kind: 'DIAGNOSTIC', atMs: milliseconds(11), label: 'late' }],
    })]))).toThrow(/outside step/u);
    expect(() => calculateSchedule(storyboard([step('x', 10, 10, {
      cues: [],
      tracks: [{
        kind: 'ELEMENT', id: 'bad-easing', target: { kind: 'PLAYFIELD' },
        channel: 'opacity',
        keyframes: [{ atMs: milliseconds(0), styles: { opacity: 0 }, easing: 'banana' }],
      }],
    })]))).toThrow(/Invalid animation easing/u);
    expect(() => compileStoryboard(storyboard([
      step('a', 100, 0, { cues: [], tracks: [opacityTrack('first')] }),
      step('b', 100, 100, { cues: [], tracks: [opacityTrack('second')] }),
    ]), FOUNDATION_TEST_BUDGET)).toThrow(/Conflicting/u);
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid authored milliseconds: %s',
    value => expect(() => milliseconds(value)).toThrow(RangeError),
  );

  it('is deterministic and does not mutate authored input', () => {
    const input = storyboard([step('x', 100, 100, { cues: [], tracks: [opacityTrack('x')] })]);
    const original = structuredClone(input);
    expect(compileStoryboard(input, FOUNDATION_TEST_BUDGET))
      .toEqual(compileStoryboard(input, FOUNDATION_TEST_BUDGET));
    expect(input).toEqual(original);
  });
});

function opacityTrack(id: string) {
  return {
    kind: 'ELEMENT' as const,
    id,
    target: { kind: 'PLAYFIELD' as const },
    channel: 'opacity' as const,
    keyframes: [
      { atMs: milliseconds(0), styles: { opacity: 0 } },
      { atMs: milliseconds(100), styles: { opacity: 1 } },
    ],
  };
}
