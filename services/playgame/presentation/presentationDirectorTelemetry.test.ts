import { afterEach, describe, expect, it, vi } from 'vitest';
import { asFrame } from '../engine/types/timeline';
import type {
  SeatTransactionFrame,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../runtime/projection';
import {
  PresentationDirector,
  PresentationTimeoutError,
} from './presentationDirector';

const state: SeatVisibleMatchState = {
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
};

const frame: SeatTransactionFrame = {
  index: 0,
  transactionId: 'telemetry:tx',
  frame: asFrame(1),
  scope: { turn: 1, phase: 'END' },
  event: { type: 'TURN_ENDED', data: { turn: 1 } },
  before: state,
  after: state,
};

const timeline: SeatTransactionTimeline = {
  transactionId: 'telemetry:tx',
  matchId: 'telemetry',
  baseRevision: 1,
  revision: 2,
  viewerSeat: 'P0',
  frames: [frame],
  finalState: state,
};

describe('PresentationDirector diagnostics', () => {
  afterEach(() => vi.useRealTimers());

  it('records completed and failed frame hooks without giving diagnostics authority', async () => {
    const outcomes: string[] = [];
    const completed = new PresentationDirector({
      cursor: { advance: () => undefined, snapToEnd: () => undefined },
      onFrameSettled: (_frame, timing) => {
        outcomes.push(timing.outcome);
        throw new Error('diagnostic sidecar failed');
      },
    });
    await expect(completed.present(timeline, {})).resolves.toMatchObject({
      status: 'completed',
    });

    const failed = new PresentationDirector({
      cursor: { advance: () => undefined, snapToEnd: () => undefined },
      onFrameSettled: (_frame, timing) => outcomes.push(timing.outcome),
    });
    await expect(failed.present(timeline, {
      afterFrame: () => { throw new Error('animation failed'); },
    })).rejects.toThrow('animation failed');

    expect(outcomes).toEqual(['completed', 'failed']);
  });

  it('records the director-owned timeout outcome', async () => {
    vi.useFakeTimers();
    const outcomes: string[] = [];
    const director = new PresentationDirector({
      cursor: { advance: () => undefined, snapToEnd: () => undefined },
      timeoutMs: 5,
      onFrameSettled: (_frame, timing) => outcomes.push(timing.outcome),
    });
    const running = director.present(timeline, {
      afterFrame: () => new Promise<void>(() => undefined),
    }).catch(error => error);

    await vi.advanceTimersByTimeAsync(5);
    expect(await running).toBeInstanceOf(PresentationTimeoutError);
    expect(outcomes).toEqual(['timed-out']);
  });
});
