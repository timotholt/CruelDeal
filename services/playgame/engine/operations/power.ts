import { apply } from '../apply';
import type { Manifest } from '../manifest/types';
import { storedPowerDelta } from '../powerLedger';
import { isPowerBearingCard } from '../projections/power-bearing';
import { getCardPower } from '../projections/power';
import { isPowerIncreaseBlocked } from '../projections/power-restrictions';
import type { EffectRef } from '../types/ability';
import type { MatchEvent } from '../types/events';
import type { CardId } from '../types/ids';
import type { MatchState, PowerMutation } from '../types/state';

export interface PowerMutationResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

/**
 * The sole authoritative operation for permanent card-power mutations.
 * Policies are evaluated before the event is committed; the reducer only
 * records the accepted semantic mutation in the card's framed ledger.
 */
export function resolveCardPowerMutation(
  state: MatchState,
  cardId: CardId,
  mutation: PowerMutation,
  cause: EffectRef,
  manifest: Manifest,
): PowerMutationResult {
  if (!isPowerBearingCard(state, cardId, manifest)) {
    return { events: [], state };
  }
  const card = state.cards[cardId];
  const def = card ? manifest.cards[card.defId] : undefined;
  if (!card || !def || isNoOp(card, def.basePower, mutation)) {
    return { events: [], state };
  }

  const blocked = isPowerIncreaseBlocked(state, cardId, manifest);
  if (blocked && mutation.kind === 'ADD' && mutation.delta > 0) {
    return { events: [], state };
  }
  if (
    blocked
    && mutation.kind === 'SET'
    && mutation.value > getCardPower(state, cardId, manifest)
  ) {
    return { events: [], state };
  }

  const event: MatchEvent = {
    type: 'CARD_POWER_CHANGED',
    cardId,
    mutation,
    cause,
  };
  const candidate = apply(state, event, manifest);
  if (
    blocked
    && getCardPower(candidate, cardId, manifest) > getCardPower(state, cardId, manifest)
  ) {
    return { events: [], state };
  }

  return { events: [event], state: candidate };
}

export function resolveCardPowerAdd(
  state: MatchState,
  cardId: CardId,
  delta: number,
  cause: EffectRef,
  manifest: Manifest,
): PowerMutationResult {
  return resolveCardPowerMutation(
    state,
    cardId,
    { kind: 'ADD', delta },
    cause,
    manifest,
  );
}

function isNoOp(
  card: MatchState['cards'][CardId],
  basePower: number,
  mutation: PowerMutation,
): boolean {
  if (!card) return true;
  const storedDelta = storedPowerDelta(card, basePower);
  switch (mutation.kind) {
    case 'ADD':
      return mutation.delta === 0;
    case 'SET':
      return mutation.value === basePower + storedDelta;
    case 'RESET':
      return storedDelta === 0;
  }
}
