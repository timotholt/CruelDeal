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

/**
 * Public, stable labels for the semantic ability families a card currently
 * has. A card can expose any number of these labels.
 */
export const CARD_ABILITY_LABEL_BY_SLOT = {
  onReveal: 'ON_REVEAL',
  ongoing: 'ONGOING',
  activate: 'ACTIVATE',
  onEndOfTurn: 'END_OF_TURN',
  onTurnStart: 'TURN_START',
  onMove: 'WHEN_MOVED',
  onDestroyed: 'WHEN_DESTROYED',
  onDiscarded: 'WHEN_DISCARDED',
  onAnyCardPlayedHere: 'AFTER_CARD_PLAYED_HERE',
} as const satisfies Readonly<Record<CardAbilitySlot, string>>;

export type CardAbilityLabel =
  (typeof CARD_ABILITY_LABEL_BY_SLOT)[CardAbilitySlot];

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

export function getCardAbilityLabels(
  abilities: CardAbilities | undefined,
): readonly CardAbilityLabel[] {
  return CARD_ABILITY_SLOTS
    .filter((slot) => hasCardAbility(abilities, slot))
    .map((slot) => CARD_ABILITY_LABEL_BY_SLOT[slot]);
}
