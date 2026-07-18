import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Step } from '../../../script/runner';

const actionSpies = vi.hoisted(() => {
  const step = (): Promise<void> => Promise.resolve();
  const action = () => vi.fn((): Step => step);
  return {
    autoPlayRemoteSeat: action(),
    advanceTurnFromEngine: action(),
    captureEngineEndTurn: action(),
    dealPlayerCard: action(),
    fadeInLocationTile: action(),
    finishResolving: action(),
    flipPlayerCardsFaceDown: action(),
    hideLocationTiles: action(),
    revealByPriorityFromEngine: action(),
    revealNextLocation: action(),
    setBoardVisible: action(),
    startResolving: action(),
    toast: action(),
  };
});

vi.mock('../../../script/actions', () => actionSpies);

import { openingSequence } from '../../../script/flows';

describe('current live opening contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.fails('uses a symmetric runtime opening transaction instead of local-only deal actions', () => {
    openingSequence();

    // The current production flow constructs four local-only deal steps and
    // none for the remote seat. This desired-state assertion must flip green
    // when both seats use the shared startingHandSize opening path.
    expect(actionSpies.dealPlayerCard).not.toHaveBeenCalled();
  });
});
