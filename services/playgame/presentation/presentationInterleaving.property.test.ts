import { describe, expect, it } from 'vitest';

import { createRng } from '../engine';
import { asFrame } from '../engine/types/timeline';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatTransactionTimeline,
  SeatVisibleMatchState,
} from '../runtime/projection';
import { PresentationDirector } from './presentationDirector';
import { planForTimeline } from './__tests__/presentationPlanFixture';

const PROPERTY_FILE =
  'services/playgame/presentation/presentationInterleaving.property.test.ts';
const DEFAULT_LOCAL_CASES = 12;
const MINIMUM_CI_CASES = 200;
const DEFAULT_SUITE_SEED = 'phase3a-p-interleave-v1';
const MODES = ['complete', 'failure', 'cancel', 'fast-forward'] as const;

type InterleaveMode = typeof MODES[number];

interface PropertyCaseRef {
  readonly index: number;
  readonly seed: string;
}

interface Scenario {
  readonly seed: string;
  readonly mode: InterleaveMode;
  readonly timeline: SeatTransactionTimeline;
  readonly injectionIndex: number;
  readonly delayTicks: readonly number[];
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function positiveInteger(value: string | undefined, name: string): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer; received ${value}`);
  }
  return parsed;
}

const suiteSeed = process.env.PLAYGAME_INTERLEAVE_SEED ?? DEFAULT_SUITE_SEED;
const exactCaseSeed = process.env.PLAYGAME_INTERLEAVE_CASE_SEED;
const configuredCases = positiveInteger(
  process.env.PLAYGAME_INTERLEAVE_CASES
    ?? process.env.PLAYGAME_PROPERTY_CASES
    ?? process.env.PROPERTY_CASES,
  'PLAYGAME_INTERLEAVE_CASES',
);
const runningInCi = /^(1|true|yes)$/i.test(process.env.CI ?? '');
const caseCount = runningInCi
  ? Math.max(configuredCases ?? MINIMUM_CI_CASES, MINIMUM_CI_CASES)
  : configuredCases ?? DEFAULT_LOCAL_CASES;
const propertyTimeoutMs = Math.max(30_000, caseCount * 100);

function propertyCases(): readonly PropertyCaseRef[] {
  if (exactCaseSeed) return [{ index: 0, seed: exactCaseSeed }];
  return Array.from({ length: caseCount }, (_, index) => ({
    index,
    seed: `${suiteSeed}::case:${index}`,
  }));
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function state(marker: number): SeatVisibleMatchState {
  return {
    turn: marker,
    phase: marker % 2 === 0 ? 'RESOLVING' : 'AWAITING_INTENT',
    priority: marker % 2 === 0 ? 'P1' : 'P0',
    energy: { P0: marker, P1: marker + 1 },
    maxEnergy: { P0: marker + 2, P1: marker + 3 },
    nextTurnEnergyBonus: { P0: 0, P1: 0 },
    deckCounts: {
      P0: Math.max(0, 12 - marker),
      P1: Math.max(0, 11 - marker),
    },
    locationDeckCount: Math.max(0, 3 - marker),
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
}

function animationEvent(marker: number): SeatAnimationEvent {
  return {
    type: 'TURN_ENDED',
    data: { turn: marker },
  };
}

function generateScenario(seed: string, mode: InterleaveMode): Scenario {
  const rng = createRng(`${seed}::${mode}`);
  const frameCount = rng.int(1, 12);
  const injectionIndex = rng.int(0, frameCount - 1);
  const transactionId = `p-interleave:${seed}:${mode}`;
  let before = state(0);
  const frames: SeatTransactionFrame[] = [];
  for (let index = 0; index < frameCount; index++) {
    const after = state(index + 1);
    frames.push(Object.freeze({
      index,
      transactionId,
      frame: asFrame(index + 1),
      scope: { turn: index + 1, phase: 'END' },
      event: animationEvent(index + 1),
      effect: null,
      before,
      after,
    }));
    before = after;
  }
  const timeline = Object.freeze({
    transactionId,
    matchId: `match:${seed}`,
    baseRevision: 40,
    revision: 41,
    viewerSeat: 'P0' as const,
    frames: Object.freeze(frames),
    finalState: frames.at(-1)!.after,
  });
  return {
    seed,
    mode,
    timeline,
    injectionIndex,
    delayTicks: Object.freeze(
      Array.from({ length: frameCount }, () => rng.int(0, 3)),
    ),
  };
}

async function delayMicrotasks(count: number): Promise<void> {
  for (let index = 0; index < count; index++) await Promise.resolve();
}

function authorityFixture(timeline: SeatTransactionTimeline): object {
  return {
    matchId: timeline.matchId,
    currentRevision: timeline.revision,
    currentState: timeline.finalState,
    transactions: [{
      transactionId: timeline.transactionId,
      baseRevision: timeline.baseRevision,
      revision: timeline.revision,
      log: timeline.frames.map(frame => ({
        frame: frame.frame,
        scope: frame.scope,
        event: frame.event,
        after: frame.after,
      })),
    }],
  };
}

async function assertScenario(scenario: Scenario): Promise<void> {
  const authority = authorityFixture(scenario.timeline);
  const noPresentationBytes = JSON.stringify(authority);
  let visibleCursor = scenario.timeline.frames[0]!.before;
  const reachedInjection = deferred();
  const heldHook = deferred();
  let staleWriteCount = 0;

  const director = new PresentationDirector({
    cursor: {
      advanceBatch: frames => {
        for (const frame of frames) visibleCursor = frame.after;
      },
      snapToEnd: timeline => { visibleCursor = timeline.finalState; },
    },
    preparationTimeoutMs: 1_000,
    diagnosticGraceMs: 1_000,
  });
  const observed = director.present(planForTimeline(scenario.timeline), {
    prepareBeat: async beat => ({
      beatId: beat.id,
      firstFrame: beat.frames[0].frame,
      lastFrame: beat.frames.at(-1)!.frame,
      declaredDurationMs: 0,
      presentAfterAdoption: async (signal) => {
        const frame = beat.frames[0];
        await delayMicrotasks(scenario.delayTicks[frame.index] ?? 0);
        if (frame.index !== scenario.injectionIndex) return 'COMPLETED';
        if (scenario.mode === 'failure') {
          throw new Error(`generated presentation failure at ${frame.index}`);
        }
        if (scenario.mode === 'cancel' || scenario.mode === 'fast-forward') {
          reachedInjection.resolve();
          await heldHook.promise;
          staleWriteCount++;
        }
        return signal.aborted ? 'CANCELLED' : 'COMPLETED';
      },
      cancel: () => undefined,
    }),
  }).then(
    result => ({ result, error: null as unknown }),
    error => ({ result: null, error }),
  );

  if (scenario.mode === 'cancel' || scenario.mode === 'fast-forward') {
    await reachedInjection.promise;
    const interrupted = scenario.mode === 'cancel'
      ? director.cancel()
      : director.fastForward();
    expect(interrupted).toBe(true);
  }

  const settlement = await observed;
  if (scenario.mode === 'failure') {
    expect(settlement.result).toBeNull();
    expect(settlement.error).toBeInstanceOf(Error);
  } else {
    expect(settlement.error).toBeNull();
    expect(settlement.result?.status).toBe(
      scenario.mode === 'complete'
        ? 'completed'
        : scenario.mode === 'cancel'
          ? 'cancelled'
          : 'fast-forwarded',
    );
  }

  expect(visibleCursor).toEqual(scenario.timeline.finalState);
  expect(director.activeGeneration).toBeNull();
  expect(JSON.stringify(authority)).toBe(noPresentationBytes);

  const settledCursorBytes = JSON.stringify(visibleCursor);
  heldHook.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(staleWriteCount).toBe(
    scenario.mode === 'cancel' || scenario.mode === 'fast-forward' ? 1 : 0,
  );
  expect(JSON.stringify(visibleCursor)).toBe(settledCursorBytes);
  expect(JSON.stringify(authority)).toBe(noPresentationBytes);
}

function reproductionMessage(
  caseRef: PropertyCaseRef,
  mode: InterleaveMode,
  error: unknown,
): string {
  const cause = error instanceof Error ? error.stack ?? error.message : String(error);
  return [
    `P-INTERLEAVE failed for generated case ${caseRef.index} (${mode})`,
    `suite seed: ${suiteSeed}`,
    `generator seed: ${caseRef.seed}`,
    'Reproduce with:',
    `PLAYGAME_INTERLEAVE_CASE_SEED='${caseRef.seed}' npx vitest run ${PROPERTY_FILE}`,
    'Cause:',
    cause,
  ].join('\n');
}

describe('P-INTERLEAVE generated presentation property', () => {
  it('settles the visible cursor without mutating authoritative state or log', async () => {
    for (const caseRef of propertyCases()) {
      for (const mode of MODES) {
        try {
          await assertScenario(generateScenario(caseRef.seed, mode));
        } catch (error) {
          throw new Error(reproductionMessage(caseRef, mode, error), {
            cause: error,
          });
        }
      }
    }
  }, propertyTimeoutMs);
});
