import type { LocationAbilities } from '../manifest/types';

export const LOCATION_ABILITY_LABEL_BY_SLOT = {
  onReveal: 'ON_REVEAL',
  ongoing: 'ONGOING',
  atTurnStart: 'TURN_START',
  atTurnEnd: 'END_OF_TURN',
  onCardPlayedHere: 'AFTER_CARD_PLAYED_HERE',
  onCardEnteredHere: 'AFTER_CARD_ENTERED_HERE',
  onCardDestroyedHere: 'AFTER_CARD_DESTROYED_HERE',
} as const satisfies Readonly<Record<keyof LocationAbilities, string>>;

export type LocationAbilitySlot = keyof LocationAbilities;
export type LocationAbilityLabel =
  (typeof LOCATION_ABILITY_LABEL_BY_SLOT)[LocationAbilitySlot];

export function getLocationAbilityLabels(
  abilities: LocationAbilities | undefined,
): readonly LocationAbilityLabel[] {
  return (Object.keys(LOCATION_ABILITY_LABEL_BY_SLOT) as LocationAbilitySlot[])
    .filter((slot) => (abilities?.[slot]?.length ?? 0) > 0)
    .map((slot) => LOCATION_ABILITY_LABEL_BY_SLOT[slot]);
}
