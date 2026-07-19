import type {
  InternalCardRecord,
  MatchState,
  PowerLedgerEntry,
} from './types/state';
import type { CardId } from './types/ids';
import type { Manifest } from './manifest/types';
import { getCardRuntime } from './projections/cardRuntime';
import { getCardTemplate } from './projections/cardTemplate';

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
  card: Pick<InternalCardRecord, 'powerLedger'>,
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
  card: Pick<InternalCardRecord, 'powerLedger'>,
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
  const card = getCardRuntime(state, cardId, manifest);
  if (!card) return 0;
  const template = getCardTemplate(manifest, card.defId);
  if (!template || template.basePower === null) return 0;
  return storedPowerDelta(card, template.basePower);
}

export function effectivePermanentPowerDelta(
  card: Pick<InternalCardRecord, 'powerLedger'>,
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
