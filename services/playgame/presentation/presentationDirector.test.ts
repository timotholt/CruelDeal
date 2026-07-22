import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { asFrame } from '../engine/types/timeline';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../runtime/projection';
import {
  PresentationDirector,
  PresentationTimeoutError,
  type PresentationCursor,
} from './presentationDirector';

const visibleState = (
  turn: number,
  phase: SeatVisibleMatchState['phase'] = 'AWAITING_INTENT',
): SeatVisibleMatchState => ({
  turn,
  phase,
  priority: 'P0',
  energy: { P0: turn, P1: turn },
  maxEnergy: { P0: turn, P1: turn },
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
});

const event = (turn: number): SeatAnimationEvent => ({
  type: 'TURN_ENDED',
  data: { turn },
});

const timeline = (
  id: string,
  turns: readonly number[] = [1, 2],
): SeatTransactionTimeline => {
  let before = visibleState(turns[0] ?? 1);
  const frames = turns.map((turn, index): SeatTransactionFrame => {
    const after = visibleState(turn);
    const frame = Object.freeze({
      index,
      transactionId: id,
      frame: asFrame(index + 1),
      scope: { turn, phase: 'END' as const },
      event: event(turn),
      before,
      after,
    });
    before = after;
    return frame;
  });
  return Object.freeze({
    transactionId: id,
    matchId: 'presentation-director-test',
    baseRevision: 1,
    revision: 2,
    viewerSeat: 'P0',
    frames: Object.freeze(frames),
    finalState: frames.at(-1)?.after ?? before,
  });
};

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const crossAdoptionBarrier = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const cursorRecorder = (writes: string[]): PresentationCursor => ({
  advance: frame => writes.push(`advance:${frame.transactionId}:${frame.index}`),
  snapToEnd: value => writes.push(`snap:${value.transactionId}`),
});

describe('PresentationDirector', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the sole iterator and lets each adopted frame commit before afterFrame', async () => {
    const order: string[] = [];
    const value = timeline('ordered');
    const director = new PresentationDirector({
      cursor: {
        advance: frame => {
          order.push(`advance:${frame.index}`);
          queueMicrotask(() => order.push(`adoptionCommitted:${frame.index}`));
        },
        snapToEnd: () => order.push('snap'),
      },
      timeoutMs: 100,
    });

    const result = await director.present(value, {
      beforeTransaction: frames => order.push(`beforeTransaction:${frames.length}`),
      beforeFrame: frame => order.push(`beforeFrame:${frame.index}`),
      afterFrame: async (frame, signal) => {
        order.push(`afterFrame:${frame.index}:${String(signal.aborted)}`);
      },
      afterTransaction: async () => {
        order.push('afterTransaction');
      },
    });

    expect(result).toEqual({ generation: 1, status: 'completed' });
    expect(order).toEqual([
      'beforeTransaction:2',
      'beforeFrame:0',
      'advance:0',
      'adoptionCommitted:0',
      'afterFrame:0:false',
      'beforeFrame:1',
      'advance:1',
      'adoptionCommitted:1',
      'afterFrame:1:false',
      'afterTransaction',
    ]);
    expect(director.activeGeneration).toBeNull();
  });

  it('does not prepare or adopt the next frame until the current animation and cleanup settle', async () => {
    const order: string[] = [];
    const currentAnimation = deferred();
    const director = new PresentationDirector({
      cursor: {
        advance: frame => order.push(`advance:${frame.index}`),
        snapToEnd: () => order.push('snap'),
      },
      timeoutMs: 1_000,
    });

    const running = director.present(timeline('strictly-serial'), {
      beforeFrame: frame => order.push(`prepare:${frame.index}`),
      afterFrame: async (frame) => {
        order.push(`animate:${frame.index}:start`);
        if (frame.index === 0) await currentAnimation.promise;
        order.push(`animate:${frame.index}:cleanup-complete`);
      },
    });

    await crossAdoptionBarrier();
    expect(order).toEqual([
      'prepare:0',
      'advance:0',
      'animate:0:start',
    ]);

    currentAnimation.resolve();
    await running;
    expect(order).toEqual([
      'prepare:0',
      'advance:0',
      'animate:0:start',
      'animate:0:cleanup-complete',
      'prepare:1',
      'advance:1',
      'animate:1:start',
      'animate:1:cleanup-complete',
    ]);
  });

  it('defers a failed-hook snap, snaps that generation once, and surfaces the error', async () => {
    const writes: string[] = [];
    const failure = new Error('animation failed');
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      timeoutMs: 100,
    });

    const running = director.present(timeline('failed'), {
      afterFrame: () => {
        throw failure;
      },
    });
    expect(writes).toEqual(['advance:failed:0']);

    await expect(running).rejects.toBe(failure);
    expect(writes).toEqual(['advance:failed:0', 'snap:failed']);
    expect(director.fastForward()).toBe(false);
    expect(director.cancel()).toBe(false);
    expect(writes.filter(write => write === 'snap:failed')).toHaveLength(1);
  });

  it('bounds a hanging hook, aborts its signal, and snaps to committed end', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    let signal: AbortSignal | null = null;
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      timeoutMs: 25,
    });
    const observed = director.present(timeline('timeout'), {
      afterFrame: (_frame, activeSignal) => {
        signal = activeSignal;
        return new Promise<void>(() => undefined);
      },
    }).catch(error => error as unknown);

    await vi.advanceTimersByTimeAsync(25);
    const error = await observed;

    expect(error).toBeInstanceOf(PresentationTimeoutError);
    expect(error).toMatchObject({ generation: 1, frame: 1 });
    expect(signal?.aborted).toBe(true);
    expect(writes).toEqual(['advance:timeout:0', 'snap:timeout']);
    expect(director.activeGeneration).toBeNull();
  });

  it('fast-forwards exactly once and ignores a stale hook completion', async () => {
    const writes: string[] = [];
    const pending = deferred();
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      timeoutMs: 1_000,
    });
    const first = director.present(timeline('old'), {
      afterFrame: () => pending.promise,
    });

    await crossAdoptionBarrier();
    expect(director.fastForward()).toBe(true);
    expect(director.fastForward()).toBe(false);
    await expect(first).resolves.toEqual({
      generation: 1,
      status: 'fast-forwarded',
    });

    await expect(director.present(timeline('new', [3]), {})).resolves.toEqual({
      generation: 3,
      status: 'completed',
    });
    const afterNewRun = [...writes];
    pending.resolve();
    await crossAdoptionBarrier();

    expect(writes).toEqual(afterNewRun);
    expect(writes).toEqual([
      'advance:old:0',
      'snap:old',
      'advance:new:0',
    ]);
  });

  it('supersedes an old generation and prevents its late failure from writing', async () => {
    const writes: string[] = [];
    const pending = deferred();
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      timeoutMs: 1_000,
    });
    const oldRun = director.present(timeline('generation-old'), {
      afterFrame: () => pending.promise,
    });
    await crossAdoptionBarrier();

    const newRun = director.present(timeline('generation-new', [4]), {});
    await expect(oldRun).resolves.toEqual({
      generation: 1,
      status: 'superseded',
    });
    await expect(newRun).resolves.toEqual({
      generation: 3,
      status: 'completed',
    });
    const afterNewRun = [...writes];
    pending.reject(new Error('stale animation rejection'));
    await crossAdoptionBarrier();

    expect(writes).toEqual(afterNewRun);
    expect(writes.filter(write => write === 'snap:generation-old')).toHaveLength(1);
  });

  it('cancels by snapping, while dispose invalidates without a stale cursor write', async () => {
    const writes: string[] = [];
    const cancelPending = deferred();
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      timeoutMs: 1_000,
    });
    const cancelled = director.present(timeline('cancelled'), {
      afterFrame: () => cancelPending.promise,
    });
    await crossAdoptionBarrier();
    expect(director.cancel()).toBe(true);
    await expect(cancelled).resolves.toMatchObject({ status: 'cancelled' });
    expect(writes.filter(write => write === 'snap:cancelled')).toHaveLength(1);

    const disposePending = deferred();
    const disposed = director.present(timeline('disposed'), {
      afterFrame: () => disposePending.promise,
    });
    await crossAdoptionBarrier();
    director.dispose();
    expect(director.activeGeneration).toBeNull();
    await expect(disposed).resolves.toMatchObject({ status: 'disposed' });
    expect(writes).not.toContain('snap:disposed');

    const afterDispose = [...writes];
    disposePending.resolve();
    await Promise.resolve();
    expect(writes).toEqual(afterDispose);
    await expect(director.present(timeline('too-late'), {}))
      .rejects.toThrow('disposed');
  });

  it('has no DOM or gameplay-submission capability', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'services/playgame/presentation/presentationDirector.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /\b(?:document|window|HTMLElement|DOMRect|submitIntent)\b/,
    );
    expect(source).not.toMatch(/from\s*['"][^'"]*engine\/(?:kernel|resolve|apply)/);
  });
});
