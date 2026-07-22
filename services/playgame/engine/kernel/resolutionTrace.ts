import type {
  AbilityRef,
  CanonicalEntityRef,
  EffectInvocationReason,
  EffectOutcomeReason,
  EffectTargetResult,
} from '../types/effectTrace';

/** Metadata returned by an EFFECT expansion. The kernel owns its ordinal. */
export interface KernelEffectInvocationDescriptor {
  readonly kind: 'EFFECT_INVOCATION';
  readonly source: CanonicalEntityRef;
  readonly ability: AbilityRef;
  readonly invocationReason: EffectInvocationReason;
  readonly candidates: readonly CanonicalEntityRef[];
}

/** Metadata returned by a governed COMMAND expansion. */
export interface KernelTargetAttemptDescriptor {
  readonly kind: 'TARGET_ATTEMPT';
  readonly operation: string;
  readonly target: CanonicalEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly CanonicalEntityRef[];
  readonly reason: EffectOutcomeReason | null;
}

export type KernelExpansionResolution =
  | KernelEffectInvocationDescriptor
  | KernelTargetAttemptDescriptor;

export interface KernelInvocationStarted {
  readonly kind: 'EFFECT_INVOCATION_STARTED';
  readonly invocationOrdinal: number;
  readonly parentInvocationOrdinal: number | null;
  readonly source: CanonicalEntityRef;
  readonly ability: AbilityRef;
  readonly invocationReason: EffectInvocationReason;
  readonly depth: number;
  readonly candidates: readonly CanonicalEntityRef[];
}

export interface KernelTargetResolved {
  readonly kind: 'EFFECT_TARGET_RESOLVED';
  readonly invocationOrdinal: number;
  readonly attemptOrdinal: number;
  readonly operation: string;
  readonly target: CanonicalEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly CanonicalEntityRef[];
  readonly reason: EffectOutcomeReason | null;
}

export interface KernelInvocationCompleted {
  readonly kind: 'EFFECT_INVOCATION_COMPLETED';
  readonly invocationOrdinal: number;
  readonly attempted: number;
  readonly affected: number;
  readonly blocked: number;
  readonly invalidated: number;
  readonly unchanged: number;
}

export type KernelEffectTraceEntry =
  | KernelInvocationStarted
  | KernelTargetResolved
  | KernelInvocationCompleted;

/**
 * Ordered successful kernel output. `transitionIndex` links a trace entry to
 * its committed fact without introducing Frames into the kernel.
 */
export interface KernelResolutionStep {
  readonly transitionIndex: number | null;
  readonly effect: KernelEffectTraceEntry | null;
}
