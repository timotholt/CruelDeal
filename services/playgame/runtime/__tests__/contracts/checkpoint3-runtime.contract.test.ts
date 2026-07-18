import { describe, expect, test } from 'vitest';

import type { MatchEvent } from '../../../engine/types/events';
import type {
  CommittedTransactionRecord,
  IntentAcceptanceResult,
  IntentEnvelope,
  MatchRevision,
} from '../../contracts';

interface HarnessIntent {
  readonly type: 'CHECKPOINT_3_TEST_INTENT';
  readonly label: string;
}

interface HarnessCommand {
  readonly envelope: IntentEnvelope<HarnessIntent>;
  readonly events: readonly MatchEvent[];
}

/**
 * Checkpoint 3 supplies this adapter around the real runtime. Keeping the
 * harness outside CP1 prevents these red contracts from becoming a second
 * queue/commit implementation.
 */
interface Checkpoint3RuntimeHarness {
  pauseDrain(): void;
  resumeDrain(): void;
  setDequeueLegality(intentId: string, legal: boolean): void;
  submit(command: HarnessCommand): Promise<IntentAcceptanceResult>;
  revision(): MatchRevision;
  transactions(): readonly CommittedTransactionRecord[];
  eventApplicationCounts(): ReadonlyMap<string, number>;
}

interface Checkpoint3HarnessModule {
  createCheckpoint3RuntimeHarness(): Checkpoint3RuntimeHarness;
}

const futureHarnessModuleUrl = new URL('../../checkpoint3RuntimeHarness.ts', import.meta.url).href;

async function createHarness(): Promise<Checkpoint3RuntimeHarness> {
  const checkpoint3 = await import(
    /* @vite-ignore -- this expected-failing module lands with checkpoint 3 */
    futureHarnessModuleUrl
  ) as Checkpoint3HarnessModule;
  return checkpoint3.createCheckpoint3RuntimeHarness();
}

function command(
  intentId: string,
  expectedRevision: MatchRevision,
  events: readonly MatchEvent[] = [{ type: 'TURN_ENDED', turn: 1 }],
): HarnessCommand {
  return {
    envelope: {
      matchId: 'phase1-contract-match',
      seat: 'P0',
      intentId,
      expectedRevision,
      intent: { type: 'CHECKPOINT_3_TEST_INTENT', label: intentId },
    },
    events,
  };
}

describe('Phase 1 checkpoint 3 runtime behavior contracts', () => {
  test.fails('drains concurrently submitted work in FIFO order', async () => {
    const runtime = await createHarness();
    runtime.pauseDrain();

    const first = runtime.submit(command('fifo-first', 0));
    const second = runtime.submit(command('fifo-second', 1));
    runtime.resumeDrain();

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect(runtime.transactions().map((record) => record.intent.intentId)).toEqual([
      'fifo-first',
      'fifo-second',
    ]);
    expect(runtime.revision()).toBe(2);
  });

  test.fails('validates legality against authoritative state when dequeued', async () => {
    const runtime = await createHarness();
    runtime.pauseDrain();

    const submittedWhileLegal = runtime.submit(command('illegal-at-dequeue', 0));
    runtime.setDequeueLegality('illegal-at-dequeue', false);
    runtime.resumeDrain();

    const result = await submittedWhileLegal;
    expect(result).toMatchObject({
      status: 'illegal',
      intentId: 'illegal-at-dequeue',
      code: 'PHASE_INVALID',
      currentRevision: 0,
    });
    expect(runtime.transactions()).toHaveLength(0);
    expect(runtime.revision()).toBe(0);
  });

  test.fails('returns an idempotent duplicate receipt without a second commit', async () => {
    const runtime = await createHarness();
    const originalCommand = command('retry-me', 0);

    const accepted = await runtime.submit(originalCommand);
    const duplicate = await runtime.submit(originalCommand);

    expect(accepted.status).toBe('accepted');
    expect(duplicate).toMatchObject({
      status: 'duplicate',
      intentId: 'retry-me',
      original: { status: 'accepted', revision: 1 },
    });
    expect(runtime.transactions()).toHaveLength(1);
    expect(runtime.revision()).toBe(1);
  });

  test.fails('applies every event in an accepted transaction exactly once', async () => {
    const runtime = await createHarness();
    const events: readonly MatchEvent[] = [
      { type: 'TURN_ENDED', turn: 1 },
      { type: 'TURN_STARTED', turn: 2, priority: 'P1', priorityReason: 'RETAINED' },
    ];

    const result = await runtime.submit(command('exactly-once', 0, events));
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;

    const counts = runtime.eventApplicationCounts();
    expect(counts.get(`${result.transaction.transactionId}:0`)).toBe(1);
    expect(counts.get(`${result.transaction.transactionId}:1`)).toBe(1);
    expect([...counts.values()]).toEqual([1, 1]);
    expect(runtime.transactions()[0]?.events).toEqual(events);
  });
});
