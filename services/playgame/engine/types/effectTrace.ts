import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
} from './ids';

declare const effectInvocationIdBrand: unique symbol;
declare const effectAttemptIdBrand: unique symbol;

export type EffectInvocationId = string & {
  readonly [effectInvocationIdBrand]: true;
};

export type EffectAttemptId = string & {
  readonly [effectAttemptIdBrand]: true;
};

export function effectInvocationId(
  transactionId: string,
  invocationOrdinal: number,
): EffectInvocationId {
  if (transactionId.trim().length === 0) {
    throw new Error('Effect invocation transactionId must be non-empty.');
  }
  if (!Number.isSafeInteger(invocationOrdinal) || invocationOrdinal < 0) {
    throw new Error('Effect invocation ordinal must be a non-negative safe integer.');
  }
  return `${transactionId}:invoke:${invocationOrdinal}` as EffectInvocationId;
}

export function effectAttemptId(
  invocationId: EffectInvocationId,
  attemptOrdinal: number,
): EffectAttemptId {
  if (!Number.isSafeInteger(attemptOrdinal) || attemptOrdinal < 0) {
    throw new Error('Effect attempt ordinal must be a non-negative safe integer.');
  }
  return `${invocationId}:attempt:${attemptOrdinal}` as EffectAttemptId;
}

export type CanonicalEntityRef =
  | { readonly kind: 'CARD'; readonly cardId: CardId }
  | {
      readonly kind: 'LOCATION';
      readonly locationId: LocationCardInstanceId;
    }
  | { readonly kind: 'LANE'; readonly laneId: LaneId }
  | { readonly kind: 'PLAYER'; readonly owner: Owner }
  | {
      readonly kind: 'ZONE';
      readonly owner: Owner | null;
      readonly zone: string;
    }
  | { readonly kind: 'SYSTEM'; readonly systemId: string };

export interface AbilityRef {
  readonly kind:
    | 'ON_REVEAL'
    | 'ONGOING'
    | 'TRIGGERED'
    | 'LOCATION'
    | 'SPELL'
    | 'SYSTEM';
  readonly ruleId: string;
  readonly ruleIndex: number;
}

export type EffectInvocationReason =
  | 'NATURAL'
  | 'RETRIGGER'
  | 'REACTION'
  | 'SCHEDULED'
  | 'SYSTEM';

export const EFFECT_TARGET_RESULTS = [
  'AFFECTED',
  'BLOCKED',
  'INVALIDATED',
  'NO_CHANGE',
] as const;

export type EffectTargetResult = (typeof EFFECT_TARGET_RESULTS)[number];

export const EFFECT_OUTCOME_REASONS = [
  'CANNOT_BE_DESTROYED',
  'CANNOT_BE_MOVED',
  'CANNOT_GAIN_POWER',
  'CANNOT_LOSE_POWER',
  'CANNOT_BE_REVEALED',
  'LANE_FULL',
  'HAND_FULL',
  'EMPTY_DECK',
  'TARGET_LEFT_ZONE',
  'TARGET_NO_LONGER_MATCHES',
  'SOURCE_INACTIVE',
  'ALREADY_SATISFIED',
  'EMPTY_SELECTION',
  'RULE_REPLACED_OPERATION',
  'OTHER_RULE',
] as const;

export type EffectOutcomeReason = (typeof EFFECT_OUTCOME_REASONS)[number];

export interface EffectInvocationStarted {
  readonly kind: 'EFFECT_INVOCATION_STARTED';
  readonly invocationId: EffectInvocationId;
  readonly parentInvocationId: EffectInvocationId | null;
  readonly source: CanonicalEntityRef;
  readonly ability: AbilityRef;
  readonly invocationReason: EffectInvocationReason;
  readonly depth: number;
  readonly candidates: readonly CanonicalEntityRef[];
}

export interface EffectTargetResolved {
  readonly kind: 'EFFECT_TARGET_RESOLVED';
  readonly invocationId: EffectInvocationId;
  readonly attemptId: EffectAttemptId;
  readonly attemptOrdinal: number;
  readonly candidateOrdinal: number;
  readonly operation: string;
  readonly target: CanonicalEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly CanonicalEntityRef[];
  readonly reason: EffectOutcomeReason | null;
}

export interface EffectInvocationCompleted {
  readonly kind: 'EFFECT_INVOCATION_COMPLETED';
  readonly invocationId: EffectInvocationId;
  readonly attempted: number;
  readonly affected: number;
  readonly blocked: number;
  readonly invalidated: number;
  readonly unchanged: number;
}

export type EffectTraceEntry =
  | EffectInvocationStarted
  | EffectTargetResolved
  | EffectInvocationCompleted;
