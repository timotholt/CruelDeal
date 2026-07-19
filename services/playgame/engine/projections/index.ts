/**
 * Projections — pure query functions over MatchState + Manifest.
 *
 * The projection layer is the ONLY place Ongoing effects are computed.
 * `apply()` never derives anything; projections re-read the world on demand.
 * See spec §5.
 */

export { getCardPower, getCardPowerModifiers, getLanePower, getLanePowerBreakdown } from './power';
export {
  getCurrentCard,
  type CurrentCard,
} from './card';
export {
  getAllCardIds,
  getCardDomain,
  getCardLifecycle,
  getCardPlacement,
  getCardRuntime,
  getCardsInZone,
  getCurrentCardAbilityEffects,
  getCurrentCardAbilityLabels,
  getEffectiveCardText,
  type CardLifecycle,
  type CardPlacement,
  type CardRuntime,
  type CurrentCardPosition,
  type EffectiveCardText,
} from './cardRuntime';
export {
  getAllCardTemplates,
  getCardTemplate,
  getCardTemplateAbilityLabels,
  getCardTemplateDomain,
  type CardTemplate,
} from './cardTemplate';
export {
  CARD_ABILITY_LABEL_BY_SLOT,
  CARD_ABILITY_SLOTS,
  getCardAbilityLabels,
  hasAnyCardAbility,
  hasCardAbility,
  type CardAbilityLabel,
  type CardAbilitySlot,
} from './abilityPresence';
export {
  LOCATION_ABILITY_LABEL_BY_SLOT,
  getLocationAbilityLabels,
  type LocationAbilityLabel,
  type LocationAbilitySlot,
} from './locationAbilityPresence';
export {
  getAllLocationTemplates,
  getLocationTemplate,
  type LocationTemplate,
} from './locationTemplate';
export {
  getAllLocationIds,
  getAllLocationStates,
  getLocationRuntime,
  getLocationState,
  redactLocationsForSeat,
  type CurrentLocationPosition,
  type LocationRuntime,
  type LocationState,
} from './locationRuntime';
export { isPowerBearingCard, isPowerBearingDef } from './power-bearing';
export type {
  PowerModifierEntry,
  LaneCardContribution,
  LanePowerAddEntry,
  LanePowerMultiplierEntry,
  LanePowerBreakdown,
} from './power';
export { getCardCost, getCardCostModifiers } from './cost';
export type { CostModifierEntry } from './cost';
export { getOnRevealMultiplier, isOnRevealDisabled } from './reveal';
export { getPriority } from './priority';
export { getFinalTurn } from './gameEnd';
export type { PriorityResult } from './priority';
export { collectAllOngoings, ongoingsTargeting } from './ongoing';
export { select, evalPredicate } from './select';
export { evalNum } from './numexpr';
export type { SourcedOngoing, EvalCtx } from './context';
