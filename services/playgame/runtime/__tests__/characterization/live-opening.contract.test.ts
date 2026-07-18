import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Step } from '../../../script/runner';

const actionSpies = vi.hoisted(() => {
  const step = (): Promise<void> => Promise.resolve();
  const action = () => vi.fn((): Step => step);
  return {
    commitTurnResolution: action(),
    fadeInLocationTile: action(),
    flipPlayerCardsFaceDown: action(),
    hideLocationTiles: action(),
    paceCommittedOpening: action(),
    paceCommittedTurn: action(),
    setBoardVisible: action(),
    toast: action(),
  };
});

vi.mock('../../../script/actions', () => actionSpies);

import { openingSequence } from '../../../script/flows';

describe('current live opening contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uses a symmetric runtime opening transaction instead of local-only deal actions', () => {
    openingSequence();

    expect(actionSpies.paceCommittedOpening).toHaveBeenCalledTimes(1);
  });
});
