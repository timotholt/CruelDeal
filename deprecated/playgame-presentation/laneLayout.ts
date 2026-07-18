export interface LaneRowLayout {
  readonly gridTemplateColumns: string;
  readonly justifyContent: 'center';
}

/**
 * Lane identity does not determine screen position. The current active count
 * owns the projection: one fixed-width lane is centered; two or three lanes
 * receive equal-width screen regions.
 */
export function laneRowLayout(activeLaneCount: number): LaneRowLayout {
  const count = Math.max(1, activeLaneCount);
  return {
    gridTemplateColumns: count === 1
      ? 'minmax(0, var(--lane-w))'
      : `repeat(${count}, minmax(0, 1fr))`,
    justifyContent: 'center',
  };
}
