import { afterEach, describe, expect, it, vi } from 'vitest';

import { asFrame } from '../engine/types/timeline';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../runtime/projection';
import {
  paceCommittedOpening,
  paceCommittedTurn,
  type PlayScriptCtx,
} from './actions';
import type { ScriptCtx } from './runner';

const state = (
  overrides: Partial<SeatVisibleMatchState> = {},
): SeatVisibleMatchState => ({
  turn: 1,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  energy: { P0: 1, P1: 1 },
  maxEnergy: { P0: 1, P1: 1 },
  nextTurnEnergyBonus: { P0: 0, P1: 0 },
  deckCounts: { P0: 0, P1: 0 },
  locationDeckCount: 0,
  hands: { P0: [], P1: [] },
  cards: [],
  lanes: [],
  stagedCards: [],
  discard: { P0: [], P1: [] },
  destroyed: { P0: [], P1: [] },
  banished: { P0: [], P1: [] },
  banishedCounts: { P0: 0, P1: 0 },
  result: null,
  ...overrides,
});

const transition = (
  frame: number,
  event: SeatAnimationEvent,
  before = state(),
  after = before,
): SeatTransactionFrame => ({
  index: frame - 1,
  transactionId: 'turn-banner-order',
  frame: asFrame(frame),
  scope: { turn: 1, phase: 'ACTION' },
  event,
  before,
  after,
});

const timelineFrom = (
  frames: readonly SeatTransactionFrame[],
): SeatTransactionTimeline => ({
  transactionId: 'turn-banner-order',
  matchId: 'presentation-test',
  baseRevision: 0,
  revision: 1,
  viewerSeat: 'P0',
  frames,
  finalState: frames.at(-1)?.after ?? state(),
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
        data: {
          turn: 2,
          priority: 'P0',
          priorityReason: 'RETAINED',
        },
      }),
      transition(2, { type: 'TURN_ENDED', data: { turn: 2 } }),
    ];
    const timeline = timelineFrom(transitions);
    const toastArea = document.createElement('div');
    const presented: SeatAnimationEvent['type'][] = [];
    const finishTurnPresentation = vi.fn();
    const ctx = {
      state: state(),
      ui: { lockedResult: null },
      localSeat: 'P0',
      toastArea,
      setUi: vi.fn(),
      presentCommittedFrame: (frame: SeatTransactionFrame) => {
        if (frame.event) presented.push(frame.event.type);
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
      data: {
        lane: 0,
        location: 'opening-location',
        defId: 'opening-location',
      },
    });
    const transitions = [
      transition(1, { type: 'TURN_ENDED', data: { turn: 0 } }),
      location,
    ];
    const toastArea = document.createElement('div');
    const presented: SeatAnimationEvent['type'][] = [];
    const ctx = {
      localSeat: 'P0',
      boardEl: document.createElement('div'),
      toastArea,
      manifest: {},
      setUi: vi.fn(),
      presentCommittedFrame: (frame: SeatTransactionFrame) => {
        if (frame.event) presented.push(frame.event.type);
      },
    } as unknown as PlayScriptCtx;
    const step = paceCommittedOpening(timelineFrom(transitions)) as (
      ctx: ScriptCtx,
    ) => Promise<void>;

    const completion = step(ctx);
    await vi.advanceTimersByTimeAsync(0);

    expect(presented).toEqual(['TURN_ENDED']);
    expect(toastArea.textContent).toBe('TURN 1');

    await vi.advanceTimersByTimeAsync(1_800);
    expect(presented).toEqual(['TURN_ENDED']);

    await vi.advanceTimersByTimeAsync(450);
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
      transition(
        1,
        { type: 'MATCH_ENDED', data: { result } },
        state(),
        state({ result }),
      ),
      transition(2, { type: 'TURN_ENDED', data: { turn: 6 } }),
    ];
    const presented: SeatAnimationEvent['type'][] = [];
    const presentedWhenPromptOpened: SeatAnimationEvent['type'][][] = [];
    const setUi = vi.fn((key: string, value: unknown) => {
      if (key === 'showEndGamePrompt' && value === true) {
        presentedWhenPromptOpened.push([...presented]);
      }
    });
    const ctx = {
      localSeat: 'P0',
      toastArea: document.createElement('div'),
      setUi,
      presentCommittedFrame: (frame: SeatTransactionFrame) => {
        if (frame.event) presented.push(frame.event.type);
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
