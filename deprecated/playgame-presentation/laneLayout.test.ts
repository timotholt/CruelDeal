import { describe, expect, it } from 'vitest';

import { laneRowLayout } from './laneLayout';

describe('dynamic lane row layout', () => {
  it('centers a sole active lane at its normal lane width', () => {
    expect(laneRowLayout(1)).toEqual({
      gridTemplateColumns: 'minmax(0, var(--lane-w))',
      justifyContent: 'center',
    });
  });

  it('gives two active lanes equal halves of the board', () => {
    expect(laneRowLayout(2).gridTemplateColumns)
      .toBe('repeat(2, minmax(0, 1fr))');
  });

  it('gives three active lanes equal thirds of the board', () => {
    expect(laneRowLayout(3).gridTemplateColumns)
      .toBe('repeat(3, minmax(0, 1fr))');
  });
});
