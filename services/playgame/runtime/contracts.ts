import type { Deck } from '../engine/manifest/types';
import type { MatchEvent } from '../engine/types/events';
import type { Seat } from '../engine/types/ids';
import type { MatchIntent } from '../engine/types/intents';
import type { MatchState } from '../engine/types/state';

/** Descriptive match modes. They do not select reducer rules in Phase 1. */
export type MatchMode = 'CONQUEST' | 'LADDER';

/** Participant execution is session metadata, not reducer state. */
export type ParticipantController = 'LOCAL_HUMAN' | 'LOCAL_AI' | 'REMOTE_PLAYER';

export interface MatchParticipantBootstrap {
  readonly participantId: string;
  readonly controller: ParticipantController;
  readonly displayName: string;
  readonly avatarId?: string;
}

export interface MatchDeckBootstrap {
  readonly deckId: string;
  readonly revision: number;
  readonly name: string;
  readonly entries: Deck;
  readonly contentHash: string;
}

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
  readonly decks: Readonly<Record<Seat, MatchDeckBootstrap>>;
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

/** Non-negative, monotonically increasing committed transaction revision. */
export type MatchRevision = number;

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
  readonly expectedRevision: MatchRevision;
  readonly intentSeq?: number;
  readonly intent: TIntent;
}

export interface CommittedIntentIdentity {
  readonly matchId: string;
  readonly seat: Seat;
  readonly intentId: string;
  readonly intentSeq?: number;
}

/**
 * Canonical append-only local transaction record. Persisted checksums and
 * durable atomic storage are deferred; their fields are reserved here.
 */
export interface CommittedTransactionRecord {
  readonly transactionId: string;
  readonly matchId: string;
  readonly baseRevision: MatchRevision;
  readonly revision: MatchRevision;
  readonly intent: CommittedIntentIdentity;
  readonly events: readonly MatchEvent[];
  readonly preStateChecksum?: string;
  readonly postStateChecksum?: string;
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
export interface MatchEventFrame {
  readonly transactionId: string;
  readonly index: number;
  readonly event: MatchEvent;
  readonly before: MatchState;
  readonly after: MatchState;
}

/**
 * A materialized canonical timeline is short-lived and transaction-scoped.
 * Consumers must follow MatchEventFrame's release rules and may not retain it
 * as match history.
 */
export interface MatchTransactionFrames {
  readonly transaction: CommittedTransactionRecord;
  readonly frames: readonly MatchEventFrame[];
  readonly finalState: MatchState;
}

interface AcceptanceIdentity {
  readonly matchId: string;
  readonly seat: Seat;
  readonly intentId: string;
}

export interface AcceptedIntentResult extends AcceptanceIdentity {
  readonly status: 'accepted';
  readonly revision: MatchRevision;
  readonly transaction: CommittedTransactionRecord;
}

export type IntentIllegalityCode =
  | 'MATCH_MISMATCH'
  | 'SEAT_AUTHORITY'
  | 'TERMINAL_MATCH'
  | 'PHASE_INVALID'
  | 'RULES_INVALID';

export interface IllegalIntentResult extends AcceptanceIdentity {
  readonly status: 'illegal';
  readonly currentRevision: MatchRevision;
  readonly code: IntentIllegalityCode;
  readonly message?: string;
}

export interface StaleIntentResult extends AcceptanceIdentity {
  readonly status: 'stale';
  readonly expectedRevision: MatchRevision;
  readonly currentRevision: MatchRevision;
}

/** Original receipt stored for a first-seen intent identity. */
export type IntentReceipt = AcceptedIntentResult | StaleIntentResult | IllegalIntentResult;

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
