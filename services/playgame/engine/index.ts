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
 *   - Step 6: revealPlayedCard / triggerOnReveal + evalEffect
 *   - Step 7: resolve (staging intents)
 *   - Step 8: resolveTurn
 */

// ---- Types -----------------------------------------------------------------
export type * from './types';

// ---- Manifest --------------------------------------------------------------
export type * from './manifest/types';
export { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';

// ---- RNG -------------------------------------------------------------------
export type { Rng } from './rng';
export { createRng } from './rng';

// ---- Reducer / resolvers ---------------------------------------------------
export { apply, applyFramed } from './apply';
export { resolve, resolveTurn } from './resolve';
export type { ResolveTurnResult } from './resolve';
export {
  activeLaneIds,
  addLocationTag,
  changeLocationCounter,
  createLane,
  destroyLocationCard,
  isActiveLane,
  laneOccupantIds,
  laneStatus,
  MAXIMUM_ACTIVE_LANES,
  MINIMUM_ACTIVE_LANES,
  moveLocation,
  removeLocation,
  removeLocationTag,
  replaceLocationCard,
  returnLocationToDeck,
  revealLocation,
  RUIN_LOCATION_DEF_ID,
  scheduleLocationSlotReveal,
  showLocationToSeats,
  swapLocations,
  turnLocationFaceDown,
  validateLaneTopology,
} from './locationLifecycle';
export type {
  CreateLaneOptions,
  DestroyLaneOptions,
  LocationLifecycleFailure,
  LocationLifecycleResult,
  ReplaceLocationCardOptions,
} from './locationLifecycle';
export {
  destroyAllOtherLanesWithNormalRules as destroyAllOtherLanes,
  destroyLaneWithNormalRules as destroyLane,
} from './effects/evaluator';
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
  EventTransition,
  EventTransactionFold,
  FrameAndFoldEventsOptions,
} from './transactionTimeline';

// ---- Evaluator (usually consumed indirectly via resolveTurn) --------------
export { revealPlayedCard, forceRevealPlayedCard, triggerOnReveal, evalEffect, MAX_REVEAL_RECURSION } from './effects/evaluator';

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
} from './replay';

// ---- Projections -----------------------------------------------------------
export * as projections from './projections';
