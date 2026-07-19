import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Step } from '../../../script/runner';

const actionSpies = vi.hoisted(() => {
  const step = (): Promise<void> => Promise.resolve();
  const action = () => vi.fn((): Step => step);
  return {
    flipPlayerCardsFaceDown: action(),
    paceCommittedOpening: action(),
    paceCommittedTurn: action(),
    presentPlayfieldEvent: action(),
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
    const timeline = {} as never;
    openingSequence(timeline);

    expect(actionSpies.presentPlayfieldEvent).toHaveBeenNthCalledWith(1, {
      type: 'HIDE_PLAYFIELD',
    });
    expect(actionSpies.presentPlayfieldEvent).toHaveBeenNthCalledWith(2, {
      type: 'SHOW_PLAYFIELD',
    });
    expect(actionSpies.paceCommittedOpening).toHaveBeenCalledOnce();
    expect(actionSpies.paceCommittedOpening).toHaveBeenCalledWith(timeline);
    expect(actionSpies.presentPlayfieldEvent.mock.invocationCallOrder[1])
      .toBeLessThan(actionSpies.paceCommittedOpening.mock.invocationCallOrder[0]);
  });
});
