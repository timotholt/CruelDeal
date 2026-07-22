import type {
  SeatTransactionFrame,
  SeatTransactionTimeline,
} from '../runtime/projection';
import {
  elapsed,
  monotonicNow,
  type PresentationFrameOutcome,
} from '../runtime/performanceTelemetry';

export interface MatchPresentationSink {
  beforeTransaction?(frames: readonly SeatTransactionFrame[]): void;
  beforeFrame?(frame: SeatTransactionFrame): void;
  afterFrame?(
    frame: SeatTransactionFrame,
    signal: AbortSignal,
  ): Promise<void> | void;
  afterTransaction?(): Promise<void> | void;
}

export interface PresentationCursor {
  /** Adopts this committed frame before its animation hook starts. */
  advance(frame: SeatTransactionFrame): void;
  /** Atomically adopts the immutable committed transaction end. */
  snapToEnd(timeline: SeatTransactionTimeline): void;
}

export type PresentationRunStatus =
  | 'completed'
  | 'cancelled'
  | 'fast-forwarded'
  | 'superseded'
  | 'disposed';

export interface PresentationRunResult {
  readonly generation: number;
  readonly status: PresentationRunStatus;
}

export interface PresentationDirectorOptions {
  readonly cursor: PresentationCursor;
  /** Maximum wait for one asynchronous presentation hook. */
  readonly timeoutMs?: number;
  /** Optional diagnostic sidecar; it has no influence on run settlement. */
  readonly onFrameSettled?: (
    frame: SeatTransactionFrame,
    timing: {
      readonly outcome: PresentationFrameOutcome;
      readonly startedAtMs: number;
      readonly endedAtMs: number;
      readonly durationMs: number;
    },
  ) => void;
}

interface ActiveRun {
  readonly generation: number;
  readonly timeline: SeatTransactionTimeline;
  readonly sink: MatchPresentationSink;
  readonly controller: AbortController;
  snapped: boolean;
  stopReason: Exclude<PresentationRunStatus, 'completed'> | null;
}

type HookSettlement = 'completed' | 'timed-out' | 'aborted';

const DEFAULT_HOOK_TIMEOUT_MS = 5_000;

export class PresentationTimeoutError extends Error {
  readonly generation: number;
  readonly frame: number | null;

  constructor(generation: number, frame: number | null, timeoutMs: number) {
    super(
      `Presentation generation ${generation} timed out${
        frame === null ? '' : ` at frame ${frame}`
      } after ${timeoutMs}ms`,
    );
    this.name = 'PresentationTimeoutError';
    this.generation = generation;
    this.frame = frame;
  }
}

function nextMicrotask(): Promise<void> {
  return new Promise(resolve => queueMicrotask(resolve));
}

function settleWithin(
  hook: Promise<void> | void,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<HookSettlement> {
  if (signal.aborted) return Promise.resolve('aborted');

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: HookSettlement): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = (): void => finish('aborted');
    const timeout = setTimeout(() => finish('timed-out'), timeoutMs);
    signal.addEventListener('abort', onAbort, { once: true });
    void Promise.resolve(hook).then(
      () => finish('completed'),
      error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Sole owner of committed presentation iteration. Match authority has already
 * committed every timeline passed here; this class can move only a visible
 * cursor and has no gameplay-command capability.
 */
export class PresentationDirector {
  readonly #cursor: PresentationCursor;
  readonly #timeoutMs: number;
  readonly #onFrameSettled: PresentationDirectorOptions['onFrameSettled'];
  #generation = 0;
  #active: ActiveRun | null = null;
  #disposed = false;

  constructor(options: PresentationDirectorOptions) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new Error('PresentationDirector timeoutMs must be finite and non-negative');
    }
    this.#cursor = options.cursor;
    this.#timeoutMs = timeoutMs;
    this.#onFrameSettled = options.onFrameSettled;
  }

  get activeGeneration(): number | null {
    return this.#active?.generation ?? null;
  }

  present(
    timeline: SeatTransactionTimeline,
    sink: MatchPresentationSink,
  ): Promise<PresentationRunResult> {
    if (this.#disposed) {
      return Promise.reject(new Error('PresentationDirector is disposed'));
    }
    if (this.#active) this.#stopActive('superseded', true);

    const run: ActiveRun = {
      generation: ++this.#generation,
      timeline,
      sink,
      controller: new AbortController(),
      snapped: false,
      stopReason: null,
    };
    this.#active = run;
    return this.#execute(run);
  }

  cancel(): boolean {
    return this.#stopActive('cancelled', true);
  }

  fastForward(): boolean {
    return this.#stopActive('fast-forwarded', true);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    // A disposed host must never receive one final cursor write. Remounting
    // adopts current authority through a new director instance.
    this.#stopActive('disposed', false);
    this.#generation++;
  }

  #isCurrent(run: ActiveRun): boolean {
    return !this.#disposed
      && this.#active === run
      && this.#generation === run.generation;
  }

  #snap(run: ActiveRun): boolean {
    if (!this.#isCurrent(run) || run.snapped) return false;
    run.snapped = true;
    this.#cursor.snapToEnd(run.timeline);
    return true;
  }

  #stopActive(
    reason: Exclude<PresentationRunStatus, 'completed'>,
    snap: boolean,
  ): boolean {
    const run = this.#active;
    if (!run) return false;
    run.stopReason = reason;
    if (snap) this.#snap(run);
    run.controller.abort(reason);
    this.#active = null;
    this.#generation++;
    return true;
  }

  async #fail(run: ActiveRun, error: unknown): Promise<never | PresentationRunResult> {
    run.controller.abort('presentation-failed');
    // Failure snaps are deliberately deferred: hooks cannot synchronously
    // re-enter cursor mutation, and a newer generation can invalidate this
    // continuation before it writes.
    await nextMicrotask();
    if (!this.#isCurrent(run)) {
      return {
        generation: run.generation,
        status: run.stopReason ?? 'superseded',
      };
    }
    this.#snap(run);
    this.#active = null;
    throw error;
  }

  async #execute(run: ActiveRun): Promise<PresentationRunResult> {
    try {
      run.sink.beforeTransaction?.(run.timeline.frames);
      for (const frame of run.timeline.frames) {
        if (!this.#isCurrent(run)) {
          return {
            generation: run.generation,
            status: run.stopReason ?? 'superseded',
          };
        }
        run.sink.beforeFrame?.(frame);
        if (!this.#isCurrent(run)) {
          return {
            generation: run.generation,
            status: run.stopReason ?? 'superseded',
          };
        }

        this.#cursor.advance(frame);
        // Cursor adoption is a reactive state write. Yield exactly one
        // microtask so every DOM consumer of frame.after can commit its
        // canonical surfaces before the sink resolves destination geometry.
        // Microtasks complete before the browser's next paint, preserving the
        // source actor's visual-ownership lease without exposing an adopted
        // destination for one frame.
        await nextMicrotask();
        if (!this.#isCurrent(run)) {
          return {
            generation: run.generation,
            status: run.stopReason ?? 'superseded',
          };
        }
        const startedAtMs = monotonicNow();
        let settlement: HookSettlement;
        try {
          settlement = await settleWithin(
            run.sink.afterFrame?.(frame, run.controller.signal),
            this.#timeoutMs,
            run.controller.signal,
          );
        } catch (error) {
          this.#recordFrameSettlement(frame, 'failed', startedAtMs);
          throw error;
        }
        if (settlement === 'timed-out') {
          this.#recordFrameSettlement(frame, 'timed-out', startedAtMs);
          throw new PresentationTimeoutError(
            run.generation,
            frame.frame,
            this.#timeoutMs,
          );
        }
        if (settlement === 'aborted' || !this.#isCurrent(run)) {
          return {
            generation: run.generation,
            status: run.stopReason ?? 'superseded',
          };
        }
        this.#recordFrameSettlement(frame, 'completed', startedAtMs);
      }

      const transactionSettlement = await settleWithin(
        run.sink.afterTransaction?.(),
        this.#timeoutMs,
        run.controller.signal,
      );
      if (transactionSettlement === 'timed-out') {
        throw new PresentationTimeoutError(
          run.generation,
          null,
          this.#timeoutMs,
        );
      }
      if (transactionSettlement === 'aborted' || !this.#isCurrent(run)) {
        return {
          generation: run.generation,
          status: run.stopReason ?? 'superseded',
        };
      }

      this.#active = null;
      return { generation: run.generation, status: 'completed' };
    } catch (error) {
      return this.#fail(run, error);
    }
  }

  #recordFrameSettlement(
    frame: SeatTransactionFrame,
    outcome: PresentationFrameOutcome,
    startedAtMs: number,
  ): void {
    if (!this.#onFrameSettled) return;
    const endedAtMs = monotonicNow();
    try {
      this.#onFrameSettled(frame, {
        outcome,
        startedAtMs,
        endedAtMs,
        durationMs: elapsed(startedAtMs, endedAtMs),
      });
    } catch {
      // Diagnostics cannot change presentation settlement.
    }
  }
}
