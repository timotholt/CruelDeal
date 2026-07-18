import type { CardAbilities } from '../manifest/types';

/**
 * Canonical list of every card ability slot.
 *
 * Keep ability-presence checks routed through this module so manifest queries
 * and runtime Selector predicates cannot silently disagree about what counts
 * as "an ability".
 */
export const CARD_ABILITY_SLOTS = [
  'onReveal',
  'ongoing',
  'activate',
  'onEndOfTurn',
  'onTurnStart',
  'onMove',
  'onDestroyed',
  'onDiscarded',
  'onAnyCardPlayedHere',
] as const satisfies readonly (keyof CardAbilities)[];

export type CardAbilitySlot = typeof CARD_ABILITY_SLOTS[number];

export function hasCardAbility(
  abilities: CardAbilities | undefined,
  slot: CardAbilitySlot,
): boolean {
  return (abilities?.[slot]?.length ?? 0) > 0;
}

export function hasAnyCardAbility(
  abilities: CardAbilities | undefined,
  excludedSlots: readonly CardAbilitySlot[] = [],
): boolean {
  return CARD_ABILITY_SLOTS.some(
    (slot) => !excludedSlots.includes(slot) && hasCardAbility(abilities, slot),
  );
}
