/**
 * engine — public surface.
 *
 * See `./README.md` for the purity contract (lint-enforced).
 * See `docs/spec-engine-isolation.md` for the architecture spec.
 *
 * Step 1 lands scaffolding and type surfaces. Every runtime function throws
 * "not implemented" until its implementation step arrives:
 *   - Step 2: Rng (createRng)
 *   - Step 3: populated manifest
 *   - Step 4: projections
 *   - Step 5: apply reducer
 *   - Step 6: canonical rules-command execution
 *   - Step 7: resolve (staging intents)
 *   - Step 8: resolveTurn
 */

// ---- Types -----------------------------------------------------------------
export type * from './types';

// ---- Manifest --------------------------------------------------------------
export type * from './manifest/types';
export { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';

// ---- RNG -------------------------------------------------------------------
export type { GameplayRngState, GameplayRngStep, Rng } from './rng';
export {
  advanceGameplayRng,
  createGameplayRngState,
  createRng,
  stepGameplayRng,
} from './rng';
export { appendGameplayRngAdvance } from './rng/transaction';

// ---- Reducer / resolvers ---------------------------------------------------
export { apply, applyFramed } from './apply';
export { resolve, resolveTurn } from './resolve';
export type { ResolveTurnResult } from './resolve';
export { buildOpeningTransaction } from './opening';
export { getFinalTurn } from './projections/gameEnd';
export {
  getCurrentCard,
  getAllCardIds,
  getCardDomain,
  getCardLifecycle,
  getCardRuntime,
  getCardsInZone,
  getCurrentCardAbilityEffects,
  getCurrentCardAbilityLabels,
  getEffectiveCardText,
  getAllCardTemplates,
  getCardTemplate,
  getCardTemplateAbilityLabels,
  getCardTemplateDomain,
  CARD_ABILITY_LABEL_BY_SLOT,
  CARD_ABILITY_SLOTS,
  getCardAbilityLabels,
  getAllLocationIds,
  getAllLocationTemplates,
  getLocationAbilityLabels,
  getLocationRuntime,
  getLocationTemplate,
  type CardAbilityLabel,
  type CardAbilitySlot,
  type CardLifecycle,
  type CardRuntime,
  type CardTemplate,
  type CurrentCard,
  type CurrentCardPosition,
  type EffectiveCardText,
  type CurrentLocationPosition,
  type LocationAbilityLabel,
  type LocationAbilitySlot,
  type LocationRuntime,
  type LocationTemplate,
} from './projections';
export {
  activeLaneIds,
  isActiveLane,
  laneStatus,
} from './laneTopology';
export {
  resolveRulesTransaction,
} from './kernel/rulesTransaction';
export type {
  CanonicalEffectContext,
  CanonicalRulesEffect,
  CanonicalRulesSemantics,
  CanonicalRulesWork,
  RulesCommand,
  RulesTransactionOptions,
  RulesTransactionResult,
} from './kernel/rulesTransaction';
export {
  assertFramedEventSequence,
  cardLifecycleFrames,
  currentFrame,
  frameEventSequence,
  frameSingleEvent,
  scopeAtFrame,
  turnAtFrame,
  turnSpans,
} from './timeline';
export {
  foldFramedEvents,
  frameAndFoldEvents,
} from './transactionTimeline';
export type {
  FoldFramedEventsOptions,
  FramedEventReducer,
  EventTransition,
  EventTransactionFold,
  FrameAndFoldEventsOptions,
} from './transactionTimeline';

// ---- Canonical rules interpreter ------------------------------------------
export { executeRulesCommands } from './effects/rulesInterpreter';

// ---- CLI (headless match driver) -----------------------------------------
export {
  createInitialMatchState,
  createMatchGenesis,
  createSetupMatch,
  type CreatedMatchSetup,
} from './cli/initState';
export {
  buildLocationSetupTransaction,
  type LocationSetupDeck,
  type LocationSetupTransaction,
} from './locationSetup';
export { runMatch, type RunMatchOptions, type RunMatchResult } from './cli/runMatch';
export {
  replayMatch,
  replayBundle,
  assertReplayBundle,
  exportReplayBundle,
  validateReplayBundle,
  type ReplayBundle,
  type ReplayStep,
  type ReplayResult,
  type ReplayMatchOptions,
  type ReplayValidationResult,
  type ExportReplayBundleOptions,
} from './replay';

// ---- Projections -----------------------------------------------------------
export * as projections from './projections';
