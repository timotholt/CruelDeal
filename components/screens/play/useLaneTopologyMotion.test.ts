import { describe, expect, it } from 'vitest';
import { laneTopologyDeltaX } from './useLaneTopologyMotion';

describe('lane topology FLIP geometry', () => {
  it('moves a surviving lane from its old visual x without resizing it', () => {
    expect(laneTopologyDeltaX({ left: 280 }, { left: 142 })).toBe(138);
    expect(laneTopologyDeltaX({ left: 4 }, { left: 142 })).toBe(-138);
  });
});
