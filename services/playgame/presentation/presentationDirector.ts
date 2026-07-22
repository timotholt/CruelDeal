import type { SeatTransactionFrame, SeatTransactionTimeline } from '../runtime/projection';
import {
  elapsed,
  monotonicNow,
  type PresentationFrameOutcome,
} from '../runtime/performanceTelemetry';
import type { PresentationOutcome } from './storyboard/contracts';
import type {
  PresentationBeat,
  TransactionPresentationPlan,
} from './transactionPresentationPlanner';

export type PresentationCancelReason =
  | 'presentation-cancelled'
  | 'presentation-fast-forwarded'
  | 'presentation-superseded'
  | 'presentation-disposed'
  | 'presentation-failed';

export interface PreparedBeatPresentation {
  readonly beatId: string;
  readonly firstFrame: number;
  readonly lastFrame: number;
  /** Maximum authored playback time before diagnostic grace. */
  readonly declaredDurationMs: number;
  presentAfterAdoption(signal: AbortSignal): Promise<PresentationOutcome>;
  cancel(reason: PresentationCancelReason): void;
}

export interface PreparedTransactionPresentation {
  readonly transactionId: string;
  /** Maximum authored playback time before diagnostic grace. */
  readonly declaredDurationMs: number;
  present(signal: AbortSignal): Promise<PresentationOutcome>;
  cancel(reason: PresentationCancelReason): void;
}

export interface MatchPresentationSink {
  prepareTransaction?(
    frames: readonly SeatTransactionFrame[],
    signal: AbortSignal,
  ): Promise<PreparedTransactionPresentation | null>;
  prepareBeat(
    beat: PresentationBeat,
    signal: AbortSignal,
  ): Promise<PreparedBeatPresentation>;
  afterTransaction?(signal: AbortSignal): Promise<void>;
}

export interface PresentationCursor {
  /** Synchronously adopts every Frame in one non-painting batch. */
  advanceBatch(frames: readonly SeatTransactionFrame[]): void;
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
  /** Bounded failure budget for resource preparation only. */
  readonly preparationTimeoutMs?: number;
  /** Added to each owner's declared duration; never used as animation pacing. */
  readonly diagnosticGraceMs?: number;
  readonly reactiveCommitBarrier?: () => Promise<void>;
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
  readonly plan: TransactionPresentationPlan;
  readonly sink: MatchPresentationSink;
  readonly controller: AbortController;
  transactionOwner: PreparedTransactionPresentation | null;
  beatOwner: PreparedBeatPresentation | null;
  snapped: boolean;
  stopReason: Exclude<PresentationRunStatus, 'completed'> | null;
}

type AwaitSettlement<T> =
  | { readonly status: 'completed'; readonly value: T }
  | { readonly status: 'timed-out' | 'aborted' };

const DEFAULT_PREPARATION_TIMEOUT_MS = 5_000;
const DEFAULT_DIAGNOSTIC_GRACE_MS = 1_000;

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

export class PresentationOutcomeError extends Error {
  constructor(owner: string, outcome: Exclude<PresentationOutcome, 'COMPLETED'>) {
    super(`Prepared presentation ${owner} returned ${outcome}`);
    this.name = 'PresentationOutcomeError';
  }
}

function nextMicrotask(): Promise<void> {
  return new Promise(resolve => queueMicrotask(resolve));
}

function settleWithin<T>(
  hook: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<AwaitSettlement<T>> {
  if (signal.aborted) return Promise.resolve({ status: 'aborted' });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: AwaitSettlement<T>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = (): void => finish({ status: 'aborted' });
    const timeout = setTimeout(
      () => finish({ status: 'timed-out' }),
      timeoutMs,
    );
    signal.addEventListener('abort', onAbort, { once: true });
    void hook.then(
      value => finish({ status: 'completed', value }),
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

function cancelReasonForStatus(
  status: Exclude<PresentationRunStatus, 'completed'>,
): PresentationCancelReason {
  switch (status) {
    case 'cancelled': return 'presentation-cancelled';
    case 'fast-forwarded': return 'presentation-fast-forwarded';
    case 'superseded': return 'presentation-superseded';
    case 'disposed': return 'presentation-disposed';
  }
}

/** Sole owner of prepared-resource adoption and serial committed playback. */
export class PresentationDirector {
  readonly #cursor: PresentationCursor;
  readonly #preparationTimeoutMs: number;
  readonly #diagnosticGraceMs: number;
  readonly #reactiveCommitBarrier: () => Promise<void>;
  readonly #onFrameSettled: PresentationDirectorOptions['onFrameSettled'];
  #generation = 0;
  #active: ActiveRun | null = null;
  #disposed = false;

  constructor(options: PresentationDirectorOptions) {
    const preparationTimeoutMs = options.preparationTimeoutMs
      ?? DEFAULT_PREPARATION_TIMEOUT_MS;
    const diagnosticGraceMs = options.diagnosticGraceMs
      ?? DEFAULT_DIAGNOSTIC_GRACE_MS;
    if (!Number.isFinite(preparationTimeoutMs) || preparationTimeoutMs < 0) {
      throw new Error(
        'PresentationDirector preparationTimeoutMs must be finite and non-negative',
      );
    }
    if (!Number.isFinite(diagnosticGraceMs) || diagnosticGraceMs < 0) {
      throw new Error(
        'PresentationDirector diagnosticGraceMs must be finite and non-negative',
      );
    }
    this.#cursor = options.cursor;
    this.#preparationTimeoutMs = preparationTimeoutMs;
    this.#diagnosticGraceMs = diagnosticGraceMs;
    this.#reactiveCommitBarrier = options.reactiveCommitBarrier ?? nextMicrotask;
    this.#onFrameSettled = options.onFrameSettled;
  }

  get activeGeneration(): number | null {
    return this.#active?.generation ?? null;
  }

  present(
    plan: TransactionPresentationPlan,
    sink: MatchPresentationSink,
  ): Promise<PresentationRunResult> {
    if (this.#disposed) {
      return Promise.reject(new Error('PresentationDirector is disposed'));
    }
    if (this.#active) this.#stopActive('superseded', true);
    const run: ActiveRun = {
      generation: ++this.#generation,
      plan,
      sink,
      controller: new AbortController(),
      transactionOwner: null,
      beatOwner: null,
      snapped: false,
      stopReason: null,
    };
    this.#active = run;
    return this.#execute(run);
  }

  cancel(): boolean { return this.#stopActive('cancelled', true); }
  fastForward(): boolean { return this.#stopActive('fast-forwarded', true); }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stopActive('disposed', false);
    this.#generation += 1;
  }

  #isCurrent(run: ActiveRun): boolean {
    return !this.#disposed
      && this.#active === run
      && this.#generation === run.generation;
  }

  #cancelOwners(run: ActiveRun, reason: PresentationCancelReason): void {
    run.beatOwner?.cancel(reason);
    run.beatOwner = null;
    run.transactionOwner?.cancel(reason);
    run.transactionOwner = null;
  }

  #snap(run: ActiveRun): boolean {
    if (!this.#isCurrent(run) || run.snapped) return false;
    run.snapped = true;
    this.#cursor.snapToEnd(run.plan.timeline);
    return true;
  }

  #stopActive(
    reason: Exclude<PresentationRunStatus, 'completed'>,
    snap: boolean,
  ): boolean {
    const run = this.#active;
    if (!run) return false;
    run.stopReason = reason;
    this.#cancelOwners(run, cancelReasonForStatus(reason));
    if (snap) this.#snap(run);
    run.controller.abort(reason);
    this.#active = null;
    this.#generation += 1;
    return true;
  }

  async #fail(run: ActiveRun, error: unknown): Promise<never | PresentationRunResult> {
    this.#cancelOwners(run, 'presentation-failed');
    run.controller.abort('presentation-failed');
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

  async #awaitOwner<T>(
    run: ActiveRun,
    promise: Promise<T>,
    frame: number | null,
    timeoutMs: number,
  ): Promise<T | null> {
    const settlement = await settleWithin(
      promise,
      timeoutMs,
      run.controller.signal,
    );
    if (settlement.status === 'timed-out') {
      throw new PresentationTimeoutError(run.generation, frame, timeoutMs);
    }
    if (settlement.status !== 'completed' || !this.#isCurrent(run)) return null;
    return settlement.value;
  }

  #assertPreparedBeat(
    beat: PresentationBeat,
    prepared: PreparedBeatPresentation,
  ): void {
    const first = beat.frames[0].frame;
    const last = beat.frames.at(-1)!.frame;
    if (
      prepared.beatId !== beat.id
      || prepared.firstFrame !== first
      || prepared.lastFrame !== last
    ) {
      prepared.cancel('presentation-failed');
      throw new Error(`Prepared beat identity does not match ${beat.id}`);
    }
    this.#assertDeclaredDuration(prepared.declaredDurationMs, beat.id);
  }

  #assertDeclaredDuration(durationMs: number, owner: string): void {
    if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
      throw new Error(`${owner} has invalid declared presentation duration`);
    }
  }

  #playbackWatchdogMs(durationMs: number): number {
    const budget = durationMs + this.#diagnosticGraceMs;
    if (!Number.isSafeInteger(budget)) {
      throw new Error('Presentation watchdog budget exceeds safe integer range');
    }
    return budget;
  }

  async #execute(run: ActiveRun): Promise<PresentationRunResult> {
    try {
      if (run.sink.prepareTransaction) {
        const owner = await this.#awaitOwner(
          run,
          run.sink.prepareTransaction(
            run.plan.timeline.frames,
            run.controller.signal,
          ),
          null,
          this.#preparationTimeoutMs,
        );
        if (!this.#isCurrent(run)) return this.#stoppedResult(run);
        run.transactionOwner = owner;
        if (owner) {
          if (owner.transactionId !== run.plan.timeline.transactionId) {
            throw new Error('Prepared transaction identity mismatch');
          }
          this.#assertDeclaredDuration(owner.declaredDurationMs, owner.transactionId);
          const outcome = await this.#awaitOwner(
            run,
            owner.present(run.controller.signal),
            null,
            this.#playbackWatchdogMs(owner.declaredDurationMs),
          );
          if (!this.#isCurrent(run)) return this.#stoppedResult(run);
          if (outcome !== 'COMPLETED') {
            throw new PresentationOutcomeError(owner.transactionId, outcome!);
          }
          run.transactionOwner = null;
        }
      }

      for (const beat of run.plan.beats) {
        if (!this.#isCurrent(run)) return this.#stoppedResult(run);
        const prepared = await this.#awaitOwner(
          run,
          run.sink.prepareBeat(beat, run.controller.signal),
          beat.frames[0].frame,
          this.#preparationTimeoutMs,
        );
        if (!this.#isCurrent(run)) return this.#stoppedResult(run);
        if (!prepared) return this.#stoppedResult(run);
        this.#assertPreparedBeat(beat, prepared);
        run.beatOwner = prepared;

        // This call is intentionally the only synchronous adoption boundary.
        // The cursor implementation owns the framework batch and may not await.
        this.#cursor.advanceBatch(beat.frames);
        await this.#reactiveCommitBarrier();
        if (!this.#isCurrent(run)) return this.#stoppedResult(run);

        const startedAtMs = monotonicNow();
        let outcome: PresentationOutcome | null;
        try {
          outcome = await this.#awaitOwner(
            run,
            prepared.presentAfterAdoption(run.controller.signal),
            beat.frames[0].frame,
            this.#playbackWatchdogMs(prepared.declaredDurationMs),
          );
        } catch (error) {
          for (const frame of beat.frames) {
            this.#recordFrameSettlement(
              frame,
              error instanceof PresentationTimeoutError ? 'timed-out' : 'failed',
              startedAtMs,
            );
          }
          throw error;
        }
        if (!this.#isCurrent(run)) return this.#stoppedResult(run);
        if (outcome !== 'COMPLETED') {
          for (const frame of beat.frames) {
            this.#recordFrameSettlement(frame, 'failed', startedAtMs);
          }
          throw new PresentationOutcomeError(beat.id, outcome!);
        }
        run.beatOwner = null;
        for (const frame of beat.frames) {
          this.#recordFrameSettlement(frame, 'completed', startedAtMs);
        }
      }

      if (run.sink.afterTransaction) {
        await this.#awaitOwner(
          run,
          run.sink.afterTransaction(run.controller.signal),
          null,
          this.#preparationTimeoutMs,
        );
      }
      if (!this.#isCurrent(run)) return this.#stoppedResult(run);
      this.#active = null;
      return { generation: run.generation, status: 'completed' };
    } catch (error) {
      return this.#fail(run, error);
    }
  }

  #stoppedResult(run: ActiveRun): PresentationRunResult {
    return {
      generation: run.generation,
      status: run.stopReason ?? 'superseded',
    };
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
