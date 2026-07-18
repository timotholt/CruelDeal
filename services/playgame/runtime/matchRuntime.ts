import { createInitialMatchState } from '../engine/cli/initState';
import { apply } from '../engine/apply';
import { planEnemyTurnFromHand } from '../engine/ai';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { Deck, Manifest } from '../engine/manifest/types';
import { createRng } from '../engine/rng';
import { resolve } from '../engine/resolve';
import { currentFrame } from '../engine/timeline';
import { frameAndFoldEvents } from '../engine/transactionTimeline';
import type { MatchEvent } from '../engine/types/events';
import type { Seat } from '../engine/types/ids';
import type { MatchIntent } from '../engine/types/intents';
import type { MatchState } from '../engine/types/state';
import { nextFrame, type Frame, type TimelinePhase } from '../engine/types/timeline';
import {
  assertProtocolPayload,
  validateIntentEnvelopeWire,
} from '../protocol';
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
  MatchRevision,
  MatchRuntimeRecordExport,
  CommittedTransactionTimeline,
  ParticipantController,
  RuntimeIntent,
} from './contracts';
import { buildOpeningTransaction } from './opening';
import { forkResolutionRng, forkSemanticRng } from './rngNamespaces';

export type MatchTransactionSubscriber = (timeline: CommittedTransactionTimeline) => void;

export interface MatchRuntime {
  state(): MatchState;
  /** Latest committed gameplay frame. Private planning never advances it. */
  frame(): Frame;
  /** Read-only private-plan projection over a committed presentation base. */
  projectWorkingState(baseState?: MatchState): MatchState;
  genesis(): MatchState;
  revision(): MatchRevision;
  transactions(): readonly CommittedTransactionRecord[];
  submitIntent(envelope: IntentEnvelope): Promise<IntentAcceptanceResult>;
  subscribeCommittedTransactions(subscriber: MatchTransactionSubscriber): () => void;
  exportReplay(): MatchRuntimeRecordExport;
}

export interface MatchRuntimeConfig {
  readonly matchId: string;
  readonly seed: string;
  readonly rulesetId: string;
  readonly manifestVersion: number;
  readonly viewerSeat: Seat;
  readonly controllers: Readonly<Record<Seat, ParticipantController>>;
  readonly decks: Readonly<Record<Seat, Deck>>;
}

interface QueuedIntent {
  readonly envelope: IntentEnvelope;
  readonly resolve: (result: IntentAcceptanceResult) => void;
  readonly after?: (result: IntentAcceptanceResult) => void;
}

interface CommitCandidate {
  readonly identity: CommittedIntentIdentity;
  readonly events: readonly MatchEvent[];
  readonly initialTimelinePhase?: TimelinePhase;
  readonly receiptKey?: IntentReceiptKey;
}

interface CommittedCandidate {
  readonly result?: AcceptedIntentResult;
  readonly timeline: CommittedTransactionTimeline;
}

interface PlannedStage {
  readonly intent: Extract<MatchIntent, { type: 'STAGE_CARD' }>;
  readonly events: readonly MatchEvent[];
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
    (key) => key !== 'log' && before[key] !== after[key],
  );
}

function assertValidTimeline(
  timeline: CommittedTransactionTimeline,
  initialState: MatchState,
  events: readonly MatchEvent[],
): void {
  if (events.length === 0 || timeline.transitions.length !== events.length) {
    throw new Error('validated commit requires a non-empty contiguous event sequence');
  }

  let expectedBefore = initialState;
  timeline.transitions.forEach((frame, index) => {
    if (frame.index !== index || frame.before !== expectedBefore || frame.event !== events[index]) {
      throw new Error(`transaction frame sequence is not contiguous at index ${index}`);
    }
    const expectedFrame = nextFrame(currentFrame(frame.before));
    if (frame.frame !== expectedFrame || frame.framedEvent.frame !== frame.frame) {
      throw new Error(`canonical gameplay frame is not contiguous at transaction index ${index}`);
    }
    if (frame.after.seed !== initialState.seed) {
      throw new Error(`authoritative event changed the match seed at index ${index}`);
    }
    if (frame.after.log.length !== frame.before.log.length + 1) {
      throw new Error(`authoritative event did not append exactly one log entry at index ${index}`);
    }
    const appended = frame.after.log[frame.after.log.length - 1];
    if (
      appended?.frame !== frame.frame
      || appended.scope !== frame.scope
      || appended.event !== frame.event
    ) {
      throw new Error(`authoritative log is not contiguous at index ${index}`);
    }
    if (!MUTATION_OPTIONAL_EVENTS.has(frame.event.type) && !hasMechanicalChange(frame.before, frame.after)) {
      throw new Error(`authoritative ${frame.event.type} event was a silent no-op at index ${index}`);
    }
    expectedBefore = frame.after;
  });

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
  currentRevision: MatchRevision,
  code: IllegalIntentResult['code'],
  message?: string,
): IllegalIntentResult {
  return {
    status: 'illegal',
    matchId: envelope.matchId,
    seat: envelope.seat,
    intentId: envelope.intentId,
    currentRevision,
    code,
    ...(message === undefined ? {} : { message }),
  };
}

/**
 * Creates the local, non-DOM match authority from an already validated and
 * frozen bootstrap. The bootstrap manifest is the only Phase 1 rules source.
 */
export function createMatchRuntime(config: MatchRuntimeConfig): MatchRuntime {
  const manifest: Manifest = BOOTSTRAP_MANIFEST;
  if (config.manifestVersion !== manifest.version) {
    throw new Error(
      `createMatchRuntime: bootstrap manifest ${config.manifestVersion} does not match ${manifest.version}`,
    );
  }
  if (!manifest.rulesets[config.rulesetId]) {
    throw new Error(`createMatchRuntime: unknown ruleset "${config.rulesetId}"`);
  }

  const genesisState = createInitialMatchState(config.seed, manifest, config.decks);
  const receipts: InMemoryIntentReceiptMap = new Map();
  const queue: QueuedIntent[] = [];
  const subscribers = new Set<MatchTransactionSubscriber>();
  const resolutionRng = forkResolutionRng(createRng(config.seed));
  let authoritativeState = genesisState;
  const planning: Record<Seat, PlannedStage[]> = { P0: [], P1: [] };
  const locked: Record<Seat, boolean> = { P0: false, P1: false };
  let currentRevision: MatchRevision = 0;
  let committedTransactions: readonly CommittedTransactionRecord[] = Object.freeze([]);
  let drainScheduled = false;
  let draining = false;

  const foldPlannedStages = (
    seat: Seat,
    baseState: MatchState = authoritativeState,
  ): MatchState => {
    let state = baseState;
    for (const planned of planning[seat]) {
      // Presentation frames at or after this stage already contain its whole
      // event batch, including lane-entry effects. Never fold it twice.
      if (state.cards[planned.intent.cardId]?.zone !== 'HAND') continue;
      for (const event of planned.events) state = apply(state, event, manifest);
    }
    // Private plans are hypothetical branches, not committed chronology.
    // Preserve their mechanical projection while withholding candidate log
    // entries (and therefore candidate frame numbers) from consumers.
    return state.log === baseState.log ? state : { ...state, log: baseState.log };
  };

  const projectWorkingState = (baseState: MatchState = authoritativeState): MatchState => (
    foldPlannedStages(config.viewerSeat, baseState)
  );

  const visibleState = (): MatchState => projectWorkingState();

  const commit = (candidate: CommitCandidate): CommittedCandidate => {
    const baseRevision = currentRevision;
    const revision = baseRevision + 1;
    const transactionId = `${config.matchId}:tx:${revision}`;
    const events = Object.freeze([...candidate.events]);
    const built = frameAndFoldEvents({
      transactionId,
      initialState: authoritativeState,
      events,
      manifest,
      initialPhase: candidate.initialTimelinePhase,
    });
    const transaction: CommittedTransactionRecord = Object.freeze({
      transactionId,
      matchId: config.matchId,
      baseRevision,
      revision,
      intent: Object.freeze({ ...candidate.identity }),
      framedEvents: built.framedEvents,
    });
    assertProtocolPayload('COMMITTED_TRANSACTION', transaction);
    const timeline: CommittedTransactionTimeline = Object.freeze({
      transaction,
      transitions: built.transitions,
      finalState: built.finalState,
    });
    assertValidTimeline(timeline, authoritativeState, events);

    const result: AcceptedIntentResult | undefined = candidate.receiptKey
      ? Object.freeze({
          status: 'accepted',
          matchId: candidate.identity.matchId,
          seat: candidate.identity.seat as Seat,
          intentId: candidate.identity.intentId,
          revision,
          commit: 'COMMITTED',
          transaction,
        })
      : undefined;

    // Local atomic commit: no callbacks, promises, or awaits may enter this block.
    authoritativeState = built.finalState;
    committedTransactions = Object.freeze([...committedTransactions, transaction]);
    currentRevision = revision;
    if (candidate.receiptKey && result) receipts.set(candidate.receiptKey, result);

    return { result, timeline };
  };

  const publish = (timeline: CommittedTransactionTimeline): void => {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(timeline);
      } catch {
        // Read-only observer failures cannot roll back or halt authority.
      }
    }
  };

  const opening = buildOpeningTransaction(genesisState, manifest);
  const opened = commit({
    identity: {
      matchId: config.matchId,
      seat: 'SYSTEM',
      intentId: opening.transactionId,
    },
    events: opening.events,
    initialTimelinePhase: 'SETUP',
  });
  publish(opened.timeline);

  const storeRejection = (
    key: IntentReceiptKey,
    rejection: IntentReceipt,
  ): IntentAcceptanceResult => {
    receipts.set(key, rejection);
    return rejection;
  };

  const acceptPrivate = (
    key: IntentReceiptKey,
    envelope: IntentEnvelope,
  ): AcceptedIntentResult => {
    currentRevision += 1;
    const result: AcceptedIntentResult = Object.freeze({
      status: 'accepted',
      matchId: envelope.matchId,
      seat: envelope.seat,
      intentId: envelope.intentId,
      revision: currentRevision,
      commit: 'PRIVATE',
    });
    receipts.set(key, result);
    return result;
  };

  const commitLockedTurn = (): void => {
    let mergedState = authoritativeState;
    const events: MatchEvent[] = [];
    const ownerOrder: readonly Seat[] = authoritativeState.priority === 'P0'
      ? ['P0', 'P1']
      : ['P1', 'P0'];

    for (const owner of ownerOrder) {
      for (const planned of planning[owner]) {
        const stageEvents = resolve(
          mergedState,
          planned.intent,
          forkSemanticRng(
            resolutionRng,
            `stage:${authoritativeState.turn}:${owner}:${planned.intent.intentId}`,
          ),
          manifest,
        );
        const rejection = stageEvents[0]?.type === 'INTENT_REJECTED' ? stageEvents[0] : null;
        if (rejection) continue;
        events.push(...stageEvents);
        for (const event of stageEvents) mergedState = apply(mergedState, event, manifest);
      }
    }

    const resolutionEvents = resolve(
      mergedState,
      {
        type: 'END_TURN',
        intentId: `system-resolve-turn-${authoritativeState.turn}`,
        owner: authoritativeState.priority,
      },
      forkSemanticRng(resolutionRng, `system-turn:${authoritativeState.turn}`),
      manifest,
    );
    events.push(...resolutionEvents);

    const committed = commit({
      identity: {
        matchId: config.matchId,
        seat: 'SYSTEM',
        intentId: `resolve-turn-${authoritativeState.turn}`,
      },
      events,
    });
    // The synchronous presentation subscriber captures each frame with the
    // viewer's just-consumed private plan still available as an overlay.
    // Authority is already committed; this only prevents staged cards from
    // disappearing before their canonical CARD_STAGED frame is presented.
    publish(committed.timeline);
    planning.P0 = [];
    planning.P1 = [];
    locked.P0 = false;
    locked.P1 = false;
  };

  const enqueueAiTurn = (seat: Seat): void => {
    const aiState = foldPlannedStages(seat);
    const plays = planEnemyTurnFromHand(
      aiState,
      seat,
      manifest,
      forkSemanticRng(
        resolutionRng,
        `ai-plan:${aiState.turn}:${seat}:${currentRevision}`,
      ),
      { forkTag: `live-ai:${aiState.turn}:${seat}` },
    );
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
        expectedRevision: currentRevision,
        intent: play
          ? { type: 'STAGE_CARD', cardId: play.cardId, lane: play.lane }
          : { type: 'END_TURN' },
      };
      queue.unshift({
        envelope,
        resolve: () => undefined,
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
      return storeRejection(key, illegalResult(envelope, currentRevision, 'MATCH_MISMATCH'));
    }
    if (!isSeat(envelope.seat)) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'SEAT_AUTHORITY'));
    }
    const suppliedOwner = isRuntimeIntent(envelope.intent)
      ? (envelope.intent as RuntimeIntent & { readonly owner?: unknown }).owner
      : undefined;
    if (suppliedOwner !== undefined && suppliedOwner !== envelope.seat) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'SEAT_AUTHORITY'));
    }
    const wire = validateIntentEnvelopeWire(envelope);
    if (!wire.ok) {
      return storeRejection(key, illegalResult(
        envelope,
        currentRevision,
        'RULES_INVALID',
        wire.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
      ));
    }
    if (envelope.expectedRevision !== currentRevision) {
      return storeRejection(key, {
        status: 'stale',
        matchId: envelope.matchId,
        seat: envelope.seat,
        intentId: envelope.intentId,
        expectedRevision: envelope.expectedRevision,
        currentRevision,
      });
    }
    if (authoritativeState.phase === 'ENDED' || authoritativeState.result !== null) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'TERMINAL_MATCH'));
    }
    if (!isRuntimeIntent(envelope.intent)) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'RULES_INVALID'));
    }
    if (!phaseAllowsIntent(authoritativeState, envelope.intent)) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'PHASE_INVALID'));
    }

    const engineIntent = toEngineIntent(envelope);
    if (!engineIntent) {
      return storeRejection(key, illegalResult(envelope, currentRevision, 'RULES_INVALID'));
    }

    try {
      if (engineIntent.type === 'STAGE_CARD') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(
            envelope,
            currentRevision,
            'PHASE_INVALID',
            'seat is locked',
          ));
        }
        const planningState = foldPlannedStages(envelope.seat);
        const events = resolve(
          planningState,
          engineIntent,
          forkSemanticRng(
            resolutionRng,
            `stage:${planningState.turn}:${envelope.seat}:${envelope.intentId}`,
          ),
          manifest,
        );
        const engineRejection = events[0]?.type === 'INTENT_REJECTED' ? events[0] : null;
        if (events.length === 0 || engineRejection) {
          return storeRejection(key, illegalResult(
            envelope,
            currentRevision,
            'RULES_INVALID',
            engineRejection?.reason ?? 'intent produced no planning events',
          ));
        }
        planning[envelope.seat].push({ intent: engineIntent, events: Object.freeze([...events]) });
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'UNSTAGE_CARD') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentRevision, 'PHASE_INVALID', 'seat is locked'));
        }
        const index = planning[envelope.seat].findIndex(
          (planned) => planned.intent.cardId === engineIntent.cardId,
        );
        if (index < 0) {
          return storeRejection(key, illegalResult(
            envelope,
            currentRevision,
            'RULES_INVALID',
            'card is not in the private planning stack',
          ));
        }
        planning[envelope.seat].splice(index);
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'UNDO_TURN') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentRevision, 'PHASE_INVALID', 'seat is locked'));
        }
        if (planning[envelope.seat].length === 0) {
          return storeRejection(key, illegalResult(envelope, currentRevision, 'RULES_INVALID', 'planning stack is empty'));
        }
        planning[envelope.seat] = [];
        return acceptPrivate(key, envelope);
      }

      if (engineIntent.type === 'END_TURN') {
        if (locked[envelope.seat]) {
          return storeRejection(key, illegalResult(envelope, currentRevision, 'PHASE_INVALID', 'seat is already locked'));
        }
        locked[envelope.seat] = true;
        const result = acceptPrivate(key, envelope);
        const other: Seat = envelope.seat === 'P0' ? 'P1' : 'P0';
        if (locked[other]) {
          commitLockedTurn();
        } else if (config.controllers[other] === 'LOCAL_AI') {
          enqueueAiTurn(other);
        }
        return result;
      }

      const events = resolve(
        authoritativeState,
        engineIntent,
        forkSemanticRng(resolutionRng, `commit:${currentRevision + 1}:${envelope.seat}:${envelope.intentId}`),
        manifest,
      );
      const engineRejection = events[0]?.type === 'INTENT_REJECTED' ? events[0] : null;
      if (events.length === 0 || engineRejection) {
        return storeRejection(key, illegalResult(
          envelope,
          currentRevision,
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
        receiptKey: key,
      });
      if (engineIntent.type === 'CONCEDE') {
        planning.P0 = [];
        planning.P1 = [];
        locked.P0 = false;
        locked.P1 = false;
      }
      publish(committed.timeline);
      return committed.result!;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return storeRejection(key, illegalResult(
        envelope,
        currentRevision,
        'RULES_INVALID',
        message,
      ));
    }
  };

  const drainQueue = (): void => {
    drainScheduled = false;
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const queued = queue.shift()!;
        const result = acceptAtDequeue(queued.envelope);
        queued.resolve(result);
        queued.after?.(result);
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
    const pending = new Promise<IntentAcceptanceResult>((resolveResult) => {
      queue.push({ envelope: copied, resolve: resolveResult });
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
    revision: () => currentRevision,
    transactions: () => committedTransactions,
    submitIntent,
    subscribeCommittedTransactions: (subscriber: MatchTransactionSubscriber) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    exportReplay: () => Object.freeze({
      version: 2 as const,
      genesis: genesisState,
      transactions: committedTransactions,
    }),
  });
}
