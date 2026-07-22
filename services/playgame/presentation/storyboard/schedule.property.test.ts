import { describe, expect, it } from 'vitest';
import { calculateSchedule } from './schedule';
import { step, storyboard } from './__tests__/fixtures';

describe('schedule bounded property corpus', () => {
  it('preserves schedule laws across 1,000 seeded step lists', () => {
    const random = mulberry32(0xc0ffee);
    for (let run = 0; run < 1000; run += 1) {
      const length = 1 + Math.floor(random() * 20);
      const authored = Array.from({ length }, (_, index) => step(
        `run-${run}-step-${index}`,
        Math.floor(random() * 500),
        Math.floor(random() * 500),
      ));
      const before = structuredClone(authored);
      const schedule = calculateSchedule(storyboard(authored));
      let expectedStart = 0;
      let expectedTotal = 0;
      schedule.steps.forEach((scheduled, index) => {
        expect(scheduled.startMs).toBe(expectedStart);
        expect(scheduled.endMs).toBe(expectedStart + scheduled.step.durationMs);
        expectedTotal = Math.max(expectedTotal, scheduled.endMs);
        expectedStart += authored[index]?.nextStepAfterMs ?? 0;
      });
      expect(schedule.totalDurationMs).toBe(expectedTotal);
      expect(authored).toEqual(before);
    }
  });
});

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
