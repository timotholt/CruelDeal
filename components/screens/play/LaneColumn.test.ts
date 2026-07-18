import { describe, expect, it } from 'vitest';
import { laneCenterPercent } from './LaneColumn';

describe('fixed lane horizontal targets', () => {
  it('centers a single fixed-size lane', () => {
    expect(laneCenterPercent(0, 1)).toBe(50);
  });

  it('equally spaces two fixed-size lanes', () => {
    expect([0, 1].map((order) => laneCenterPercent(order, 2))).toEqual([25, 75]);
  });

  it('equally spaces three fixed-size lanes', () => {
    const centers = [0, 1, 2].map((order) => laneCenterPercent(order, 3));
    expect(centers[0]).toBeCloseTo(100 / 6);
    expect(centers[1]).toBe(50);
    expect(centers[2]).toBeCloseTo(500 / 6);
  });
});
