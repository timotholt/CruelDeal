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
export { apply } from './apply';
export { resolve, resolveTurn } from './resolve';
export type { ResolveTurnResult } from './resolve';
export { buildEventTransactionFrames } from './transactionFrames';
export type {
  BuildEventTransactionFramesOptions,
  EventTransactionFrames,
  TransactionFrame,
} from './transactionFrames';

// ---- Evaluator (usually consumed indirectly via resolveTurn) --------------
export { revealPlayedCard, forceRevealPlayedCard, triggerOnReveal, evalEffect, MAX_REVEAL_RECURSION } from './effects/evaluator';

// ---- CLI (headless match driver) -----------------------------------------
export { createInitialMatchState } from './cli/initState';
export { runMatch, type RunMatchOptions, type RunMatchResult } from './cli/runMatch';
export {
  replayMatch,
  replayBundle,
  assertReplayBundle,
  exportReplayBundle,
  validateReplayBundle,
  type ReplayBundle,
  type ReplayFrame,
  type ReplayResult,
  type ReplayMatchOptions,
  type ReplayValidationResult,
} from './replay';

// ---- Projections -----------------------------------------------------------
export * as projections from './projections';
