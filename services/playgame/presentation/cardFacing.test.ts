import { describe, expect, it } from 'vitest';

import { isBoardCardFaceDown, type BoardCardFacingInput } from './cardFacing';

const transitions = (states: readonly boolean[]): number => states.reduce(
  (count, state, index) => count + (index > 0 && state !== states[index - 1] ? 1 : 0),
  0,
);

const facing = (overrides: Partial<BoardCardFacingInput>): boolean => isBoardCardFaceDown({
  cardId: 'card',
  owner: 'P0',
  viewerSeat: 'P0',
  revealed: false,
  stagingOrder: ['card'],
  resolutionLocked: false,
  ...overrides,
});

describe('END TURN card facing', () => {
  it('allows at most one down and one up transition per card per resolution', () => {
    const local = [
      facing({ resolutionLocked: false }),
      facing({ resolutionLocked: true }),
      facing({ resolutionLocked: true, revealed: true }),
    ];
    const remote = [
      facing({ owner: 'P1', resolutionLocked: true }),
      facing({ owner: 'P1', resolutionLocked: true, revealed: true }),
    ];

    expect(local).toEqual([false, true, false]);
    expect(remote).toEqual([true, false]);
    expect(transitions(local)).toBeLessThanOrEqual(2);
    expect(transitions(remote)).toBeLessThanOrEqual(2);
  });

  it('keeps an engine-delayed local card down after the resolution unlock', () => {
    const delayed = [
      facing({ resolutionLocked: false }),
      facing({ resolutionLocked: true }),
      facing({ resolutionLocked: false, stagingOrder: [] }),
    ];

    expect(delayed).toEqual([false, true, true]);
    expect(transitions(delayed)).toBe(1);
  });
});
