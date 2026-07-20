import type { EffectRef } from '../types/ability';
import type { Owner } from '../types/ids';
import type { EnergyReason, MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import {
  type EnergyChangedEvent,
} from './operations/energy';
import type { ChangeEnergyCommand } from './types';

export interface EnergySnapshot {
  readonly current: number;
  readonly maximum: number;
  readonly nextTurnBonus: number;
}

export interface EnergySemantics {
  readonly eventType: EnergyChangedEvent['type'];
  readonly transitionKind:
    | 'CURRENT_ENERGY_INCREASE'
    | 'CURRENT_ENERGY_DECREASE'
    | 'CURRENT_ENERGY_PAYMENT_RECORDED'
    | 'MAXIMUM_ENERGY_INCREASE'
    | 'MAXIMUM_ENERGY_DECREASE'
    | 'NEXT_TURN_BONUS_INCREASE'
    | 'NEXT_TURN_BONUS_DECREASE';
  readonly affectedOwner: Owner;
  readonly target: ChangeEnergyCommand['target'];
  readonly cause: EffectRef;
  readonly reason: EnergyReason;
  readonly prior: EnergySnapshot;
  readonly result: EnergySnapshot;
  readonly signedChange: number;
}

function snapshotEnergy(state: MatchState, owner: Owner): EnergySnapshot {
  return {
    current: state.energy[owner],
    maximum: state.maxEnergy[owner],
    nextTurnBonus: state.nextTurnEnergyBonus[owner],
  };
}

function targetForEvent(
  event: EnergyChangedEvent,
): ChangeEnergyCommand['target'] {
  switch (event.type) {
    case 'ENERGY_CHANGED':
      return 'CURRENT';
    case 'MAX_ENERGY_CHANGED':
      return 'MAXIMUM';
    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      return 'NEXT_TURN_BONUS';
  }
}

function valueAtTarget(
  snapshot: EnergySnapshot,
  target: ChangeEnergyCommand['target'],
): number {
  switch (target) {
    case 'CURRENT':
      return snapshot.current;
    case 'MAXIMUM':
      return snapshot.maximum;
    case 'NEXT_TURN_BONUS':
      return snapshot.nextTurnBonus;
  }
}

function transitionKind(
  target: ChangeEnergyCommand['target'],
  signedChange: number,
): EnergySemantics['transitionKind'] {
  if (target === 'CURRENT') {
    if (signedChange === 0) {
      return 'CURRENT_ENERGY_PAYMENT_RECORDED';
    }
    return signedChange > 0
      ? 'CURRENT_ENERGY_INCREASE'
      : 'CURRENT_ENERGY_DECREASE';
  }
  if (target === 'MAXIMUM') {
    return signedChange > 0
      ? 'MAXIMUM_ENERGY_INCREASE'
      : 'MAXIMUM_ENERGY_DECREASE';
  }
  return signedChange > 0
    ? 'NEXT_TURN_BONUS_INCREASE'
    : 'NEXT_TURN_BONUS_DECREASE';
}

export function captureEnergySemantics(
  before: MatchState,
  event: EnergyChangedEvent,
  after: MatchState,
) {
  const target = targetForEvent(event);
  const prior = snapshotEnergy(before, event.owner);
  const result = snapshotEnergy(after, event.owner);
  const signedChange = valueAtTarget(result, target) - valueAtTarget(prior, target);
  const unchangedTargets = (
    (target === 'CURRENT' || prior.current === result.current)
    && (target === 'MAXIMUM' || prior.maximum === result.maximum)
    && (
      target === 'NEXT_TURN_BONUS'
      || prior.nextTurnBonus === result.nextTurnBonus
    )
  );
  if (signedChange !== event.delta || !unchangedTargets) {
    return kernelStepFailure<EnergySemantics>({
      code: 'MISSING_SEMANTICS',
      message: 'Energy commit changed an unexpected resource or amount.',
      sourceInstanceId: event.owner,
    });
  }

  return kernelStepSuccess<EnergySemantics>({
    eventType: event.type,
    transitionKind: transitionKind(target, signedChange),
    affectedOwner: event.owner,
    target,
    cause: { ...event.cause },
    reason: event.reason,
    prior,
    result,
    signedChange,
  });
}

export type { EnergyChangedEvent };
