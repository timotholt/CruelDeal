import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MatchEvent } from '../engine/types/events';
import type { EventTransition } from '../engine/transactionTimeline';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import {
  paceCommittedOpening,
  paceCommittedTurn,
  type PlayScriptCtx,
} from './actions';
import type { ScriptCtx } from './runner';

const transition = (frame: number, event: MatchEvent): EventTransition => ({
  transactionId: 'turn-banner-order',
  frame,
  event,
  before: {} as EventTransition['before'],
  after: {} as EventTransition['after'],
});

const timelineFrom = (
  transitions: readonly EventTransition[],
): CommittedTransactionTimeline => ({
  transaction: {
    framedEvents: transitions.map(({ transactionId, frame, event }) => ({
      transactionId,
      frame,
      event,
    })),
  },
  transitions,
} as unknown as CommittedTransactionTimeline);

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
    const timeline = timelineFrom(transitions);
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

  it('walks opening frames continuously and inserts TURN 1 at the location boundary', async () => {
    vi.useFakeTimers();
    const location = transition(2, {
      type: 'LOCATION_REVEALED',
      lane: 0,
      locationId: 'opening-location' as never,
      cause: {
        sourceId: 'opening-location',
        effectKind: 'SYSTEM',
        reason: 'OPENING',
      },
    });
    const transitions = [
      transition(1, { type: 'TURN_ENDED', turn: 0 }),
      {
        ...location,
        before: { locationStore: {} } as EventTransition['before'],
        after: { locationStore: {} } as EventTransition['after'],
      },
    ];
    const toastArea = document.createElement('div');
    const presented: MatchEvent['type'][] = [];
    const ctx = {
      localSeat: 'P0',
      boardEl: document.createElement('div'),
      toastArea,
      manifest: {},
      setUi: vi.fn(),
      presentCommittedFrame: (frame: EventTransition) => {
        presented.push(frame.event.type);
      },
    } as unknown as PlayScriptCtx;
    const step = paceCommittedOpening(timelineFrom(transitions)) as (
      ctx: ScriptCtx,
    ) => Promise<void>;

    const completion = step(ctx);
    await vi.advanceTimersByTimeAsync(0);

    expect(presented).toEqual(['TURN_ENDED']);
    expect(toastArea.textContent).toBe('TURN 1');

    await vi.advanceTimersByTimeAsync(1_900);
    expect(presented).toEqual(['TURN_ENDED']);

    await vi.advanceTimersByTimeAsync(350);
    expect(presented).toEqual(['TURN_ENDED', 'LOCATION_REVEALED']);

    await vi.advanceTimersByTimeAsync(350);
    await completion;
  });

  it('opens the result prompt on the MATCH_ENDED frame rather than transaction completion', async () => {
    const result = {
      winner: 'P0' as const,
      lanesWon: { P0: 2, P1: 1 },
      totalPower: { P0: 20, P1: 15 },
    };
    const transitions = [
      transition(1, { type: 'MATCH_ENDED', result }),
      transition(2, { type: 'TURN_ENDED', turn: 6 }),
    ];
    const presented: MatchEvent['type'][] = [];
    const presentedWhenPromptOpened: MatchEvent['type'][][] = [];
    const setUi = vi.fn((key: string, value: unknown) => {
      if (key === 'showEndGamePrompt' && value === true) {
        presentedWhenPromptOpened.push([...presented]);
      }
    });
    const ctx = {
      localSeat: 'P0',
      toastArea: document.createElement('div'),
      setUi,
      presentCommittedFrame: (frame: EventTransition) => {
        presented.push(frame.event.type);
      },
      finishTurnPresentation: vi.fn(),
    } as unknown as PlayScriptCtx;
    const step = paceCommittedTurn(timelineFrom(transitions)) as (
      ctx: ScriptCtx,
    ) => Promise<void>;

    await step(ctx);

    expect(presentedWhenPromptOpened).toEqual([['MATCH_ENDED']]);
    expect(setUi).toHaveBeenCalledWith('lockedResult', result);
    expect(presented).toEqual(['MATCH_ENDED', 'TURN_ENDED']);
  });
});
