import type {
  CardInstance,
  MatchState,
  PowerLedgerEntry,
} from './types/state';
import type { CardId } from './types/ids';
import type { Manifest } from './manifest/types';

export interface ActivePowerContribution {
  readonly id: string;
  readonly delta: number;
  readonly entry: PowerLedgerEntry;
}

/**
 * Fold the authoritative semantic ledger into its currently active permanent
 * contributions. SET and RESET replace prior contributions without erasing
 * history.
 */
export function activePowerContributions(
  card: Pick<CardInstance, 'powerLedger'>,
  basePower: number,
): readonly ActivePowerContribution[] {
  let active: ActivePowerContribution[] = [];
  for (const entry of card.powerLedger) {
    switch (entry.mutation.kind) {
      case 'ADD':
        if (entry.mutation.delta !== 0) {
          active.push({ id: entry.id, delta: entry.mutation.delta, entry });
        }
        break;
      case 'SET': {
        const delta = entry.mutation.value - basePower;
        active = delta === 0 ? [] : [{ id: entry.id, delta, entry }];
        break;
      }
      case 'RESET':
        active = [];
        break;
    }
  }
  return active;
}

export function storedPowerDelta(
  card: Pick<CardInstance, 'powerLedger'>,
  basePower: number,
): number {
  return activePowerContributions(card, basePower)
    .reduce((total, contribution) => total + contribution.delta, 0);
}

/** Resolve one card's stored permanent delta from state and manifest. */
export function getStoredCardPowerDelta(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): number {
  const card = state.cards[cardId];
  if (!card) return 0;
  const definition = manifest.cards[card.defId];
  if (!definition) return 0;
  return storedPowerDelta(card, definition.basePower);
}

export function effectivePermanentPowerDelta(
  card: Pick<CardInstance, 'powerLedger'>,
  basePower: number,
  suppressPositive: boolean,
): number {
  return activePowerContributions(card, basePower).reduce(
    (total, contribution) => (
      suppressPositive && contribution.delta > 0
        ? total
        : total + contribution.delta
    ),
    0,
  );
}
