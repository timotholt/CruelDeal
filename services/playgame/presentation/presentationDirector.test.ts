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
import { planForTimeline } from './__tests__/presentationPlanFixture';
import {
  PresentationDirector,
  PresentationTimeoutError,
  type MatchPresentationSink,
  type PresentationCursor,
} from './presentationDirector';

const visibleState = (turn: number): SeatVisibleMatchState => ({
  turn,
  phase: 'AWAITING_INTENT',
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
      effect: null,
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

const sink = (
  present: (frame: SeatTransactionFrame, signal: AbortSignal) => Promise<void> | void,
  options: {
    readonly prepare?: (frame: SeatTransactionFrame) => void;
    readonly cancel?: (frame: SeatTransactionFrame) => void;
    readonly afterTransaction?: () => void;
    readonly declaredDurationMs?: number;
  } = {},
): MatchPresentationSink => ({
  prepareBeat: async (beat) => {
    const frame = beat.frames[0];
    options.prepare?.(frame);
    return {
      beatId: beat.id,
      firstFrame: frame.frame,
      lastFrame: beat.frames.at(-1)!.frame,
      declaredDurationMs: options.declaredDurationMs ?? 0,
      present: async (signal, adopt) => {
        await adopt();
        await present(frame, signal);
        return signal.aborted ? 'CANCELLED' : 'COMPLETED';
      },
      cancel: () => options.cancel?.(frame),
    };
  },
  afterTransaction: async () => options.afterTransaction?.(),
});

const crossAdoptionBarrier = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const cursorRecorder = (writes: string[]): PresentationCursor => ({
  advanceBatch: frames => {
    for (const frame of frames) writes.push(`advance:${frame.transactionId}:${frame.index}`);
  },
  snapToEnd: value => writes.push(`snap:${value.transactionId}`),
});

describe('PresentationDirector prepared lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('awaits preparation, adopts one batch, crosses the barrier, then presents', async () => {
    const order: string[] = [];
    const value = timeline('ordered');
    const director = new PresentationDirector({
      cursor: {
        advanceBatch: frames => {
          order.push(`advance:${frames[0]!.index}`);
          queueMicrotask(() => order.push(`adoptionCommitted:${frames[0]!.index}`));
        },
        snapToEnd: () => order.push('snap'),
      },
      preparationTimeoutMs: 100,
    });

    const result = await director.present(planForTimeline(value), sink(
      async (frame, signal) => order.push(`present:${frame.index}:${signal.aborted}`),
      {
        prepare: frame => order.push(`prepare:${frame.index}`),
        afterTransaction: () => order.push('afterTransaction'),
      },
    ));

    expect(result).toEqual({ generation: 1, status: 'completed' });
    expect(order).toEqual([
      'prepare:0',
      'advance:0',
      'adoptionCommitted:0',
      'present:0:false',
      'prepare:1',
      'advance:1',
      'adoptionCommitted:1',
      'present:1:false',
      'afterTransaction',
    ]);
  });

  it('does not prepare the next beat until current presentation cleanup settles', async () => {
    const order: string[] = [];
    const gate = deferred();
    const director = new PresentationDirector({ cursor: cursorRecorder(order) });
    const running = director.present(planForTimeline(timeline('serial')), sink(
      async (frame) => {
        order.push(`present:${frame.index}:start`);
        if (frame.index === 0) await gate.promise;
        order.push(`present:${frame.index}:cleanup`);
      },
      { prepare: frame => order.push(`prepare:${frame.index}`) },
    ));

    await vi.waitFor(() => expect(order).toContain('present:0:start'));
    expect(order).toEqual(['prepare:0', 'advance:serial:0', 'present:0:start']);
    gate.resolve();
    await running;
    expect(order).toContain('prepare:1');
    expect(order.indexOf('prepare:1')).toBeGreaterThan(order.indexOf('present:0:cleanup'));
  });

  it('keeps canonical state at beat.before until the prepared owner hands off', async () => {
    const order: string[] = [];
    const handoff = deferred();
    const value = timeline('authored-handoff', [1]);
    const director = new PresentationDirector({ cursor: cursorRecorder(order) });
    const running = director.present(planForTimeline(value), {
      prepareBeat: async beat => ({
        beatId: beat.id,
        firstFrame: beat.frames[0].frame,
        lastFrame: beat.frames.at(-1)!.frame,
        declaredDurationMs: 1_000,
        present: async (_signal, adopt) => {
          order.push('actor:start');
          await handoff.promise;
          order.push('actor:handoff');
          await adopt();
          order.push('actor:cleanup');
          return 'COMPLETED';
        },
        cancel: () => undefined,
      }),
    });

    await vi.waitFor(() => expect(order).toContain('actor:start'));
    expect(order).toEqual(['actor:start']);
    handoff.resolve();
    await expect(running).resolves.toMatchObject({ status: 'completed' });
    expect(order).toEqual([
      'actor:start',
      'actor:handoff',
      'advance:authored-handoff:0',
      'actor:cleanup',
    ]);
  });

  it('does not adopt a beat when preparation fails', async () => {
    const writes: string[] = [];
    const failure = new Error('prepare failed');
    const director = new PresentationDirector({ cursor: cursorRecorder(writes) });
    const broken: MatchPresentationSink = {
      prepareBeat: async () => { throw failure; },
    };
    await expect(director.present(planForTimeline(timeline('prepare-failed')), broken))
      .rejects.toBe(failure);
    expect(writes).toEqual(['snap:prepare-failed']);
  });

  it('fails closed after adoption, cancels the owner, and snaps once', async () => {
    const writes: string[] = [];
    const cancelled: string[] = [];
    const failure = new Error('animation failed');
    const director = new PresentationDirector({ cursor: cursorRecorder(writes) });
    await expect(director.present(planForTimeline(timeline('failed')), sink(
      () => { throw failure; },
      { cancel: frame => cancelled.push(String(frame.index)) },
    ))).rejects.toBe(failure);
    expect(writes).toEqual(['advance:failed:0', 'snap:failed']);
    expect(cancelled).toEqual(['0']);
  });

  it('bounds a hanging owner, aborts it, cancels resources, and snaps', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    let signal: AbortSignal | null = null;
    let cancelled = false;
    const director = new PresentationDirector({
      cursor: cursorRecorder(writes),
      diagnosticGraceMs: 25,
    });
    const observed = director.present(planForTimeline(timeline('timeout')), sink(
      (_frame, activeSignal) => {
        signal = activeSignal;
        return new Promise<void>(() => undefined);
      },
      { cancel: () => { cancelled = true; } },
    )).catch(error => error);
    await vi.advanceTimersByTimeAsync(25);
    const error = await observed;
    expect(error).toBeInstanceOf(PresentationTimeoutError);
    expect(signal?.aborted).toBe(true);
    expect(cancelled).toBe(true);
    expect(writes).toEqual(['advance:timeout:0', 'snap:timeout']);
  });

  it('derives its playback watchdog from a prepared owner\'s declared duration', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const director = new PresentationDirector({ cursor: cursorRecorder(writes) });
    const running = director.present(
      planForTimeline(timeline('declared-duration', [1])),
      sink(
        () => new Promise<void>(resolve => setTimeout(resolve, 5_150)),
        { declaredDurationMs: 5_150 },
      ),
    );

    await crossAdoptionBarrier();
    await vi.advanceTimersByTimeAsync(5_150);
    await expect(running).resolves.toMatchObject({ status: 'completed' });
    expect(writes).not.toContain('snap:declared-duration');
  });

  it('fast-forwards exactly once and ignores stale completion', async () => {
    const writes: string[] = [];
    const gate = deferred();
    const director = new PresentationDirector({ cursor: cursorRecorder(writes) });
    const running = director.present(planForTimeline(timeline('old')), sink(
      () => gate.promise,
    ));
    await crossAdoptionBarrier();
    expect(director.fastForward()).toBe(true);
    expect(director.fastForward()).toBe(false);
    await expect(running).resolves.toMatchObject({ status: 'fast-forwarded' });
    const settled = [...writes];
    gate.resolve();
    await crossAdoptionBarrier();
    expect(writes).toEqual(settled);
  });

  it('supersedes old ownership and dispose performs no stale cursor write', async () => {
    const writes: string[] = [];
    const oldGate = deferred();
    const director = new PresentationDirector({ cursor: cursorRecorder(writes) });
    const old = director.present(planForTimeline(timeline('old-generation')), sink(
      () => oldGate.promise,
    ));
    await crossAdoptionBarrier();
    const next = director.present(planForTimeline(timeline('new-generation', [3])), sink(
      () => undefined,
    ));
    await expect(old).resolves.toMatchObject({ status: 'superseded' });
    await expect(next).resolves.toMatchObject({ status: 'completed' });

    const disposeGate = deferred();
    const disposed = director.present(planForTimeline(timeline('disposed')), sink(
      () => disposeGate.promise,
    ));
    await crossAdoptionBarrier();
    director.dispose();
    await expect(disposed).resolves.toMatchObject({ status: 'disposed' });
    expect(writes).not.toContain('snap:disposed');
  });

  it('has no DOM or gameplay-submission capability', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'services/playgame/presentation/presentationDirector.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/\b(?:document|window|HTMLElement|DOMRect|submitIntent)\b/);
    expect(source).not.toMatch(/from\s*['"][^'"]*engine\/(?:kernel|resolve|apply)/);
  });
});
