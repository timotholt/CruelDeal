import type { EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { PendingEffectId } from '../types/ids';
import type { MatchState, PendingEffect } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import {
  type PendingEffectCommand,
  type PendingEffectEvent,
} from './operations/pendingEffect';

export type PendingEffectSemantics =
  | {
      readonly eventType: 'PENDING_EFFECT_SCHEDULED';
      readonly transitionKind: 'PENDING_SCHEDULED';
      readonly entityId: PendingEffectId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly priorPresent: false;
      readonly resultPresent: true;
      readonly priorSequence: number;
      readonly resultSequence: number;
      readonly effect: PendingEffect;
    }
  | {
      readonly eventType: 'PENDING_EFFECT_CONSUMED';
      readonly transitionKind: 'PENDING_CONSUMED';
      readonly entityId: PendingEffectId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly priorPresent: true;
      readonly resultPresent: false;
      readonly effect: PendingEffect;
    }
  | {
      readonly eventType: MatchEvent['type'];
      readonly transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT';
    };

export function capturePendingEffectSemantics(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
) {
  if (event.type === 'PENDING_EFFECT_SCHEDULED') {
    const priorPresent = before.pendingEffects.some(
      effect => effect.id === event.effect.id,
    );
    const result = after.pendingEffects.find(
      effect => effect.id === event.effect.id,
    );
    if (
      priorPresent
      || !result
      || after.nextPendingEffectSequence !==
        before.nextPendingEffectSequence + 1
    ) {
      return kernelStepFailure<PendingEffectSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'Pending schedule did not produce the declared transition.',
        sourceInstanceId: String(event.effect.id),
      });
    }
    return kernelStepSuccess<PendingEffectSemantics>({
      eventType: event.type,
      transitionKind: 'PENDING_SCHEDULED',
      entityId: event.effect.id,
      cause: { ...event.cause },
      reason: event.cause.reason,
      priorPresent: false,
      resultPresent: true,
      priorSequence: before.nextPendingEffectSequence,
      resultSequence: after.nextPendingEffectSequence,
      effect: structuredClone(result),
    });
  }

  if (event.type === 'PENDING_EFFECT_CONSUMED') {
    const prior = before.pendingEffects.find(
      effect => effect.id === event.pendingEffectId,
    );
    const resultPresent = after.pendingEffects.some(
      effect => effect.id === event.pendingEffectId,
    );
    if (!prior || resultPresent) {
      return kernelStepFailure<PendingEffectSemantics>({
        code: 'MISSING_SEMANTICS',
        message: 'Pending consumption did not produce the declared transition.',
        sourceInstanceId: String(event.pendingEffectId),
      });
    }
    return kernelStepSuccess<PendingEffectSemantics>({
      eventType: event.type,
      transitionKind: 'PENDING_CONSUMED',
      entityId: event.pendingEffectId,
      cause: { ...event.cause },
      reason: event.cause.reason,
      priorPresent: true,
      resultPresent: false,
      effect: structuredClone(prior),
    });
  }

  return kernelStepSuccess<PendingEffectSemantics>({
    eventType: event.type,
    transitionKind: 'ALREADY_RESOLVED_EFFECT_EVENT',
  });
}

export type { PendingEffectCommand, PendingEffectEvent };
