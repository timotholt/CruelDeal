import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MatchEvent } from '../engine/types/events';
import type { EventTransition } from '../engine/transactionTimeline';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import { paceCommittedTurn, type PlayScriptCtx } from './actions';
import type { ScriptCtx } from './runner';

const transition = (frame: number, event: MatchEvent): EventTransition => ({
  transactionId: 'turn-banner-order',
  frame,
  event,
  before: {} as EventTransition['before'],
  after: {} as EventTransition['after'],
});

describe('committed turn presentation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds later committed frames behind the TURN_STARTED banner', async () => {
    vi.useFakeTimers();
    const transitions = [
      transition(1, {
        type: 'TURN_STARTED',
        turn: 2,
        priority: 'P0',
        priorityReason: 'RETAINED',
      }),
      transition(2, { type: 'TURN_ENDED', turn: 2 }),
    ];
    const timeline = {
      transaction: {
        framedEvents: transitions.map(({ transactionId, frame, event }) => ({
          transactionId,
          frame,
          event,
        })),
      },
      transitions,
    } as unknown as CommittedTransactionTimeline;
    const toastArea = document.createElement('div');
    const presented: MatchEvent['type'][] = [];
    const finishTurnPresentation = vi.fn();
    const ctx = {
      state: { phase: 'AWAITING_INTENT' },
      ui: { lockedResult: null },
      localSeat: 'P0',
      toastArea,
      setUi: vi.fn(),
      presentCommittedFrame: (frame: EventTransition) => {
        presented.push(frame.event.type);
      },
      finishTurnPresentation,
    } as unknown as PlayScriptCtx;
    const step = paceCommittedTurn(timeline) as (ctx: ScriptCtx) => Promise<void>;

    const completion = step(ctx);
    await vi.advanceTimersByTimeAsync(0);

    expect(presented).toEqual(['TURN_STARTED']);
    expect(toastArea.textContent).toBe('TURN 2');
    expect(finishTurnPresentation).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_200);
    await completion;

    expect(presented).toEqual(['TURN_STARTED', 'TURN_ENDED']);
    expect(finishTurnPresentation).toHaveBeenCalledOnce();
  });
});
