import type { Deck } from '../engine/manifest/types';
import type { CanonicalFrameTransition } from '../engine/transactionTimeline';
import type { Seat } from '../engine/types/ids';
import type { MatchIntent } from '../engine/types/intents';
import type { MatchState } from '../engine/types/state';
import type { CanonicalFrame } from '../engine/types/timeline';

/** Descriptive match modes. They do not select reducer rules in Phase 1. */
export type MatchMode = 'CONQUEST' | 'LADDER' | 'DEBUG';

/** Participant execution is session metadata, not reducer state. */
export type ParticipantController = 'LOCAL_HUMAN' | 'LOCAL_AI' | 'REMOTE_PLAYER';

export interface MatchParticipantBootstrap {
  readonly participantId: string;
  readonly controller: ParticipantController;
  readonly displayName: string;
  readonly avatarId?: string;
}

export interface DeckBootstrapBase<TEntry> {
  readonly deckId: string;
  readonly revision: number;
  readonly name: string;
  readonly entries: readonly TEntry[];
  readonly contentHash: string;
}

export interface PlayerDeckBootstrap
  extends DeckBootstrapBase<Deck[number]> {
  readonly kind: 'PLAYER';
}

export interface LocationCardDeckEntry {
  readonly defId: string;
}

export interface LocationDeckBootstrap
  extends DeckBootstrapBase<LocationCardDeckEntry> {
  readonly kind: 'LOCATION';
  readonly order: 'WEIGHTED_RANDOM';
}

export type MatchDeckSlot = Seat | 'LOCATIONS';

/**
 * Complete match-construction descriptor retained by MatchSession.
 * Mechanical projection into MatchState is deliberately a later checkpoint.
 */
export interface MatchBootstrap {
  readonly matchId: string;
  readonly mode: MatchMode;
  readonly seed: string;
  readonly rulesetId: string;
  readonly manifestVersion: number;
  readonly viewerSeat: Seat;
  readonly participants: Readonly<Record<Seat, MatchParticipantBootstrap>>;
  readonly decks: Readonly<{
    readonly P0: PlayerDeckBootstrap;
    readonly P1: PlayerDeckBootstrap;
    readonly LOCATIONS: LocationDeckBootstrap;
  }>;
}

/** Structural validation only. Collection ownership/possession is deferred. */
export type MatchBootstrapValidationIssueCode =
  | 'INVALID_BOOTSTRAP_SHAPE'
  | 'MANIFEST_VERSION_MISMATCH'
  | 'UNKNOWN_RULESET'
  | 'INVALID_DECK_SIZE'
  | 'UNKNOWN_CARD_DEFINITION'
  | 'DISABLED_CARD_DEFINITION'
  | 'UNKNOWN_CARD_VARIANT'
  | 'INVALID_LOCATION_DECK_SIZE'
  | 'UNKNOWN_LOCATION_DEFINITION'
  | 'DISABLED_LOCATION_DEFINITION'
  | 'PLAYER_CARD_IN_LOCATION_DECK'
  | 'LOCATION_CARD_IN_PLAYER_DECK'
  | 'UNIQUENESS_RULE_VIOLATION'
  | 'COPY_LIMIT_EXCEEDED'
  | 'CONTENT_HASH_MISMATCH';

export interface MatchBootstrapValidationIssue {
  readonly code: MatchBootstrapValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly seat?: Seat;
  readonly entryIndex?: number;
}

declare const validatedMatchBootstrapBrand: unique symbol;

/** Produced only after structural bootstrap validation and defensive copying. */
export type ValidatedMatchBootstrap = MatchBootstrap & {
  readonly [validatedMatchBootstrapBrand]: true;
};

export type MatchBootstrapValidationResult =
  | {
      readonly ok: true;
      readonly value: ValidatedMatchBootstrap;
    }
  | {
      readonly ok: false;
      readonly issues: readonly MatchBootstrapValidationIssue[];
    };

/** Non-negative revision of publicly committed authoritative match state. */
export type PublicRevision = number;

/** Non-negative revision of one seat's private staging/lock plan. */
export type PlanRevision = number;

export type SeatInteractionStatus =
  | 'PLANNING'
  | 'WAITING'
  | 'PRESENTING'
  | 'TERMINAL';

/**
 * Runtime payload corresponding to MatchIntent without client-authoritative
 * ownership or the duplicate intent identity already carried by the envelope.
 */
export type RuntimeIntent = MatchIntent extends infer Intent
  ? Intent extends MatchIntent
    ? Omit<Intent, 'intentId' | 'owner'>
    : never
  : never;

export interface IntentEnvelope<TIntent = RuntimeIntent> {
  readonly matchId: string;
  readonly seat: Seat;
  readonly intentId: string;
  readonly expectedPublicRevision: PublicRevision;
  readonly expectedPlanRevision: PlanRevision;
  readonly intentSeq?: number;
  readonly intent: TIntent;
}

export interface CommittedIntentIdentity {
  readonly matchId: string;
  readonly seat: Seat | 'SYSTEM';
  readonly intentId: string;
  readonly intentSeq?: number;
}

/**
 * Canonical append-only local transaction record. Durable backend storage is
 * a separate boundary.
 */
export interface CommittedTransactionRecord {
  readonly transactionId: string;
  readonly matchId: string;
  readonly baseRevision: PublicRevision;
  readonly revision: PublicRevision;
  readonly intent: CommittedIntentIdentity;
  /** Canonical committed event stream. Frames are match-global and contiguous. */
  readonly frames: readonly CanonicalFrame[];
  readonly rngDrawsBefore: number;
  readonly rngDrawsAfter: number;
}

/**
 * Canonical immutable event frame. Reducer snapshots must use structural
 * sharing: never deep-clone MatchState per frame or copy its canonical log.
 *
 * Interactive owners retain at most the bounded active transaction and must
 * release all frame references on completion, abort, fast-forward, reset,
 * disposal, unmount, and every other terminal presentation path. Replay
 * frames are generated lazily rather than retained with a live session.
 */
/**
 * A materialized canonical timeline is short-lived and transaction-scoped.
 * Consumers must follow CanonicalFrameTransition's release rules and may not retain it
 * as match history.
 */
export interface CommittedTransactionTimeline {
  readonly transaction: CommittedTransactionRecord;
  readonly transitions: readonly CanonicalFrameTransition[];
  readonly finalState: MatchState;
}

interface AcceptanceIdentity {
  readonly matchId: string;
  readonly seat: Seat;
  readonly intentId: string;
}

export interface AcceptedIntentResult extends AcceptanceIdentity {
  readonly status: 'accepted';
  readonly publicRevision: PublicRevision;
  readonly planRevision: PlanRevision;
  /** Private planning edits have no canonical transaction until both seats lock. */
  readonly commit: 'PRIVATE' | 'WAITING' | 'COMMITTED';
  readonly transaction?: CommittedTransactionRecord;
}

export type IntentIllegalityCode =
  | 'MATCH_MISMATCH'
  | 'SEAT_AUTHORITY'
  | 'TERMINAL_MATCH'
  | 'PHASE_INVALID'
  | 'RULES_INVALID';

export interface IllegalIntentResult extends AcceptanceIdentity {
  readonly status: 'illegal';
  readonly currentPublicRevision: PublicRevision;
  readonly currentPlanRevision: PlanRevision;
  readonly code: IntentIllegalityCode;
  readonly message?: string;
}

export interface StalePublicIntentResult extends AcceptanceIdentity {
  readonly status: 'stale-public';
  readonly expectedPublicRevision: PublicRevision;
  readonly currentPublicRevision: PublicRevision;
  readonly currentPlanRevision: PlanRevision;
  readonly resyncRequired: true;
}

export interface StalePlanIntentResult extends AcceptanceIdentity {
  readonly status: 'stale-plan';
  readonly expectedPlanRevision: PlanRevision;
  readonly currentPublicRevision: PublicRevision;
  readonly currentPlanRevision: PlanRevision;
}

/** Original receipt stored for a first-seen intent identity. */
export type IntentReceipt =
  | AcceptedIntentResult
  | StalePublicIntentResult
  | StalePlanIntentResult
  | IllegalIntentResult;

export interface DuplicateIntentResult extends AcceptanceIdentity {
  readonly status: 'duplicate';
  readonly original: IntentReceipt;
}

export type IntentAcceptanceResult = IntentReceipt | DuplicateIntentResult;

declare const intentReceiptKeyBrand: unique symbol;

/** Match-scoped key for (matchId, seat, intentId). Key construction is CP3. */
export type IntentReceiptKey = string & { readonly [intentReceiptKeyBrand]: true };

/** Local-only receipt storage. Durability, watermarks, and compaction are deferred. */
export type InMemoryIntentReceiptMap = Map<IntentReceiptKey, IntentReceipt>;

/** Runtime-owned replay records; transaction events never overlap genesis. */
export interface MatchRuntimeRecordExport {
  readonly version: 3;
  readonly genesis: MatchState;
  readonly transactions: readonly CommittedTransactionRecord[];
}

/** Session-owned replay export adds the retained descriptive bootstrap. */
export interface MatchRuntimeReplayExport extends MatchRuntimeRecordExport {
  readonly bootstrap: ValidatedMatchBootstrap;
}

/** Optional DEBUG-only evidence; never part of MatchState or canonical history. */
export interface DebugMatchCheckpoint {
  readonly frame: number;
  readonly rngDraws: number;
  readonly stateJson: string;
}
