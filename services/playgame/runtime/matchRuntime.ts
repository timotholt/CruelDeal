import { createMatchGenesis } from '../engine/cli/initState';
import { apply, applyCanonicalFrame } from '../engine/apply';
import { planEnemyTurnFromHand } from '../engine/ai';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { Deck, Manifest } from '../engine/manifest/types';
import { createRng } from '../engine/rng';
import {
  appendGameplayRngAdvance,
  appendGameplayRngResolution,
} from '../engine/rng/transaction';
import { resolve } from '../engine/resolve';
import { currentFrame } from '../engine/timeline';
import { frameAndFoldResolution } from '../engine/transactionTimeline';
import type { KernelResolutionStep } from '../engine/kernel/resolutionTrace';
import type { MatchEvent } from '../engine/types/events';
import type { Seat } from '../engine/types/ids';
import type { MatchIntent } from '../engine/types/intents';
import type { MatchState } from '../engine/types/state';
import { nextFrame, type Frame, type TimelinePhase } from '../engine/types/timeline';
import {
  assertAuthorityPayload,
  validateInternalIntentEnvelope,
} from '../protocol';
import { projectMechanicalStateForController } from './projection';
import type {
  AcceptedIntentResult,
  CommittedIntentIdentity,
  CommittedTransactionRecord,
  IllegalIntentResult,
  InMemoryIntentReceiptMap,
  IntentAcceptanceResult,
  IntentEnvelope,
  IntentReceipt,
  IntentReceiptKey,
  PlanRevision,
  PublicRevision,
  MatchRuntimeRecordExport,
  CommittedTransactionTimeline,
  ParticipantController,
  RuntimeIntent,
  LocationCardDeckEntry,
  DebugMatchCheckpoint,
  SeatInteractionStatus,
} from './contracts';
import { getCardPlacement } from '../engine/projections/cardRuntime';
import { buildOpeningTransaction } from '../engine/opening';
import { buildLocationSetupTransaction } from '../engine/locationSetup';
import { KernelInvariantError } from '../engine/kernel';
import {
  canonicalJson,
  DeterminismDriftError,
  reconcileRuntimeRecord,
  type MatchReconciliationResult,
} from './replayExport';
import {
  elapsed,
  MatchPerformanceTelemetry,
  monotonicNow,
  type MatchPerformanceProfile,
} from './performanceTelemetry';

export type MatchTransactionSubscriber = (timeline: CommittedTransactionTimeline) => void;

export interface MatchInitializationTimelines {
  readonly setup: CommittedTransactionTimeline;
  readonly opening: CommittedTransactionTimeline;
}

export interface MatchRuntime {
  state(): MatchState;
  /** Latest committed gameplay frame. Private planning never advances it. */
  frame(): Frame;
  /** Read-only private-plan projection over a committed presentation base. */
  projectWorkingState(baseState?: MatchState): MatchState;
  genesis(): MatchState;
  initialization(): MatchInitializationTimelines;
  publicRevision(): PublicRevision;
  planRevision(seat: Seat): PlanRevision;
  interactionStatus(seat: Seat): SeatInteractionStatus;
  transactions(): readonly CommittedTransactionRecord[];
  submitIntent(envelope: IntentEnvelope): Promise<IntentAcceptanceResult>;
  subscribeCommittedTransactions(subscriber: MatchTransactionSubscriber): () => void;
  exportReplay(): MatchRuntimeRecordExport;
  debugCheckpoints(): readonly DebugMatchCheckpoint[];
  /** Replays genesis + canonical transactions and compares the full state. */
  reconcile(): MatchReconciliationResult;
  /** Non-canonical, bounded timing sidecar for live diagnostics. */
  performanceProfile(): MatchPerformanceProfile;
}

export interface MatchRuntimeConfig {
  readonly matchId: string;
  readonly seed: string;
  readonly rulesetId: string;
  readonly manifestVersion: number;
  readonly viewerSeat: Seat;
  readonly controllers: Readonly<Record<Seat, ParticipantController>>;
  readonly decks: Readonly<Record<Seat, Deck>>;
  readonly locationDeck: readonly LocationCardDeckEntry[];
  /** Expensive invariant: replay and compare after every committed transaction. */
  readonly debugDeterminism?: boolean;
  /** Optional shared recorder so presentation timings can join runtime spans. */
  readonly performanceTelemetry?: MatchPerformanceTelemetry;
}

interface QueuedIntent {
  readonly envelope: IntentEnvelope;
  readonly resolve: (result: IntentAcceptanceResult) => void;
  readonly reject: (reason: unknown) => void;
  readonly after?: (result: IntentAcceptanceResult) => void;
}

interface CommitCandidate {
  readonly identity: CommittedIntentIdentity;
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
  readonly resolveMs?: number;
  readonly initialTimelinePhase?: TimelinePhase;
  readonly receiptKey?: IntentReceiptKey;
}

interface CommittedCandidate {
  readonly result?: AcceptedIntentResult;
  readonly timeline: CommittedTransactionTimeline;
}

interface PlannedStage {
  readonly intent: Extract<MatchIntent, { type: 'STAGE_CARD' }>;
}

interface PlanningPrelude {
  readonly baseDraws: number;
  readonly events: readonly MatchEvent[];
}

interface ResolvedEventBatch {
  readonly events: readonly MatchEvent[];
  readonly resolutionSteps: readonly KernelResolutionStep[];
  readonly durationMs: number;
}

interface PlannedSequenceFold {
  readonly state: MatchState;
  readonly rejection: Extract<MatchEvent, { type: 'INTENT_REJECTED' }> | null;
}

interface PlanProjectionSnapshot {
  readonly stages: readonly PlannedStage[];
  readonly prelude: PlanningPrelude | null;
}

interface PlannedSequenceFoldOptions {
  readonly baseState?: MatchState;
  readonly prelude?: PlanningPrelude | null;
  readonly alreadyAppliedStagePolicy?: 'REJECT' | 'SKIP';
}

const MUTATION_OPTIONAL_EVENTS = new Set<MatchEvent['type']>([
  'OR_WINDOW_OPEN',
  'OR_WINDOW_CLOSE',
  'RECURSION_LIMIT_HIT',
  'INTENT_REJECTED',
]);

function isSeat(value: unknown): value is Seat {
  return value === 'P0' || value === 'P1';
}

function isRuntimeIntent(value: unknown): value is RuntimeIntent {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { readonly type?: unknown }).type === 'string';
}

function receiptKey(matchId: string, seat: Seat, intentId: string): IntentReceiptKey {
  return JSON.stringify([matchId, seat, intentId]) as IntentReceiptKey;
}

function copyEnvelope(envelope: IntentEnvelope): IntentEnvelope {
  const intent = typeof envelope.intent === 'object' && envelope.intent !== null
    ? Object.freeze({ ...envelope.intent }) as RuntimeIntent
    : envelope.intent;
  return Object.freeze({
    ...envelope,
    intent,
  });
}

function toEngineIntent(envelope: IntentEnvelope): MatchIntent | null {
  const intent = envelope.intent;
  switch (intent.type) {
    case 'STAGE_CARD':
      return {
        type: intent.type,
        intentId: envelope.intentId,
        owner: envelope.seat,
        cardId: intent.cardId,
        lane: intent.lane,
      };
    case 'UNSTAGE_CARD':
      return {
        type: intent.type,
        intentId: envelope.intentId,
        owner: envelope.seat,
        cardId: intent.cardId,
      };
    case 'UNDO_TURN':
    case 'END_TURN':
    case 'CONCEDE':
      return {
        type: intent.type,
        intentId: envelope.intentId,
        owner: envelope.seat,
      };
    default:
      return null;
  }
}

function hasMechanicalChange(before: MatchState, after: MatchState): boolean {
  return (Object.keys(before) as (keyof MatchState)[]).some(
    (key) => key !== 'timeline' && before[key] !== after[key],
  );
}

function eventsHaveSameValue(left: MatchEvent, right: MatchEvent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertValidTimeline(
  timeline: CommittedTransactionTimeline,
  initialState: MatchState,
  events: readonly MatchEvent[],
): void {
  if (timeline.transitions.length === 0) {
    throw new Error('validated commit requires a non-empty canonical frame sequence');
  }
  const rngDrawDelta = events.reduce(
    (total, event) => total + (event.type === 'GAMEPLAY_RNG_ADVANCED' ? event.draws : 0),
    0,
  );
  if (
    timeline.transaction.rngDrawsBefore !== initialState.rng.draws
    || timeline.transaction.rngDrawsAfter !== timeline.finalState.rng.draws
    || timeline.transaction.rngDrawsAfter - timeline.transaction.rngDrawsBefore !== rngDrawDelta
  ) {
    throw new Error('transaction RNG coordinates do not match committed draw events');
  }

  let expectedBefore = initialState;
  let eventIndex = 0;
  timeline.transitions.forEach((frame, index) => {
    const inputEvent = frame.event === null ? null : events[eventIndex++];
    if (
      frame.index !== index
      || frame.before !== expectedBefore
      || frame.event !== frame.canonicalFrame.event
      || frame.effect !== frame.canonicalFrame.effect
      || (
        frame.event !== null
        && (
          inputEvent === null
          || inputEvent === undefined
          || !eventsHaveSameValue(frame.event, inputEvent)
        )
      )
    ) {
      throw new Error(`transaction frame sequence is not contiguous at index ${index}`);
    }
    const expectedFrame = nextFrame(currentFrame(frame.before));
    if (frame.frame !== expectedFrame || frame.canonicalFrame.frame !== frame.frame) {
      throw new Error(`canonical gameplay frame is not contiguous at transaction index ${index}`);
    }
    if (frame.after.rng.seed !== initialState.rng.seed) {
      throw new Error(`authoritative event changed the match seed at index ${index}`);
    }
    if (
      frame.after.timeline.frame !== frame.frame
      || frame.after.timeline.scope?.turn !== frame.scope.turn
      || frame.after.timeline.scope.phase !== frame.scope.phase
    ) {
      throw new Error(`authoritative timeline is not contiguous at index ${index}`);
    }
    if (frame.event === null) {
      if (hasMechanicalChange(frame.before, frame.after)) {
        throw new Error(`trace-only frame mutated mechanics at index ${index}`);
      }
    } else if (
      !MUTATION_OPTIONAL_EVENTS.has(frame.event.type)
      && !hasMechanicalChange(frame.before, frame.after)
    ) {
      throw new Error(
        `authoritative ${frame.event.type} event was a silent no-op at index ${index}`,
      );
    }
    expectedBefore = frame.after;
  });

  if (eventIndex !== events.length) {
    throw new Error('canonical frames do not cover every committed event');
  }

  if (timeline.finalState !== expectedBefore) {
    throw new Error('transaction final state does not match its final frame');
  }
}

function phaseAllowsIntent(state: MatchState, intent: RuntimeIntent): boolean {
  if (intent.type === 'CONCEDE') return state.phase !== 'ENDED';
  return state.phase === 'AWAITING_INTENT';
}

function illegalResult(
  envelope: IntentEnvelope,
  currentPublicRevision: PublicRevision,
  currentPlanRevision: PlanRevision,
  code: IllegalIntentResult['code'],
  message?: string,
): IllegalIntentResult {
  return {
    status: 'illegal',
    matchId: envelope.matchId,
    seat: envelope.seat,
    intentId: envelope.intentId,
    currentPublicRevision,
    currentPlanRevision,
    code,
    ...(message === undefined ? {} : { message }),
  };
}

function asKernelInvariantError(error: unknown): KernelInvariantError {
  if (error instanceof KernelInvariantError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new KernelInvariantError(Object.freeze({
    kind: 'KERNEL_FAILURE',
    code: 'REDUCER_INVARIANT',
    message,
    workItemsConsumed: 0,
    eventsProduced: 0,
    reactionsScheduled: 0,
  }));
}

/**
 * Creates the local, non-DOM match authority from an already validated and
 * frozen bootstrap. The bootstrap manifest is the only Phase 1 rules source.
 */
export function createMatchRuntime(config: MatchRuntimeConfig): MatchRuntime {
  const manifest: Manifest = BOOTSTRAP_MANIFEST;
  const performanceTelemetry = config.performanceTelemetry ?? new MatchPerformanceTelemetry();
  if (config.manifestVersion !== manifest.version) {
    throw new Error(
      `createMatchRuntime: bootstrap manifest ${config.manifestVersion} does not match ${manifest.version}`,
    );
  }
  if (!manifest.rulesets[config.rulesetId]) {
    throw new Error(`createMatchRuntime: unknown ruleset "${config.rulesetId}"`);
  }

  const genesisState = createMatchGenesis(
    config.seed,
    manifest,
    config.decks,
  );
  const receipts: InMemoryIntentReceiptMap = new Map();
  const queue: QueuedIntent[] = [];
  const subscribers = new Set<MatchTransactionSubscriber>();
  let authoritativeState = genesisState;
  const planning: Record<Seat, PlannedStage[]> = { P0: [], P1: [] };
  const planningPrelude: Record<Seat, PlanningPrelude | null> = { P0: null, P1: null };
  const locked: Record<Seat, boolean> = { P0: false, P1: false };
  let presentationPlan: Readonly<Record<Seat, PlanProjectionSnapshot>> | null = null;
  let currentPublicRevision: PublicRevision = 0;
  const currentPlanRevision: Record<Seat, PlanRevision> = { P0: 0, P1: 0 };
  let committedTransactions: readonly CommittedTransactionRecord[] = Object.freeze([]);
  let checkpoints: readonly DebugMatchCheckpoint[] = Object.freeze([]);
  let drainScheduled = false;
  let draining = false;

  const resolveWithStateRng = (
    state: MatchState,
    intent: MatchIntent,
    purpose: string,
  ): ResolvedEventBatch => {
    const startedAtMs = monotonicNow();
    const rng = createRng(state.rng).scope(purpose);
    const resolved = resolve(state, intent, rng, manifest);
    const committed = appendGameplayRngResolution(state, rng, resolved);
    const endedAtMs = monotonicNow();
    performanceTelemetry.recordResolve({
      purpose,
      turn: state.turn,
      intentType: intent.type,
      eventCount: committed.events.length,
      startedAtMs,
      endedAtMs,
      durationMs: elapsed(startedAtMs, endedAtMs),
    });
    return {
      events: committed.events,
      resolutionSteps: committed.resolutionSteps,
      durationMs: elapsed(startedAtMs, endedAtMs),
    };
  };

  const foldPlannedSequence = (
    seat: Seat,
    plannedStages: readonly PlannedStage[],
    options: PlannedSequenceFoldOptions = {},
  ): PlannedSequenceFold => {
    const baseState = options.baseState ?? authoritativeState;
    const prelude = options.prelude === undefined
      ? planningPrelude[seat]
      : options.prelude;
    const alreadyAppliedStagePolicy = options.alreadyAppliedStagePolicy ?? 'REJECT';
    let state = baseState;
    if (prelude && state.rng.draws === prelude.baseDraws) {
      for (const event of prelude.events) {
        state = apply(state, event, manifest);
      }
    }
    for (const planned of plannedStages) {
      // Presentation frames at or after this stage already contain its whole
      // event batch, including lane-entry effects. Never fold it twice.
      if (getCardPlacement(state, planned.intent.cardId)?.zone !== 'HAND') {
        if (alreadyAppliedStagePolicy === 'SKIP') continue;
        return {
          state: baseState,
          rejection: {
            type: 'INTENT_REJECTED',
            intentId: planned.intent.intentId,
            reason: 'card not in hand',
          },
        };
      }
      const rng = createRng(state.rng).scope(
        `stage:${state.turn}:${seat}:${planned.intent.intentId}`,
      );
      const events = appendGameplayRngAdvance(
        state,
        rng,
        resolve(state, planned.intent, rng, manifest).events,
      );
      const rejection = events[0]?.type === 'INTENT_REJECTED'
        ? events[0]
        : null;
      if (events.length === 0 || rejection) {
        return {
          state: baseState,
          rejection: rejection ?? {
            type: 'INTENT_REJECTED',
            intentId: planned.intent.intentId,
            reason: 'private stage produced no planning events',
          },
        };
      }
      for (const event of events) state = apply(state, event, manifest);
    }
    // Private plans are hypothetical branches, not committed chronology.
    // Preserve their mechanical projection while withholding candidate frame
    // advancement from consumers.
    return {
      state: state.timeline === baseState.timeline
        ? state
        : { ...state, timeline: baseState.timeline },
      rejection: null,
    };
  };

  const foldPlannedStages = (
    seat: Seat,
    plannedStages: readonly PlannedStage[] = planning[seat],
    options: PlannedSequenceFoldOptions = {},
  ): MatchState => {
    const folded = foldPlannedSequence(
      seat,
      plannedStages,
      options,
    );
    if (folded.rejection) {
      throw new KernelInvariantError(Object.freeze({
        kind: 'KERNEL_FAILURE',
        code: 'REDUCER_INVARIANT',
        message: `stored private plan is invalid: ${folded.rejection.reason}`,
        workItemsConsumed: 0,
        eventsProduced: 0,
        reactionsScheduled: 0,
      }));
    }
    return folded.state;
  };

  const projectWorkingState = (baseState?: MatchState): MatchState => {
    const snapshot = baseState === undefined
      ? undefined
      : presentationPlan?.[config.viewerSeat];
    return foldPlannedStages(
      config.viewerSeat,
      snapshot?.stages ?? planning[config.viewerSeat],
      {
        baseState: baseState ?? authoritativeState,
        prelude: snapshot
          ? snapshot.prelude
          : planningPrelude[config.viewerSeat],
        alreadyAppliedStagePolicy: baseState === undefined ? 'REJECT' : 'SKIP',
      },
    );
  };

  const visibleState = (): MatchState => projectWorkingState();

  const commit = (candidate: CommitCandidate): CommittedCandidate => {
    const commitStartedAtMs = monotonicNow();
    const baseRevision = currentPublicRevision;
    const revision = baseRevision + 1;
    const transactionId = `${config.matchId}:tx:${revision}`;
    const events = Object.freeze([...candidate.events]);
    let applyMs = 0;
    const foldStartedAtMs = monotonicNow();
    const built = frameAndFoldResolution({
      transactionId,
      initialState: authoritativeState,
      events,
      resolutionSteps: candidate.resolutionSteps,
      manifest,
      initialPhase: candidate.initialTimelinePhase,
      reduceCanonicalFrame: (state, canonicalFrame, activeManifest) => {
        const startedAtMs = monotonicNow();
        const after = applyCanonicalFrame(state, canonicalFrame, activeManifest);
        const endedAtMs = monotonicNow();
        const durationMs = elapsed(startedAtMs, endedAtMs);
        applyMs += durationMs;
        performanceTelemetry.recordFrameApply({
          transactionId,
          frame: canonicalFrame.frame,
          eventType: canonicalFrame.event?.type ?? canonicalFrame.effect!.kind,
          startedAtMs,
          endedAtMs,
          durationMs,
        });
        return after;
      },
    });
    const foldEndedAtMs = monotonicNow();
    const transaction: CommittedTransactionRecord = Object.freeze({
      transactionId,
      matchId: config.matchId,
      baseRevision,
      revision,
      intent: Object.freeze({ ...candidate.identity }),
      frames: built.frames,
      rngDrawsBefore: authoritativeState.rng.draws,
      rngDrawsAfter: built.finalState.rng.draws,
    });
    const protocolStartedAtMs = monotonicNow();
    assertAuthorityPayload('COMMITTED_TRANSACTION', transaction);
    const protocolEndedAtMs = monotonicNow();
    const timeline: CommittedTransactionTimeline = Object.freeze({
      transaction,
      transitions: built.transitions,
      finalState: built.finalState,
    });
    const invariantStartedAtMs = monotonicNow();
    assertValidTimeline(timeline, authoritativeState, events);
    const invariantEndedAtMs = monotonicNow();

    const result: AcceptedIntentResult | undefined = candidate.receiptKey
      ? Object.freeze({
          status: 'accepted',
          matchId: candidate.identity.matchId,
          seat: candidate.identity.seat as Seat,
          intentId: candidate.identity.intentId,
          publicRevision: revision,
          planRevision: currentPlanRevision[candidate.identity.seat as Seat],
          commit: 'COMMITTED',
          transaction,
        })
      : undefined;

    const nextTransactions = Object.freeze([...committedTransactions, transaction]);
    let nextCheckpoints = checkpoints;
    if (config.debugDeterminism) {
      const additions = built.transitions
        .filter(transition => (
          transition.event?.type === 'CARD_STAGED'
          || transition.event?.type === 'MATCH_ENDED'
        ))
        .map((transition): DebugMatchCheckpoint => Object.freeze({
          frame: transition.frame,
          rngDraws: transition.after.rng.draws,
          stateJson: canonicalJson(transition.after),
        }));
      if (additions.length > 0) {
        nextCheckpoints = Object.freeze([...checkpoints, ...additions]);
      }
    }
    const endsMatch = built.transitions
      .some(transition => transition.event?.type === 'MATCH_ENDED');
    let reconciliationMs = 0;
    if (config.debugDeterminism || endsMatch) {
      const reconciliationStartedAtMs = monotonicNow();
      const reconciliation = reconcileRuntimeRecord({
        version: 3,
        genesis: genesisState,
        transactions: nextTransactions,
      }, config.matchId, manifest, built.finalState, nextCheckpoints);
      const reconciliationEndedAtMs = monotonicNow();
      reconciliationMs = elapsed(reconciliationStartedAtMs, reconciliationEndedAtMs);
      if (!reconciliation.ok) throw new DeterminismDriftError(reconciliation);
    }

    const commitEndedAtMs = monotonicNow();
    performanceTelemetry.recordTransaction({
      transactionId,
      revision,
      eventCount: events.length,
      startedAtMs: commitStartedAtMs,
      endedAtMs: commitEndedAtMs,
      durationMs: elapsed(commitStartedAtMs, commitEndedAtMs),
      resolveMs: candidate.resolveMs ?? 0,
      foldMs: elapsed(foldStartedAtMs, foldEndedAtMs),
      applyMs,
      protocolValidationMs: elapsed(protocolStartedAtMs, protocolEndedAtMs),
      invariantValidationMs: elapsed(invariantStartedAtMs, invariantEndedAtMs),
      reconciliationMs,
    });

    // Local atomic commit: no callbacks, promises, awaits, or fallible
    // reconciliation may enter this block.
    authoritativeState = built.finalState;
    committedTransactions = nextTransactions;
    checkpoints = nextCheckpoints;
    currentPublicRevision = revision;
    if (candidate.receiptKey && result) receipts.set(candidate.receiptKey, result);

    return { result, timeline };
  };

  const publish = (timeline: CommittedTransactionTimeline): void => {
    const startedAtMs = monotonicNow();
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(timeline);
      } catch {
        // Read-only observer failures cannot roll back or halt authority.
      }
    }
    performanceTelemetry.recordPublish(
      timeline.transaction.transactionId,
      elapsed(startedAtMs, monotonicNow()),
    );
  };

  const setup = buildLocationSetupTransaction(
    genesisState,
    manifest,
    config.locationDeck,
  );
  const setupCommit = commit({
    identity: {
      matchId: config.matchId,
      seat: 'SYSTEM',
      intentId: setup.transactionId,
    },
    events: setup.events,
    resolutionSteps: setup.resolutionSteps,
    initialTimelinePhase: 'SETUP',
  });
  publish(setupCommit.timeline);

  const opening = buildOpeningTransaction(authoritativeState, manifest);
  const opened = commit({
    identity: {
      matchId: config.matchId,
      seat: 'SYSTEM',
      intentId: opening.transactionId,
    },
    events: opening.events,
    resolutionSteps: opening.resolutionSteps,
    initialTimelinePhase: 'SETUP',
  });
  publish(opened.timeline);
  const initialization = Object.freeze({
    setup: setupCommit.timeline,
    opening: opened.timeline,
  });

  const storeRejection = (
    key: IntentReceiptKey,
    rejection: IntentReceipt,
  ): IntentAcceptanceResult => {
    receipts.set(key, rejection);
    return rejection;
  };

  const planRevisionForEnvelope = (envelope: IntentEnvelope): PlanRevision => (
    isSeat(envelope.seat) ? currentPlanRevision[envelope.seat] : 0
  );

  const interactionStatus = (seat: Seat): SeatInteractionStatus => {
    if (authoritativeState.phase === 'ENDED' || authoritativeState.result !== null) {
      return 'TERMINAL';
    }
    return locked[seat] ? 'WAITING' : 'PLANNING';
  };

  const acceptPrivate = (
    key: IntentReceiptKey,
    envelope: IntentEnvelope,
    commitState: AcceptedIntentResult['commit'] = 'PRIVATE',
  ): AcceptedIntentResult => {
    currentPlanRevision[envelope.seat] += 1;
    const result: AcceptedIntentResult = Object.freeze({
      status: 'accepted',
      matchId: envelope.matchId,
      seat: envelope.seat,
      intentId: envelope.intentId,
      publicRevision: currentPublicRevision,
      planRevision: currentPlanRevision[envelope.seat],
      commit: commitState,
    });
    receipts.set(key, result);
    return result;
  };

  const acceptCommittedLock = (
    key: IntentReceiptKey,
    envelope: IntentEnvelope,
    transaction: CommittedTransactionRecord,
  ): AcceptedIntentResult => {
    const result: AcceptedIntentResult = Object.freeze({
      status: 'accepted',
      matchId: envelope.matchId,
      seat: envelope.seat,
      intentId: envelope.intentId,
      publicRevision: currentPublicRevision,
      planRevision: planRevisionForEnvelope(envelope),
      commit: 'COMMITTED',
      transaction,
    });
    receipts.set(key, result);
    return result;
  };

  const commitLockedTurn = (): CommittedCandidate => {
    let mergedState = authoritativeState;
    const events: MatchEvent[] = [];
    const resolutionSteps: KernelResolutionStep[] = [];
    const appendBatch = (
      batch: Pick<ResolvedEventBatch, 'events' | 'resolutionSteps'>,
    ): void => {
      const transitionOffset = events.length;
      events.push(...batch.events);
      resolutionSteps.push(...batch.resolutionSteps.map(step => ({
        transitionIndex: step.transitionIndex === null
          ? null
          : step.transitionIndex + transitionOffset,
        effect: step.effect,
      })));
    };
    let resolveMs = 0;
    const ownerOrder: readonly Seat[] = authoritativeState.priority === 'P0'
      ? ['P0', 'P1']
      : ['P1', 'P0'];

    // Controller decisions are part of the same canonical RNG sequence, but
    // remain speculative until the locked turn commits. Apply their draw
    // consumption before resolving the resulting staged intents.
    for (const owner of ['P0', 'P1'] as const) {
      const prelude = planningPrelude[owner];
      if (prelude) {
        for (const event of prelude.events) {
          events.push(event);
          resolutionSteps.push({
            transitionIndex: events.length - 1,
            effect: null,
          });
          mergedState = apply(mergedState, event, manifest);
        }
      }
    }

    for (const owner of ownerOrder) {
      for (const planned of planning[owner]) {
        const stageBatch = resolveWithStateRng(
          mergedState,
          planned.intent,
          `stage:${authoritativeState.turn}:${owner}:${planned.intent.intentId}`,
        );
        const stageEvents = stageBatch.events;
        resolveMs += stageBatch.durationMs;
        const rejection = stageEvents[0]?.type === 'INTENT_REJECTED' ? stageEvents[0] : null;
        if (stageEvents.length === 0 || rejection) {
          throw new KernelInvariantError(Object.freeze({
            kind: 'KERNEL_FAILURE',
            code: 'REDUCER_INVARIANT',
            message: `accepted private plan failed commit refold: ${rejection?.reason ?? 'stage produced no events'}`,
            workItemsConsumed: 0,
            eventsProduced: events.length,
            reactionsScheduled: 0,
          }));
        }
        appendBatch(stageBatch);
        for (const event of stageEvents) mergedState = apply(mergedState, event, manifest);
      }
    }

    const resolutionBatch = resolveWithStateRng(
      mergedState,
      {
        type: 'END_TURN',
        intentId: `system-resolve-turn-${authoritativeState.turn}`,
        owner: authoritativeState.priority,
      },
      `system-turn:${authoritativeState.turn}`,
    );
    const resolutionEvents = resolutionBatch.events;
    resolveMs += resolutionBatch.durationMs;
    appendBatch(resolutionBatch);

    const committed = commit({
      identity: {
        matchId: config.matchId,
        seat: 'SYSTEM',
        intentId: `resolve-turn-${authoritativeState.turn}`,
      },
      events,
      resolutionSteps,
      resolveMs,
    });
    // Active planning ends at commit. Presentation receives a separate,
    // immutable snapshot while synchronous subscribers project the committed
    // frame walk; it must never observe or mutate the live planning store.
    presentationPlan = Object.freeze({
      P0: Object.freeze({
        stages: Object.freeze([...planning.P0]),
        prelude: planningPrelude.P0,
      }),
      P1: Object.freeze({
        stages: Object.freeze([...planning.P1]),
        prelude: planningPrelude.P1,
      }),
    });
    planning.P0 = [];
    planning.P1 = [];
    planningPrelude.P0 = null;
    planningPrelude.P1 = null;
    locked.P0 = false;
    locked.P1 = false;
    currentPlanRevision.P0 += 1;
    currentPlanRevision.P1 += 1;
    try {
      publish(committed.timeline);
    } finally {
      presentationPlan = null;
    }
    return committed;
  };

  const enqueueAiTurn = (seat: Seat): void => {
    const authoritativeAiState = foldPlannedStages(seat);
    const aiState = projectMechanicalStateForController(authoritativeAiState, seat);
    const aiRng = createRng(authoritativeAiState.rng).scope(
      `ai-plan:${aiState.turn}:${seat}:${currentPublicRevision}`,
    );
    const plays = planEnemyTurnFromHand(
      aiState,
      seat,
      manifest,
      aiRng,
      { forkTag: `live-ai:${aiState.turn}:${seat}` },
    );
    planningPrelude[seat] = Object.freeze({
      baseDraws: authoritativeAiState.rng.draws,
      events: appendGameplayRngAdvance(authoritativeAiState, aiRng, []),
    });
    let index = 0;

    const enqueueNext = (): void => {
      const play = plays[index++];
      const intentId = play
        ? `ai-${aiState.turn}-${seat}-stage-${index}-${play.cardId}`
        : `ai-${aiState.turn}-${seat}-end`;
      const envelope: IntentEnvelope = {
        matchId: config.matchId,
        seat,
        intentId,
        expectedPublicRevision: currentPublicRevision,
        expectedPlanRevision: currentPlanRevision[seat],
        intent: play
          ? { type: 'STAGE_CARD', cardId: play.cardId, lane: play.lane }
          : { type: 'END_TURN' },
      };
      queue.unshift({
        envelope,
        resolve: () => undefined,
        reject: () => undefined,
        ...(play ? { after: enqueueNext } : {}),
      });
    };

    enqueueNext();
  };

  const acceptAtDequeue = (envelope: IntentEnvelope): IntentAcceptanceResult => {
    const key = receiptKey(envelope.matchId, envelope.seat, envelope.intentId);
    const original = receipts.get(key);
    if (original) {
      return {
        status: 'duplicate',
        matchId: envelope.matchId,
        seat: envelope.seat,
        intentId: envelope.intentId,
        original,
      };
    }

    if (envelope.matchId !== config.matchId) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'MATCH_MISMATCH'));
    }
    if (!isSeat(envelope.seat)) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'SEAT_AUTHORITY'));
    }
    const suppliedOwner = isRuntimeIntent(envelope.intent)
      ? (envelope.intent as RuntimeIntent & { readonly owner?: unknown }).owner
      : undefined;
    if (suppliedOwner !== undefined && suppliedOwner !== envelope.seat) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'SEAT_AUTHORITY'));
    }
    const wire = validateInternalIntentEnvelope(envelope);
    if (!wire.ok) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
        'RULES_INVALID',
        wire.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
      ));
    }
    if (envelope.expectedPublicRevision !== currentPublicRevision) {
      return storeRejection(key, {
        status: 'stale-public',
        matchId: envelope.matchId,
        seat: envelope.seat,
        intentId: envelope.intentId,
        expectedPublicRevision: envelope.expectedPublicRevision,
        currentPublicRevision,
        currentPlanRevision: planRevisionForEnvelope(envelope),
        resyncRequired: true,
      });
    }
    if (envelope.expectedPlanRevision !== currentPlanRevision[envelope.seat]) {
      return storeRejection(key, {
        status: 'stale-plan',
        matchId: envelope.matchId,
        seat: envelope.seat,
        intentId: envelope.intentId,
        expectedPlanRevision: envelope.expectedPlanRevision,
        currentPublicRevision,
        currentPlanRevision: currentPlanRevision[envelope.seat],
      });
    }
    if (authoritativeState.phase === 'ENDED' || authoritativeState.result !== null) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'TERMINAL_MATCH'));
    }
    if (!isRuntimeIntent(envelope.intent)) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'RULES_INVALID'));
    }
    if (!phaseAllowsIntent(authoritativeState, envelope.intent)) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'PHASE_INVALID'));
    }

    const engineIntent = toEngineIntent(envelope);
    if (!engineIntent) {
      return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'RULES_INVALID'));
    }

    try {
      if (engineIntent.type === 'STAGE_CARD') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
            'PHASE_INVALID',
            'seat is locked',
          ));
        }
        const candidate = [
          ...planning[envelope.seat],
          { intent: engineIntent },
        ];
        const folded = foldPlannedSequence(envelope.seat, candidate);
        if (folded.rejection) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
            'RULES_INVALID',
            folded.rejection.reason,
          ));
        }
        planning[envelope.seat] = candidate;
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'UNSTAGE_CARD') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'PHASE_INVALID', 'seat is locked'));
        }
        const index = planning[envelope.seat].findIndex(
          (planned) => planned.intent.cardId === engineIntent.cardId,
        );
        if (index < 0) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
            'RULES_INVALID',
            'card is not in the private planning stack',
          ));
        }
        const candidate = planning[envelope.seat].filter(
          (_, candidateIndex) => candidateIndex !== index,
        );
        const folded = foldPlannedSequence(envelope.seat, candidate);
        if (folded.rejection) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
            'RULES_INVALID',
            `remaining private plan is invalid: ${folded.rejection.reason}`,
          ));
        }
        planning[envelope.seat] = candidate;
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'UNDO_TURN') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'PHASE_INVALID', 'seat is locked'));
        }
        if (planning[envelope.seat].length === 0) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'RULES_INVALID', 'planning stack is empty'));
        }
        planning[envelope.seat] = [];
        planningPrelude[envelope.seat] = null;
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'END_TURN') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope), 'PHASE_INVALID', 'seat is already locked'));
        }
        const other: Seat = envelope.seat === 'P0' ? 'P1' : 'P0';
        if (locked[other]) {
          const committed = commitLockedTurn();
          return acceptCommittedLock(key, envelope, committed.timeline.transaction);
        }

        locked[envelope.seat] = true;
        const result = acceptPrivate(key, envelope, 'WAITING');
        if (config.controllers[other] === 'LOCAL_AI') {
          enqueueAiTurn(other);
        }
        return result;
      }

      const resolved = resolveWithStateRng(
        authoritativeState,
        engineIntent,
        `commit:${currentPublicRevision + 1}:${envelope.seat}:${envelope.intentId}`,
      );
      const events = resolved.events;
      const engineRejection = events[0]?.type === 'INTENT_REJECTED' ? events[0] : null;
      if (events.length === 0 || engineRejection) {
        return storeRejection(key, illegalResult(envelope, currentPublicRevision, planRevisionForEnvelope(envelope),
          'RULES_INVALID',
          engineRejection?.reason ?? 'intent produced no authoritative events',
        ));
      }
      const committed = commit({
        identity: {
          matchId: envelope.matchId,
          seat: envelope.seat,
          intentId: envelope.intentId,
          ...(envelope.intentSeq === undefined ? {} : { intentSeq: envelope.intentSeq }),
        },
        events,
        resolutionSteps: resolved.resolutionSteps,
        resolveMs: resolved.durationMs,
        receiptKey: key,
      });
      if (engineIntent.type === 'CONCEDE') {
        planning.P0 = [];
        planning.P1 = [];
        planningPrelude.P0 = null;
        planningPrelude.P1 = null;
        locked.P0 = false;
        locked.P1 = false;
      }
      publish(committed.timeline);
      return committed.result!;
    } catch (error) {
      throw asKernelInvariantError(error);
    }
  };

  const drainQueue = (): void => {
    drainScheduled = false;
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const queued = queue.shift()!;
        try {
          const result = acceptAtDequeue(queued.envelope);
          queued.resolve(result);
          queued.after?.(result);
        } catch (error) {
          queued.reject(error);
        }
      }
    } finally {
      draining = false;
      if (queue.length > 0 && !drainScheduled) {
        drainScheduled = true;
        queueMicrotask(drainQueue);
      }
    }
  };

  const submitIntent = (envelope: IntentEnvelope): Promise<IntentAcceptanceResult> => {
    const copied = copyEnvelope(envelope);
    const pending = new Promise<IntentAcceptanceResult>((resolveResult, rejectResult) => {
      queue.push({ envelope: copied, resolve: resolveResult, reject: rejectResult });
    });
    if (!draining && !drainScheduled) {
      drainScheduled = true;
      queueMicrotask(drainQueue);
    }
    return pending;
  };

  return Object.freeze({
    state: visibleState,
    frame: () => currentFrame(authoritativeState),
    projectWorkingState,
    genesis: () => genesisState,
    initialization: () => initialization,
    publicRevision: () => currentPublicRevision,
    planRevision: (seat: Seat) => currentPlanRevision[seat],
    interactionStatus,
    transactions: () => committedTransactions,
    submitIntent,
    subscribeCommittedTransactions: (subscriber: MatchTransactionSubscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    exportReplay: () => Object.freeze({
      version: 3 as const,
      genesis: genesisState,
      transactions: committedTransactions,
    }),
    debugCheckpoints: () => checkpoints,
    reconcile: () => reconcileRuntimeRecord({
      version: 3,
      genesis: genesisState,
      transactions: committedTransactions,
    }, config.matchId, manifest, authoritativeState, checkpoints),
    performanceProfile: () => performanceTelemetry.snapshot(),
  });
}
