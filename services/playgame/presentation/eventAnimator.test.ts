import { describe, expect, it } from 'vitest';

import { fallbackRectForZone } from './eventAnimator';

describe('event animator transfer origins', () => {
  it('falls remote hand transfers back to the opponent hand region at board top-center', () => {
    const board = { left: 100, top: 40, width: 400, height: 700 };

    const rect = fallbackRectForZone(board, { kind: 'HAND', owner: 'P1' }, 'P1');

    expect(rect.left + rect.width / 2).toBe(board.left + board.width / 2);
    expect(rect.top).toBe(board.top + 16);
    expect(rect.top).toBeLessThan(board.top + board.height / 2);
  });

  it('keeps unrelated missing endpoints on the neutral board-center fallback', () => {
    const board = { left: 100, top: 40, width: 400, height: 700 };

    const rect = fallbackRectForZone(board, { kind: 'OFFBOARD' }, 'P1');

    expect(rect.left + rect.width / 2).toBe(board.left + board.width / 2);
    expect(rect.top + rect.height / 2).toBe(board.top + board.height / 2);
  });
});
