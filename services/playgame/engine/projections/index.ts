/**
 * Projections — pure query functions over MatchState + Manifest.
 *
 * The projection layer is the ONLY place Ongoing effects are computed.
 * `apply()` never derives anything; projections re-read the world on demand.
 * See spec §5.
 */

export { getCardPower, getCardPowerModifiers, getLanePower, getLanePowerBreakdown } from './power';
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
export type { PriorityResult } from './priority';
export { collectAllOngoings, ongoingsTargeting } from './ongoing';
export { select, evalPredicate } from './select';
export { evalNum } from './numexpr';
export type { SourcedOngoing, EvalCtx } from './context';
