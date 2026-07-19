import type { MatchEvent } from '../engine/types/events';
import type { MatchIntent } from '../engine/types/intents';
import type { Frame } from '../engine/types/timeline';

export type PresentationFrameOutcome = 'completed' | 'failed' | 'timed-out';

export interface ResolveCallTiming {
  readonly purpose: string;
  readonly turn: number;
  readonly intentType: MatchIntent['type'];
  readonly eventCount: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
}

export interface FrameApplyTiming {
  readonly transactionId: string;
  readonly frame: Frame;
  readonly eventType: MatchEvent['type'];
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
}

export interface FrameProjectionTiming {
  readonly transactionId: string;
  readonly frame: Frame;
  readonly eventType: MatchEvent['type'];
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
}

export interface FramePresentationTiming {
  readonly transactionId: string;
  readonly frame: Frame;
  readonly eventType: MatchEvent['type'];
  readonly beatKind: string;
  readonly outcome: PresentationFrameOutcome;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
}

export interface TransactionCommitTiming {
  readonly transactionId: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly resolveMs: number;
  readonly foldMs: number;
  readonly applyMs: number;
  readonly protocolValidationMs: number;
  readonly invariantValidationMs: number;
  readonly reconciliationMs: number;
  readonly publishMs?: number;
}

export interface MatchPerformanceProfile {
  readonly resolveCalls: readonly ResolveCallTiming[];
  readonly frameApplies: readonly FrameApplyTiming[];
  readonly frameProjections: readonly FrameProjectionTiming[];
  readonly framePresentations: readonly FramePresentationTiming[];
  readonly transactions: readonly TransactionCommitTiming[];
}

const DEFAULT_ENTRY_LIMIT = 2_048;

function appendBounded<T>(entries: T[], entry: T, limit: number): void {
  entries.push(Object.freeze(entry));
  if (entries.length > limit) entries.splice(0, entries.length - limit);
}

/**
 * Bounded live diagnostic sidecar. Timings never enter canonical state,
 * framed events, transaction records, replay exports, or determinism checks.
 */
export class MatchPerformanceTelemetry {
  private readonly resolveCalls: ResolveCallTiming[] = [];
  private readonly frameApplies: FrameApplyTiming[] = [];
  private readonly frameProjections: FrameProjectionTiming[] = [];
  private readonly framePresentations: FramePresentationTiming[] = [];
  private readonly transactions: TransactionCommitTiming[] = [];

  constructor(private readonly entryLimit = DEFAULT_ENTRY_LIMIT) {}

  recordResolve(entry: ResolveCallTiming): void {
    appendBounded(this.resolveCalls, entry, this.entryLimit);
  }

  recordFrameApply(entry: FrameApplyTiming): void {
    appendBounded(this.frameApplies, entry, this.entryLimit);
  }

  recordFrameProjection(entry: FrameProjectionTiming): void {
    appendBounded(this.frameProjections, entry, this.entryLimit);
  }

  recordFramePresentation(entry: FramePresentationTiming): void {
    appendBounded(this.framePresentations, entry, this.entryLimit);
  }

  recordTransaction(entry: TransactionCommitTiming): void {
    appendBounded(this.transactions, entry, this.entryLimit);
  }

  recordPublish(transactionId: string, publishMs: number): void {
    const index = this.transactions.findIndex(entry => entry.transactionId === transactionId);
    if (index < 0) return;
    this.transactions[index] = Object.freeze({
      ...this.transactions[index],
      publishMs,
    });
  }

  snapshot(): MatchPerformanceProfile {
    return Object.freeze({
      resolveCalls: Object.freeze([...this.resolveCalls]),
      frameApplies: Object.freeze([...this.frameApplies]),
      frameProjections: Object.freeze([...this.frameProjections]),
      framePresentations: Object.freeze([...this.framePresentations]),
      transactions: Object.freeze([...this.transactions]),
    });
  }
}

export function monotonicNow(): number {
  return performance.now();
}

export function elapsed(startedAtMs: number, endedAtMs: number): number {
  return Math.max(0, endedAtMs - startedAtMs);
}
