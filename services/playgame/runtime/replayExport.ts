import type { Manifest } from '../engine/manifest/types';
import type { ReplayResult, ReplayStep } from '../engine/replay';
import { currentFrame } from '../engine/timeline';
import { foldCanonicalFrames } from '../engine/transactionTimeline';
import { GENESIS_FRAME } from '../engine/types/timeline';
import { assertAuthorityPayload } from '../protocol';
import type { MatchState } from '../engine/types/state';
import type {
  MatchRuntimeRecordExport,
  MatchRuntimeReplayExport,
  DebugMatchCheckpoint,
} from './contracts';

export interface MatchReconciliationResult {
  readonly ok: boolean;
  readonly expectedFingerprint: string;
  readonly replayedFingerprint: string;
  readonly expectedFrame: number;
  readonly replayedFrame: number;
  readonly transactionCount: number;
  readonly eventCount: number;
  readonly checkpointCount: number;
  readonly mismatchPath?: string;
}

export class DeterminismDriftError extends Error {
  readonly reconciliation: MatchReconciliationResult;

  constructor(reconciliation: MatchReconciliationResult) {
    super(
      `Deterministic replay drift at ${reconciliation.mismatchPath ?? '/'}: `
      + `live=${reconciliation.expectedFingerprint} `
      + `replay=${reconciliation.replayedFingerprint}`,
    );
    this.name = 'DeterminismDriftError';
    this.reconciliation = reconciliation;
  }
}

/** Stable comparison encoding; this is diagnostic, not an integrity boundary. */
export function canonicalJson(value: unknown): string {
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .filter(([, child]) => child !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, visit(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(visit(value));
}

function diagnosticChecksum(json: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function firstMismatchPath(left: unknown, right: unknown, path = ''): string | undefined {
  if (Object.is(left, right)) return undefined;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return `${path}/length`;
    for (let index = 0; index < left.length; index += 1) {
      const mismatch = firstMismatchPath(left[index], right[index], `${path}/${index}`);
      if (mismatch) return mismatch;
    }
    return undefined;
  }
  if (
    left !== null
    && right !== null
    && typeof left === 'object'
    && typeof right === 'object'
  ) {
    const leftRecord = left as Readonly<Record<string, unknown>>;
    const rightRecord = right as Readonly<Record<string, unknown>>;
    const keys = [...new Set([
      ...Object.keys(leftRecord),
      ...Object.keys(rightRecord),
    ])].sort();
    for (const key of keys) {
      if (!(key in leftRecord) || !(key in rightRecord)) return `${path}/${key}`;
      const mismatch = firstMismatchPath(
        leftRecord[key],
        rightRecord[key],
        `${path}/${key}`,
      );
      if (mismatch) return mismatch;
    }
    return undefined;
  }
  return path || '/';
}

/**
 * Fold the canonical runtime record without any descriptive/session metadata.
 * This is the same path used by live debug reconciliation and replay viewing.
 */
export function renderRuntimeRecord(
  replay: MatchRuntimeRecordExport,
  matchId: string,
  manifest: Manifest,
): ReplayResult {
  const serializedVersion = (replay as { readonly version: number }).version;
  if (serializedVersion !== 3) {
    throw new Error(`Unsupported runtime replay version: ${serializedVersion}`);
  }
  if (
    currentFrame(replay.genesis) !== GENESIS_FRAME
    || replay.genesis.timeline.scope !== null
  ) {
    throw new Error(
      `Runtime replay genesis must be frame 0; received frame ${currentFrame(replay.genesis)}`,
    );
  }

  const steps: ReplayStep[] = [{
    cursor: 0,
    canonicalFrame: null,
    frame: GENESIS_FRAME,
    scope: null,
    event: null,
    state: replay.genesis,
  }];
  let state = replay.genesis;
  let previousRevision = 0;
  const transactionIds = new Set<string>();

  for (const transaction of replay.transactions) {
    if (transactionIds.has(transaction.transactionId)) {
      throw new Error(`Runtime replay has duplicate transactionId ${transaction.transactionId}`);
    }
    transactionIds.add(transaction.transactionId);
    if (transaction.matchId !== matchId) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has the wrong matchId`);
    }
    if (
      transaction.baseRevision < previousRevision
      || transaction.revision <= previousRevision
    ) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} is out of order`);
    }
    if (transaction.revision !== transaction.baseRevision + 1) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has a non-contiguous commit revision`);
    }
    if (transaction.frames.length === 0) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has no framed events`);
    }
    assertAuthorityPayload('COMMITTED_TRANSACTION', transaction);
    if (transaction.rngDrawsBefore !== state.rng.draws) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has the wrong RNG start cursor`);
    }

    const built = foldCanonicalFrames({
      transactionId: transaction.transactionId,
      initialState: state,
      frames: transaction.frames,
      manifest,
    });
    if (transaction.rngDrawsAfter !== built.finalState.rng.draws) {
      throw new Error(`Runtime replay transaction ${transaction.transactionId} has the wrong RNG end cursor`);
    }
    for (const frame of built.transitions) {
      steps.push({
        cursor: steps.length,
        transactionId: transaction.transactionId,
        canonicalFrame: frame.canonicalFrame,
        frame: frame.frame,
        scope: frame.scope,
        event: frame.event,
        state: frame.after,
      });
    }
    state = built.finalState;
    previousRevision = transaction.revision;
  }

  return {
    initialState: replay.genesis,
    finalState: state,
    steps,
  };
}

export function reconcileRuntimeRecord(
  replay: MatchRuntimeRecordExport,
  matchId: string,
  manifest: Manifest,
  expectedState: MatchState,
  debugCheckpoints: readonly DebugMatchCheckpoint[] = [],
): MatchReconciliationResult {
  const rendered = renderRuntimeRecord(replay, matchId, manifest);
  const replayed = rendered.finalState;
  const expectedJson = canonicalJson(expectedState);
  const replayedJson = canonicalJson(replayed);
  const replayByFrame = new Map(
    rendered.steps.map(step => [step.frame as number, step.state]),
  );
  const checkpointMismatch = debugCheckpoints.find((checkpoint) => {
    const checkpointState = replayByFrame.get(checkpoint.frame);
    return checkpointState === undefined
      || canonicalJson(checkpointState) !== checkpoint.stateJson
      || checkpointState.rng.draws !== checkpoint.rngDraws;
  });
  const ok = expectedJson === replayedJson && checkpointMismatch === undefined;
  return Object.freeze({
    ok,
    expectedFingerprint: diagnosticChecksum(expectedJson),
    replayedFingerprint: diagnosticChecksum(replayedJson),
    expectedFrame: currentFrame(expectedState),
    replayedFrame: currentFrame(replayed),
    transactionCount: replay.transactions.length,
    eventCount: replay.transactions.reduce(
      (total, transaction) => total + transaction.frames.length,
      0,
    ),
    checkpointCount: debugCheckpoints.length,
    ...(ok ? {} : {
      mismatchPath: checkpointMismatch
        ? `/debugCheckpoints/${checkpointMismatch.frame}`
        : firstMismatchPath(expectedState, replayed) ?? '/',
    }),
  });
}

/** Read-only replay rendering from the runtime's canonical export shape. */
export function renderRuntimeReplay(
  replay: MatchRuntimeReplayExport,
  manifest: Manifest,
): ReplayResult {
  if (replay.bootstrap.manifestVersion !== manifest.version) {
    throw new Error(
      `Runtime replay manifest mismatch: export=${replay.bootstrap.manifestVersion} manifest=${manifest.version}`,
    );
  }
  if (replay.genesis.rng.seed !== replay.bootstrap.seed) {
    throw new Error(
      `Runtime replay seed mismatch: bootstrap=${replay.bootstrap.seed} genesis=${replay.genesis.rng.seed}`,
    );
  }
  return renderRuntimeRecord(replay, replay.bootstrap.matchId, manifest);
}
