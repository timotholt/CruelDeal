import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Step } from '../../../script/runner';

const actionSpies = vi.hoisted(() => {
  const step = (): Promise<void> => Promise.resolve();
  const action = () => vi.fn((): Step => step);
  return {
    fadeInLocationTile: action(),
    flipPlayerCardsFaceDown: action(),
    hideLocationTiles: action(),
    paceCommittedOpeningDeal: action(),
    paceCommittedOpeningLocationReveal: action(),
    paceCommittedOpeningTurnStart: action(),
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
    openingSequence({} as never);

    expect(actionSpies.paceCommittedOpeningDeal).toHaveBeenCalledTimes(1);
    expect(actionSpies.paceCommittedOpeningLocationReveal).toHaveBeenCalledTimes(1);
    expect(actionSpies.paceCommittedOpeningTurnStart).toHaveBeenCalledTimes(1);

    const turnOneToastCall = actionSpies.toast.mock.calls.findIndex(([text]) => text === 'TURN 1');
    expect(turnOneToastCall).toBeGreaterThanOrEqual(0);
    expect(actionSpies.paceCommittedOpeningDeal.mock.invocationCallOrder[0])
      .toBeLessThan(actionSpies.toast.mock.invocationCallOrder[turnOneToastCall]);
    expect(actionSpies.toast.mock.invocationCallOrder[turnOneToastCall])
      .toBeLessThan(actionSpies.paceCommittedOpeningLocationReveal.mock.invocationCallOrder[0]);
    expect(actionSpies.paceCommittedOpeningLocationReveal.mock.invocationCallOrder[0])
      .toBeLessThan(actionSpies.paceCommittedOpeningTurnStart.mock.invocationCallOrder[0]);
  });
});
